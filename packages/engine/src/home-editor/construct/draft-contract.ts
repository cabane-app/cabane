/* Interaction concepts were reviewed against ai_room_planner (MIT); this
 * reducer and metre-first state contract are original to Cabane. */
import type {
  FloorCoordinates,
  FloorFinishSpec,
  FloorFinishZoneSpec,
  PlanPoint,
  Polygon,
  PoolSpec,
  OutdoorPlatformSpec,
  HedgeSpec,
  WallJunctionSpec,
} from "../../types";

import { type OpeningOrientationAction } from "../../opening-orientation";

import { type EditorOpening, type EditorRoomIdentity, type EditorWall } from "./topology";
import type { EditorWallAttachment } from "./wall-attachments";

export const FLOOR_EDITOR_DRAFT_VERSION = 1 as const;

export const FLOOR_EDITOR_HISTORY_LIMIT = 50;

export const FLOOR_EDITOR_GRID_METERS = 0.1;

export const FLOOR_EDITOR_ANGLE_STEP_RADIANS = Math.PI / 4;

export const FLOOR_EDITOR_ANGLE_SNAP_TOLERANCE_RADIANS = (5 * Math.PI) / 180;

export type FloorEditorTool =
  | "select"
  | "hedge"
  | "wall"
  | "door"
  | "niche"
  | "window"
  | "passage"
  | "floor"
  | "platform"
  | "pool"
  | "measure"
  | "pan";

export type FloorEditorSelectionTarget =
  | { kind: "hedge"; id: string }
  | {
      kind: "wall";
      id: string;
      /** Transient deletion interval along the source wall, from 0 to 1. */ span?: readonly [
        number,
        number,
      ];
    }
  | { kind: "opening"; id: string }
  | { kind: "room"; id: string }
  | { kind: "floor-zone"; id: string }
  | { kind: "pool"; id: string }
  | { kind: "outdoor-platform"; id: string };

export type FloorEditorSelection =
  | FloorEditorSelectionTarget
  | { kind: "multiple"; targets: readonly FloorEditorSelectionTarget[] }
  | null;

export interface FloorEditorView {
  center: PlanPoint;
  pixelsPerMeter: number;
}

export interface FloorEditorDraft {
  version: typeof FLOOR_EDITOR_DRAFT_VERSION;
  floorId: string;
  floorToFloorHeightMeters?: number;
  belowGround?: boolean;
  floorName: string;
  coordinates: FloorCoordinates;
  walls: EditorWall[];
  openings: EditorOpening[];
  rooms: EditorRoomIdentity[];
  junctions: WallJunctionSpec[];
  hedges?: HedgeSpec[];
  pools?: PoolSpec[];
  outdoorPlatforms?: OutdoorPlatformSpec[];
  groundZones?: FloorFinishZoneSpec[];
  defaultWallHeightMeters: number;
  defaultCeilingHeightMeters: number;
  exteriorWallThicknessMeters: number;
  interiorWallThicknessMeters: number;
  tool: FloorEditorTool;
  selection: FloorEditorSelection;
  view: FloorEditorView;
  nextSerial: number;
}

export interface FloorEditorHistory {
  past: FloorEditorDraft[];
  present: FloorEditorDraft;
  future: FloorEditorDraft[];
}

export interface FloorEditorFloorSettings {
  coordinates: FloorCoordinates;
  defaultWallHeightMeters: number;
  defaultCeilingHeightMeters: number;
}

export type FloorEditorAction =
  | { type: "set-tool"; tool: FloorEditorTool }
  | { type: "select"; selection: FloorEditorSelection }
  | { type: "set-view"; view: FloorEditorView }
  | { type: "add-wall"; from: PlanPoint; to: PlanPoint; exteriorColor?: string }
  | { type: "add-hedge"; hedge: Omit<HedgeSpec, "id"> }
  | { type: "update-hedge"; id: string; changes: Partial<Omit<HedgeSpec, "id">> }
  | { type: "add-pool"; polygon: Polygon }
  | {
      type: "add-outdoor-platform";
      polygon: Polygon;
      finish: FloorFinishSpec;
      defaultEdge: OutdoorPlatformSpec["defaultEdge"];
    }
  | {
      type: "update-outdoor-platform";
      id: string;
      changes: Partial<Omit<OutdoorPlatformSpec, "id">>;
    }
  | {
      type: "add-floor-zone";
      room: Pick<EditorRoomIdentity, "id" | "name" | "accent" | "anchor">;
      polygon: Polygon;
      finish: FloorFinishSpec;
    }
  | {
      type: "add-ground-zone";
      polygon: Polygon;
      finish: FloorFinishSpec;
    }
  | {
      type: "update-floor-zone";
      zoneId: string;
      changes: Partial<Pick<FloorFinishZoneSpec, "polygon" | "finish">>;
    }
  | { type: "update-pool"; poolId: string; polygon: Polygon }
  | { type: "move-endpoint"; from: PlanPoint; to: PlanPoint }
  | { type: "translate-wall"; wallId: string; delta: PlanPoint }
  | {
      type: "update-wall-metadata";
      wallId: string;
      changes: Partial<
        Pick<
          EditorWall,
          | "thicknessMeters"
          | "heightMeters"
          | "exteriorColor"
          | "edgeColor"
          | "faceColors"
          | "faceFinishes"
          | "niches"
        >
      >;
    }
  | { type: "delete-selection" }
  | { type: "delete-elements"; targets: readonly FloorEditorSelectionTarget[] }
  | {
      type: "add-opening";
      wallId: string;
      kind: "door" | "window" | "passage" | "niche";
      side?: "left" | "right";
      offsetPlanUnits: number;
      doorConfiguration?: import("../../types").DoorConfiguration;
    }
  | { type: "duplicate-opening"; openingId: string }
  | { type: "move-opening"; openingId: string; wallId: string; offsetPlanUnits: number }
  | { type: "resize-opening"; openingId: string; widthPlanUnits: number }
  | { type: "update-opening"; opening: EditorWallAttachment }
  | { type: "reorient-opening"; openingId: string; change: OpeningOrientationAction }
  | { type: "name-room"; roomId: string; name: string; accent: string; anchor: PlanPoint }
  | {
      type: "update-room-metadata";
      roomId: string;
      anchor: PlanPoint;
      changes: Partial<
        Pick<
          EditorRoomIdentity,
          "name" | "accent" | "floorFinish" | "floorZones" | "ceilingHeightMeters" | "isSolid"
        >
      >;
    }
  | {
      type: "resolve-room-merge";
      survivorId: string;
      mergedRoomIds: readonly string[];
      anchor: PlanPoint;
    }
  | { type: "discard-room-identity"; roomId: string }
  | { type: "set-floor-name"; name: string }
  | { type: "update-floor-settings"; settings: FloorEditorFloorSettings }
  | { type: "replace-draft"; draft: FloorEditorDraft }
  | { type: "undo" }
  | { type: "redo" };
