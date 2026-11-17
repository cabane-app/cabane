import { elevationCutouts, localSurfaceAt, terrainLocalHeight } from "../elevation/surfaces";
import { floorSupportPolygons, pointOnFloorSupport } from "../outdoor-platforms/platform-geometry";
import { deriveFloorLevels } from "../building/floor-levels";
import { planPointToWorld, worldPointToPlan } from "../geometry";
import { createTerrainSurface } from "../terrain/terrain-surface";
import type { FloorCoordinates, FloorSpec } from "../types";
import { stairShapeGeometry } from "./stair-shape-geometry";
import type { BuildingGeometry, StairSpec } from "./types";

export const stairFloorIds = (stair: StairSpec): readonly string[] =>
  stair.terrain ? [stair.terrain.floorId] : [stair.lowerFloorId, stair.upperFloorId];

/** Physical surfaces beside a flight, before its own clearance is cut away. */
export function stairSurfaceSupport(building: BuildingGeometry, floor: FloorSpec) {
  const elevation = deriveFloorLevels(building.floors).find(
    (level) => level.floorId === floor.id,
  )!.elevationMeters;
  const terrain = createTerrainSurface(building.home?.terrain, building.floors);
  const groundAt = terrainLocalHeight(
    floor,
    terrain ? (x, z) => terrain.offsetAt(x, z) : undefined,
  );
  return {
    boundariesWorld: [...floorSupportPolygons(floor), ...elevationCutouts(floor)].map((polygon) =>
      polygon.map((p) => planPointToWorld(p, floor.coordinates)),
    ),
    heightAt(point: { x: number; z: number }) {
      const p = worldPointToPlan(point, floor.coordinates);
      const surface = localSurfaceAt(floor, p, groundAt);
      return pointOnFloorSupport(p, floor) || surface.id !== floor.id
        ? elevation + surface.elevation
        : groundAt(p);
    },
  };
}

/** Route endpoints depend only on the plan, before its vertical connection is resolved. */
export function stairRouteEnd(stair: StairSpec, coordinates: FloorCoordinates, upper: boolean) {
  const geometry = stairShapeGeometry(stair, 1, 2);
  const p = upper ? geometry.path.at(-1)! : geometry.path[0];
  const [x, z] = planPointToWorld(stair.at, coordinates);
  const c = Math.cos(stair.rotationYRadians),
    s = Math.sin(stair.rotationYRadians);
  return { x: x + p.x * c + p.z * s, z: z - p.x * s + p.z * c };
}

export function resolveStairConnection(building: BuildingGeometry, stair: StairSpec) {
  const levels = deriveFloorLevels(building.floors);
  if (stair.terrain) {
    const floor = building.floors.find((floor) => floor.id === stair.terrain?.floorId);
    if (!floor || (building.home?.apartmentFloor && !stair.terrain.surfaces)) return null;
    const point = stairRouteEnd(stair, building.coordinates, stair.terrain.end === "upper");
    const terrain = createTerrainSurface(building.home?.terrain, building.floors);
    const terrainElevation = terrain?.offsetAt(point.x, point.z) ?? 0;
    const elevation = levels.find((level) => level.floorId === floor.id)!.elevationMeters;
    if (stair.terrain.surfaces) {
      const support = stairSurfaceSupport(building, floor);
      const height = (upper: boolean) =>
        support.heightAt(stairRouteEnd(stair, building.coordinates, upper));
      return {
        lowerFloorId: floor.id,
        upperFloorId: floor.id,
        baseElevationMeters: height(false),
        riseMeters: height(true) - height(false),
      };
    }
    const lower = stair.terrain.end === "lower";
    return {
      lowerFloorId: lower ? undefined : floor.id,
      upperFloorId: lower ? floor.id : undefined,
      baseElevationMeters: lower ? terrainElevation : elevation,
      riseMeters: lower ? elevation - terrainElevation : terrainElevation - elevation,
    };
  }
  const index = building.floors.findIndex((floor) => floor.id === stair.lowerFloorId);
  if (index < 0 || building.floors[index + 1]?.id !== stair.upperFloorId) return null;
  return {
    lowerFloorId: stair.lowerFloorId,
    upperFloorId: stair.upperFloorId,
    baseElevationMeters: levels[index].elevationMeters,
    riseMeters: building.floors[index].floorToFloorHeightMeters,
  };
}

/** Reverse the same plan route while preserving its footprint and physical endpoints. */
export function reverseStairRoute(stair: StairSpec, coordinates: FloorCoordinates): StairSpec {
  const end = stairRouteEnd(stair, coordinates, true);
  const at = worldPointToPlan(end, coordinates);
  if (stair.shape === "spiral") {
    const sign = stair.direction === "clockwise" ? 1 : -1;
    return {
      ...stair,
      rotationYRadians: stair.rotationYRadians - (sign * stair.totalTurnDegrees * Math.PI) / 180,
      direction: sign === 1 ? ("counterclockwise" as const) : ("clockwise" as const),
    };
  }
  if (stair.shape === "l-shaped" || stair.shape === "u-shaped") {
    const sign = stair.turn === "right" ? 1 : -1;
    return {
      ...stair,
      at,
      rotationYRadians:
        stair.rotationYRadians + (stair.shape === "u-shaped" ? 0 : (sign * Math.PI) / 2 + Math.PI),
      lowerRunMeters: stair.upperRunMeters,
      upperRunMeters: stair.lowerRunMeters,
      turn: sign === 1 ? ("left" as const) : ("right" as const),
    };
  }
  return { ...stair, at, rotationYRadians: stair.rotationYRadians + Math.PI };
}

/** Placement starts on the selected floor and ends on terrain, in either vertical direction. */
export function connectStairToTerrain(building: BuildingGeometry, stair: StairSpec): StairSpec {
  if (!stair.terrain) return stair;
  const floor = deriveFloorLevels(building.floors).find(
    (level) => level.floorId === stair.terrain?.floorId,
  );
  if (!floor) return stair;
  const end = stairRouteEnd(stair, building.coordinates, true);
  const surface = createTerrainSurface(building.home?.terrain, building.floors);
  const connection = stair.terrain.surfaces ? resolveStairConnection(building, stair) : null;
  const descending = connection
    ? connection.riseMeters < 0
    : floor.elevationMeters > (surface?.offsetAt(end.x, end.z) ?? 0);
  const route = descending ? reverseStairRoute(stair, building.coordinates) : stair;
  return {
    ...route,
    terrain: {
      ...stair.terrain,
      floorId: stair.terrain.floorId,
      end: descending ? "lower" : "upper",
    },
  } as StairSpec;
}
