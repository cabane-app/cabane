import { formatArea, useMeasurementUnits } from "@cabane/engine";
import { LengthInput } from "../../editor-chrome/LengthInput";
import { EditorIcon } from "../../editor-chrome/EditorIcon";
import { EditorButton } from "../../editor-chrome/EditorButton";
import {
  mapPoolOutline,
  polygonSignedArea,
  type OutdoorPlatformSpec,
  type OutdoorPlatformEdgeConfiguration,
  type PlanPoint,
} from "@cabane/engine";

import { PlatformRoomFields } from "./PlatformRoomFields";
import { FloorFinishPalette } from "./FloorFinishPalette";
import { PlatformEdgeFields } from "./PlatformEdgeFields";
import type { ConstructEditorController } from "./useConstructEditor";
import "./floor-tool-properties.css";

export function PlatformProperties({
  platform,
  editor,
}: {
  platform: OutdoorPlatformSpec;
  editor: ConstructEditorController;
}) {
  const units = useMeasurementUnits();
  const edge = platform.edges.find((candidate) => candidate.id === editor.selectedPlatformEdgeId);
  const area =
    Math.abs(polygonSignedArea(platform.polygon)) * editor.draft.coordinates.metersPerPlanUnit ** 2;
  const updateOutline = (points: readonly PlanPoint[]) => {
    if (points.length < 3) return;
    const [first, second, third, ...rest] = points;
    editor.updatePlatform(platform.id, { polygon: [first, second, third, ...rest] });
  };
  const updateEdge = (configuration: OutdoorPlatformEdgeConfiguration) => {
    if (edge) {
      editor.updatePlatform(platform.id, {
        edges: platform.edges.map((candidate) =>
          candidate.id === edge.id ? { ...candidate, configuration } : candidate,
        ),
      });
    } else {
      editor.updatePlatform(platform.id, { defaultEdge: configuration });
    }
  };
  const resetEdge = () =>
    editor.updatePlatform(platform.id, {
      edges: platform.edges.map((candidate) =>
        candidate.id === edge?.id ? { id: candidate.id } : candidate,
      ),
    });
  const addCorner = () => {
    if (!edge) return;
    const index = platform.edges.indexOf(edge);
    const from = platform.polygon[index];
    const to = platform.polygon[(index + 1) % platform.polygon.length];
    updateOutline([
      ...platform.polygon.slice(0, index + 1),
      [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
      ...platform.polygon.slice(index + 1),
    ]);
  };

  return (
    <div className="construction-inspector__selection">
      <p className="editor-property-fact">
        Area <strong>{formatArea(area, units)}</strong>
      </p>
      <p className="construction-inspector__tool-hint">
        Drag the platform to move it, or a corner to reshape it. Select an edge to change its style.
      </p>
      <PlatformRoomFields
        platform={platform}
        onChange={(changes) => editor.updatePlatform(platform.id, changes)}
      />
      <fieldset>
        <legend>Edges</legend>
        <label>
          Apply to
          <select
            aria-label="Platform edge"
            value={edge?.id ?? ""}
            onChange={(event) =>
              event.target.value
                ? editor.selectPlatformEdge(platform.id, event.target.value)
                : editor.selectPlatform(platform.id)
            }
          >
            <option value="">Default style</option>
            {platform.edges.map((candidate, index) => (
              <option key={candidate.id} value={candidate.id}>
                Edge {index + 1}
              </option>
            ))}
          </select>
        </label>
        <PlatformEdgeFields
          value={edge?.configuration ?? platform.defaultEdge}
          onChange={updateEdge}
        />
      </fieldset>
      {edge?.configuration && (
        <EditorButton variant="secondary" type="button" onClick={resetEdge}>
          Use default edge style
        </EditorButton>
      )}
      {edge && (
        <EditorButton variant="secondary" type="button" onClick={addCorner}>
          Add corner on edge
        </EditorButton>
      )}
      <fieldset>
        <legend>Floor finish</legend>
        <FloorFinishPalette
          value={platform.finish}
          onChange={(finish) => editor.updatePlatform(platform.id, { finish })}
        />
      </fieldset>
      <fieldset className="platform-corners">
        <legend>Corners</legend>
        {platform.polygon.map((point, index) => (
          <div key={index} className="platform-corner-row">
            <span className="platform-corner-number" aria-label={`Corner ${index + 1}`}>
              {index + 1}
            </span>
            {([0, 1] as const).map((axis) => (
              <label key={axis}>
                {axis === 0 ? "X" : "Y"}
                <LengthInput
                  metersPerUnit={editor.draft.coordinates.metersPerPlanUnit}
                  label={`Platform corner ${index + 1} ${axis === 0 ? "X" : "Y"}`}
                  value={point[axis]}
                  step={0.1}
                  onCommit={(value) =>
                    editor.updatePlatform(platform.id, {
                      polygon: mapPoolOutline(platform.polygon, (candidate, cornerIndex) =>
                        cornerIndex === index
                          ? axis === 0
                            ? [value, candidate[1]]
                            : [candidate[0], value]
                          : candidate,
                      ),
                    })
                  }
                />
              </label>
            ))}
            {platform.polygon.length > 3 && (
              <EditorButton
                variant="text"
                type="button"
                className="platform-corner-remove"
                aria-label={`Remove corner ${index + 1}`}
                title={`Remove corner ${index + 1}`}
                onClick={() =>
                  updateOutline(platform.polygon.filter((_, cornerIndex) => cornerIndex !== index))
                }
              >
                <EditorIcon name="delete" />
              </EditorButton>
            )}
          </div>
        ))}
      </fieldset>
      <fieldset>
        <legend>Actions</legend>
        <div className="construction-inspector__room-actions">
          <EditorButton variant="text" type="button" onClick={editor.deleteSelected}>
            Delete platform
          </EditorButton>
        </div>
      </fieldset>
    </div>
  );
}
