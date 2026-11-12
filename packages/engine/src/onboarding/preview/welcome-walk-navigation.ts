import { deriveFloorLevels } from "../../building/floor-levels";
import { pointInsidePolygon, worldPointToPlan } from "../../geometry";
import { resolveItemTransform } from "../../home-project/placements";
import { deriveWalkColliders, isWalkPointClear } from "../../navigation/walk-colliders";
import { resolveCircleMovement } from "../../navigation/walk-motion";
import {
  WALK_EYE_HEIGHT,
  type BoxWalkCollider,
  type StickVector,
  type WalkPoint,
} from "../../navigation/walk-navigation-contract";
import type { HomeManifest, RenderableFloorSpec } from "../../types";
import { welcomeWalkTour } from "./welcome-walk-tour";

const MANUAL_WALK_SPEED = 1.5;

function furnishingColliders(
  manifest: HomeManifest,
  floor: RenderableFloorSpec,
): BoxWalkCollider[] {
  return manifest.sceneItems.flatMap((item) => {
    if (item.floorId !== floor.id || item.placement.kind !== "absolute") return [];
    const { position, rotationYRadians } = resolveItemTransform(item.placement, floor);
    const [x, y, z] = position;
    const [width, height, depth] = item.size;
    // The tour needs to avoid furnishings, including catalog items the
    // interactive walker can pass through. Leave rugs and overhead models out.
    if (y + height <= 0.05 || y >= WALK_EYE_HEIGHT + 0.1) return [];
    const cos = Math.abs(Math.cos(rotationYRadians));
    const sin = Math.abs(Math.sin(rotationYRadians));
    const halfWidth = (width * cos + depth * sin) / 2;
    const halfDepth = (width * sin + depth * cos) / 2;
    return [
      {
        kind: "box",
        id: item.id,
        minX: x - halfWidth,
        maxX: x + halfWidth,
        minZ: z - halfDepth,
        maxZ: z + halfDepth,
      },
    ];
  });
}

export function createWelcomeWalkNavigation(
  manifest: HomeManifest,
  floor: RenderableFloorSpec,
  furniture: readonly BoxWalkCollider[] = [],
) {
  const tour = welcomeWalkTour(floor);
  const livingRoom = floor.rooms.find((room) => room.id === tour?.roomId && !room.isSolid);
  if (!livingRoom) return null;
  const elevation = deriveFloorLevels(manifest.floors).find(
    (level) => level.floorId === floor.id,
  )?.elevationMeters;
  if (elevation === undefined) return null;

  const colliders = deriveWalkColliders(
    floor,
    new Set(),
    [...furnishingColliders(manifest, floor), ...furniture],
    elevation,
  );
  const insideRoom = (point: WalkPoint) =>
    pointInsidePolygon(worldPointToPlan(point, floor.coordinates), livingRoom.polygon);
  const isClear = (point: WalkPoint) => insideRoom(point) && isWalkPointClear(point, colliders);

  return {
    eyeHeight: elevation + WALK_EYE_HEIGHT,
    isClear,
    move(start: WalkPoint, input: StickVector, yaw: number, seconds: number) {
      const scale = (MANUAL_WALK_SPEED * seconds) / Math.max(1, Math.hypot(input.x, input.y));
      const next = resolveCircleMovement(
        start,
        {
          x: (Math.cos(yaw) * input.x + Math.sin(yaw) * input.y) * scale,
          z: (-Math.sin(yaw) * input.x + Math.cos(yaw) * input.y) * scale,
        },
        colliders,
      );
      return isClear(next) ? next : start;
    },
  };
}
