import { elevationWalkable } from "../elevation/walk-support";
import { elevationAreas, localSurfaceAt, terrainLocalHeight } from "../elevation/surfaces";
import { createTerrainSurface } from "../terrain/terrain-surface";
import { deriveFloorLevels } from "../building/floor-levels";
import { worldPointToPlan } from "../geometry";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";
import { pointOnFloorSupport } from "../outdoor-platforms/platform-geometry";
import type { BuildingGeometry } from "../stairs/types";
import type { BuildingWalkPoint } from "../stairs/stair-navigation";
import { WALK_MAX_STEP_METERS, type WalkPoint } from "./walk-navigation-contract";

/** Follow the rendered grade, entering a floor only across a near-level threshold. */
export function resolveTerrainWalking(
  building: BuildingGeometry,
  previous: BuildingWalkPoint,
  next: BuildingWalkPoint,
  heightAt: (point: WalkPoint) => number | null,
  airborne = false,
): BuildingWalkPoint {
  if (airborne) return next;
  const plan = worldPointToPlan(next, building.coordinates);
  const levels = deriveFloorLevels(building.floors);
  const terrain = createTerrainSurface(building.home?.terrain, building.floors);
  for (const floor of [...building.floors].sort(
    (a, b) => Number(b.id === previous.floorId) - Number(a.id === previous.floorId),
  )) {
    const support = localSurfaceAt(
      floor,
      plan,
      terrainLocalHeight(floor, terrain ? (x, z) => terrain.offsetAt(x, z) : undefined),
    );
    const elevation =
      levels.find((level) => level.floorId === floor.id)!.elevationMeters + support.elevation;
    // Keep the feet at the edge height; the shared fall resolver starts gravity.
    if (
      floor.id === previous.floorId &&
      elevation < previous.elevation - WALK_MAX_STEP_METERS &&
      (pointOnFloorSupport(plan, floor) || support.id !== floor.id)
    )
      return { ...next, floorId: previous.floorId, elevation: previous.elevation };
    if (
      Math.abs(elevation - previous.elevation) <= WALK_MAX_STEP_METERS &&
      (pointOnFloorSupport(plan, floor) || support.id !== floor.id) &&
      elevationWalkable(
        floor,
        plan,
        terrainLocalHeight(floor, terrain ? (x, z) => terrain.offsetAt(x, z) : undefined),
      )
    )
      return { ...next, floorId: floor.id, elevation };
  }
  const height = heightAt(next);
  if (height === null) return previous;
  const elevation =
    height -
    (building.floors.some((floor) => elevationAreas(floor).length > 0)
      ? 0
      : GROUND_ELEVATION_METERS);
  if (elevation < previous.elevation - WALK_MAX_STEP_METERS)
    return { ...next, floorId: previous.floorId, elevation: previous.elevation };
  if (elevation - previous.elevation > WALK_MAX_STEP_METERS) return previous;
  // Door proximity must follow the grade before entering the next footprint.
  const level = levels.reduce(
    (nearest, candidate) =>
      Math.abs(candidate.elevationMeters - elevation) <
      Math.abs(nearest.elevationMeters - elevation)
        ? candidate
        : nearest,
    levels.find((level) => level.floorId === previous.floorId) ?? levels[0],
  );
  return { ...next, floorId: level.floorId, elevation };
}
