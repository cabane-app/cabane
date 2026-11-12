import { dashboardCabaneStyles, dashboardNavigationStyles } from "./embedded-dashboard-styles";

/** Observe new HA cards and shadow roots, without polling state or touching HA's saved theme. */
export function attachDashboardAppearance(
  doc: Document,
  matchCabane: boolean,
  onReady: () => void,
) {
  const view = doc.defaultView;
  if (!view) return () => undefined;
  const sheets: HTMLStyleElement[] = [];
  const observed = new WeakSet<Document | ShadowRoot>();
  let disposed = false;
  let frame = 0;
  let ready = false;
  const observer = new view.MutationObserver(() => {
    if (!frame && !disposed) frame = view.requestAnimationFrame(scan);
  });
  const visit = (root: Document | ShadowRoot) => {
    if (!observed.has(root)) {
      observed.add(root);
      const style = doc.createElement("style");
      style.textContent = dashboardNavigationStyles + (matchCabane ? dashboardCabaneStyles : "");
      (root instanceof view.Document ? root.head : root).append(style);
      sheets.push(style);
      observer.observe(root, { childList: true, subtree: true });
    }
    if (
      !ready &&
      root.querySelector("hui-view, hui-sections-view, hui-masonry-view, hui-panel-view")
    ) {
      ready = true;
      onReady();
    }
    for (const element of root.querySelectorAll("*"))
      if (element.shadowRoot) visit(element.shadowRoot);
  };
  function scan() {
    frame = 0;
    if (!disposed) visit(doc);
  }
  scan();
  // Lit can attach an initial shadow root without a light-DOM mutation.
  const startup = view.setInterval(() => {
    if (!ready) scan();
  }, 250);
  const stopStartup = view.setTimeout(() => view.clearInterval(startup), 15_000);
  return () => {
    disposed = true;
    observer.disconnect();
    view.cancelAnimationFrame(frame);
    view.clearInterval(startup);
    view.clearTimeout(stopStartup);
    for (const sheet of sheets) sheet.remove();
  };
}
