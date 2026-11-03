import { validHedge } from "../hedges/hedge-validity";
import polygonClipping, {
  type MultiPolygon,
  type Polygon as ClippingPolygon,
} from "polygon-clipping";
import {
  planPointToWorld,
  polygonSelfIntersects,
  polygonSignedArea,
  worldBoundsForPolygon,
} from "../geometry";
import type { FloorCoordinates, FloorSpec, PlanPoint, PoolSpec, Polygon } from "../types";

import { GROUND_ELEVATION_METERS } from "../ground-elevation";

export const POOL_DEPTH_METERS = 1.5;
export const POOL_RIM_WIDTH_METERS = 0.25;
export const POOL_LINING_CLEARANCE_METERS = 0.06;
export const POOL_GROUND_Y = GROUND_ELEVATION_METERS;
export const POOL_RIM_BASE_Y = POOL_GROUND_Y - 0.02;
export const POOL_WATER_Y = POOL_GROUND_Y - 0.12;

export const mapPoolOutline = (
  polygon: Polygon,
  map: (point: PlanPoint, index: number) => PlanPoint,
): Polygon => [
  map(polygon[0], 0),
  map(polygon[1], 1),
  map(polygon[2], 2),
  ...polygon.slice(3).map((point, index) => map(point, index + 3)),
];

/** Also guards geometry builders against malformed, recoverable drafts. */
export const isPoolOutline = (value: unknown): value is Polygon => {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    !value.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every((v) => typeof v === "number" && Number.isFinite(v)),
    )
  )
    return false;
  const points = value as PlanPoint[];
  if (
    points.some((point, index) =>
      points
        .slice(index + 1)
        .some((other) => Math.hypot(point[0] - other[0], point[1] - other[1]) <= 1e-7),
    )
  )
    return false;
  // Adjacent backtracking edges are not detected by the general intersection test.
  if (
    points.some((point, index) => {
      const before = points[(index + points.length - 1) % points.length];
      const after = points[(index + 1) % points.length];
      const a = [before[0] - point[0], before[1] - point[1]];
      const b = [after[0] - point[0], after[1] - point[1]];
      return Math.abs(a[0] * b[1] - a[1] * b[0]) < 1e-10 && a[0] * b[0] + a[1] * b[1] > 0;
    })
  )
    return false;
  return Math.abs(polygonSignedArea(points)) > 1e-8 && !polygonSelfIntersects(points);
};

export const poolWorldRing = (
  polygon: Polygon,
  coordinates: FloorCoordinates,
): [number, number][] => polygon.map((point) => [...planPointToWorld(point, coordinates)]);

/** Round-joined outward buffer. Boolean union handles concave corners without crossed miters. */
export const bufferedPoolFootprint = (
  polygon: Polygon,
  coordinates: FloorCoordinates,
  width: number,
): MultiPolygon => {
  if (!isPoolOutline(polygon)) return [];
  const ring = poolWorldRing(polygon, coordinates);
  const additions: ClippingPolygon[] = [];
  ring.forEach(([x, z], index) => {
    const [tx, tz] = ring[(index + 1) % ring.length];
    const length = Math.hypot(tx - x, tz - z);
    const nx = (-(tz - z) / length) * width,
      nz = ((tx - x) / length) * width;
    additions.push([
      [
        [x + nx, z + nz],
        [tx + nx, tz + nz],
        [tx - nx, tz - nz],
        [x - nx, z - nz],
      ],
    ]);
    additions.push([
      Array.from({ length: 24 }, (_, i): [number, number] => {
        const angle = (i * Math.PI) / 12;
        return [x + Math.cos(angle) * width, z + Math.sin(angle) * width];
      }),
    ]);
  });
  return polygonClipping.union([ring], ...additions);
};

export const poolOuterFootprint = (polygon: Polygon, coordinates: FloorCoordinates): MultiPolygon =>
  bufferedPoolFootprint(polygon, coordinates, POOL_RIM_WIDTH_METERS);

