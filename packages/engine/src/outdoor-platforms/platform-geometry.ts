import { indoorRoomsForFloor } from "./platform-rooms";
import polygonClipping from "polygon-clipping";
import { pointInsidePolygon, polygonSignedArea } from "../geometry";
import { pointOnPolygonBoundary } from "../validation/geometry";
import { isPoolOutline } from "../pools/pool-footprint";
import type { FloorSpec, OutdoorPlatformSpec, PlanPoint, Polygon } from "../types";

export const isOutdoorPlatformOutline = isPoolOutline;
type SupportFloor = Pick<
  FloorSpec,
  "rooms" | "footprint" | "footprintRegions" | "outdoorPlatforms"
>;
/** The footprint is only an envelope on a floor made entirely of platforms. */
export const floorSlabPolygons = (floor: SupportFloor) =>
  (indoorRoomsForFloor(floor).length || !floor.outdoorPlatforms?.length
    ? (floor.footprintRegions ?? [floor.footprint])
    : []
  ).filter((p): p is Polygon => p.length >= 3);
export const floorSupportPolygons = (floor: SupportFloor) => [
  ...floorSlabPolygons(floor),
  ...(floor.outdoorPlatforms ?? [])
    .filter((p) => isOutdoorPlatformOutline(p.polygon))
    .map((p) => p.polygon),
];
export const pointOnFloorSupport = (
  point: PlanPoint,
  floor: Parameters<typeof floorSupportPolygons>[0],
) =>
  floorSupportPolygons(floor).some(
    (p) => pointInsidePolygon(point, p) || pointOnPolygonBoundary(point, p),
  );
export const platformPolygonsOverlap = (a: readonly PlanPoint[], b: readonly PlanPoint[]) => {
  if (!isOutdoorPlatformOutline(a) || !isOutdoorPlatformOutline(b)) return false;
  return polygonClipping
    .intersection(
      [a.map((p) => [p[0], p[1]] as [number, number])],
      [b.map((p) => [p[0], p[1]] as [number, number])],
    )
    .some(
      (p) =>
        Math.abs(polygonSignedArea(p[0])) -
          p.slice(1).reduce((n, h) => n + Math.abs(polygonSignedArea(h)), 0) >
        1e-8,
    );
};
/** Existing edges retain identity/configuration on corner edits and translation. */
export const platformWithPolygon = (
  platform: OutdoorPlatformSpec,
  polygon: OutdoorPlatformSpec["polygon"],
): OutdoorPlatformSpec => {
  const occupied = new Set(platform.edges.map((edge) => edge.id));
  let serial = 1;
  return {
    ...platform,
    polygon,
    edges: polygon.map((_, index) => {
      const oldIndex =
        polygon.length === platform.polygon.length
          ? index
          : platform.polygon.findIndex(
              (p) => Math.hypot(p[0] - polygon[index][0], p[1] - polygon[index][1]) < 1e-7,
            );
      if (oldIndex >= 0 && platform.edges[oldIndex]) return platform.edges[oldIndex];
      while (occupied.has(`${platform.id}:edge-${serial}`)) serial++;
      const id = `${platform.id}:edge-${serial++}`;
      occupied.add(id);
      return { id };
    }),
  };
};
