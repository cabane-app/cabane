import { useState } from "react";
import { AddItemReadingDialog } from "../editor-preview/furnish/AddItemReadingDialog";
import { saveModelLighting } from "../model-lighting/save-model-lighting";
import { ownerProjectRegistries } from "../project-runtime";
import { ModelLightingDialog } from "../model-lighting/ModelLightingDialog";
import type { ManifestIssue } from "@cabane/engine";
import { OpeningDetails } from "../editor-preview/construct/OpeningDetails";
import { ConstructionSelectionProperties } from "../editor-preview/construct/ConstructionSelectionProperties";
import { FloorPaintConfirmation } from "../editor-preview/construct";
import { FurnishingInspector } from "../editor-preview/furnish";
import { SelectedItemsProperties } from "../editor-preview/furnish/SelectedItemsProperties";
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
  const [addingReading, setAddingReading] = useState(false);
  const itemConnections = {
    profile: connect.profile,
    runtime: connect.displayRuntime,
    onConnect: (slotId: string) => {
      if (connect.selectSlot(slotId)) selectMode("connect", true);
    },
    onDisconnect: (slotId: string) =>
      connect.assignEntities(
        Object.fromEntries(
          Object.entries(connect.profile.entityIdsBySlotId).filter(([id]) => id !== slotId),
        ),
      ),
    onAddReading: () => setAddingReading(true),
  };
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
            (furnishingEditor.selectedGroup || furnishingEditor.selectedIds.length > 1 ? (
              <SelectedItemsProperties
                editor={furnishingEditor}
                floor={placementFloor}
                furnishingModels={furnishingModels}
                deviceModels={deviceModels}
                onClose={onCollapse}
              />
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
                connections={itemConnections}
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
      {addingReading && selectedItem && (
        <AddItemReadingDialog
          item={selectedItem}
          label={
            deviceModels[selectedItem.modelId]?.label ??
            furnishingModels[selectedItem.modelId]?.label ??
            selectedItem.modelId
          }
          connections={itemConnections}
          disabled={disabled || connect.disconnected}
          onClose={() => setAddingReading(false)}
          onAdd={(id, presentation) => {
            connect.addItemReading(selectedItem.id, id, presentation);
            setAddingReading(false);
          }}
        />
      )}
      {lightingModel && (
        <ModelLightingDialog
          key={lightingModel}
          project={snapshot.project}
          modelId={lightingModel}
          native={ownerProjectRegistries}
          onCancel={() => setLightingModel(null)}
          onSave={(light) =>
            saveModelLighting(
              workspace,
              lightingModel,
              light,
              ownerProjectRegistries,
              replaceEditorsFromProject,
            )
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
