import { CatmullRomCurve3, Vector3 } from "three";
import { deriveFloorLevels } from "../../building/floor-levels";
import { planPointToWorld, pointInsidePolygon, worldPointToPlan } from "../../geometry";
import { resolveItemTransform } from "../../home-project/placements";
import { deriveWalkColliders, isWalkPointClear } from "../../navigation/walk-colliders";
import { WALK_EYE_HEIGHT, type BoxWalkCollider } from "../../navigation/walk-navigation-contract";
import type { HomeManifest, PlanPoint, RenderableFloorSpec } from "../../types";

const LIVING_ROOM_ID = "open-plan-living";
const WALK_SPEED = 0.88;
const CLEARANCE_SAMPLE_SPACING = 0.05;

// An eye-level tour of the bundled villa: past the dining table, along the
// garden windows, then back towards the kitchen. Coordinates are in plan units.
// The camera looks into the room as it moves, so it can linger on furnishings
// and the terrace instead of only looking straight down each aisle.
const VILLA_TOUR = [
  { at: [5.9, 12.05], yaw: -142 },
  { at: [9.1, 11.85], yaw: -154 },
  { at: [12.4, 11.95], yaw: 179 },
  { at: [13.1, 14.6], yaw: 108 },
  { at: [12.3, 16.85], yaw: 76 },
  { at: [8.55, 16.7], yaw: 68 },
  { at: [6.65, 15.95], yaw: 42 },
  { at: [6.05, 13.4], yaw: -65 },
] as const satisfies readonly { at: PlanPoint; yaw: number }[];

interface WelcomeWalkLoop {
  curve: CatmullRomCurve3;
  durationSeconds: number;
}

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

export function createWelcomeWalkLoop(
  manifest: HomeManifest,
  floor: RenderableFloorSpec,
  furniture: readonly BoxWalkCollider[] = [],
): WelcomeWalkLoop | null {
  const livingRoom = floor.rooms.find((room) => room.id === LIVING_ROOM_ID && !room.isSolid);
  if (!livingRoom) return null;
  const elevation = deriveFloorLevels(manifest.floors).find(
    (level) => level.floorId === floor.id,
  )?.elevationMeters;
  if (elevation === undefined) return null;

  const curve = new CatmullRomCurve3(
    VILLA_TOUR.map(({ at }) => {
      const [x, z] = planPointToWorld(at, floor.coordinates);
      return new Vector3(x, elevation + WALK_EYE_HEIGHT, z);
    }),
    true,
  );
  const length = curve.getLength();
  const colliders = deriveWalkColliders(
    floor,
    new Set(),
    [...furnishingColliders(manifest, floor), ...furniture],
    elevation,
  );
  const sampleCount = Math.ceil(length / CLEARANCE_SAMPLE_SPACING);
  // Validate the rounded corners as well as the authored waypoints. A customized
  // demo whose room layout has changed can fall back to the orbit preview.
  for (let index = 0; index < sampleCount; index++) {
    const point = curve.getPointAt(index / sampleCount);
    if (
      !pointInsidePolygon(worldPointToPlan(point, floor.coordinates), livingRoom.polygon) ||
      !isWalkPointClear(point, colliders)
    ) {
      return null;
    }
  }
  return { curve, durationSeconds: length / WALK_SPEED };
}

export function sampleWelcomeWalkLoop(loop: WelcomeWalkLoop, elapsedSeconds: number) {
  const distance = (elapsedSeconds % loop.durationSeconds) * WALK_SPEED;
  const time = loop.curve.getUtoTmapping(0, distance);
  const position = loop.curve.getPoint(time);
  const segment = time * VILLA_TOUR.length;
  const index = Math.floor(segment) % VILLA_TOUR.length;
  const amount = segment - Math.floor(segment);
  const eased = amount * amount * (3 - 2 * amount);
  const fromYaw = VILLA_TOUR[index].yaw;
  const toYaw = VILLA_TOUR[(index + 1) % VILLA_TOUR.length].yaw;
  const turn = ((toYaw - fromYaw + 540) % 360) - 180;
  return {
    position: [position.x, position.y, position.z] as const,
    yaw: ((fromYaw + turn * eased) * Math.PI) / 180,
    pitch: (-3 * Math.PI) / 180,
  };
}
