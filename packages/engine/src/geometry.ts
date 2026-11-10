import type {
  FloorCoordinates,
  FloorSpec,
  OpeningSpec,
  PlanPoint,
  Polygon,
  RoomSpec,
  WallSpec,
} from "./types";
import { slopedCeilingHeightSampler } from "./architecture-geometry/sloped-ceiling-plane";
import { isGardenGate } from "./garden-gate";
import type { SlopedCeilingSpec } from "./types";

export interface WorldPoint {
  x: number;
  z: number;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

export const planPointToWorld = (
  [x, y]: PlanPoint,
  coordinates: FloorCoordinates,
): readonly [number, number] => [
  (x - coordinates.origin[0]) * coordinates.metersPerPlanUnit,
  (y - coordinates.origin[1]) * coordinates.metersPerPlanUnit,
];

export const worldPointToPlan = (point: WorldPoint, coordinates: FloorCoordinates): PlanPoint => [
  point.x / coordinates.metersPerPlanUnit + coordinates.origin[0],
  point.z / coordinates.metersPerPlanUnit + coordinates.origin[1],
];

export const polygonSignedArea = (polygon: readonly PlanPoint[]) => {
  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
};

export const pointInsidePolygon = ([x, y]: PlanPoint, polygon: readonly PlanPoint[]) => {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const [currentX, currentY] = polygon[index];
    const [previousX, previousY] = polygon[previous];
    const crosses =
      currentY > y !== previousY > y &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (crosses) inside = !inside;
  }
  return inside;
};

const orientation = (a: PlanPoint, b: PlanPoint, c: PlanPoint) =>
  Math.sign((b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]));

const onSegment = (a: PlanPoint, b: PlanPoint, c: PlanPoint) =>
  b[0] <= Math.max(a[0], c[0]) &&
  b[0] >= Math.min(a[0], c[0]) &&
  b[1] <= Math.max(a[1], c[1]) &&
  b[1] >= Math.min(a[1], c[1]);

export const segmentsIntersect = (
  firstStart: PlanPoint,
  firstEnd: PlanPoint,
  secondStart: PlanPoint,
  secondEnd: PlanPoint,
) => {
  const firstA = orientation(firstStart, firstEnd, secondStart);
  const firstB = orientation(firstStart, firstEnd, secondEnd);
  const secondA = orientation(secondStart, secondEnd, firstStart);
  const secondB = orientation(secondStart, secondEnd, firstEnd);
  if (firstA !== firstB && secondA !== secondB) return true;
  return (
    (firstA === 0 && onSegment(firstStart, secondStart, firstEnd)) ||
    (firstB === 0 && onSegment(firstStart, secondEnd, firstEnd)) ||
    (secondA === 0 && onSegment(secondStart, firstStart, secondEnd)) ||
    (secondB === 0 && onSegment(secondStart, firstEnd, secondEnd))
  );
};

export const polygonSelfIntersects = (polygon: readonly PlanPoint[]) => {
  for (let first = 0; first < polygon.length; first += 1) {
    const firstNext = (first + 1) % polygon.length;
    for (let second = first + 1; second < polygon.length; second += 1) {
      const secondNext = (second + 1) % polygon.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (
        segmentsIntersect(polygon[first], polygon[firstNext], polygon[second], polygon[secondNext])
      )
        return true;
    }
  }
  return false;
};

export const polygonCentroid = (polygon: readonly PlanPoint[]): PlanPoint => {
  const area = polygonSignedArea(polygon);
  if (Math.abs(area) < 1e-9) {
    return [
      polygon.reduce((sum, point) => sum + point[0], 0) / polygon.length,
      polygon.reduce((sum, point) => sum + point[1], 0) / polygon.length,
    ];
  }
  let x = 0;
  let y = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const factor = current[0] * next[1] - next[0] * current[1];
    x += (current[0] + next[0]) * factor;
    y += (current[1] + next[1]) * factor;
  }
  return [x / (6 * area), y / (6 * area)];
};

