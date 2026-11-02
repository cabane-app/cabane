import type { SceneMode } from "../types";

export const SCENE_TAP_MOVE_TOLERANCE_PX = 10;

export const WALK_EYE_HEIGHT = 1.52;

export const WALK_PLAYER_RADIUS = 0.22;

export const WALK_MAX_STEP_METERS = 0.3;

export const WALK_CRUISE_SPEED = 2.3;

export const WALK_MAX_SPEED = 2.8;

export const WALK_EDGE_BOOST_START = 0.82;

export const WALK_PITCH_LIMIT = (55 * Math.PI) / 180;

export interface StickVector {
  x: number;
  y: number;
}

export interface WalkPoint {
  x: number;
  z: number;
}

export interface WalkPose extends WalkPoint {
  yaw: number;
  pitch: number;
}

export interface SegmentWalkCollider {
  kind: "segment";
  id: string;
  from: WalkPoint;
  to: WalkPoint;
  halfThickness: number;
  /** World-space vertical extent. Omitted colliders block at every walk height. */
  minY?: number;
  maxY?: number;
}

export interface BoxWalkCollider {
  kind: "box";
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** World-space vertical extent. Omitted colliders block at every walk height. */
  minY?: number;
  maxY?: number;
  /** World-space top elevation when this collider can support a standing walker. */
  supportY?: number;
}

export type WalkCollider = SegmentWalkCollider | BoxWalkCollider;

export interface WalkVerticalRange {
  minY: number;
  maxY: number;
}

export interface DerivedWalkNavigationOptions {
  openOpeningIds?: ReadonlySet<string>;
  furniture?: readonly BoxWalkCollider[];
  playerRadius?: number;
}

export interface WalkRoomConnection {
  kind: "opening" | "open-boundary";
  id: string;
  openingId?: string;
  roomIds: readonly [string, string];
}

export interface WalkRoomNavigation {
  roomId: string;
  spawnPose: WalkPose | null;
  connectedRoomIds: readonly string[];
}

export interface WalkNavigationDiagnostic {
  code: "navigation.room-no-walkable-connection";
  severity: "error" | "warning";
  path: string;
  message: string;
  suggestion: string;
  roomId: string;
}

export interface DerivedWalkNavigationEvaluation {
  valid: boolean;
  colliders: readonly WalkCollider[];
  connections: readonly WalkRoomConnection[];
  rooms: readonly WalkRoomNavigation[];
  diagnostics: readonly WalkNavigationDiagnostic[];
}

export interface SceneSessionState {
  mode: SceneMode;
  selectedRoomId: string | null;
  wallFadeEnabled: boolean;
}

export const SCENE_SESSION_STORAGE_KEY = "cabane-scene-session";

export const LEGACY_SCENE_SESSION_STORAGE_KEY = "smart-home-3d-scene-session";
