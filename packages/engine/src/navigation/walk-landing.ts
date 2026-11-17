import { localSurfaceAt } from "../elevation/surfaces";
import { deriveFloorLevels } from "../building/floor-levels";
import { pointInsidePolygon, worldPointToPlan } from "../geometry";
import type { BoxWalkCollider, WalkPoint } from "../navigation";
import { deriveStairFlight } from "../stairs/flight-geometry";
import { stairFloorIds } from "../stairs/stair-connection";
import { safeBuildingSpawn } from "../stairs/stair-navigation";
import type { BuildingGeometry } from "../stairs/types";
import type { WalkToolLanding } from "../walk-tools";

/** Deliberately conservative: relocation starts on supported, clear, level ground. */
export function resolveWalkLanding(
  building: BuildingGeometry,
  position: { x: number; y: number; z: number },
  furniture: (elevation: number) => readonly BoxWalkCollider[],
  supportsTerrain?: (point: WalkPoint) => boolean,
): WalkToolLanding | null {
  if (![position.x, position.y, position.z].every(Number.isFinite)) return null;
  const plan = worldPointToPlan(position, building.coordinates);
  const level = deriveFloorLevels(building.floors)
    .map((level) => ({
      ...level,
      supportElevation:
        level.elevationMeters +
        localSurfaceAt(
          building.floors.find((floor) => floor.id === level.floorId)!,
          plan,
        ).elevation,
    }))
    .sort(
      (a, b) =>
        Math.abs(a.supportElevation - position.y) - Math.abs(b.supportElevation - position.y),
    )[0];
  if (!level || Math.abs(level.supportElevation - position.y) > 1.05) return null;
  // Stair interiors require traversal state; never manufacture that state by relocation.
  if (
    building.stairs.some((stair) => {
      if (!stairFloorIds(stair).includes(level.floorId)) return false;
      const flight = deriveStairFlight(building, stair);
      return flight && pointInsidePolygon(plan, flight.footprint);
    })
  )
    return null;
  const spawn = safeBuildingSpawn(
    building,
    level.floorId,
    plan,
    supportsTerrain,
    furniture(level.supportElevation),
  );
  if (!spawn) return null;
  return {
    x: position.x,
    z: position.z,
    floorId: level.floorId,
    elevation: level.supportElevation,
  };
}
