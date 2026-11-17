import { useId, useState } from "react";
import { useHomeAssistantRuntime } from "../HomeAssistantRuntimeContext";
import {
  DEFAULT_ROOM_DASHBOARD,
  normalizeDashboardViewPath,
  roomDashboardPath,
  type RoomDashboardSettings as Settings,
} from "./room-dashboard";
import { useDashboardViews } from "./useDashboardViews";
import "./room-dashboard-settings.css";

export function RoomDashboardSettings({
  value = DEFAULT_ROOM_DASHBOARD,
  areaId,
  onChange,
}: {
  value: Settings | undefined;
  areaId: string | undefined;
  onChange: (settings: Settings) => void;
}) {
  const runtime = useHomeAssistantRuntime();
  const id = useId();
  const areaName = runtime.areas.find((area) => area.area_id === areaId)?.name;
  const enabled = value.controls === "home-assistant";
  const discovery = useDashboardViews(enabled);
  const [custom, setCustom] = useState(false);
  const [input, setInput] = useState(value.view === "automatic" ? "" : value.view);
  const [error, setError] = useState<string | null>(null);
  const path = roomDashboardPath(value, areaId);
  const change = (patch: Partial<Settings>) => onChange({ ...value, ...patch });
  return (
    <section className="room-dashboard-settings" aria-label="Room panel settings">
      <fieldset className="room-panel-choice">
        <legend>Room panel</legend>
        <p>Choose what opens when you select this room.</p>
        <label className="room-panel-choice__option">
          <input
            type="radio"
            name={`${id}-controls`}
            value="cabane"
            checked={!enabled}
            aria-labelledby={`${id}-cabane`}
            onChange={() => change({ controls: "cabane" })}
          />
          <span>
            <strong id={`${id}-cabane`}>Cabane room controls</strong>
            <small>Controls for the devices you connect in Cabane.</small>
          </span>
        </label>
        <label className="room-panel-choice__option">
          <input
            type="radio"
            name={`${id}-controls`}
            value="home-assistant"
            checked={enabled}
            aria-labelledby={`${id}-ha`}
            onChange={() => change({ controls: "home-assistant" })}
          />
          <span>
            <strong id={`${id}-ha`}>Home Assistant dashboard</strong>
            <small>An existing HA view, with its cards and layout.</small>
          </span>
        </label>
      </fieldset>
      {enabled && (
        <div className="room-dashboard-settings__view">
          <label>
            Dashboard page
            <select
              value={custom ? "custom" : value.view}
              onChange={(event) => {
                setError(null);
                setCustom(event.target.value === "custom");
                if (event.target.value !== "custom") change({ view: event.target.value });
              }}
            >
              <option value="automatic">
                {areaName ? `Mapped HA room: ${areaName}` : "Mapped HA room (automatic)"}
              </option>
              {value.view !== "automatic" &&
                !discovery.views.some((view) => view.path === value.view) && (
                  <option value={value.view}>{value.view} (saved view)</option>
                )}
              {discovery.views.map((view) => (
                <option key={view.path} value={view.path}>
                  {view.label}
                </option>
              ))}
              <option value="custom">Enter a dashboard view URL…</option>
            </select>
          </label>
          {custom && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const normalized =
                  runtime.origin && normalizeDashboardViewPath(input, runtime.origin);
                if (!normalized) {
                  setError(
                    "Use a view URL from this Home Assistant server, without query parameters or a fragment.",
                  );
                  return;
                }
                change({ view: normalized });
                setCustom(false);
                setError(null);
              }}
            >
              <label>
                Dashboard view URL
                <input
                  type="text"
                  value={input}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="/dashboard-home/kitchen"
                />
              </label>
              <button type="submit">Use this view</button>
            </form>
          )}
          {error && (
            <p role="alert" id={`${id}-error`}>
              {error}
            </p>
          )}
          {discovery.loading && <p role="status">Loading dashboard views…</p>}
          {discovery.error && (
            <p role="status">
              {discovery.error}{" "}
              <button type="button" onClick={discovery.retry}>
                Retry
              </button>
            </p>
          )}
          {value.view === "automatic" && (
            <p>
              {!areaId
                ? "Choose a Home Assistant area above, or select a custom view."
                : !discovery.loading && !discovery.automatic
                  ? "Automatic room pages are unavailable on this Home Assistant version. Choose a custom view."
                  : `Opens Home Assistant’s room page${areaName ? ` for ${areaName}` : " for the mapped area"}. Choose another view to use a custom dashboard.`}
            </p>
          )}
          {runtime.origin && path && (
            <a href={`${runtime.origin}${path}`} target="_blank" rel="noopener noreferrer">
              Preview this view in Home Assistant
            </a>
          )}
          <label>
            Appearance
            <select
              value={value.appearance}
              onChange={(event) =>
                change({ appearance: event.target.value as Settings["appearance"] })
              }
            >
              <option value="cabane">Cabane palette</option>
              <option value="original">Original HA theme</option>
            </select>
          </label>
          <p>
            Changes the embedded view’s colors, without changing your HA theme. Some custom cards
            keep their own styling.
          </p>
        </div>
      )}
    </section>
  );
}
