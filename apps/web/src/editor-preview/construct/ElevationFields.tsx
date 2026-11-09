import type { ElevationSettings, Polygon } from "@cabane/engine";
import { LengthInput } from "../../editor-chrome/LengthInput";
import { areaElevation, withEdgeTransition } from "./elevation-editing";
import "./elevation-controls.css";

export function ElevationFields({
  id,
  polygon,
  value,
  indoor = false,
  selectedEdge = null,
  onSelectEdge,
  onChange,
}: {
  id: string;
  polygon: Polygon;
  value: ElevationSettings | undefined;
  indoor?: boolean;
  selectedEdge?: number | null;
  onSelectEdge: (index: number | null) => void;
  onChange: (value: ElevationSettings) => void;
}) {
  const settings = areaElevation(id, polygon, value);
  const edge = selectedEdge === null ? null : settings.edges[selectedEdge];
  const transition = edge?.transition;
  const minX = Math.min(...polygon.map((p) => p[0])),
    minY = Math.min(...polygon.map((p) => p[1]));
  const scale =
    72 / Math.max(0.01, ...polygon.map((p) => p[0] - minX), ...polygon.map((p) => p[1] - minY));
  const points = polygon.map((p) => [14 + (p[0] - minX) * scale, 14 + (p[1] - minY) * scale]);
  const allKind = settings.edges.every(
    (e) => (e.transition?.kind ?? "sharp") === (settings.edges[0]?.transition?.kind ?? "sharp"),
  )
    ? (settings.edges[0]?.transition?.kind ?? "sharp")
    : null;
  const firstSlope = settings.edges.find((e) => e.transition?.kind === "sloped")?.transition;
  const slopeWidth =
    transition?.kind === "sloped"
      ? transition.widthMeters
      : firstSlope?.kind === "sloped"
        ? firstSlope.widthMeters
        : 1;
  const kind = edge ? (transition?.kind ?? "sharp") : allKind;
  return (
    <div className="elevation-controls">
      <section className="elevation-controls__section" aria-label="Area elevation">
        <h4>Elevation</h4>
        <label className="elevation-controls__value">
          <span>Floor level</span>
          <LengthInput
            label="Floor level"
            value={settings.offsetMeters}
            step={0.01}
            onCommit={(offsetMeters) => onChange({ ...settings, offsetMeters })}
          />
        </label>
        <p className="elevation-controls__hint">
          {settings.offsetMeters < 0 ? "Below" : settings.offsetMeters > 0 ? "Above" : "Level with"}{" "}
          the storey floor. Drag the height handle in 3D to adjust.
        </p>
      </section>
      <section className="elevation-controls__section" aria-label="Edge transition">
        <h4>Transition</h4>
        <div className="elevation-controls__boundary">
          <svg
            viewBox="0 0 100 100"
            role="group"
            aria-label="Choose an edge"
            className="elevation-controls__footprint"
          >
            <polygon
              points={points.map((p) => p.join(",")).join(" ")}
              fill="currentColor"
              fillOpacity="0.08"
            />
            {points.map((p, i) => {
              const q = points[(i + 1) % points.length];
              return (
                <g key={settings.edges[i]?.id ?? i}>
                  <line
                    x1={p[0]}
                    y1={p[1]}
                    x2={q[0]}
                    y2={q[1]}
                    className={selectedEdge === i || selectedEdge === null ? "is-selected" : ""}
                  />
                  <rect
                    x={0}
                    y={-7}
                    width={Math.hypot(q[0] - p[0], q[1] - p[1])}
                    height={14}
                    transform={`translate(${p[0]} ${p[1]}) rotate(${(Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI})`}
                    className="elevation-controls__edge-hit"
                    role="button"
                    tabIndex={0}
                    aria-label={`Select edge ${i + 1}`}
                    aria-pressed={selectedEdge === i}
                    onClick={() => onSelectEdge(i)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectEdge(i);
                      }
                    }}
                  />
                </g>
              );
            })}
          </svg>
          <div>
            <strong>{selectedEdge === null ? "Whole boundary" : `Selected edge`}</strong>
            <p className="elevation-controls__hint">Select an edge here or in the scene.</p>
            {selectedEdge !== null && (
              <button
                type="button"
                className="elevation-controls__text-button"
                onClick={() => onSelectEdge(null)}
              >
                Apply to all edges
              </button>
            )}
          </div>
        </div>
        <div className="elevation-controls__choices" role="group" aria-label="Transition style">
          {(["sharp", "sloped"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={kind === choice}
              onClick={() =>
                onChange(
                  withEdgeTransition(
                    settings,
                    selectedEdge,
                    choice === "sharp"
                      ? { kind: "sharp" }
                      : { kind: "sloped", widthMeters: slopeWidth },
                  ),
                )
              }
            >
              <svg viewBox="0 0 48 24" aria-hidden="true">
                <path d={choice === "sharp" ? "M3 5H23V19H45" : "M3 5H15L33 19H45"} />
              </svg>
              <span>{choice === "sharp" ? "Vertical" : "Slope"}</span>
            </button>
          ))}
        </div>
        {kind === "sloped" && (
          <label className="elevation-controls__value">
            <span>Slope width</span>
            <LengthInput
              label="Slope width"
              min={0.05}
              step={0.1}
              value={slopeWidth}
              onCommit={(widthMeters) =>
                onChange(
                  withEdgeTransition(settings, selectedEdge, { kind: "sloped", widthMeters }),
                )
              }
            />
          </label>
        )}
        {kind === null && (
          <p className="elevation-controls__hint">
            Mixed transitions. Select an edge to edit it individually.
          </p>
        )}
      </section>
      {indoor && (
        <details className="elevation-controls__ceiling">
          <summary>Ceiling</summary>
          <p className="elevation-controls__hint">
            Keep the existing ceiling, or set a height above this area.
          </p>
          <label className="elevation-controls__check">
            <input
              type="checkbox"
              checked={settings.ceilingHeightMeters !== undefined}
              onChange={(event) => {
                const { ceilingHeightMeters: _height, ...rest } = settings;
                onChange(event.target.checked ? { ...settings, ceilingHeightMeters: 2.5 } : rest);
              }}
            />
            Set a local ceiling height
          </label>
          {settings.ceilingHeightMeters !== undefined && (
            <label className="elevation-controls__value">
              <span>Headroom</span>
              <LengthInput
                label="Ceiling height above area"
                min={0.1}
                step={0.05}
                value={settings.ceilingHeightMeters}
                onCommit={(ceilingHeightMeters) => onChange({ ...settings, ceilingHeightMeters })}
              />
            </label>
          )}
        </details>
      )}
    </div>
  );
}