/** Ground must not share a plane with the basin lining; the rim covers this clearance. */
export const poolExcavationFootprint = (
  polygon: Polygon,
  coordinates: FloorCoordinates,
): MultiPolygon => bufferedPoolFootprint(polygon, coordinates, POOL_LINING_CLEARANCE_METERS);

export const poolRimFootprint = (polygon: Polygon, coordinates: FloorCoordinates): MultiPolygon => {
  const outer = poolOuterFootprint(polygon, coordinates);
  return outer.length
    ? polygonClipping.difference(outer, [poolWorldRing(polygon, coordinates)])
    : [];
};

/** Scene framing only: never enlarge the architectural floor footprint. */
export const worldBoundsForFloorScene = (floor: FloorSpec) => {
  const bounds = worldBoundsForPolygon(floor.footprint, floor.coordinates);
  for (const zone of [...(floor.groundZones ?? []), ...(floor.outdoorPlatforms ?? [])]) {
    if (
      !Array.isArray(zone.polygon) ||
      zone.polygon.length < 3 ||
      !zone.polygon.every(
        (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite),
      )
    )
      continue;
    const zoneBounds = worldBoundsForPolygon(zone.polygon, floor.coordinates);
    bounds.minX = Math.min(bounds.minX, zoneBounds.minX);
    bounds.maxX = Math.max(bounds.maxX, zoneBounds.maxX);
    bounds.minZ = Math.min(bounds.minZ, zoneBounds.minZ);
    bounds.maxZ = Math.max(bounds.maxZ, zoneBounds.maxZ);
  }
  for (const hedge of floor.hedges ?? []) {
    if (!validHedge(hedge, floor.coordinates.metersPerPlanUnit)) continue;
    for (const point of [hedge.from, hedge.to]) {
      const [x, z] = planPointToWorld(point, floor.coordinates);
      bounds.minX = Math.min(bounds.minX, x - hedge.widthMeters / 2);
      bounds.maxX = Math.max(bounds.maxX, x + hedge.widthMeters / 2);
      bounds.minZ = Math.min(bounds.minZ, z - hedge.widthMeters / 2);
      bounds.maxZ = Math.max(bounds.maxZ, z + hedge.widthMeters / 2);
    }
  }
  for (const pool of floor.pools ?? []) {
    if (!isPoolOutline(pool.polygon)) continue;
    const poolBounds = worldBoundsForPolygon(pool.polygon, floor.coordinates);
    bounds.minX = Math.min(bounds.minX, poolBounds.minX - POOL_RIM_WIDTH_METERS);
    bounds.maxX = Math.max(bounds.maxX, poolBounds.maxX + POOL_RIM_WIDTH_METERS);
    bounds.minZ = Math.min(bounds.minZ, poolBounds.minZ - POOL_RIM_WIDTH_METERS);
    bounds.maxZ = Math.max(bounds.maxZ, poolBounds.maxZ + POOL_RIM_WIDTH_METERS);
  }
  return {
    ...bounds,
    width: bounds.maxX - bounds.minX,
    depth: bounds.maxZ - bounds.minZ,
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerZ: (bounds.minZ + bounds.maxZ) / 2,
  };
};

/** Shared vertical layout keeps lining, coping and water aligned. */
export function poolVerticalLayout(pool: PoolSpec) {
  const height =
    Number.isFinite(pool.heightMeters) && pool.heightMeters! >= 0.3 && pool.heightMeters! <= 5
      ? pool.heightMeters!
      : POOL_DEPTH_METERS;
  const raised = pool.type === "above-ground-wood";
  const lift = raised ? height : 0;
  return {
    height,
    // Above-ground basins keep an opaque floor above the intact terrain.
    bottom: raised ? POOL_GROUND_Y + 0.025 : POOL_GROUND_Y - height,
    rim: POOL_RIM_BASE_Y + lift,
    water: POOL_WATER_Y + lift,
  };
}
