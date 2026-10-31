import { CommittedTextInput } from "./CommittedTextInput";
import { LengthInput } from "../../editor-chrome/LengthInput";
import type { ReactNode } from "react";
import { OpeningColorControls } from "./OpeningColorControls";
import { omitUndefinedProperties } from "@cabane/engine";
import { doorConfiguration, doorFromConfiguration } from "@cabane/engine";
import { DoorPresetPalette } from "./DoorPresetPalette";
import { DoorDesignFields } from "./DoorDesignFields";
import type { EditorOpening } from "@cabane/engine";
import { CommittedNumberInput } from "../../editor-chrome/CommittedNumberInput";
import type { ConstructEditorController } from "./useConstructEditor";

export function OpeningProperties({
  opening: selectedOpening,
  editor,
  advanced,
  orientationControls,
}: {
  opening: EditorOpening;
  editor: ConstructEditorController;
  advanced?: boolean;
  orientationControls?: ReactNode;
}) {
  const wallPosition = (
    <fieldset>
      <legend>Wall position</legend>
      <label>
        Offset
        <LengthInput
          metersPerUnit={editor.draft.coordinates.metersPerPlanUnit}
          label="Opening wall offset"
          min={0}
          value={selectedOpening.offsetPlanUnits}
          onCommit={(offsetPlanUnits) => editor.updateSelectedOpening({ offsetPlanUnits })}
        />
      </label>
      <label>
        Wall
        <input
          aria-label="Opening wall identifier"
          type="text"
          value={selectedOpening.wallId}
          readOnly
        />
      </label>
    </fieldset>
  );
  return (
    <>
      <fieldset>
        <legend>Name</legend>
        <CommittedTextInput
          key={selectedOpening.id}
          label="Opening name"
          value={selectedOpening.name ?? ""}
          placeholder={selectedOpening.id}
          onCommit={(name) => {
            const { name: _name, ...opening } = selectedOpening;
            editor.replaceSelectedOpening({ ...opening, ...(name ? { name } : {}) });
          }}
        />
      </fieldset>
      <fieldset>
        <legend>Dimensions</legend>
        <label>
          Width
          <LengthInput
            label="Opening width"
            commitOnChange
            min={0.3}
            value={
              selectedOpening.widthPlanUnits * editor.previewFloor.coordinates.metersPerPlanUnit
            }
            onCommit={(value) =>
              editor.updateSelectedOpening({
                widthPlanUnits: value / editor.previewFloor.coordinates.metersPerPlanUnit,
              })
            }
          />
        </label>
        <label>
          Height
          <LengthInput
            label="Opening height"
            commitOnChange
            min={0.3}
            value={selectedOpening.openingHeightMeters}
            onCommit={(value) => editor.updateSelectedOpening({ openingHeightMeters: value })}
          />
        </label>
      </fieldset>
      {orientationControls}
      {selectedOpening.kind !== "passage" && (
        <OpeningColorControls opening={selectedOpening} onChange={editor.replaceSelectedOpening} />
      )}
      {selectedOpening.kind === "window" && (
        <label className="construction-inspector__single-control">
          Height from floor
          <LengthInput
            label="Window height from floor"
            min={0}
            value={selectedOpening.sillHeightMeters}
            onCommit={(value) => editor.updateSelectedOpening({ sillHeightMeters: value })}
          />
        </label>
      )}
      {selectedOpening.kind === "door" &&
        (() => {
          const scale = editor.previewFloor.coordinates.metersPerPlanUnit;
          const value = doorConfiguration(
            { ...selectedOpening, offsetFromWallStartPlanUnits: selectedOpening.offsetPlanUnits },
            scale,
          );
          const apply = (configuration: typeof value) => {
            const { offsetFromWallStartPlanUnits, ...door } = doorFromConfiguration(
              configuration,
              scale,
              {
                id: selectedOpening.id,
                wallId: selectedOpening.wallId,
                offsetFromWallStartPlanUnits: selectedOpening.offsetPlanUnits,
              },
            );
            editor.replaceSelectedOpening({
              ...door,
              ...(selectedOpening.name ? { name: selectedOpening.name } : {}),
              offsetPlanUnits: offsetFromWallStartPlanUnits,
            });
          };
          return (
            <>
              <DoorPresetPalette value={value} onChange={apply} />
              <DoorDesignFields value={value} onChange={apply} showSize={false} />
            </>
          );
        })()}
      {selectedOpening.kind === "window" && (
        <fieldset className="construction-inspector__variants">
          <legend>Window design</legend>
          <label>
            Motion
            <select
              aria-label="Window operation"
              value={selectedOpening.operation}
              onChange={(event) =>
                editor.replaceSelectedOpening({
                  ...selectedOpening,
                  operation: event.target.value as typeof selectedOpening.operation,
                })
              }
            >
              <option value="fixed">Fixed</option>
              <option value="casement">Casement</option>
            </select>
          </label>
          <label>
            Style
            <select
              aria-label="Window style"
              value={selectedOpening.variant}
              onChange={(event) => {
                const variant = event.target.value as typeof selectedOpening.variant;
                editor.replaceSelectedOpening(
                  omitUndefinedProperties({
                    ...selectedOpening,
                    variant,
                    muntins:
                      variant === "muntined"
                        ? (selectedOpening.muntins ?? { columns: 2, rows: 2 })
                        : undefined,
                  }),
                );
              }}
            >
              <option value="plain">Plain</option>
              <option value="steel-arched">Arched steel glass</option>
              <option value="muntined">Muntined</option>
            </select>
          </label>
          <label>
            Glass
            <select
              aria-label="Window glazing"
              value={selectedOpening.glazing}
              onChange={(event) =>
                editor.replaceSelectedOpening({
                  ...selectedOpening,
                  glazing: event.target.value as typeof selectedOpening.glazing,
                })
              }
            >
              <option value="clear">Clear</option>
              <option value="privacy">Privacy</option>
            </select>
          </label>
          <label>
            Panels
            <select
              aria-label="Window panel count"
              value={selectedOpening.panelCount}
              onChange={(event) =>
                editor.replaceSelectedOpening({
                  ...selectedOpening,
                  panelCount: Number(event.target.value) as 1 | 2,
                })
              }
            >
              <option value={1}>One</option>
              <option value={2}>Two</option>
            </select>
          </label>
          {selectedOpening.variant === "muntined" && (
            <>
              <label>
                Columns
                <CommittedNumberInput
                  label="Muntin columns"
                  min={1}
                  step={1}
                  value={selectedOpening.muntins?.columns ?? 2}
                  onCommit={(value) =>
                    editor.replaceSelectedOpening({
                      ...selectedOpening,
                      muntins: {
                        columns: Math.max(1, Math.round(value)),
                        rows: selectedOpening.muntins?.rows ?? 2,
                      },
                    })
                  }
                />
              </label>
              <label>
                Rows
                <CommittedNumberInput
                  label="Muntin rows"
                  min={1}
                  step={1}
                  value={selectedOpening.muntins?.rows ?? 2}
                  onCommit={(value) =>
                    editor.replaceSelectedOpening({
                      ...selectedOpening,
                      muntins: {
                        columns: selectedOpening.muntins?.columns ?? 2,
                        rows: Math.max(1, Math.round(value)),
                      },
                    })
                  }
                />
              </label>
            </>
          )}
        </fieldset>
      )}
      {selectedOpening.kind === "passage" && (
        <fieldset className="construction-inspector__variants">
          <legend>Passage design</legend>
          <label>
            Shape
            <select
              aria-label="Passage shape"
              value={selectedOpening.variant}
              onChange={(event) => {
                if (event.target.value === "arched") {
                  editor.replaceSelectedOpening({
                    ...selectedOpening,
                    variant: "arched",
                    archRiseMeters: 0.12,
                  });
                } else {
                  const { archRiseMeters: _archRiseMeters, ...shared } = selectedOpening;
                  editor.replaceSelectedOpening({ ...shared, variant: "rectangular" });
                }
              }}
            >
              <option value="rectangular">Rectangular</option>
              <option value="arched">Arched</option>
            </select>
          </label>
          {selectedOpening.variant === "arched" && (
            <label>
              Arch rise
              <LengthInput
                label="Passage arch rise"
                min={0.05}
                step={0.01}
                value={selectedOpening.archRiseMeters}
                onCommit={(value) =>
                  editor.replaceSelectedOpening({ ...selectedOpening, archRiseMeters: value })
                }
              />
            </label>
          )}
        </fieldset>
      )}

      {editor.openingError && <p role="alert">{editor.openingError}</p>}
      {advanced === undefined ? (
        <details className="opening-properties__advanced">
          <summary>Advanced</summary>
          {wallPosition}
        </details>
      ) : (
        advanced && wallPosition
      )}
    </>
  );
}
