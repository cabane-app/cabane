import { roomsForFloor, useFloorNavigation } from "@cabane/engine";
import { useEffectEvent } from "react";
import type { ConnectWorkspaceProps } from "./editor-workspace-contract";

import { useEffect } from "react";

import { useFurnishingEditor } from "../editor-preview/furnish";

import type { HomeProject } from "@cabane/engine";
/** Consume entry requests once; subsequent edits and selections stay user controlled. */
export function useEditorEntryRequest(
  initialRequest: ConnectWorkspaceProps["initialRequest"],
  project: HomeProject,
  initialItems: HomeProject["sceneItems"],
  floorNavigationSelectFloor: ReturnType<typeof useFloorNavigation>["selectFloor"],
  furnishingEditorSelect: ReturnType<typeof useFurnishingEditor>["select"],
) {
  // Apply a navigation request once, using the current draft without retriggering on edits.
  const applyEntryFloor = useEffectEvent(() => {
    const request = initialRequest;
    if (!request) return;
    const target =
      request.floorId ??
      project.sceneItems.find(
        (item) => item.id === request.relationshipId || item.id === request.arrange?.selectedItemId,
      )?.floorId ??
      project.floors.find((floor) =>
        roomsForFloor(floor).some((room) => room.id === request.roomId),
      )?.id;
    if (target && project.floors.some((floor) => floor.id === target))
      floorNavigationSelectFloor(target, "target");
  });
  useEffect(() => {
    applyEntryFloor();
  }, [initialRequest]);
  // Initial selection is consumed on entry; subsequent selection belongs to the editor.
  const selectInitialItem = useEffectEvent(() => {
    const id = initialRequest?.arrange?.selectedItemId;
    if (id && initialItems.some((item) => item.id === id)) furnishingEditorSelect(id);
  });
  useEffect(() => {
    selectInitialItem();
  }, []);
}
