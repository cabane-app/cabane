import { MeasurementText } from "@cabane/engine";
import { displayLength, parseLength, lengthUnit, useMeasurementUnits } from "@cabane/engine";
import { nicheDepthLimit, type EditorNiche } from "@cabane/engine";
import { LengthInput } from "../../editor-chrome/LengthInput";
import { EditorButton } from "../../editor-chrome/EditorButton";
import { CommittedTextInput } from "./CommittedTextInput";
import type { ConstructEditorController } from "./construct-controller-contract";

export function NicheProperties({
  niche,
  editor,
}: {
  niche: EditorNiche;
  editor: ConstructEditorController;
}) {
  const units = useMeasurementUnits();
  const depthLimit = nicheDepthLimit(editor.draft, niche.wallId);
  return (
    <>
      <fieldset>
        <legend>Dimensions</legend>
        <label>
          Width
          <LengthInput
            label="Niche width"
            value={niche.widthPlanUnits * editor.draft.coordinates.metersPerPlanUnit}
            min={0.05}
            step={0.01}
            commitOnChange
            onCommit={(width) =>
              editor.updateSelectedOpening({
                widthPlanUnits: width / editor.draft.coordinates.metersPerPlanUnit,
              })
            }
          />
        </label>
        <label>
          Height
          <LengthInput
            label="Niche height"
            value={niche.openingHeightMeters}
            min={0.05}
            step={0.01}
            commitOnChange
            onCommit={(openingHeightMeters) =>
              editor.updateSelectedOpening({ openingHeightMeters })
            }
          />
        </label>
        <label>
          Depth
          <LengthInput
            label="Niche depth"
            value={niche.depthMeters}
            min={0.01}
            max={depthLimit}
            step={0.01}
            commitOnChange
            onCommit={(depthMeters) =>
              editor.replaceSelectedOpening({
                ...niche,
                depthMeters: Math.min(depthLimit, depthMeters),
              })
            }
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>Placement</legend>
        <label className="construction-inspector__single-control">
          Height from floor
          <LengthInput
            label="Niche height from floor"
            value={niche.sillHeightMeters}
            min={0.012}
            step={0.01}
            commitOnChange
            onCommit={(sillHeightMeters) => editor.updateSelectedOpening({ sillHeightMeters })}
          />
        </label>
        <EditorButton variant="text" onClick={() => editor.reorientOpening(niche.id, "side")}>
          Switch wall face
        </EditorButton>
      </fieldset>
      <details className="selection-details-advanced">
        <summary>Shelves</summary>
        <label className="construction-inspector__single-control">
          Heights ({lengthUnit(units)})
          <CommittedTextInput
            label="Niche shelf heights"
            value={(niche.shelfHeightsMeters ?? [])
              .map((height) => Number(displayLength(height, units).toFixed(4)))
              .join(", ")}
            onCommit={(text) => {
              const heights = text
                ? text.split(",").map((value) => parseLength(value.trim(), units))
                : [];
              if (
                heights.every(
                  (height) =>
                    Number.isFinite(height) && height > 0 && height < niche.openingHeightMeters,
                )
              )
                editor.replaceSelectedOpening({ ...niche, shelfHeightsMeters: heights });
            }}
          />
        </label>
        <label className="construction-inspector__single-control">
          Thickness
          <LengthInput
            label="Niche shelf thickness"
            value={niche.shelfThicknessMeters ?? 0.025}
            min={0.005}
            step={0.005}
            onCommit={(shelfThicknessMeters) =>
              editor.replaceSelectedOpening({ ...niche, shelfThicknessMeters })
            }
          />
        </label>
      </details>
      {editor.openingError && (
        <p role="alert">
          <MeasurementText>{editor.openingError}</MeasurementText>
        </p>
      )}
    </>
  );
}
