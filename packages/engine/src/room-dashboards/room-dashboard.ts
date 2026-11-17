/** Private, per-origin room presentation. HA paths never belong to portable projects. */
export interface RoomDashboardSettings {
  controls: "cabane" | "home-assistant";
  view: string; // "automatic", or a canonical root-relative HA view path.
  appearance: "original" | "cabane";
}

export const DEFAULT_ROOM_DASHBOARD: RoomDashboardSettings = {
  controls: "cabane",
  view: "automatic",
  appearance: "cabane",
};

/** Accept a pasted HA URL, but store only its path, without auth or query material. */
export function normalizeDashboardViewPath(value: string, origin: string): string | null {
  try {
    const input = value.trim();
    if (!input.startsWith("/") && !/^https?:\/\//i.test(input)) return null;
    const url = new URL(input, origin);
    if (
      url.origin !== new URL(origin).origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname === "/" ||
      /^\/(cabane|auth|api|config|local)(\/|$)/i.test(decodeURIComponent(url.pathname))
    )
      return null;
    return url.pathname;
  } catch {
    return null;
  }
}

export function isRoomDashboardSettings(value: unknown): value is RoomDashboardSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    Object.keys(item).every((key) => ["controls", "view", "appearance"].includes(key)) &&
    (item.controls === "cabane" || item.controls === "home-assistant") &&
    (item.appearance === "original" || item.appearance === "cabane") &&
    typeof item.view === "string" &&
    (item.view === "automatic" ||
      normalizeDashboardViewPath(item.view, "https://ha.invalid") === item.view)
  );
}

export const roomDashboardPath = (
  settings: RoomDashboardSettings,
  areaId?: string,
): string | null =>
  settings.view === "automatic"
    ? areaId
      ? `/home/areas-${encodeURIComponent(areaId)}`
      : null
    : settings.view;

export function retainRoomDashboards(
  settings: Readonly<Record<string, RoomDashboardSettings>> | undefined,
  roomIds: ReadonlySet<string>,
) {
  return settings === undefined
    ? {}
    : {
        roomDashboards: Object.fromEntries(
          Object.entries(settings).filter(([id]) => roomIds.has(id)),
        ),
      };
}
