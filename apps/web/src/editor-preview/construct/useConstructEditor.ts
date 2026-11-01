import { DEFAULT_WALL_COLORS } from "@cabane/engine";
import { useWallOpeningPlacement } from "./useWallOpeningPlacement";
import { openingEdits } from "./opening-edits";
import { incompleteFloorPreview } from "./incomplete-floor-preview";
import {
  editorWallAttachments,
  DEFAULT_DOOR_CONFIGURATION,
  type DoorConfiguration,
  availableOpeningOffsetRanges,
  createFloorEditorDraft,
  createFloorEditorHistory,
  createFloorEditorSelection,
  duplicateOpeningOffset,
  floorEditorSelectionTargets,
  nearestAvailableOpeningOffset,
  pointInsidePolygon,
  roomAnchorForPolygon,
  type FloorEditorHistory,
  type FloorEditorSelection,
  type FloorEditorTool,
  type FloorFinishSpec,
  type FloorSpec,
  type Polygon,
} from "@cabane/engine";

import { useCallback, useMemo, useReducer, useRef, useState } from "react";

import { floorWithOpeningOrientations } from "./opening-orientation-floor";

import { resolveConstructionDeletionTargets } from "./selection-geometry";

import { ConstructEditorController } from "./construct-controller-contract";
import {
  constructEditorHistoryReducer,
  topologyForDraft,
  topologyIssueKey,
} from "./construct-controller-reducer";
import { useClosedOutlineDrawing } from "./useClosedOutlineDrawing";
import { useWallDrawing } from "./useWallDrawing";

