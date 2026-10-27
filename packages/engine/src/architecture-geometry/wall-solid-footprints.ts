import { type Polygon as ClippingPolygon } from "polygon-clipping";

import { BufferGeometry } from "three";

import { planPointToWorld } from "../geometry";

import type {
  FloorSpec,
  OpeningSpec,
  WallJunctionSpec,
  WallSpec,
  WallSurfaceFinish,
} from "../types";
import {
  EPSILON,
  Horizontal,
  JUNCTION_SEAM_OVERLAP_METERS,
  WallPlanFloor,
} from "./architecture-geometry-contract";
import { wallExteriorNormal, wallFrame } from "./wall-coordinate-frame";

export interface ArchitecturalWallGeometryGroup {
  geometry: BufferGeometry;
  finish?: WallSurfaceFinish;
  outwardNormal: Horizontal | null;
  fadeNormals: readonly Horizontal[];
  center: Horizontal;
}

export const orientedWallPolygon = (
  wall: WallSpec,
  floor: WallPlanFloor,
  startDistance = 0,
  endDistance?: number,
): ClippingPolygon => {
  const frame = wallFrame(wall, floor);
  const start = startDistance;
  const end = endDistance ?? frame.length;
  const across = wall.thicknessMeters / 2;
  const corners = [
    [start, -across],
    [end, -across],
    [end, across],
    [start, across],
    [start, -across],
  ].map(
    ([distance, side]) =>
      [
        frame.from[0] + frame.direction[0] * distance + frame.normal[0] * side,
        frame.from[1] + frame.direction[1] * distance + frame.normal[1] * side,
      ] as [number, number],
  );
  return [corners];
};

const junctionEndpointExtension = (
  wall: WallSpec,
  junction: WallJunctionSpec,
  floor: FloorSpec,
): number => {
  const frame = wallFrame(wall, floor);
  return Math.min(
    2,
    Math.max(
      ...floor.walls
        .filter((other) => other.id !== wall.id && junction.wallIds.includes(other.id))
        .map((other) => {
          const otherFrame = wallFrame(other, floor);
          const crossing = Math.abs(
            frame.direction[0] * otherFrame.normal[0] + frame.direction[1] * otherFrame.normal[1],
          );
          return crossing > 0.001 ? other.thicknessMeters / (2 * crossing) : 0;
        }),
      JUNCTION_SEAM_OVERLAP_METERS,
    ),
  );
};

export const junctionConnectorInterval = (
  wall: WallSpec,
  junction: WallJunctionSpec,
  floor: FloorSpec,
): readonly [number, number] | null => {
  const frame = wallFrame(wall, floor);
  const center = planPointToWorld(junction.at, floor.coordinates);
  const distance =
    (center[0] - frame.from[0]) * frame.direction[0] +
    (center[1] - frame.from[1]) * frame.direction[1];
  const atStart = Math.abs(distance) <= JUNCTION_SEAM_OVERLAP_METERS;
  const atEnd = Math.abs(distance - frame.length) <= JUNCTION_SEAM_OVERLAP_METERS;
  if (!atStart && !atEnd) return null;
  const extension = junctionEndpointExtension(wall, junction, floor);
  return atStart
    ? [-extension, JUNCTION_SEAM_OVERLAP_METERS]
    : [frame.length - JUNCTION_SEAM_OVERLAP_METERS, frame.length + extension];
};

const junctionEndpointArmPolygon = (
  wall: WallSpec,
  junction: WallJunctionSpec,
  floor: FloorSpec,
): ClippingPolygon | null => {
  const frame = wallFrame(wall, floor);
  const interval = junctionConnectorInterval(wall, junction, floor);
  if (!interval) return null;
  const [start, end] = interval;
  const across = wall.thicknessMeters / 2;
  return [
    [
      [start, -across],
      [end, -across],
      [end, across],
      [start, across],
      [start, -across],
    ].map(
      ([distance, side]) =>
        [
          frame.from[0] + frame.direction[0] * distance + frame.normal[0] * side,
          frame.from[1] + frame.direction[1] * distance + frame.normal[1] * side,
        ] as [number, number],
    ),
  ];
};

