import { floorZonePointWithinRoom } from "../floor-finishes/finish-geometry";
import { WALK_EYE_HEIGHT } from "../navigation/walk-navigation-contract";
import { WALK_HEAD_MARGIN } from "../opening-pose";
import type { FloorSpec, PlanPoint } from "../types";
import { ceilingHeightAt } from "./ceilings";
import { localSurfaceAt } from "./surfaces";

/** Match terrain's normal.y > 0.5 limit and the walker's actual head clearance. */
export function elevationWalkable(
  floor: FloorSpec,
  point: PlanPoint,
  groundAt: (point: PlanPoint) => number = () => 0,
) {
  const surface = localSurfaceAt(floor, point, groundAt);
  const room = floor.rooms.find((room) => floorZonePointWithinRoom(point, room.polygon));
  if (
    room &&
    ceilingHeightAt(floor, room.id, point) - surface.elevation < WALK_EYE_HEIGHT + WALK_HEAD_MARGIN
  )
    return false;
  if (!surface.sloped) return true;
  const d = 0.001 / floor.coordinates.metersPerPlanUnit;
  const sample = (dx: number, dz: number) =>
    localSurfaceAt(floor, [point[0] + dx, point[1] + dz], groundAt).elevation;
  const dx = (sample(d, 0) - sample(-d, 0)) / 0.002;
  const dz = (sample(0, d) - sample(0, -d)) / 0.002;
  return 1 / Math.sqrt(1 + dx * dx + dz * dz) > 0.5;
}
