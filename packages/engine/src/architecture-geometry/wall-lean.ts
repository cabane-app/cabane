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
  leans = (floor.walls ?? []).flatMap((wall) => {
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

/**
 * The horizontal shift of a world point at height `y` (metres above the floor).
 * Where leaning walls meet, the point moves to where their sheared faces cross:
 * the shift whose component along each wall's normal is that wall's lean.
 * Walls in line (a wall split in two) share one normal and so one shift.
 */
const leanOffsetAt = (leans: readonly WallLean[], x: number, y: number, z: number): Horizontal => {
  const height = Math.max(y, 0);
  const shifts: { normal: Horizontal; amount: number }[] = [];
  for (const lean of leans) {
    if (!touches(lean, x, z)) continue;
    const amount = lean.slope * height;
    const same = shifts.find(
      (shift) => shift.normal[0] * lean.normal[0] + shift.normal[1] * lean.normal[1] > 0.995,
    );
    if (same) same.amount = Math.max(same.amount, amount);
    else shifts.push({ normal: lean.normal, amount });
  }
  if (!shifts.length) return [0, 0];
  const [first, second] = shifts;
  if (second) {
    // Solve n1·v = a1, n2·v = a2 for the corner of two walls at an angle.
    const det = first.normal[0] * second.normal[1] - first.normal[1] * second.normal[0];
    if (Math.abs(det) > 0.05)
      return [
        (first.amount * second.normal[1] - second.amount * first.normal[1]) / det,
        (first.normal[0] * second.amount - second.normal[0] * first.amount) / det,
      ];
  }
  return [first.normal[0] * first.amount, first.normal[1] * first.amount];
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

/** Move world-space outline rings to where the walls they follow are at `height`. */
export const leanWorldRings = <R extends readonly (readonly [number, number])[]>(
  rings: readonly R[],
  floor: FloorSpec,
  height: number,
): [number, number][][] => {
  const leans = wallLeans(floor);
  return rings.map((ring) =>
    ring.map(([x, z]): [number, number] => {
      if (!leans.length) return [x, z];
      const [dx, dz] = leanOffsetAt(leans, x, height, z);
      return [x + dx, z + dz];
    }),
  );
};
