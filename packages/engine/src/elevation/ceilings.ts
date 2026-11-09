import { floorZonePointWithinRoom } from "../floor-finishes/finish-geometry";
import { slopedCeilingHeightSampler } from "../architecture-geometry/sloped-ceiling-plane";
import type { FloorSpec, PlanPoint } from "../types";
import { elevationAreas } from "./surfaces";

export function ceilingHeightAt(
  floor: Pick<FloorSpec, "rooms" | "ceilings" | "defaultCeilingHeightMeters">,
  roomId: string,
  point: PlanPoint,
) {
  const room = floor.rooms.find((room) => room.id === roomId);
  const area = room?.floorZones?.find(
    (zone) =>
      zone.elevation?.ceilingHeightMeters !== undefined &&
      floorZonePointWithinRoom(point, zone.polygon),
  );
  if (area?.elevation?.ceilingHeightMeters !== undefined)
    return area.elevation.offsetMeters + area.elevation.ceilingHeightMeters;
  const ceiling = floor.ceilings?.find((ceiling) => ceiling.roomIds.includes(roomId));
  if (ceiling?.kind === "flat") return ceiling.heightMeters;
  if (ceiling?.kind === "sloped") {
    const plane = ceiling.planes.find((plane) => floorZonePointWithinRoom(point, plane.boundary));
    if (plane) return slopedCeilingHeightSampler(plane)(point);
  }
  return floor.defaultCeilingHeightMeters;
}

export const ceilingOverrides = (floor: FloorSpec) =>
  elevationAreas(floor).filter(
    (area) => area.roomId && area.elevation.ceilingHeightMeters !== undefined,
  );
