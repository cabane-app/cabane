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
  sameFloor = false,
  canConnectFloors = true,
  onConnectionChange,
  issues = [],
  onChange,
  onCancel,
}: {
  shape: StairShape;
  style: StairStyle;
  onStyleChange: (style: StairStyle) => void;
  sameFloor?: boolean;
  canConnectFloors?: boolean;
  onConnectionChange?: (connection: "floors" | "surfaces") => void;
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
            aria-pressed={!sameFloor}
            disabled={!canConnectFloors}
            title={!canConnectFloors ? "Add a floor above to connect two floors." : undefined}
            onClick={() => onConnectionChange("floors")}
          >
            Between floors
          </button>
          <button
            type="button"
            aria-pressed={sameFloor}
            onClick={() => onConnectionChange("surfaces")}
          >
            Same floor
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
        {sameFloor && shape !== "spiral"
          ? shape === "l-shaped" || shape === "u-shaped"
            ? "Click the starting surface, the turn, then the destination. Height follows both surfaces. Escape cancels."
            : "Click or drag between two surfaces. Floors, terraces and terrain are detected automatically. Escape cancels."
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
