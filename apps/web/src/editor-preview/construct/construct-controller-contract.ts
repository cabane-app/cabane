import {
  deriveFloorTopology,
  type DerivedWallRun,
  type EditorWallAttachment as EditorOpening,
  type EditorWall,
  type FloorEditorAction,
  type FloorEditorFloorSettings,
  type FloorEditorHistory,
  type FloorEditorSelection,
  type FloorEditorSelectionTarget,
  type FloorEditorTool,
  type FloorFinishSpec,
  type FloorFinishZoneSpec,
  type FloorSpec,
  type PlanPoint,
  type Polygon,
} from "@cabane/engine";

import { usePoolDrawing } from "./usePoolDrawing";
import type { FloorPaintTarget } from "./floor-painting-contract";

export interface ConstructEditorState {
  history: FloorEditorHistory;
  previewFloor: FloorSpec;
  topologyIssues: ReturnType<typeof deriveFloorTopology>["issues"];
  wallRuns: readonly DerivedWallRun[];
}

// Kept for consumers that wait for a committed architecture snapshot. Topology
// is now cheap enough to publish with the edit; only mesh construction was slow.
export const CONSTRUCT_ARCHITECTURE_SETTLE_MS = 0;

export type ConstructEditorAction =
  | FloorEditorAction
  | { type: "replace-floor"; floor: FloorSpec }
  | { type: "move-wall-endpoint"; wallId: string; endpoint: "from" | "to"; point: PlanPoint }
  | {
      type: "update-selected-opening";
      patch: Partial<
        Pick<
          EditorOpening,
          "offsetPlanUnits" | "widthPlanUnits" | "openingHeightMeters" | "sillHeightMeters"
        >
      >;
    }
  | { type: "replace-selected-opening"; opening: EditorOpening };

