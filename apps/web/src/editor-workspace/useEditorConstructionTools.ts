import {
  editorWallAttachments,
  createBrowserUuid,
  stairFloorIds,
  type StairSpec,
} from "@cabane/engine";

import { type FloorFinishSpec } from "@cabane/engine";

import { useCallback, useEffect, useState } from "react";

import { type EditorMode } from "../editor-chrome/EditorModeNav";

import {
  useConstructEditor,
  useConstructMeasure,
  useFloorZoneDrawing,
} from "../editor-preview/construct";

import type { HomeProject } from "@cabane/engine";
export function useEditorConstructionTools(
  project: HomeProject,
  activeFloorId: string,
  mode: EditorMode,
  constructEditor: ReturnType<typeof useConstructEditor>,
) {
  const {
    selection: constructEditorSelection,
    draft: constructEditorDraft,
    previewFloor: constructEditorPreviewFloor,
    tool: constructEditorTool,
    clearSelection: constructEditorClearSelection,
    setTool: constructEditorSetTool,
    addFloorZone: constructEditorAddFloorZone,
    addGroundZone: constructEditorAddGroundZone,
    paintRoomFloor: constructEditorPaintRoomFloor,
  } = constructEditor;
  const [stairPlacement, setStairPlacement] = useState<StairSpec | null>(null);
  const [stairDialog, setStairDialog] = useState<StairSpec | null>(null);
  useEffect(() => {
    setStairDialog((current) =>
      current && !project.stairs.some((stair) => stair.id === current.id) ? null : current,
    );
  }, [project.stairs]);
  useEffect(() => {
    setStairDialog((current) =>
      mode !== "construct" || (current && !stairFloorIds(current).includes(activeFloorId))
        ? null
        : current,
    );
  }, [activeFloorId, mode]);
  const [floorDialog, setFloorDialog] = useState<
    "rename" | "remove" | "add-above" | "add-below" | null
  >(null);
  const selectedOpeningId =
    constructEditorSelection?.kind === "opening" ? constructEditorSelection.id : null;
  const selectedOpening = selectedOpeningId
    ? editorWallAttachments(constructEditorDraft).find(
        (opening) => opening.id === selectedOpeningId,
      )
    : undefined;
  const constructMeasure = useConstructMeasure(constructEditorPreviewFloor.coordinates);
  const { cancel: constructMeasureCancel } = constructMeasure;
  const [floorFinish, setFloorFinish] = useState<FloorFinishSpec>({
    kind: "preset",
    preset: "light-oak",
  });
  const { floorPaintTarget, setFloorPaintTarget } = constructEditor;
  const [pendingRoomPaintId, setPendingRoomPaintId] = useState<string | null>(null);
  const floorZoneDrawing = useFloorZoneDrawing(constructEditorPreviewFloor, (roomId, polygon) =>
    roomId
      ? constructEditorAddFloorZone(roomId, polygon, floorFinish)
      : constructEditorAddGroundZone(polygon, floorFinish),
  );
  const { cancel: floorZoneDrawingCancel } = floorZoneDrawing;
  useEffect(() => {
    if (constructEditorSelection || constructEditorTool !== "select") setStairDialog(null);
  }, [constructEditorSelection, constructEditorTool]);
  useEffect(() => {
    if (mode !== "construct" || constructEditorTool !== "measure") {
      constructMeasureCancel();
    }
  }, [constructEditorTool, constructMeasureCancel, mode]);

  useEffect(() => {
    if (mode === "construct" && constructEditorTool === "floor") return;
    floorZoneDrawingCancel();
    setPendingRoomPaintId(null);
  }, [constructEditorTool, floorZoneDrawingCancel, mode]);

  const requestRoomPaint = useCallback(
    (roomId: string) => {
      const room = constructEditorPreviewFloor.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return;
      if (room.floorZones?.length) {
        setPendingRoomPaintId(roomId);
        return;
      }
      constructEditorPaintRoomFloor(roomId, floorFinish, false);
    },
    [constructEditorPaintRoomFloor, constructEditorPreviewFloor.rooms, floorFinish],
  );

  const confirmRoomPaint = useCallback(
    (clearZones: boolean) => {
      if (!pendingRoomPaintId) return;
      constructEditorPaintRoomFloor(pendingRoomPaintId, floorFinish, clearZones);
      setPendingRoomPaintId(null);
    },
    [constructEditorPaintRoomFloor, floorFinish, pendingRoomPaintId],
  );

  const startStairs = (connection?: "floors" | "terrain") => {
    constructEditorSetTool("select");
    constructEditorClearSelection();
    const index = project.floors.findIndex((f) => f.id === activeFloorId);
    const floor = project.floors[index];
    const upperFloor = project.floors[index + 1];
    if (!floor) return;
    const terrain = connection === "terrain" || (!connection && !upperFloor);
    if (!terrain && !upperFloor) return;
    setStairDialog(null);
    setStairPlacement({
      id: `stairs-${createBrowserUuid()}`,
      ...(terrain
        ? { terrain: { floorId: activeFloorId, end: "lower" as const } }
        : { lowerFloorId: activeFloorId, upperFloorId: upperFloor!.id }),
      at: floor.footprint[0] ?? floor.coordinates.origin,
      widthMeters: 1,
      ...(terrain ? { style: "concrete" as const } : {}),
      runMeters: terrain ? 2 : floor.floorToFloorHeightMeters * 1.5,
      rotationYRadians: 0,
    });
  };

  return {
    stairPlacement,
    setStairPlacement,
    stairDialog,
    setStairDialog,
    floorDialog,
    setFloorDialog,
    selectedOpening,
    constructMeasure,
    floorFinish,
    setFloorFinish,
    floorPaintTarget,
    setFloorPaintTarget,
    pendingRoomPaintId,
    setPendingRoomPaintId,
    floorZoneDrawing,
    requestRoomPaint,
    confirmRoomPaint,
    beginStairPlacement: startStairs,
  };
}
