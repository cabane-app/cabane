import { useEffect, useRef, useState } from "react";
import { useHomeAssistantHostSession } from "../HomeAssistantHostSession";
import { useHomeAssistantRuntime } from "../HomeAssistantRuntimeContext";
import { attachDashboardAppearance } from "./embedded-dashboard";
import {
  normalizeDashboardViewPath,
  roomDashboardPath,
  type RoomDashboardSettings,
} from "./room-dashboard";
import { useDashboardViews } from "./useDashboardViews";
import "./room-dashboard.css";

export function HaRoomDashboard({
  settings,
  areaId,
  roomName,
  onCabaneControls,
}: {
  settings: RoomDashboardSettings;
  areaId: string | undefined;
  roomName: string;
  onCabaneControls: () => void;
}) {
  const runtime = useHomeAssistantRuntime();
  const host = useHomeAssistantHostSession();
  const discovery = useDashboardViews(settings.view === "automatic");
  const missingArea =
    settings.view === "automatic" &&
    areaId &&
    !runtime.areas.some((area) => area.area_id === areaId);
  const path = missingArea ? null : roomDashboardPath(settings, areaId);
  const origin = runtime.origin;
  const sameOrigin = Boolean(host && origin === host.origin && window.location.origin === origin);
  const automaticUnavailable =
    settings.view === "automatic" && !discovery.loading && !discovery.automatic;
  const canEmbed =
    sameOrigin &&
    runtime.status === "connected" &&
    runtime.canMutate &&
    path &&
    !automaticUnavailable;
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const frame = useRef<HTMLIFrameElement>(null);
  const url = origin && path ? `${origin}${path}` : null;
  useEffect(() => {
    setState("loading");
    if (!canEmbed) return;
    let detach = () => {};
    if (loaded)
      try {
        const doc = frame.current?.contentDocument;
        if (doc && normalizeDashboardViewPath(doc.location.href, origin!) !== null)
          detach = attachDashboardAppearance(doc, settings.appearance === "cabane", () =>
            setState(doc.location.pathname === path ? "ready" : "error"),
          );
        else setState("error");
      } catch {
        setState("error");
      }
    const timeout = window.setTimeout(
      () => setState((current) => (current === "ready" ? current : "error")),
      15_000,
    );
    return () => {
      window.clearTimeout(timeout);
      detach();
    };
  }, [canEmbed, loaded, settings.appearance, url, origin, path]);
  const message = missingArea
    ? "The mapped Home Assistant area is unavailable. Choose another area or dashboard view in Connect."
    : !path
      ? "Map this room to a Home Assistant area in Connect, or choose a dashboard view."
      : runtime.status !== "connected"
        ? "Reconnect to Home Assistant to use this dashboard."
        : !runtime.canMutate
          ? "Open the saved home to use the Home Assistant dashboard."
          : automaticUnavailable
            ? "This Home Assistant version does not provide automatic room pages. Choose a dashboard view in Connect."
            : state === "error"
              ? "The dashboard could not be displayed. Open it in Home Assistant, or retry."
              : "Loading Home Assistant dashboard…";
  return (
    <section className="ha-room-dashboard" aria-label={`${roomName} Home Assistant dashboard`}>
      <div className="ha-room-dashboard__actions">
        <button type="button" onClick={onCabaneControls}>
          Show Cabane room controls
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open in HA
          </a>
        )}
      </div>
      {(!canEmbed || state !== "ready") && (
        <div className="ha-room-dashboard__notice" role="status">
          <p>{message}</p>
          {canEmbed && state === "error" && (
            <button
              type="button"
              onClick={() => {
                setState("loading");
                setLoaded(0);
                setReload((value) => value + 1);
              }}
            >
              Retry dashboard
            </button>
          )}
        </div>
      )}
      {canEmbed && (
        <iframe
          key={`${url}:${reload}`}
          ref={frame}
          src={url!}
          title={`${roomName} Home Assistant dashboard`}
          className="ha-room-dashboard__frame"
          hidden={state === "error"}
          onLoad={() => setLoaded((value) => value + 1)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          allow="fullscreen"
        />
      )}
    </section>
  );
}
