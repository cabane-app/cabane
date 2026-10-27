/*
 * Planar face traversal follows the conventional directed half-edge walk used
 * by OpenPlan3D and ai_room_planner (MIT). The implementation is original to
 * Cabane and keeps the data model independent from either application.
 */

import type {
  OpeningSpec,
  FloorCoordinates,
  FloorFinishSpec,
  FloorFinishZoneSpec,
  FloorSpec,
  ManifestIssue,
  PlanPoint,
  Polygon,
  PoolSpec,
  OutdoorPlatformSpec,
  HedgeSpec,
  WallJunctionSpec,
  WallSpec,
} from "../../types";

export const FLOOR_EDITOR_EPSILON = 1e-7;

export interface EditorWall {
  id: string;
  from: PlanPoint;
  to: PlanPoint;
  thicknessMeters?: number;
  heightMeters?: number;
  exteriorColor?: string | undefined;
  edgeColor?: string | undefined;
  faceColors?: WallSpec["faceColors"];
  faceFinishes?: WallSpec["faceFinishes"];
  niches?: WallSpec["niches"];
}

type EditableOpening<T extends OpeningSpec> = T extends OpeningSpec
  ? Omit<T, "offsetFromWallStartPlanUnits" | "contactSlot" | "coverSlot" | "visualModel"> & {
      offsetPlanUnits: number;
    }
  : never;
export type EditorOpening = EditableOpening<OpeningSpec>;

export interface EditorRoomIdentity {
  isSolid?: boolean;
  id: string;
  name: string;
  accent: string;
  floorFinish?: FloorFinishSpec;
  floorZones?: FloorFinishZoneSpec[];
  ceilingId?: string;
  ceilingHeightMeters?: number;
  anchor: PlanPoint;
}

export interface FloorTopologyInput {
  floorId: string;
  floorToFloorHeightMeters?: number;
  belowGround?: boolean;
  floorName: string;
  coordinates?: FloorCoordinates;
  walls: readonly EditorWall[];
  openings: readonly EditorOpening[];
  rooms: readonly EditorRoomIdentity[];
  reservedRoomNames?: readonly string[];
  junctions?: readonly WallJunctionSpec[];
  hedges?: readonly HedgeSpec[];
  pools?: readonly PoolSpec[];
  outdoorPlatforms?: readonly OutdoorPlatformSpec[];
  groundZones?: readonly FloorFinishZoneSpec[];
  defaultWallHeightMeters?: number;
  defaultCeilingHeightMeters?: number;
  exteriorWallThicknessMeters?: number;
  interiorWallThicknessMeters?: number;
  defaultRoomAccent?: string;
}

export interface FloorTopologyResult {
  floor?: FloorSpec;
  issues: ManifestIssue[];
  faces: readonly Polygon[];
  classifications: Readonly<Record<string, "interior" | "exterior">>;
  wallRuns: readonly DerivedWallRun[];
}

export interface DerivedWallRun {
  sourceWallId: string;
  wallId: string;
  startOffsetPlanUnits: number;
  endOffsetPlanUnits: number;
  classification: "interior" | "exterior";
}

export interface RemappedWallOffset {
  wallId: string;
  offsetFromWallStartPlanUnits: number;
}

export interface Node {
  key: string;
  point: PlanPoint;
}

export interface Subsegment {
  id: string;
  wallId: string;
  from: Node;
  to: Node;
}

export interface DirectedEdge {
  id: string;
  segment: Subsegment;
  from: Node;
  to: Node;
  reverseId: string;
}
