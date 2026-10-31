import { deriveOutdoorPlatformBarriers } from "../outdoor-platforms/platform-barriers";
import { rollUpDoorGeometry } from "../roll-up-door-geometry";
import { validHedge } from "../hedges/hedge-validity";
import { planPointToWorld } from "../geometry";

import { junctionConnectorInterval } from "../architecture-geometry";
import { physicalFloor } from "../architecture-geometry/physical-floor";

import {
  isPoolOutline,
  POOL_DEPTH_METERS,
  POOL_RIM_WIDTH_METERS,
  poolWorldRing,
} from "../pools/pool-footprint";

import type { FloorSpec, WallSpec } from "../types";
import { closestPointOnSegment } from "./walk-motion";
import {
  BoxWalkCollider,
  SegmentWalkCollider,
  WALK_PLAYER_RADIUS,
  WalkCollider,
  WalkPoint,
  WalkVerticalRange,
} from "./walk-navigation-contract";

const wallPointAtDistance = (
  wall: WallSpec,
  distanceMeters: number,
  floor: FloorSpec,
): WalkPoint => {
  const [fromX, fromZ] = planPointToWorld(wall.from, floor.coordinates);
  const [toX, toZ] = planPointToWorld(wall.to, floor.coordinates);
  const length = Math.hypot(toX - fromX, toZ - fromZ);
  return {
    x: fromX + ((toX - fromX) / length) * distanceMeters,
    z: fromZ + ((toZ - fromZ) / length) * distanceMeters,
  };
};

const wallColliderRuns = (
  wall: WallSpec,
  floor: FloorSpec,
  openOpeningIds: ReadonlySet<string>,
  elevation: number,
): SegmentWalkCollider[] => {
  const relevant = floor.openings
    .filter((opening) => opening.wallId === wall.id)
    .sort((left, right) => left.offsetFromWallStartPlanUnits - right.offsetFromWallStartPlanUnits);
  const scale = floor.coordinates.metersPerPlanUnit;
  const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]) * scale;
  const intervals: Array<readonly [number, number]> = [];
  let cursor = 0;
  for (const opening of relevant) {
    const start = opening.offsetFromWallStartPlanUnits * scale;
    const end = start + opening.widthPlanUnits * scale;
    if (start > cursor) intervals.push([cursor, start]);
    if (
      opening.kind !== "passage" &&
      (opening.kind === "window" || !openOpeningIds.has(opening.id))
    )
      intervals.push([start, end]);
    if (
      opening.kind === "door" &&
      opening.operation === "roll-up" &&
      openOpeningIds.has(opening.id)
    ) {
      const { jambWidth } = rollUpDoorGeometry(
        opening.widthPlanUnits * scale,
        opening.openingHeightMeters,
        1,
      );
      intervals.push([start, start + jambWidth], [end - jambWidth, end]);
    }
    cursor = end;
  }
  if (cursor < length) intervals.push([cursor, length]);
  return intervals.map(([start, end], index) => ({
    kind: "segment",
    id: `${wall.id}-walk-${index}`,
    from: wallPointAtDistance(wall, start, floor),
    to: wallPointAtDistance(wall, end, floor),
    halfThickness: wall.thicknessMeters / 2,
    minY: elevation,
    maxY: elevation + (wall.heightMeters ?? floor.defaultWallHeightMeters),
  }));
};

/** Virtual room dividers never block walking. */
export const deriveWalkColliders = (
  floor: FloorSpec,
  openOpeningIds: ReadonlySet<string> = new Set(),
  furniture: readonly BoxWalkCollider[] = [],
  elevation = 0,
): WalkCollider[] =>
  deriveBuiltWalkColliders(physicalFloor(floor), openOpeningIds, furniture, elevation);