export interface ConstructEditorController extends ConstructEditorState {
  doorConfiguration: import("@cabane/engine").DoorConfiguration;
  setDoorConfiguration: (configuration: import("@cabane/engine").DoorConfiguration) => void;
  openingError: string | null;
  hedgeSettings: Pick<import("@cabane/engine").HedgeSpec, "style" | "heightMeters" | "widthMeters">;
  setHedgeSettings: (settings: ConstructEditorController["hedgeSettings"]) => void;
  platformSettings: {
    finish: FloorFinishSpec;
    defaultEdge: import("@cabane/engine").OutdoorPlatformEdgeConfiguration;
  };
  setPlatformSettings: (settings: ConstructEditorController["platformSettings"]) => void;
  selectedPlatformEdgeId: string | null;
  selectPlatformEdge: (platformId: string, edgeId: string) => void;
  selectPlatform: (id: string) => void;
  updatePlatform: (
    id: string,
    changes: Partial<Omit<import("@cabane/engine").OutdoorPlatformSpec, "id">>,
  ) => void;
  addPlatform: (
    polygon: Polygon,
    finish: FloorFinishSpec,
    defaultEdge: import("@cabane/engine").OutdoorPlatformEdgeConfiguration,
  ) => void;
  poolDrawing: ReturnType<typeof usePoolDrawing>;
  selectPool: (id: string) => void;
  selectFloorZone: (id: string) => void;
  updatePool: (poolId: string, polygon: Polygon) => void;
  addPool: (polygon: Polygon) => void;
  addHedge: (hedge: Omit<import("@cabane/engine").HedgeSpec, "id">) => void;
  updateHedge: (
    id: string,
    changes: Partial<Omit<import("@cabane/engine").HedgeSpec, "id">>,
  ) => void;
  paintRoomFloor: (roomId: string, finish: FloorFinishSpec, clearZones: boolean) => void;
  addFloorZone: (roomId: string, polygon: Polygon, finish: FloorFinishSpec) => void;
  addGroundZone: (polygon: Polygon, finish: FloorFinishSpec) => void;
  updateFloorZone: (
    zoneId: string,
    changes: Partial<Pick<FloorFinishZoneSpec, "polygon" | "finish">>,
  ) => void;
  /** True until the current architectural inputs have finished composition. */
  isSettling: boolean;
  draft: FloorEditorHistory["present"];
  selection: FloorEditorSelection;
  selectionTargets: readonly FloorEditorSelectionTarget[];
  deletionTargets: readonly FloorEditorSelectionTarget[];
  tool: FloorEditorTool;
  drawStart: PlanPoint | null;
  drawPreview: PlanPoint | null;
  drawAngleReferenceRadians: number | null;
  exteriorWallColor: string;
  defaultExteriorWallColor: string;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: (action: ConstructEditorAction) => void;
  setTool: (tool: FloorEditorTool) => void;
  floorPaintTarget: FloorPaintTarget;
  setFloorPaintTarget: (target: FloorPaintTarget) => void;
  selectWall: (id: string) => void;
  selectOpening: (id: string) => void;
  selectRoom: (id: string) => void;
  selectMany: (targets: readonly FloorEditorSelectionTarget[]) => void;
  clearSelection: () => void;
  setExteriorWallColor: (color: string) => void;
  updateWallEndpoint: (wallId: string, endpoint: "from" | "to", point: PlanPoint) => void;
  updateSelectedWallMetadata: (
    changes: Partial<
      Pick<
        EditorWall,
        | "name"
        | "thicknessMeters"
        | "heightMeters"
        | "exteriorColor"
        | "edgeColor"
        | "faceColors"
        | "niches"
      >
    >,
  ) => void;
  updateWallMetadata: (
    wallId: string,
    changes: Parameters<ConstructEditorController["updateSelectedWallMetadata"]>[0],
  ) => void;
  addWallSegment: (
    from: PlanPoint,
    to: PlanPoint,
    options?: { exteriorColor?: string; virtual?: boolean },
  ) => void;
  updateFloorSettings: (settings: FloorEditorFloorSettings) => void;
  setFloorName: (name: string) => void;
  updateRoom: (
    roomId: string,
    changes: Partial<
      Pick<
        FloorEditorHistory["present"]["rooms"][number],
        "name" | "accent" | "floorFinish" | "floorZones" | "ceilingHeightMeters" | "isSolid"
      >
    >,
  ) => void;
  updateSelectedRoom: (
    changes: Partial<
      Pick<
        FloorEditorHistory["present"]["rooms"][number],
        "name" | "accent" | "floorFinish" | "floorZones" | "ceilingHeightMeters" | "isSolid"
      >
    >,
  ) => void;
  resolveRoomMerge: (survivorId: string, roomId?: string) => void;
  translateWall: (wallId: string, delta: PlanPoint) => void;
  beginWall: (from: PlanPoint) => void;
  previewWall: (to: PlanPoint) => void;
  addWall: (to: PlanPoint) => void;
  cancelWall: () => void;
  addOpening: (kind: "door" | "window" | "passage" | "niche") => void;
  placeOpening: (
    kind: "door" | "window" | "passage" | "niche",
    wallId: string,
    offsetPlanUnits: number,
    side?: "left" | "right",
    configuration?: import("@cabane/engine").DoorConfiguration,
  ) => boolean;
  updateOpening: (opening: EditorOpening) => boolean;
  reorientOpening: (
    openingId: string,
    change: import("@cabane/engine").OpeningOrientationAction,
  ) => void;
  resizeOpening: (openingId: string, offsetPlanUnits: number, widthPlanUnits: number) => boolean;
  updateSelectedOpening: (
    patch: Partial<
      Pick<
        EditorOpening,
        "offsetPlanUnits" | "widthPlanUnits" | "openingHeightMeters" | "sillHeightMeters"
      >
    >,
  ) => void;
  replaceSelectedOpening: (opening: EditorOpening) => void;
  resizeSelectedOpening: (offsetPlanUnits: number, widthPlanUnits: number) => void;
  moveOpening: (openingId: string, wallId: string, offsetPlanUnits: number) => void;
  canDuplicateOpening: (openingId: string) => boolean;
  duplicateOpening: (openingId: string) => boolean;
  deleteSelected: () => void;
  deleteElements: (targets: readonly FloorEditorSelectionTarget[]) => void;
  undo: () => void;
  redo: () => void;
  replaceFloor: (floor: FloorSpec) => void;
}
