import { createBrowserUuid, stairFloorIds } from "@cabane/engine";
import { FloorManagementDialog } from "../editor-floors";
import type { useHomeEditorController } from "./useHomeEditorController";

export function EditorFloorDialog({
  controller,
  removeDisabledReason,
}: {
  controller: ReturnType<typeof useHomeEditorController>;
  removeDisabledReason: string | undefined;
}) {
  const { floorDialog, setFloorDialog, snapshot, activeFloorId, executeProjectAction } = controller;
  const addFloor = (below: boolean, duplicate: boolean) => {
    const id = `floor-${createBrowserUuid()}`;
    executeProjectAction({
      type: below ? "add-floor-below" : "add-floor-above",
      id,
      ...(duplicate ? { sourceFloorId: activeFloorId } : {}),
    });
  };
  return (
    <>
      {floorDialog && (
        <FloorManagementDialog
          action={floorDialog}
          onRemove={!removeDisabledReason ? () => setFloorDialog("remove") : undefined}
          removeDisabledReason={removeDisabledReason}
          name={snapshot.project.floors.find((floor) => floor.id === activeFloorId)!.name}
          height={
            snapshot.project.floors.find((floor) => floor.id === activeFloorId)!
              .floorToFloorHeightMeters
          }
          itemCount={
            snapshot.project.sceneItems.filter((item) => item.floorId === activeFloorId).length
          }
          stairCount={
            snapshot.project.stairs.filter((stair) => stairFloorIds(stair).includes(activeFloorId))
              .length
          }
          onCancel={() => setFloorDialog(null)}
          onSave={(name, height, duplicate = false) => {
            if (floorDialog === "add-above" || floorDialog === "add-below") {
              addFloor(floorDialog === "add-below", duplicate);
              setFloorDialog(null);
              return;
            }
            executeProjectAction(
              floorDialog === "remove"
                ? { type: "remove-floor", floorId: activeFloorId }
                : { type: "rename-floor", floorId: activeFloorId, name, heightMeters: height },
            );
            setFloorDialog(null);
          }}
        />
      )}
    </>
  );
}
