import { useRef } from "react";
import type { ManifestIssue, StairShape, StairStyle } from "@cabane/engine";
import { StairStyleSelect } from "./StairStyleSelect";
import { StairWarnings } from "./StairWarnings";
import { EditorButton } from "../editor-chrome/EditorButton";
import {
  ModelThumbnail,
  ModelThumbnailRenderer,
} from "../editor-preview/furnish/catalog/ModelThumbnailRenderer";
import { stairPreviewEntriesForStyle } from "./stair-preview-entries";
import "../editor-preview/furnish/catalog/arrange-catalog.css";
import "../editor-preview/construct/door-preset-palette.css";
import "./stair-connection-picker.css";

export function StairPlacementPanel({
  shape,
  style,
  onStyleChange,
  terrain = false,
  canConnectFloors = true,
  canConnectTerrain = true,
  onConnectionChange,
  issues = [],
  onChange,
  onCancel,
}: {
  shape: StairShape;
  style: StairStyle;
  onStyleChange: (style: StairStyle) => void;
  terrain?: boolean;
  canConnectFloors?: boolean;
  canConnectTerrain?: boolean;
  onConnectionChange?: (connection: "floors" | "terrain") => void;
  issues?: readonly ManifestIssue[];
  onChange: (shape: StairShape) => void;
  onCancel: () => void;
}) {
  const scrollRoot = useRef<HTMLDivElement>(null);
  return (
    <section className="construction-inspector__selection" aria-label="Staircase">
      <header>
        <h3>Staircase</h3>
      </header>
      {onConnectionChange && (
        <div className="stair-connection-picker" role="group" aria-label="Stair connection">
          <button
            type="button"
            aria-pressed={!terrain}
            disabled={!canConnectFloors}
            title={!canConnectFloors ? "Add a floor above to connect two floors." : undefined}
            onClick={() => onConnectionChange("floors")}
          >
            Between floors
          </button>
          <button
            type="button"
            aria-pressed={terrain}
            disabled={!canConnectTerrain}
            title={
              !canConnectTerrain ? "Set apartment floor to 0 to connect to the ground." : undefined
            }
            onClick={() => onConnectionChange("terrain")}
          >
            To ground
          </button>
        </div>
      )}
      <StairStyleSelect value={style} onChange={onStyleChange} />
      <ModelThumbnailRenderer scrollRoot={scrollRoot} enabled>
        <div
          className="floor-finish-palette__grid door-preset-palette__grid"
          ref={scrollRoot}
          role="group"
          aria-label="Stair shape"
        >
          {stairPreviewEntriesForStyle(style).map(({ shape: value, label, entry }) => (
            <button
              type="button"
              key={value}
              aria-label={label}
              aria-pressed={shape === value}
              onClick={() => onChange(value)}
            >
              <ModelThumbnail
                entry={entry}
                showAdd={false}
                fallback={<span>Preview unavailable</span>}
              />
              <small>{label}</small>
            </button>
          ))}
        </div>
      </ModelThumbnailRenderer>
      <p className="construction-inspector__tool-hint" role="status">
        {terrain && shape !== "spiral"
          ? shape === "l-shaped" || shape === "u-shaped"
            ? "Click the floor landing, the turn, then the ground endpoint. Height follows the terrain. Escape cancels."
            : "Draw from the floor landing to the ground endpoint. Height follows the terrain. Escape cancels."
          : shape === "spiral"
            ? "Click the center, then the outer edge to set diameter and rotation. Escape cancels."
            : shape === "l-shaped" || shape === "u-shaped"
              ? "Click the bottom, landing center, then the upper endpoint. Escape cancels."
              : "Drag from bottom to top, or click each endpoint. Escape cancels."}
      </p>
      <StairWarnings issues={issues} compact />
      <EditorButton variant="text" onClick={onCancel}>
        Cancel stairs
      </EditorButton>
    </section>
  );
}