export const junctionCornerMiterPolygon = (
  junction: WallJunctionSpec,
  activeWalls: readonly WallSpec[],
  floor: WallPlanFloor,
): ClippingPolygon | null => {
  if (junction.wallIds.length !== 2) return null;
  const walls = activeWalls.filter((wall) => junction.wallIds.includes(wall.id));
  if (walls.length !== 2) return null;
  const [left, right] = walls;
  const leftFrame = wallFrame(left, floor);
  const rightFrame = wallFrame(right, floor);
  let leftNormal = wallExteriorNormal(left, floor);
  let rightNormal = wallExteriorNormal(right, floor);
  if (left.classification !== "exterior" || right.classification !== "exterior") {
    // Interior endpoint corners need the same outside quadrant as facade corners.
    // Restrict this fallback to right angles; preserve existing angled-wall behavior.
    const outward = (wall: WallSpec, direction: Horizontal): Horizontal | null => {
      const atStart =
        Math.hypot(...wall.from.map((value, axis) => value - junction.at[axis])) <= EPSILON;
      const atEnd =
        Math.hypot(...wall.to.map((value, axis) => value - junction.at[axis])) <= EPSILON;
      return atStart ? direction : atEnd ? [-direction[0], -direction[1]] : null;
    };
    const a = outward(left, leftFrame.direction);
    const b = outward(right, rightFrame.direction);
    if (!a || !b || Math.abs(a[0] * b[0] + a[1] * b[1]) > EPSILON) return null;
    const sign = Math.sign(a[0] * b[1] - a[1] * b[0]);
    leftNormal = [sign * a[1], -sign * a[0]];
    rightNormal = [-sign * b[1], sign * b[0]];
  }
  if (!leftNormal || !rightNormal) return null;
  const denominator =
    leftFrame.direction[0] * rightFrame.direction[1] -
    leftFrame.direction[1] * rightFrame.direction[0];
  if (Math.abs(denominator) <= EPSILON) return null;
  const center = planPointToWorld(junction.at, floor.coordinates);
  const leftOffset: Horizontal = [
    center[0] + (leftNormal[0] * left.thicknessMeters) / 2,
    center[1] + (leftNormal[1] * left.thicknessMeters) / 2,
  ];
  const rightOffset: Horizontal = [
    center[0] + (rightNormal[0] * right.thicknessMeters) / 2,
    center[1] + (rightNormal[1] * right.thicknessMeters) / 2,
  ];
  const offset: Horizontal = [rightOffset[0] - leftOffset[0], rightOffset[1] - leftOffset[1]];
  const progress =
    (offset[0] * rightFrame.direction[1] - offset[1] * rightFrame.direction[0]) / denominator;
  const miter: Horizontal = [
    leftOffset[0] + leftFrame.direction[0] * progress,
    leftOffset[1] + leftFrame.direction[1] * progress,
  ];
  const maximumMiter = Math.max(left.thicknessMeters, right.thicknessMeters) * 2;
  if (Math.hypot(miter[0] - center[0], miter[1] - center[1]) > maximumMiter) return null;
  return [
    [
      [center[0], center[1]],
      [leftOffset[0], leftOffset[1]],
      [miter[0], miter[1]],
      [rightOffset[0], rightOffset[1]],
      [center[0], center[1]],
    ],
  ];
};

/** Horizontal wall solids, including corner miters, shared by rendering and outdoor clearance. */
export const wallSolidFootprintPolygons = (
  floor: WallPlanFloor,
  activeWalls: readonly WallSpec[] = floor.walls,
): ClippingPolygon[] => [
  ...activeWalls.map((wall) => orientedWallPolygon(wall, floor)),
  ...floor.wallJunctions.flatMap((junction) => {
    const miter = junctionCornerMiterPolygon(junction, activeWalls, floor);
    return miter ? [miter] : [];
  }),
];

export const openingCutPolygon = (wall: WallSpec, opening: OpeningSpec, floor: FloorSpec) => {
  const scale = floor.coordinates.metersPerPlanUnit;
  // Cut beyond both wall faces, not exactly along their edges. Independent
  // clipping-grid rounding of diagonal endpoints can otherwise leave a
  // sub-micron sliver that extrudes into an opaque, full-height wall face.
  return orientedWallPolygon(
    { ...wall, thicknessMeters: wall.thicknessMeters + 0.002 },
    floor,
    opening.offsetFromWallStartPlanUnits * scale - 0.001,
    (opening.offsetFromWallStartPlanUnits + opening.widthPlanUnits) * scale + 0.001,
  );
};

const pointCoveredByWall = (
  point: Horizontal,
  wall: WallSpec,
  frame: ReturnType<typeof wallFrame>,
) => {
  const offsetX = point[0] - frame.from[0];
  const offsetZ = point[1] - frame.from[1];
  const along = offsetX * frame.direction[0] + offsetZ * frame.direction[1];
  const across = Math.abs(offsetX * frame.normal[0] + offsetZ * frame.normal[1]);
  return (
    along >= -JUNCTION_SEAM_OVERLAP_METERS &&
    along <= frame.length + JUNCTION_SEAM_OVERLAP_METERS &&
    across <= wall.thicknessMeters / 2 + JUNCTION_SEAM_OVERLAP_METERS
  );
};

const pointInsideRing = (point: Horizontal, ring: readonly (readonly [number, number])[]) => {
  let inside = false;
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current, current += 1
  ) {
    const [x, z] = ring[current];
    const [previousX, previousZ] = ring[previous];
    // Visible corner faces lie exactly on the assembly boundary. Include
    // those points consistently instead of relying on ray-casting direction.
    const dx = previousX - x;
    const dz = previousZ - z;
    const lengthSquared = dx * dx + dz * dz;
    const progress =
      lengthSquared > 0
        ? Math.max(0, Math.min(1, ((point[0] - x) * dx + (point[1] - z) * dz) / lengthSquared))
        : 0;
    if (Math.hypot(point[0] - x - progress * dx, point[1] - z - progress * dz) <= EPSILON)
      return true;
    const crosses = z > point[1] !== previousZ > point[1];
    if (crosses && point[0] < ((previousX - x) * (point[1] - z)) / (previousZ - z) + x)
      inside = !inside;
  }
  return inside;
};

/** Build once per geometry operation; no cache survives edits to the floor. */
export const createWallAssemblyPointTest = (wall: WallSpec, floor: FloorSpec) => {
  const frame = wallFrame(wall, floor);
  const arms = floor.wallJunctions.flatMap((junction) => {
    if (!junction.wallIds.includes(wall.id)) return [];
    const arm = junctionEndpointArmPolygon(wall, junction, floor);
    return arm ? [arm[0]] : [];
  });
  return (point: Horizontal) =>
    pointCoveredByWall(point, wall, frame) || arms.some((arm) => pointInsideRing(point, arm));
};

/** Footprints used to assign finishes to a wall and its junction arms. */
export const wallAssemblyFootprintPolygons = (
  wall: WallSpec,
  floor: FloorSpec,
): ClippingPolygon[] => [
  orientedWallPolygon(wall, floor),
  ...floor.wallJunctions.flatMap((junction) => {
    if (!junction.wallIds.includes(wall.id)) return [];
    const arm = junctionEndpointArmPolygon(wall, junction, floor);
    return arm ? [arm] : [];
  }),
];
