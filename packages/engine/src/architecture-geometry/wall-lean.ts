import { Matrix4 } from "three";

import { planPointToWorld, worldPointToPlan } from "../geometry";

import type { FloorSpec, PlanPoint, WallSpec } from "../types";
import type { Horizontal } from "./architecture-geometry-contract";
import { wallExteriorNormal, wallFrame } from "./wall-coordinate-frame";

/**
 * A leaning wall is drawn as a shear: a point at height y on it moves
 * `leanMeters * y / wallHeight` along the wall's exterior normal (its left
 * normal for an interior wall), so the top sits `leanMeters` out from the base.
 * Anything touching the wall (corners, ceilings, openings) follows the same shear.
 */
export type WallLean = {
  wall: WallSpec;
  /** Horizontal shift per metre of height. */
  slope: number;
  normal: Horizontal;
  from: Horizontal;
  direction: Horizontal;
  length: number;
  reach: number;
};

const leansByFloor = new WeakMap<FloorSpec, readonly WallLean[]>();

const wallLeans = (floor: FloorSpec): readonly WallLean[] => {
  let leans = leansByFloor.get(floor);
  if (leans) return leans;
  leans = floor.walls.flatMap((wall) => {
    if (!wall.leanMeters) return [];
    const frame = wallFrame(wall, floor);
    const normal = wallExteriorNormal(wall, floor) ?? frame.normal;
    const height = wall.heightMeters ?? floor.defaultWallHeightMeters;
    return [
      {
        wall,
        slope: wall.leanMeters / height,
        normal,
        from: frame.from,
        direction: frame.direction,
        length: frame.length,
        // A point on either face, or a corner where another wall meets this one.
        reach: wall.thicknessMeters / 2 + 0.02,
      },
    ];
  });
  leansByFloor.set(floor, leans);
  return leans;
};

const touches = (lean: WallLean, x: number, z: number) => {
  const dx = x - lean.from[0];
  const dz = z - lean.from[1];
  const along = dx * lean.direction[0] + dz * lean.direction[1];
  const across = dx * lean.normal[0] + dz * lean.normal[1];
  return (
    along >= -lean.reach && along <= lean.length + lean.reach && Math.abs(across) <= lean.reach
  );
};

/** The horizontal shift of a world point at height `y` (metres above the floor). */
const leanOffsetAt = (leans: readonly WallLean[], x: number, y: number, z: number): Horizontal => {
  let offsetX = 0;
  let offsetZ = 0;
  const height = Math.max(y, 0);
  for (const lean of leans) {
    if (!touches(lean, x, z)) continue;
    offsetX += lean.normal[0] * lean.slope * height;
    offsetZ += lean.normal[1] * lean.slope * height;
  }
  return [offsetX, offsetZ];
};

/** Shear a flat xyz position list in place. */
export const leanPositions = (positions: number[] | Float32Array, floor: FloorSpec) => {
  const leans = wallLeans(floor);
  if (!leans.length) return;
  for (let index = 0; index < positions.length; index += 3) {
    const [dx, dz] = leanOffsetAt(
      leans,
      positions[index],
      positions[index + 1],
      positions[index + 2],
    );
    positions[index] += dx;
    positions[index + 2] += dz;
  }
};

/** Move a plan polygon's corners that sit on a leaning wall to where it is at `height`. */
export const leanPlanPolygon = <T extends readonly PlanPoint[]>(
  polygon: T,
  floor: FloorSpec,
  height: number,
): T => {
  const leans = wallLeans(floor);
  if (!leans.length) return polygon;
  return polygon.map((point) => {
    const [x, z] = planPointToWorld(point, floor.coordinates);
    const [dx, dz] = leanOffsetAt(leans, x, height, z);
    return dx || dz ? worldPointToPlan({ x: x + dx, z: z + dz }, floor.coordinates) : point;
  }) as unknown as T;
};

/** The shear for things set in a wall (windows, doors), about the floor level. */
export const wallLeanMatrix = (wall: WallSpec, floor: FloorSpec) => {
  const lean = wallLeans(floor).find((candidate) => candidate.wall.id === wall.id);
  if (!lean) return null;
  // prettier-ignore
  return new Matrix4().set(
    1, lean.normal[0] * lean.slope, 0, 0,
    0, 1, 0, 0,
    0, lean.normal[1] * lean.slope, 1, 0,
    0, 0, 0, 1,
  );
};
