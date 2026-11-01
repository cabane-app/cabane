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
  for (const floor of building.floors) {
    const elevation = levels.find((level) => level.floorId === floor.id)!.elevationMeters;
    if (
      Math.abs(elevation - previous.elevation) <= WALK_MAX_STEP_METERS &&
      pointOnFloorSupport(plan, floor)
    )
      return { ...next, floorId: floor.id, elevation };
  }
  const height = heightAt(next);
  if (height === null) return previous;
  const elevation = height - GROUND_ELEVATION_METERS;
  if (Math.abs(elevation - previous.elevation) > WALK_MAX_STEP_METERS) return previous;
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
