import { useState } from "react";
import { saveModelEditor } from "../model-editor/save-model-editor";
import { ownerProjectRegistries } from "../project-runtime";
import { ProjectModelEditor } from "../model-editor/ProjectModelEditor";
import type { ManifestIssue } from "@cabane/engine";
import { OpeningDetails } from "../editor-preview/construct/OpeningDetails";
import { ConstructionSelectionProperties } from "../editor-preview/construct/ConstructionSelectionProperties";
import { FloorPaintConfirmation } from "../editor-preview/construct";
import { FurnishingInspector } from "../editor-preview/furnish";
import { SelectionDetailsPanel } from "../editor-chrome/SelectionDetailsPanel";
import { EditorButton } from "../editor-chrome/EditorButton";
import { StairDetails } from "../editor-floors/StairDetails";
import type { useHomeEditorController } from "./useHomeEditorController";

type Props = Pick<
  ReturnType<typeof useHomeEditorController>,
  | "mode"
  | "editingLocked"
  | "publishOpen"
  | "previewOpen"
  | "constructEditor"
  | "dragging"
  | "placementFloor"
  | "furnishingModels"
  | "deviceModels"
  | "selectedOpening"
  | "visualSceneItems"
  | "furnishingEditor"
  | "selectedItem"
  | "arrangeAnnouncement"
  | "pendingRoomPaintId"
  | "confirmRoomPaint"
  | "setPendingRoomPaintId"
  | "stairDialog"
  | "snapshot"
  | "commit"
  | "connect"
  | "selectMode"
  | "workspace"
  | "replaceEditorsFromProject"
> & {
  open: boolean;
  onCollapse: () => void;
  liveStairIssues: readonly ManifestIssue[] | null;
  disabled: boolean;
};

export function EditorSelectionDetails({
  mode,
  editingLocked,
  publishOpen,
  previewOpen,
  constructEditor,
  dragging,
  placementFloor,
  furnishingModels,
  deviceModels,
  selectedOpening,
  visualSceneItems,
  furnishingEditor,
  selectedItem,
  arrangeAnnouncement,
  pendingRoomPaintId,
  confirmRoomPaint,
  setPendingRoomPaintId,
  stairDialog,
  snapshot,
  commit,
  workspace,
  connect,
  selectMode,
  replaceEditorsFromProject,
  open,
  onCollapse,
  liveStairIssues,
  disabled,
}: Props) {
  const [lightingModel, setLightingModel] = useState<string | null>(null);
  const selectedStair =
    stairDialog && snapshot.project.stairs.find((stair) => stair.id === stairDialog.id);
  return (
    <>
      {open && (
        <div
          className="editor-properties-host"
          inert={editingLocked || publishOpen || previewOpen || dragging || disabled}
        >
          {mode === "construct" &&
            (selectedStair ? (
              <StairDetails
                key={selectedStair.id}
                project={snapshot.project}
                stair={selectedStair}
                registries={{ furnishingModels, deviceModels }}
                liveIssues={liveStairIssues}
                onCancel={onCollapse}
                onSave={(stair) =>
                  commit({
                    ...snapshot,
                    project: {
                      ...snapshot.project,
                      stairs: snapshot.project.stairs.map((existing) =>
                        existing.id === stair.id ? stair : existing,
                      ),
                    },
                  })
                }
              />
            ) : selectedOpening ? (
              <OpeningDetails
                key={selectedOpening.id}
                opening={selectedOpening}
                editor={constructEditor}
                disabled={disabled}
                onClose={onCollapse}
              />
            ) : constructEditor.selection ? (
              <ConstructionSelectionProperties
                key={
                  constructEditor.selection.kind === "multiple"
                    ? "multiple"
                    : constructEditor.selection.id
                }
                editor={constructEditor}
                onClose={onCollapse}
              />
            ) : null)}
          {mode === "furnish" &&
            (furnishingEditor.selectedIds.length > 1 ? (
              <SelectionDetailsPanel
                title={`${furnishingEditor.selectedIds.length} items`}
                subtitle={placementFloor.name}
                label="Selected items"
                onClose={onCollapse}
              >
                <p className="editor-properties-note">Drag any selected item to move the group.</p>
                <EditorButton
                  variant="text"
                  onClick={() => furnishingEditor.deleteItems(furnishingEditor.selectedIds)}
                >
                  Delete selection
                </EditorButton>
              </SelectionDetailsPanel>
            ) : selectedItem ? (
              <FurnishingInspector
                items={visualSceneItems}
                selectedId={furnishingEditor.selectedId}
                floor={placementFloor}
                furnishingModels={furnishingModels}
                deviceModels={deviceModels}
                onWindowFit={furnishingEditor.updatePlacementAndSize}
                onPlacementChange={furnishingEditor.updatePlacement}
                onSizeChange={furnishingEditor.updateSize}
                onLightStateChange={furnishingEditor.updateLightState}
                onEntitySlotsChange={furnishingEditor.updateEntitySlots}
                onVariantChange={furnishingEditor.updateVariant}
                onColorChange={furnishingEditor.updateColor}
                onEditLighting={() => setLightingModel(selectedItem.modelId)}
                onConnectLighting={() => {
                  if (connect.selectDevice(selectedItem.lightSlotId ?? selectedItem.id))
                    selectMode("connect", true);
                }}
                onClose={onCollapse}
              />
            ) : null)}
        </div>
      )}
      {lightingModel && (
        <ProjectModelEditor
          key={lightingModel}
          project={snapshot.project}
          modelId={lightingModel}
          native={ownerProjectRegistries}
          onCancel={() => setLightingModel(null)}
          onSave={(change) =>
            saveModelEditor(workspace, change, ownerProjectRegistries, (next) => {
              replaceEditorsFromProject(next.project);
              workspace.commit(next);
            })
          }
        />
      )}
      <div className="arrange-announcement" role="status">
        {arrangeAnnouncement}
      </div>
      {pendingRoomPaintId &&
        (() => {
          const room = constructEditor.previewFloor.rooms.find(
            (candidate) => candidate.id === pendingRoomPaintId,
          );
          return room ? (
            <FloorPaintConfirmation
              roomName={room.name || "this room"}
              onKeepZones={() => confirmRoomPaint(false)}
              onReplaceEverything={() => confirmRoomPaint(true)}
              onCancel={() => setPendingRoomPaintId(null)}
            />
          ) : null;
        })()}
    </>
  );
}
