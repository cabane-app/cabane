import { MeasurementText } from "@cabane/engine";
import type { ConstructionInspectorProps } from "./construction-inspector-contract";
export type { ConstructionInspectorProps } from "./construction-inspector-contract";
import { EditorButton } from "../../editor-chrome/EditorButton";
import { FloorToolProperties } from "./FloorToolProperties";
import { DoorPresetPalette } from "./DoorPresetPalette";
import { DoorDesignFields } from "./DoorDesignFields";
import { HedgeProperties } from "./HedgeProperties";
import { ConstructionBuildingSettings } from "./ConstructionBuildingSettings";
import { DebouncedColorInput } from "./DebouncedColorInput";

export function ConstructionInspector({
  inert,
  referencePlanControls,
  planImportControls,
  tutorialControls,
  walkStartControls,
  northControls,
  terrainControls,
  roof,
  onRoofChange,
  editor,
  floorPainting,
}: ConstructionInspectorProps) {
  return (
    <section className="construction-inspector" aria-label="Construction inspector">
      <div className="construction-inspector__context" inert={inert}>
        {editor.tool === "select" && (
          <p className="construction-inspector__tool-hint" role="status">
            Hold Shift and drag to select several objects. Delete or Backspace removes the
            selection.
          </p>
        )}
        {editor.tool === "hedge" && <HedgeProperties editor={editor} editingSelection={false} />}
        {(editor.tool === "floor" || editor.tool === "platform") && floorPainting && (
          <FloorToolProperties editor={editor} painting={floorPainting} />
        )}
        {(editor.tool === "wall" || editor.tool === "virtual-wall") && (
          <div className="construction-inspector__selection">
            <header>
              <div>
                <strong>
                  {editor.tool === "virtual-wall" ? "Draw invisible walls" : "Draw walls"}
                </strong>
              </div>
            </header>
            <p className="construction-inspector__tool-hint">
              Click and drag a wall segment. Continue from its endpoint to draw a connected wall.
            </p>
            {editor.tool === "virtual-wall" && (
              <p className="construction-inspector__tool-hint">
                Divide an open space into rooms without building a wall. Dashed lines appear only in
                Construct; people can walk through them.
              </p>
            )}
            {editor.tool === "wall" && (
              <fieldset>
                <legend>Finish</legend>
                <label>
                  Exterior
                  <DebouncedColorInput
                    label="New wall exterior color"
                    value={editor.exteriorWallColor}
                    onCommit={(exteriorColor) => {
                      editor.setExteriorWallColor(exteriorColor);
                      if (editor.selection?.kind === "wall")
                        editor.updateSelectedWallMetadata({ exteriorColor });
                    }}
                  />
                </label>
              </fieldset>
            )}
          </div>
        )}
        {editor.tool === "door" && (
          <div className="construction-inspector__selection">
            <header>
              <div>
                <strong>Place a door</strong>
              </div>
            </header>
            <p className="construction-inspector__tool-hint">
              Choose a door type, then click a wall.
            </p>
            <DoorPresetPalette
              value={editor.doorConfiguration}
              onChange={editor.setDoorConfiguration}
            />
            <DoorDesignFields
              value={editor.doorConfiguration}
              onChange={editor.setDoorConfiguration}
            />
            {editor.openingError && (
              <p role="alert">
                <MeasurementText>{editor.openingError}</MeasurementText>
              </p>
            )}
          </div>
        )}
        {editor.tool === "niche" && (
          <div className="construction-inspector__selection" role="status">
            <header>
              <div>
                <strong>Place a niche</strong>
              </div>
            </header>
            <p className="construction-inspector__tool-hint">
              Click a wall face to place a recess. Drag it along the wall and use its handles to
              change the width. Properties controls its height, depth and height from floor.
            </p>
            {editor.openingError && (
              <p role="alert">
                <MeasurementText>{editor.openingError}</MeasurementText>
              </p>
            )}
          </div>
        )}
        {editor.tool === "pool" && (
          <div className="construction-inspector__selection" role="status">
            <header>
              <div>
                <strong>Close the outline</strong>
              </div>
            </header>
            <p className="construction-inspector__tool-hint">
              Click to add corners, then return to the first corner to close the pool. Undo removes
              the last corner. Escape cancels.
            </p>
            {editor.poolDrawing?.error && (
              <p role="alert">
                <MeasurementText>{editor.poolDrawing.error}</MeasurementText>
              </p>
            )}
            {editor.poolDrawing?.active && (
              <EditorButton variant="secondary" type="button" onClick={editor.poolDrawing.cancel}>
                Cancel pool
              </EditorButton>
            )}
          </div>
        )}
      </div>
      {referencePlanControls}
      <ConstructionBuildingSettings
        {...{
          planImportControls,
          roof,
          northControls,
          terrainControls,
          walkStartControls,
          tutorialControls,
          editor,
        }}
        {...(inert === undefined ? {} : { inert })}
        {...(onRoofChange ? { onRoofChange } : {})}
      />
    </section>
  );
}
