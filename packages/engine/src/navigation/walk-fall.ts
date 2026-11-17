import { elevationAreas, localSurfaceAt, terrainLocalHeight } from "../elevation/surfaces";
import { createTerrainSurface } from "../terrain/terrain-surface";
import { deriveFloorLevels } from "../building/floor-levels";
import { worldPointToPlan } from "../geometry";
import { pointOnFloorSupport } from "../outdoor-platforms/platform-geometry";
import type { BuildingGeometry } from "../stairs/types";
import type { BuildingWalkPoint } from "../stairs/stair-navigation";
import { WALK_MAX_STEP_METERS, type WalkPoint } from "./walk-navigation-contract";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";

export interface WalkFall {
  kind: "fall";
  point: BuildingWalkPoint;
  jumpHeight: number;
}

export type WalkFallResolution = WalkFall | { kind: "supported" } | { kind: "blocked" };

/** Drop an airborne walker from an elevated platform onto rendered ground. */
export function resolveWalkFall(
  building: BuildingGeometry,
  candidate: BuildingWalkPoint,
  feetElevation: number,
  supportsTerrain: (point: WalkPoint) => boolean,
  terrainHeight?: (point: WalkPoint) => number | null,
): WalkFallResolution {
  const floor = building.floors.find((entry) => entry.id === candidate.floorId);
  const ground = building.floors.find((entry) => !entry.belowGround);
  if (!floor || !ground) return { kind: "blocked" };
  if (candidate.stairId) return { kind: "supported" };
  const plan = worldPointToPlan(candidate, building.coordinates);
  const terrain = createTerrainSurface(building.home?.terrain, building.floors);
  const surface = localSurfaceAt(
    floor,
    plan,
    terrainLocalHeight(floor, terrain ? (x, z) => terrain.offsetAt(x, z) : undefined),
  );
  if (surface.id !== floor.id || pointOnFloorSupport(plan, floor)) {
    const elevation =
      deriveFloorLevels(building.floors).find((level) => level.floorId === floor.id)!
        .elevationMeters + surface.elevation;
    if (elevation > feetElevation + WALK_MAX_STEP_METERS) return { kind: "blocked" };
    if (Math.abs(candidate.elevation - elevation) > 1e-8)
      return {
        kind: "fall",
        point: { ...candidate, elevation },
        jumpHeight: Math.max(0, feetElevation - elevation),
      };
    return { kind: "supported" };
  }
  if (
    terrainHeight &&
    !pointOnFloorSupport(worldPointToPlan(candidate, building.coordinates), floor)
  ) {
    const height = terrainHeight(candidate);
    if (height === null) return { kind: "blocked" };
    const elevation =
      height -
      (building.floors.some((floor) => elevationAreas(floor).length > 0)
        ? 0
        : GROUND_ELEVATION_METERS);
    if (elevation > feetElevation + WALK_MAX_STEP_METERS) return { kind: "blocked" };
    return {
      kind: "fall",
      point: { ...candidate, elevation },
      jumpHeight: Math.max(0, feetElevation - elevation),
    };
  }
  if (floor.id === ground.id) return { kind: "supported" };
  if (pointOnFloorSupport(worldPointToPlan(candidate, building.coordinates), floor))
    return { kind: "supported" };
  if (!supportsTerrain(candidate)) return { kind: "blocked" };
  const groundElevation = deriveFloorLevels(building.floors).find(
    (level) => level.floorId === ground.id,
  )?.elevationMeters;
  if (groundElevation === undefined || groundElevation >= candidate.elevation)
    return { kind: "blocked" };
  return {
    kind: "fall",
    point: { ...candidate, floorId: ground.id, elevation: groundElevation },
    jumpHeight: Math.max(0, feetElevation - groundElevation),
  };
}
