import { normalizeDashboardViewPath } from "./room-dashboard";

export interface DashboardViewOption {
  path: string;
  label: string;
}
interface DashboardPanel {
  component_name?: string;
  title?: string | null;
}
interface DashboardConfig {
  views?: { path?: string; title?: string }[];
  strategy?: unknown;
}
type Sender = <T>(message: { type: string; [key: string]: unknown }) => Promise<T>;

/** Dashboard lists include views whose dashboards are hidden from the HA sidebar. */
export async function discoverDashboardViews(send: Sender, origin: string) {
  const [panels, dashboards] = await Promise.allSettled([
    send<Record<string, DashboardPanel>>({ type: "get_panels" }),
    send<{ url_path: string; title: string }[]>({ type: "lovelace/dashboards/list" }),
  ]);
  if (panels.status === "rejected" && dashboards.status === "rejected") throw panels.reason;
  const targets = new Map<string, string>();
  if (panels.status === "fulfilled")
    for (const [key, panel] of Object.entries(panels.value)) {
      if (panel.component_name === "lovelace" && key !== "home")
        targets.set(key, panel.title || (key === "lovelace" ? "Overview" : key));
    }
  if (dashboards.status === "fulfilled")
    for (const dashboard of dashboards.value) targets.set(dashboard.url_path, dashboard.title);
  let failed = panels.status === "rejected" || dashboards.status === "rejected";
  const defaultView = (key: string, title: string) => {
    const target =
      key === "lovelace" && panels.status === "fulfilled" && panels.value.home
        ? "/home/overview"
        : `/${key}/0`;
    const path = normalizeDashboardViewPath(target, origin);
    return path ? [{ path, label: `${title} → Default view` }] : [];
  };
  const groups = await Promise.all(
    [...targets].map(async ([key, title]) => {
      try {
        const config = await send<DashboardConfig>({
          type: "lovelace/config",
          url_path: key === "lovelace" ? null : key,
        });
        if (!config.views && config.strategy) return defaultView(key, title);
        return (config.views ?? []).flatMap((view, index) => {
          const path = normalizeDashboardViewPath(`/${key}/${view.path ?? index}`, origin);
          const pageName = view.title?.trim() || view.path?.trim() || `Page ${index + 1}`;
          return path ? [{ path, label: `${title} → ${pageName}` }] : [];
        });
      } catch (error) {
        // HA generates the default view in its frontend until a dashboard is customized.
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "config_not_found"
        )
          return defaultView(key, title);
        failed = true;
        return [];
      }
    }),
  );
  const unique = new Map<string, DashboardViewOption>();
  for (const view of groups.flat()) if (!unique.has(view.path)) unique.set(view.path, view);
  const labelCounts = new Map<string, number>();
  for (const view of unique.values())
    labelCounts.set(view.label, (labelCounts.get(view.label) ?? 0) + 1);
  return {
    views: [...unique.values()]
      .map((view) => ({
        ...view,
        label: labelCounts.get(view.label)! > 1 ? `${view.label} (${view.path})` : view.label,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    automatic: panels.status === "fulfilled" && Boolean(panels.value.home),
    error: failed ? "Some dashboards could not be read. You can enter their view URL." : null,
  };
}
