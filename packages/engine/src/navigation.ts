import { findContainingRoom, openingWorldPlacement, worldPointToPlan } from "./geometry";

import {
  LEGACY_SCENE_SESSION_STORAGE_KEY,
  SCENE_SESSION_STORAGE_KEY,
  SCENE_TAP_MOVE_TOLERANCE_PX,
  SceneSessionState,
  WalkPoint,
} from "./navigation/walk-navigation-contract";
import type { FloorSpec, OpeningSpec, SceneMode } from "./types";

export const roomAtWorldPoint = (point: WalkPoint, floor: FloorSpec) =>
  findContainingRoom(worldPointToPlan(point, floor.coordinates), floor.rooms);

export const shouldAutoOpenDoor = (
  distance: number,
  currentlyOpen: boolean,
  openDistance = 1.15,
  closeDistance = 1.55,
) => distance <= (currentlyOpen ? closeDistance : openDistance);

export const distanceToOpening = (point: WalkPoint, opening: OpeningSpec, floor: FloorSpec) => {
  const wall = floor.walls.find((candidate) => candidate.id === opening.wallId);
  if (!wall) return Number.POSITIVE_INFINITY;
  const placement = openingWorldPlacement(wall, opening, floor.coordinates);
  const dx = placement.end[0] - placement.start[0];
  const dz = placement.end[1] - placement.start[1];
  const fraction = Math.max(
    0,
    Math.min(
      1,
      ((point.x - placement.start[0]) * dx + (point.z - placement.start[1]) * dz) /
        (dx * dx + dz * dz),
    ),
  );
  return Math.hypot(
    point.x - placement.start[0] - fraction * dx,
    point.z - placement.start[1] - fraction * dz,
  );
};

export const movedBeyondSceneTapTolerance = (
  start: { x: number; y: number },
  current: { x: number; y: number },
  tolerance = SCENE_TAP_MOVE_TOLERANCE_PX,
) => Math.hypot(current.x - start.x, current.y - start.y) > tolerance;

const defaultSceneSession = (): SceneSessionState => ({
  mode: "overview",
  selectedRoomId: null,
  wallFadeEnabled: true,
});

export const readSceneSession = (
  storage: (Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">>) | null | undefined,
): SceneSessionState => {
  try {
    const current = storage?.getItem(SCENE_SESSION_STORAGE_KEY) ?? null;
    const raw = current ?? storage?.getItem(LEGACY_SCENE_SESSION_STORAGE_KEY);
    if (!raw) return defaultSceneSession();
    const value = JSON.parse(raw) as Partial<SceneSessionState>;
    if (!(["overview", "room", "walk"] as const).includes(value.mode as SceneMode)) {
      return defaultSceneSession();
    }
    if (value.selectedRoomId !== null && typeof value.selectedRoomId !== "string") {
      return defaultSceneSession();
    }
    const state = {
      mode: value.mode as SceneMode,
      selectedRoomId: value.selectedRoomId ?? null,
      wallFadeEnabled: value.wallFadeEnabled !== false,
    };
    if (current === null) storage?.setItem?.(SCENE_SESSION_STORAGE_KEY, JSON.stringify(state));
    return state;
  } catch {
    return defaultSceneSession();
  }
};

export const writeSceneSession = (
  storage: Pick<Storage, "setItem"> | null | undefined,
  state: SceneSessionState,
) => {
  try {
    storage?.setItem(SCENE_SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Scene navigation must remain usable if storage is blocked or full.
  }
};
export {
  deriveWalkColliders,
  isWalkPointClear,
  walkCollidersForVerticalRange,
} from "./navigation/walk-colliders";
export { evaluateDerivedWalkNavigation } from "./navigation/walk-connectivity";
export {
  clampPitch,
  dampValue,
  integrateWalkVelocity,
  normalizeStickInput,
  resolveCircleMovement,
} from "./navigation/walk-motion";
export {
  LEGACY_SCENE_SESSION_STORAGE_KEY,
  SCENE_SESSION_STORAGE_KEY,
  SCENE_TAP_MOVE_TOLERANCE_PX,
  WALK_CRUISE_SPEED,
  WALK_EDGE_BOOST_START,
  WALK_EYE_HEIGHT,
  WALK_MAX_SPEED,
  WALK_PITCH_LIMIT,
  WALK_PLAYER_RADIUS,
} from "./navigation/walk-navigation-contract";
export type {
  BoxWalkCollider,
  DerivedWalkNavigationEvaluation,
  DerivedWalkNavigationOptions,
  SceneSessionState,
  SegmentWalkCollider,
  StickVector,
  WalkCollider,
  WalkNavigationDiagnostic,
  WalkPoint,
  WalkPose,
  WalkRoomConnection,
  WalkRoomNavigation,
  WalkVerticalRange,
} from "./navigation/walk-navigation-contract";
export { safeSpawnPoseForRoom, spawnPoseForRoom } from "./navigation/walk-spawn";

export {
  collectSceneWalkColliders,
  observeSceneWalkColliders,
} from "./navigation/scene-walk-colliders";