const deriveBuiltWalkColliders = (
  floor: FloorSpec,
  openOpeningIds: ReadonlySet<string>,
  furniture: readonly BoxWalkCollider[],
  elevation: number,
): WalkCollider[] => [
  ...[...(floor.solidRooms ?? []), ...floor.rooms.filter((room) => room.isSolid)].flatMap(
    (room): SegmentWalkCollider[] =>
      room.polygon.map((point, index) => {
        const [x, z] = planPointToWorld(point, floor.coordinates);
        const [tx, tz] = planPointToWorld(
          room.polygon[(index + 1) % room.polygon.length],
          floor.coordinates,
        );
        return {
          kind: "segment",
          id: `${room.id}-solid-${index}`,
          from: { x, z },
          to: { x: tx, z: tz },
          halfThickness: 0,
          minY: elevation,
          maxY: elevation + floor.defaultWallHeightMeters,
        };
      }),
  ),
  ...deriveOutdoorPlatformBarriers(floor).map((barrier, index): SegmentWalkCollider => ({
    kind: "segment",
    id: `${barrier.edgeId}:walk-${index}`,
    from: { x: barrier.from[0], z: barrier.from[1] },
    to: { x: barrier.to[0], z: barrier.to[1] },
    halfThickness: barrier.configuration.kind === "low-wall" ? 0.075 : 0.035,
    minY: elevation,
    maxY: elevation + barrier.configuration.heightMeters,
  })),
  ...(floor.hedges ?? [])
    .filter((hedge) => validHedge(hedge, floor.coordinates.metersPerPlanUnit))
    .map((hedge): SegmentWalkCollider => {
      const [x, z] = planPointToWorld(hedge.from, floor.coordinates);
      const [tx, tz] = planPointToWorld(hedge.to, floor.coordinates);
      return {
        kind: "segment",
        id: `${hedge.id}-walk`,
        from: { x, z },
        to: { x: tx, z: tz },
        halfThickness: hedge.widthMeters / 2,
        minY: elevation,
        maxY: elevation + hedge.heightMeters,
      };
    }),
  ...(floor.pools ?? []).flatMap((pool): SegmentWalkCollider[] => {
    if (!isPoolOutline(pool.polygon)) return [];
    const ring = poolWorldRing(pool.polygon, floor.coordinates);
    return ring.map(([x, z], index) => ({
      kind: "segment",
      id: `${pool.id}-pool-edge-${index}`,
      from: { x, z },
      to: { x: ring[(index + 1) % ring.length][0], z: ring[(index + 1) % ring.length][1] },
      halfThickness: POOL_RIM_WIDTH_METERS,
      minY: elevation - POOL_DEPTH_METERS,
      maxY: elevation + floor.defaultWallHeightMeters,
    }));
  }),
  ...floor.walls.flatMap((wall) => wallColliderRuns(wall, floor, openOpeningIds, elevation)),
  ...floor.wallJunctions.flatMap((junction) => {
    return junction.wallIds.flatMap((wallId) => {
      const wall = floor.walls.find((candidate) => candidate.id === wallId);
      if (!wall) return [];
      const from = planPointToWorld(wall.from, floor.coordinates);
      const to = planPointToWorld(wall.to, floor.coordinates);
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
      const direction = [(to[0] - from[0]) / length, (to[1] - from[1]) / length] as const;
      const interval = junctionConnectorInterval(wall, junction, floor);
      if (!interval) return [];
      return [
        {
          kind: "segment" as const,
          id: `${junction.id}-${wall.id}-walk-arm`,
          from: {
            x: from[0] + direction[0] * interval[0],
            z: from[1] + direction[1] * interval[0],
          },
          to: { x: from[0] + direction[0] * interval[1], z: from[1] + direction[1] * interval[1] },
          halfThickness: wall.thicknessMeters / 2,
          minY: elevation,
          maxY: elevation + (wall.heightMeters ?? floor.defaultWallHeightMeters),
        },
      ];
    });
  }),
  ...furniture,
];

export const walkCollidersForVerticalRange = (
  colliders: readonly WalkCollider[],
  range?: WalkVerticalRange,
): readonly WalkCollider[] =>
  range
    ? colliders.filter(
        (collider) =>
          collider.minY === undefined ||
          collider.maxY === undefined ||
          (collider.maxY > range.minY + 1e-7 && collider.minY < range.maxY - 1e-7),
      )
    : colliders;

const distanceToWalkCollider = (point: WalkPoint, collider: WalkCollider) => {
  if (collider.kind === "segment") {
    const closest = closestPointOnSegment(point, collider.from, collider.to);
    return Math.hypot(point.x - closest.x, point.z - closest.z) - collider.halfThickness;
  }
  const dx =
    point.x < collider.minX
      ? collider.minX - point.x
      : point.x > collider.maxX
        ? point.x - collider.maxX
        : 0;
  const dz =
    point.z < collider.minZ
      ? collider.minZ - point.z
      : point.z > collider.maxZ
        ? point.z - collider.maxZ
        : 0;
  return Math.hypot(dx, dz);
};

export const isWalkPointClear = (
  point: WalkPoint,
  colliders: readonly WalkCollider[],
  radius = WALK_PLAYER_RADIUS,
) => colliders.every((collider) => distanceToWalkCollider(point, collider) + 1e-7 >= radius);
