import { EditorButton } from "../../editor-chrome/EditorButton";
import { FloorFinishPalette } from "./FloorFinishPalette";
import { PlatformEdgeFields } from "./PlatformEdgeFields";
import type { FloorPaintingInspector, FloorPaintTarget } from "./floor-painting-contract";
import type { ConstructEditorController } from "./useConstructEditor";
import "./floor-tool-properties.css";

const targets = [
  { id: "room", label: "Whole room", description: "Change an existing room’s finish." },
  { id: "custom-area", label: "Custom area", description: "Draw a finish area or a ground path." },
] as const;
const instructions: Record<FloorPaintTarget, string> = {
  room: "Choose a finish, then click a room.",
  "custom-area":
    "Click corners, then return to the first point to close the area. Start inside a room for an inset, or outside for a ground patch.",
  "outdoor-platform":
    "Click corners, then return to the first point to close the platform. House walls and doorways stay clear.",
};

/** One stable panel owns all Floor modes; changing the target never reorders controls. */
export function FloorToolProperties({
  editor,
  painting,
}: {
  editor: ConstructEditorController;
  painting: FloorPaintingInspector;
}) {
  const isPlatform = editor.tool === "platform";
  const target = isPlatform ? "outdoor-platform" : painting.target;
  const settings = editor.platformSettings;
  const error = isPlatform ? editor.poolDrawing.error : painting.drawingError;
  return (
    <div className="construction-inspector__selection floor-tool-properties">
      <header>
        <h3>{isPlatform ? "Outdoor space" : "Floor tool"}</h3>
      </header>
      {!isPlatform && (
        <div className="floor-tool-targets" role="group" aria-label="Paint target">
          {targets.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-label={option.label}
              aria-pressed={target === option.id}
              onClick={() => painting.onTargetChange(option.id)}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      )}
      <p className="construction-inspector__tool-hint">{instructions[target]}</p>
      <fieldset>
        <legend>Floor finish</legend>
        <FloorFinishPalette
          value={isPlatform ? settings.finish : painting.finish}
          onChange={(finish) =>
            isPlatform
              ? editor.setPlatformSettings({ ...settings, finish })
              : painting.onFinishChange(finish)
          }
        />
      </fieldset>
      {isPlatform && (
        <fieldset>
          <legend>Exposed edges</legend>
          <PlatformEdgeFields
            value={settings.defaultEdge}
            onChange={(defaultEdge) => editor.setPlatformSettings({ ...settings, defaultEdge })}
          />
        </fieldset>
      )}
      {error && <p role="alert">{error}</p>}
      {isPlatform ? (
        <EditorButton variant="secondary" type="button" onClick={() => editor.setTool("select")}>
          Cancel outdoor space
        </EditorButton>
      ) : (
        painting.drawingActive && (
          <EditorButton variant="secondary" type="button" onClick={painting.onCancelDrawing}>
            Cancel area
          </EditorButton>
        )
      )}
    </div>
  );
}
