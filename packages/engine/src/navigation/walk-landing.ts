import { deriveFloorLevels } from "../building/floor-levels";
import { pointInsidePolygon, worldPointToPlan } from "../geometry";
import { isWalkPointClear, type BoxWalkCollider, type WalkPoint } from "../navigation";
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
  const level = [...deriveFloorLevels(building.floors)].sort(
    (a, b) => Math.abs(a.elevationMeters - position.y) - Math.abs(b.elevationMeters - position.y),
  )[0];
  if (!level || Math.abs(level.elevationMeters - position.y) > 1.05) return null;
  const plan = worldPointToPlan(position, building.coordinates);
  // Stair interiors require traversal state; never manufacture that state by relocation.
  if (
    building.stairs.some((stair) => {
      if (!stairFloorIds(stair).includes(level.floorId)) return false;
      const flight = deriveStairFlight(building, stair);
      return flight && pointInsidePolygon(plan, flight.footprint);
    })
  )
    return null;
  const spawn = safeBuildingSpawn(building, level.floorId, plan, supportsTerrain);
  if (!spawn || !isWalkPointClear(position, furniture(level.elevationMeters))) return null;
  return { x: position.x, z: position.z, floorId: level.floorId, elevation: level.elevationMeters };
}
