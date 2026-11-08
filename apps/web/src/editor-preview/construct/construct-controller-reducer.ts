import { omitUndefinedProperties } from "@cabane/engine";
import { incompleteFloorPreview } from "./incomplete-floor-preview";
import {
  editorWallAttachments,
  availableOpeningOffsetRanges,
  createFloorEditorDraft,
  createFloorEditorHistory,
  deriveFloorTopology,
  floorEditorReducer,
  nearestAvailableOpeningOffset,
  type FloorEditorAction,
  type FloorEditorHistory,
  type FloorSpec,
} from "@cabane/engine";

import { floorWithOpeningOrientations } from "./opening-orientation-floor";

import { ConstructEditorAction, ConstructEditorState } from "./construct-controller-contract";

export const topologyForDraft = (
  draft: FloorEditorHistory["present"],
  reservedRoomNames: readonly string[] = [],
) => {
  return deriveFloorTopology(
    omitUndefinedProperties({
      ...(draft.floorToFloorHeightMeters === undefined
        ? {}
        : { floorToFloorHeightMeters: draft.floorToFloorHeightMeters }),
      ...(draft.belowGround === undefined ? {} : { belowGround: draft.belowGround }),
      floorId: draft.floorId,
      floorName: draft.floorName,
      coordinates: draft.coordinates,
      walls: draft.walls,
      openings: draft.openings,
      rooms: draft.rooms,
      slopedCeilings: draft.slopedCeilings,
      reservedRoomNames,
      junctions: draft.junctions,
      ...(draft.hedges === undefined ? {} : { hedges: draft.hedges }),
      pools: draft.pools,
      outdoorPlatforms: draft.outdoorPlatforms,
      groundZones: draft.groundZones,
      defaultWallHeightMeters: draft.defaultWallHeightMeters,
      defaultCeilingHeightMeters: draft.defaultCeilingHeightMeters,
      exteriorWallThicknessMeters: draft.exteriorWallThicknessMeters,
      interiorWallThicknessMeters: draft.interiorWallThicknessMeters,
    }),
  );
};

export const topologyIssueKey = (issue: ConstructEditorState["topologyIssues"][number]) =>
  `${issue.code}:${issue.path}:${issue.message}`;

export const createConstructEditorState = (floor: FloorSpec): ConstructEditorState => {
  const history = createFloorEditorHistory(createFloorEditorDraft(floor));
  const topology = topologyForDraft(history.present);
  return {
    history,
    previewFloor: topology.floor ?? floor,
    topologyIssues: topology.issues,
    wallRuns: topology.wallRuns,
  };
};

const engineActionFor = (
  history: FloorEditorHistory,
  action: ConstructEditorAction,
): FloorEditorAction | null => {
  if (action.type === "replace-floor") return null;
  if (action.type === "move-wall-endpoint") {
    const wall = history.present.walls.find((candidate) => candidate.id === action.wallId);
    return wall ? { type: "move-endpoint", from: wall[action.endpoint], to: action.point } : null;
  }
  if (action.type === "update-selected-opening" || action.type === "replace-selected-opening") {
    const selection = history.present.selection;
    const opening =
      selection?.kind === "opening"
        ? editorWallAttachments(history.present).find((candidate) => candidate.id === selection.id)
        : undefined;
    if (!opening) return null;
    const updated =
      action.type === "replace-selected-opening" ? action.opening : { ...opening, ...action.patch };
    if (updated.id !== opening.id || updated.kind !== opening.kind) return null;
    const constrainedOffset = nearestAvailableOpeningOffset(
      updated.offsetPlanUnits,
      availableOpeningOffsetRanges({
        draft: history.present,
        wallId: updated.wallId,
        widthPlanUnits: updated.widthPlanUnits,
        sillHeightMeters: updated.sillHeightMeters,
        excludeOpeningId: updated.id,
      }),
    );
    if (constrainedOffset === undefined) return null;
    return {
      type: "update-opening",
      opening: { ...updated, offsetPlanUnits: constrainedOffset },
    };
  }
  return action;
};

/**
 * Updates the editable draft without rebuilding its derived architectural mesh.
 * The hook below schedules that expensive preview separately, after the direct
 * manipulation has painted.
 */
export const constructEditorHistoryReducer = (
  history: FloorEditorHistory,
  action: ConstructEditorAction,
): FloorEditorHistory => {
  if (action.type === "replace-floor") {
    return createFloorEditorHistory(createFloorEditorDraft(action.floor));
  }
  const engineAction = engineActionFor(history, action);
  return engineAction ? floorEditorReducer(history, engineAction) : history;
};

export const constructEditorReducer = (
  state: ConstructEditorState,
  action: ConstructEditorAction,
): ConstructEditorState => {
  const history = constructEditorHistoryReducer(state.history, action);
  if (history === state.history) return state;
  const orientedFloor = floorWithOpeningOrientations(
    state.history.present,
    history.present,
    state.previewFloor,
  );
  if (orientedFloor) return { ...state, history, previewFloor: orientedFloor };
  const topology = topologyForDraft(history.present);
  return {
    history,
    previewFloor:
      topology.floor ??
      (topology.faces.length === 0
        ? incompleteFloorPreview(history.present, state.previewFloor)
        : state.previewFloor),
    topologyIssues: topology.issues,
    wallRuns: topology.wallRuns,
  };
};