export const useConstructEditor = (
  initialFloor: FloorSpec,
  acceptedFloor = initialFloor,
  defaultExteriorWallColor: string = DEFAULT_WALL_COLORS.exterior,
  initialTool: import("@cabane/engine").FloorEditorTool = "select",
  otherFloorRoomNames: readonly string[] = [],
): ConstructEditorController => {
  const reservedNamesKey = JSON.stringify(otherFloorRoomNames);
  const deriveTopology = useCallback(
    (draft: FloorEditorHistory["present"]) =>
      topologyForDraft(draft, JSON.parse(reservedNamesKey) as string[]),
    [reservedNamesKey],
  );
  const [history, dispatch] = useReducer(constructEditorHistoryReducer, initialFloor, (floor) =>
    createFloorEditorHistory({ ...createFloorEditorDraft(floor), tool: initialTool }),
  );
  // Only the accepted seed can establish existing diagnostics. A recovered draft
  // must not silently accept its own errors as the new baseline.
  const [baselineTopologyIssueKeys] = useState(
    () =>
      new Set(deriveTopology(createFloorEditorDraft(acceptedFloor)).issues.map(topologyIssueKey)),
  );
  const [initialTopology] = useState(() => {
    const initialTopology = deriveTopology(createFloorEditorDraft(initialFloor));
    return {
      previewFloor: initialFloor,
      topologyIssues: initialTopology.issues.filter(
        (issue) => !baselineTopologyIssueKeys.has(topologyIssueKey(issue)),
      ),
      wallRuns: initialTopology.wallRuns,
    };
  });
  const [doorConfiguration, setDoorConfiguration] = useState<DoorConfiguration>(
    DEFAULT_DOOR_CONFIGURATION,
  );
  const [openingError, setOpeningError] = useState<string | null>(null);
  const [hedgeSettings, setHedgeSettings] = useState<
    Pick<import("@cabane/engine").HedgeSpec, "style" | "heightMeters" | "widthMeters">
  >({ style: "clipped", heightMeters: 1.4, widthMeters: 0.65 });
  const [exteriorWallColor, setExteriorWallColor] = useState(defaultExteriorWallColor);
  const [platformSettings, setPlatformSettings] = useState<
    ConstructEditorController["platformSettings"]
  >({
    finish: { kind: "solid", color: "#c8b79b" },
    defaultEdge: { kind: "railing", heightMeters: 1 },
  });
  const [selectedPlatformEdgeId, setSelectedPlatformEdgeId] = useState<string | null>(null);
  const [floorPaintTarget, rememberFloorPaintTarget] = useState<
    ConstructEditorController["floorPaintTarget"]
  >(initialTool === "platform" ? "outdoor-platform" : "room");
  const drawingTool = useRef(history.present.tool);
  drawingTool.current = history.present.tool;
  const poolDrawing = useClosedOutlineDrawing(
    (polygon) =>
      dispatch(
        drawingTool.current === "platform"
          ? { type: "add-outdoor-platform", polygon, ...platformSettings }
          : { type: "add-pool", polygon },
      ),
    history.present.tool === "platform" ? "platform" : "pool",
  );
  const { cancel: poolDrawingCancel } = poolDrawing;
  const draft = history.present;
  const restoredFloor = useRef<{ floor: FloorSpec; draft: typeof draft | null } | null>(null);
  const initialDraft = useRef(draft);
  const lastValidFloor = useRef(initialTopology.previewFloor);
  const previousTopology = useRef({ draft, value: initialTopology });
  const topologyPreview = useMemo(() => {
    const remember = (value: typeof initialTopology) => {
      previousTopology.current = { draft, value };
      return value;
    };
    const restored = restoredFloor.current;
    if (restored && (restored.draft === null || restored.draft === draft)) {
      restored.draft = draft;
      lastValidFloor.current = restored.floor;
      const topology = deriveTopology(draft);
      return remember({
        previewFloor: restored.floor,
        topologyIssues: topology.issues.filter(
          (issue) => !baselineTopologyIssueKeys.has(topologyIssueKey(issue)),
        ),
        wallRuns: topology.wallRuns,
      });
    }
    restoredFloor.current = null;
    if (draft === initialDraft.current) return remember(initialTopology);
    const previous = previousTopology.current;
    const orientedFloor = floorWithOpeningOrientations(
      previous.draft,
      draft,
      previous.value.previewFloor,
    );
    if (orientedFloor) {
      lastValidFloor.current = orientedFloor;
      return remember({ ...previous.value, previewFloor: orientedFloor });
    }
    const topology = deriveTopology(draft);
    if (topology.floor) lastValidFloor.current = topology.floor;
    return remember({
      previewFloor:
        topology.floor ??
        (topology.faces.length === 0
          ? incompleteFloorPreview(draft, lastValidFloor.current)
          : lastValidFloor.current),
      topologyIssues: topology.issues.filter(
        (issue) => !baselineTopologyIssueKeys.has(topologyIssueKey(issue)),
      ),
      wallRuns: topology.wallRuns,
    });
    // Topology tracks the architectural fields below; selection changes must not derive topology again. Initial topology is immutable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.defaultCeilingHeightMeters,
    draft.defaultWallHeightMeters,
    draft.coordinates,
    draft.exteriorWallThicknessMeters,
    draft.floorId,
    draft.floorToFloorHeightMeters,
    draft.belowGround,
    draft.floorName,
    draft.interiorWallThicknessMeters,
    draft.junctions,
    draft.openings,
    draft.hedges,
    draft.pools,
    draft.outdoorPlatforms,
    draft.groundZones,
    draft.rooms,
    draft.walls,
    baselineTopologyIssueKeys,
    deriveTopology,
  ]);
  const {
    drawStart,
    drawPreview,
    drawAngleReferenceRadians,
    beginWall,
    previewWall,
    addWall,
    cancelWall,
  } = useWallDrawing({
    tool: history.present.tool,
    walls: history.present.walls,
    hedgeSettings,
    exteriorWallColor,
    dispatch,
  });
  const setTool = useCallback(
    (tool: FloorEditorTool) => {
      poolDrawingCancel();
      cancelWall();
      if (tool === "platform") rememberFloorPaintTarget("outdoor-platform");
      if (tool === "floor" && floorPaintTarget === "outdoor-platform")
        rememberFloorPaintTarget("room");
      dispatch({
        type: "set-tool",
        tool,
      });
    },
    [poolDrawingCancel, floorPaintTarget, cancelWall],
  );
  const setFloorPaintTarget = useCallback(
    (target: ConstructEditorController["floorPaintTarget"]) => {
      rememberFloorPaintTarget(target);
      poolDrawingCancel();
      cancelWall();
      dispatch({ type: "set-tool", tool: target === "outdoor-platform" ? "platform" : "floor" });
    },
    [poolDrawingCancel, cancelWall],
  );
  const select = useCallback((selection: FloorEditorSelection) => {
    setOpeningError(null);
    dispatch({ type: "select", selection });
  }, []);
  const { addOpening, placeOpening } = useWallOpeningPlacement(
    draft,
    doorConfiguration,
    dispatch,
    setOpeningError,
  );
  const updateRoom = useCallback(
    (
      roomId: string,
      changes: Partial<
        Pick<
          FloorEditorHistory["present"]["rooms"][number],
          "name" | "accent" | "floorFinish" | "floorZones" | "ceilingHeightMeters" | "isSolid"
        >
      >,
    ) => {
      const room = topologyPreview.previewFloor.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return;
      const identity = history.present.rooms.find((candidate) => candidate.id === room.id);
      dispatch({
        type: "update-room-metadata",
        roomId: room.id,
        anchor: roomAnchorForPolygon(room.polygon),
        changes: identity
          ? changes
          : {
              name: room.name,
              accent: room.accent,
              ...(room.floorFinish ? { floorFinish: room.floorFinish } : {}),
              ...(room.floorZones ? { floorZones: [...room.floorZones] } : {}),
              ...changes,
            },
      });
    },
    [history.present, topologyPreview.previewFloor.rooms],
  );
  const paintRoomFloor = useCallback(
    (roomId: string, finish: FloorFinishSpec, clearZones: boolean) => {
      const room = topologyPreview.previewFloor.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return;
      dispatch({
        type: "update-room-metadata",
        roomId,
        anchor: roomAnchorForPolygon(room.polygon),
        changes: {
          floorFinish: finish,
          ...(clearZones ? { floorZones: [] } : {}),
        },
      });
    },
    [topologyPreview.previewFloor.rooms],
  );
  const addFloorZone = useCallback(
    (roomId: string, polygon: Polygon, finish: FloorFinishSpec) => {
      const room = topologyPreview.previewFloor.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return;
      dispatch({
        type: "add-floor-zone",
        room: {
          id: room.id,
          name: room.name,
          accent: room.accent,
          anchor: roomAnchorForPolygon(room.polygon),
        },
        polygon,
        finish,
      });
    },
    [topologyPreview.previewFloor.rooms],
  );
  const resolveRoomMerge = useCallback(
    (survivorId: string, roomId?: string) => {
      const selection = history.present.selection;
      const targetId = roomId ?? (selection?.kind === "room" ? selection.id : undefined);
      const room = topologyPreview.previewFloor.rooms.find(
        (candidate) => candidate.id === targetId,
      );
      if (!room) return;
      const mergedRoomIds = history.present.rooms
        .filter((identity) => pointInsidePolygon(identity.anchor, room.polygon))
        .map((identity) => identity.id);
      if (mergedRoomIds.length < 2 || !mergedRoomIds.includes(survivorId)) return;
      dispatch({
        type: "resolve-room-merge",
        survivorId,
        mergedRoomIds,
        anchor: roomAnchorForPolygon(room.polygon),
      });
    },
    [history.present, topologyPreview.previewFloor.rooms],
  );
  const selectionTargets = useMemo(
    () => floorEditorSelectionTargets(draft.selection),
    [draft.selection],
  );
  const deletionTargets = useMemo(
    () =>
      resolveConstructionDeletionTargets({
        selection: draft.selection,
        draft,
        previewFloor: topologyPreview.previewFloor,
        wallRuns: topologyPreview.wallRuns,
      }),
    [draft, topologyPreview.previewFloor, topologyPreview.wallRuns],
  );
  const deleteElements: ConstructEditorController["deleteElements"] = (targets) =>
    dispatch({
      type: "delete-elements",
      targets: resolveConstructionDeletionTargets({
        selection: createFloorEditorSelection(targets),
        draft,
        previewFloor: topologyPreview.previewFloor,
        wallRuns: topologyPreview.wallRuns,
      }),
    });
  const updateWallMetadata: ConstructEditorController["updateWallMetadata"] = (wallId, changes) =>
    dispatch({ type: "update-wall-metadata", wallId, changes });
  const edits = openingEdits(draft, dispatch, setOpeningError);
  return {
    history,
    doorConfiguration,
    setDoorConfiguration,
    openingError,
    hedgeSettings,
    setHedgeSettings,
    platformSettings,
    setPlatformSettings,
    selectedPlatformEdgeId,
    selectPlatform: (id) => {
      setSelectedPlatformEdgeId(null);
      select({ kind: "outdoor-platform", id });
    },
    selectPlatformEdge: (id, edgeId) => {
      setSelectedPlatformEdgeId(edgeId);
      select({ kind: "outdoor-platform", id });
    },
    updatePlatform: (id, changes) => dispatch({ type: "update-outdoor-platform", id, changes }),
    addPlatform: (polygon, finish, defaultEdge) =>
      dispatch({ type: "add-outdoor-platform", polygon, finish, defaultEdge }),
    poolDrawing,
    selectPool: (id) => select({ kind: "pool", id }),
    selectFloorZone: (id) => select({ kind: "floor-zone", id }),
    updatePool: (poolId, polygon) => dispatch({ type: "update-pool", poolId, polygon }),
    addPool: (polygon) => dispatch({ type: "add-pool", polygon }),
    addHedge: (hedge) => dispatch({ type: "add-hedge", hedge }),
    updateHedge: (id, changes) => dispatch({ type: "update-hedge", id, changes }),
    paintRoomFloor,
    addFloorZone,
    addGroundZone: (polygon, finish) =>
      dispatch({
        type: "add-ground-zone",
        polygon,
        finish,
      }),
    updateFloorZone: (zoneId, changes) =>
      dispatch({
        type: "update-floor-zone",
        zoneId,
        changes,
      }),
    ...topologyPreview,
    isSettling: false,
    draft,
    selection: draft.selection,
    selectionTargets,
    deletionTargets,
    tool: draft.tool,
    drawStart,
    drawPreview,
    drawAngleReferenceRadians,
    exteriorWallColor,
    defaultExteriorWallColor,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dispatch,
    setTool,
    floorPaintTarget,
    setFloorPaintTarget,
    selectWall: (id) => select({ kind: "wall", id }),
    selectOpening: (id) => select({ kind: "opening", id }),
    selectRoom: (id) => select({ kind: "room", id }),
    selectMany: (targets) => select(createFloorEditorSelection(targets)),
    clearSelection: () => select(null),
    setExteriorWallColor,
    updateWallEndpoint: (wallId, endpoint, point) =>
      dispatch({
        type: "move-wall-endpoint",
        wallId,
        endpoint,
        point,
      }),
    updateSelectedWallMetadata: (changes) => {
      const selection = history.present.selection;
      if (selection?.kind !== "wall") return;
      updateWallMetadata(selection.id, changes);
    },
    updateWallMetadata,
    addWallSegment: (from, to, options = {}) =>
      dispatch({ type: "add-wall", from, to, ...options }),
    updateFloorSettings: (settings) => dispatch({ type: "update-floor-settings", settings }),
    setFloorName: (name) => dispatch({ type: "set-floor-name", name }),
    updateRoom,
    updateSelectedRoom: (changes) => {
      if (history.present.selection?.kind === "room")
        updateRoom(history.present.selection.id, changes);
    },
    resolveRoomMerge,
    translateWall: (wallId, delta) => dispatch({ type: "translate-wall", wallId, delta }),
    beginWall,
    previewWall,
    addWall,
    cancelWall,
    addOpening,
    placeOpening,
    reorientOpening: (openingId, change) =>
      dispatch({ type: "reorient-opening", openingId, change }),
    ...edits,
    moveOpening: (openingId, wallId, offsetPlanUnits) => {
      const opening = editorWallAttachments(history.present).find(
        (candidate) => candidate.id === openingId,
      );
      if (!opening) return;
      const constrainedOffset = nearestAvailableOpeningOffset(
        offsetPlanUnits,
        availableOpeningOffsetRanges({
          draft: history.present,
          wallId,
          widthPlanUnits: opening.widthPlanUnits,
          sillHeightMeters: opening.sillHeightMeters,
          excludeOpeningId: openingId,
        }),
      );
      if (constrainedOffset === undefined) return;
      dispatch({
        type: "move-opening",
        openingId,
        wallId,
        offsetPlanUnits: constrainedOffset,
      });
    },
    canDuplicateOpening: (openingId) =>
      duplicateOpeningOffset(history.present, openingId) !== undefined,
    duplicateOpening: (openingId) => {
      if (duplicateOpeningOffset(history.present, openingId) === undefined) return false;
      dispatch({ type: "duplicate-opening", openingId });
      return true;
    },
    deleteSelected: () => deleteElements(selectionTargets),
    deleteElements,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    replaceFloor: (floor) => {
      cancelWall();
      poolDrawingCancel();
      // History already owns the resolved architecture. Re-deriving it here
      // can change room identities or split a ceiling shared by several rooms.
      restoredFloor.current = { floor, draft: null };
      dispatch({ type: "replace-floor", floor });
    },
  };
};
export { CONSTRUCT_ARCHITECTURE_SETTLE_MS } from "./construct-controller-contract";
export type {
  ConstructEditorAction,
  ConstructEditorController,
  ConstructEditorState,
} from "./construct-controller-contract";
export {
  constructEditorHistoryReducer,
  constructEditorReducer,
  createConstructEditorState,
} from "./construct-controller-reducer";
export { closesWallLoop } from "./wall-loop-closure";

export { availableOpeningOffsetRanges, nearestAvailableOpeningOffset } from "@cabane/engine";
