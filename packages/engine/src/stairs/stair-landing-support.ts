import { planPointToWorld, pointInsidePolygon } from "../geometry";
import { pointOnPolygonBoundary } from "../validation/geometry";
import { floorSupportPolygons } from "../outdoor-platforms/platform-geometry";
import { WALK_MAX_STEP_METERS } from "../navigation/walk-navigation-contract";
import { createTerrainSurface } from "../terrain/terrain-surface";
import { stairLandingSupported } from "./stair-clearance";
import type { BuildingGeometry } from "./types";
import type { StairFlight } from "./flight-geometry";

/** Both validation and exit advice use the same physical landing connection. */
export function stairEndSupported(building: BuildingGeometry, flight: StairFlight, upper: boolean) {
  const landing = upper ? flight.upperLanding : flight.lowerLanding;
  const floorId = upper ? flight.upperFloorId : flight.lowerFloorId;
  if (floorId) {
    const floor = building.floors.find((floor) => floor.id === floorId);
    return Boolean(
      floor && stairLandingSupported(landing, floorSupportPolygons(floor), building.coordinates),
    );
  }
  if (!flight.terrain || building.home?.apartmentFloor) return false;
  const surface = createTerrainSurface(building.home?.terrain, building.floors);
  const elevation = flight.baseElevationMeters + (upper ? flight.riseMeters : 0);
  const ground = building.floors.find((floor) => !floor.belowGround);
  if (!ground) return false;
  const holes = surface?.cutouts ?? ground.rooms.map((room) => room.polygon);
  const pools = building.floors.flatMap((floor) => floor.pools ?? []);
  return landing.every((a, i) => {
    const b = landing[(i + 1) % landing.length];
    const count = Math.max(
      1,
      Math.ceil(
        (Math.hypot(b[0] - a[0], b[1] - a[1]) * building.coordinates.metersPerPlanUnit) / 0.2,
      ),
    );
    return Array.from({ length: count + 1 }, (_, j) => {
      const point = [
        a[0] + ((b[0] - a[0]) * j) / count,
        a[1] + ((b[1] - a[1]) * j) / count,
      ] as const;
      if (
        holes.some(
          (hole) => pointInsidePolygon(point, hole) && !pointOnPolygonBoundary(point, hole),
        ) ||
        pools.some((pool) => pointInsidePolygon(point, pool.polygon))
      )
        return false;
      const [x, z] = planPointToWorld(point, building.coordinates);
      return Math.abs((surface?.offsetAt(x, z) ?? 0) - elevation) <= WALK_MAX_STEP_METERS;
    }).every(Boolean);
  });
}