export const worldBoundsForPolygon = (
  polygon: readonly PlanPoint[],
  coordinates: FloorCoordinates,
): WorldBounds => {
  const world = polygon.length
    ? polygon.map((point) => planPointToWorld(point, coordinates))
    : [
        [-4, -4],
        [4, 4],
      ];
  const xs = world.map(([x]) => x);
  const zs = world.map(([, z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
};

export const findContainingRoom = (point: PlanPoint, rooms: readonly RoomSpec[]) =>
  rooms.find((room) => pointInsidePolygon(point, room.polygon)) ?? null;

export const slopedCeilingHeightAtPoint = (
  point: PlanPoint,
  plane: SlopedCeilingSpec["planes"][number],
) => slopedCeilingHeightSampler(plane)(point);

export interface WallRun {
  id: string;
  wallId: string;
  startMeters: number;
  endMeters: number;
  bottomMeters: number;
  topMeters: number;
}

export const wallLengthPlanUnits = (wall: WallSpec) =>
  Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);

export const openingsForWall = (wallId: string, openings: readonly OpeningSpec[]) =>
  openings
    .filter((opening) => opening.wallId === wallId)
    .sort((left, right) => left.offsetFromWallStartPlanUnits - right.offsetFromWallStartPlanUnits);

/** Garden gates cut through the full wall height, independent of the leaf height. */
export const openingCutTop = (opening: OpeningSpec, wallTop: number) =>
  opening.kind === "door" && isGardenGate(opening.variant)
    ? wallTop
    : opening.sillHeightMeters + opening.openingHeightMeters;

export const splitWallIntoRuns = (
  wall: WallSpec,
  openings: readonly OpeningSpec[],
  coordinates: FloorCoordinates,
  defaultHeightMeters: number,
): WallRun[] => {
  const scale = coordinates.metersPerPlanUnit;
  const lengthMeters = wallLengthPlanUnits(wall) * scale;
  const wallHeight = wall.heightMeters ?? defaultHeightMeters;
  const runs: WallRun[] = [];
  let cursor = 0;
  for (const opening of openingsForWall(wall.id, openings)) {
    const start = opening.offsetFromWallStartPlanUnits * scale;
    const end = start + opening.widthPlanUnits * scale;
    if (start > cursor) {
      runs.push({
        id: `${wall.id}-full-${runs.length}`,
        wallId: wall.id,
        startMeters: cursor,
        endMeters: start,
        bottomMeters: 0,
        topMeters: wallHeight,
      });
    }
    if (opening.sillHeightMeters > 0) {
      runs.push({
        id: `${wall.id}-${opening.id}-sill`,
        wallId: wall.id,
        startMeters: start,
        endMeters: end,
        bottomMeters: 0,
        topMeters: opening.sillHeightMeters,
      });
    }
    const openingTop = openingCutTop(opening, wallHeight);
    if (openingTop < wallHeight) {
      runs.push({
        id: `${wall.id}-${opening.id}-lintel`,
        wallId: wall.id,
        startMeters: start,
        endMeters: end,
        bottomMeters: openingTop,
        topMeters: wallHeight,
      });
    }
    cursor = end;
  }
  if (cursor < lengthMeters) {
    runs.push({
      id: `${wall.id}-full-${runs.length}`,
      wallId: wall.id,
      startMeters: cursor,
      endMeters: lengthMeters,
      bottomMeters: 0,
      topMeters: wallHeight,
    });
  }
  return runs;
};

export interface OpeningWorldPlacement {
  start: readonly [number, number];
  end: readonly [number, number];
  center: readonly [number, number];
  widthMeters: number;
  rotationY: number;
}

export const openingWorldPlacement = (
  wall: WallSpec,
  opening: OpeningSpec,
  coordinates: FloorCoordinates,
): OpeningWorldPlacement => {
  const [wallStartX, wallStartZ] = planPointToWorld(wall.from, coordinates);
  const [wallEndX, wallEndZ] = planPointToWorld(wall.to, coordinates);
  const length = Math.hypot(wallEndX - wallStartX, wallEndZ - wallStartZ);
  const directionX = (wallEndX - wallStartX) / length;
  const directionZ = (wallEndZ - wallStartZ) / length;
  const startDistance = opening.offsetFromWallStartPlanUnits * coordinates.metersPerPlanUnit;
  const widthMeters = opening.widthPlanUnits * coordinates.metersPerPlanUnit;
  const start = [
    wallStartX + directionX * startDistance,
    wallStartZ + directionZ * startDistance,
  ] as const;
  const end = [start[0] + directionX * widthMeters, start[1] + directionZ * widthMeters] as const;
  return {
    start,
    end,
    center: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
    widthMeters,
    rotationY: -Math.atan2(directionZ, directionX),
  };
};

export const defineFloorPolygon = <T extends Polygon>(polygon: T) => polygon;

export const floorForManifest = (floors: readonly FloorSpec[]) =>
  floors.find((floor) => !floor.belowGround) ?? floors[0];
