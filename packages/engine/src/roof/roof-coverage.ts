import { indoorRoomsForFloor } from "../outdoor-platforms/platform-rooms";
import { isOutdoorPlatformOutline } from "../outdoor-platforms/platform-geometry";
import polygonClipping, { type MultiPolygon, type Polygon as ClipPolygon } from "polygon-clipping";
import {
  differenceClippingGeometry,
  unionClippingPolygons,
} from "../architecture-geometry/architecture-clipping";
import { physicalFloor } from "../architecture-geometry/physical-floor";
import { wallSolidFootprintPolygons } from "../architecture-geometry/wall-solid-footprints";
import { deriveFloorLevels } from "../building/floor-levels";
import { planPointToWorld, slopedCeilingHeightAtPoint, worldPointToPlan } from "../geometry";
import type { FloorSpec, PlanPoint } from "../types";
import { ROOF_MAX_RISE_METERS, ROOF_THICKNESS_METERS } from "./roof-settings";

export interface RoofRegion {
  floorId: string;
  polygon: ClipPolygon;
  baseHeight: number;
  maxRise: number;
  /** Authored slopes already define their outer silhouette. */
  heightAt?: (point: [number, number]) => number;
}

const worldPolygon = (points: readonly PlanPoint[], floor: FloorSpec): ClipPolygon => [
  points.map((point) => [...planPointToWorld(point, floor.coordinates)]),
];

/** Include the wall tops, but never fill an unroofed courtyard between rooms. */
const coveredFloor = (floor: FloorSpec): MultiPolygon => {
  const rooms = indoorRoomsForFloor(floor);
  const domain = unionClippingPolygons([
    ...(rooms.length
      ? rooms.map((room) => worldPolygon(room.polygon, floor))
      : floor.outdoorPlatforms?.length
        ? []
        : (floor.footprintRegions ?? [floor.footprint]).map((polygon) =>
            worldPolygon(polygon, floor),
          )),
    ...wallSolidFootprintPolygons(floor),
  ]);
  // Room interiors and wall solids can leave narrow service/seam gaps. These
  // are not roof openings. Only bridge enclosed voids narrower than a wall;
  // retain courtyard rings and every concavity of the exterior outline.
  const seamWidth = Math.max(0.005, ...floor.walls.map((wall) => wall.thicknessMeters)) + 0.01;
  return domain.map(([outer, ...holes]) => [
    outer,
    ...holes.filter((ring) => {
      const width = Math.max(...ring.map((p) => p[0])) - Math.min(...ring.map((p) => p[0]));
      const depth = Math.max(...ring.map((p) => p[1])) - Math.min(...ring.map((p) => p[1]));
      return Math.min(width, depth) > seamWidth;
    }),
  ]);
};

/** Extend a ceiling into its supporting walls; the building domain clips the result. */
const ceilingWithWalls = (
  polygon: ClipPolygon,
  margin: number,
  domain: MultiPolygon,
): MultiPolygon => {
  const ring = polygon[0];
  const strips: ClipPolygon[] = [polygon];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-8) continue;
    const dx = ((b[0] - a[0]) / length) * margin,
      dz = ((b[1] - a[1]) / length) * margin;
    strips.push([
      [
        [a[0] - dx - dz, a[1] - dz + dx],
        [b[0] + dx - dz, b[1] + dz + dx],
        [b[0] + dx + dz, b[1] + dz - dx],
        [a[0] - dx + dz, a[1] - dz - dx],
      ],
    ]);
  }
  return polygonClipping.intersection(unionClippingPolygons(strips), domain);
};

export function deriveRoofRegions(requestedFloors: readonly FloorSpec[]): RoofRegion[] {
  const floors = requestedFloors.map(physicalFloor);
  const levels = deriveFloorLevels(floors);
  const domains = floors.map(coveredFloor);
  const coverDomains = floors.map((floor, index) =>
    unionClippingPolygons([
      ...domains[index],
      ...(floor.outdoorPlatforms ?? [])
        .filter((p) => isOutdoorPlatformOutline(p.polygon))
        .map((p) => worldPolygon(p.polygon, floor)),
    ]),
  );
  return floors.flatMap((floor, index) => {
    const rooms = indoorRoomsForFloor(floor);
    const domain = domains[index];
    if (!domain.length) return [];
    const elevation = levels[index].elevationMeters;
    const upperCoverage = coverDomains.slice(index + 1).filter((polygon) => polygon.length);
    // Drawn platforms stop at wall centerlines. Cover the supporting wall tops
    // too, otherwise their outer halves become narrow, full-height gables.
    // Restrict the extension to wall solids so exposed rooms keep their roofs.
    const wallTops = unionClippingPolygons(wallSolidFootprintPolygons(floor));
    const margin = Math.max(0, ...floor.walls.map((wall) => wall.thicknessMeters / 2)) + 0.002;
    const above = upperCoverage.map((coverage) =>
      unionClippingPolygons([
        ...coverage,
        ...coverage.flatMap((polygon) => ceilingWithWalls(polygon, margin, wallTops)),
      ]),
    );
    const ceilings = floor.ceilings ?? [
      {
        id: "roof-default",
        kind: "flat" as const,
        roomIds: rooms.map((room) => room.id),
        heightMeters: floor.defaultCeilingHeightMeters,
      },
    ];
    const flat = new Map<number, ClipPolygon[]>();
    const slopes: RoofRegion[] = [];
    for (const ceiling of ceilings) {
      if (ceiling.kind === "sloped") {
        for (const plane of ceiling.planes) {
          slopes.push({
            floorId: floor.id,
            polygon: worldPolygon(plane.boundary, floor),
            baseHeight: elevation + Math.min(plane.lowHeightMeters, plane.highHeightMeters) + 0.16,
            maxRise: 0,
            heightAt: ([x, z]) =>
              elevation +
              0.16 +
              slopedCeilingHeightAtPoint(worldPointToPlan({ x, z }, floor.coordinates), plane),
          });
        }
      } else {
        const height = elevation + ceiling.heightMeters + 0.16;
        const polygons = flat.get(height) ?? [];
        const coveredRooms = rooms.filter((room) => ceiling.roomIds.includes(room.id));
        for (const room of coveredRooms)
          polygons.push(...ceilingWithWalls(worldPolygon(room.polygon, floor), margin, domain));
        if (!rooms.length) polygons.push(...domain);
        flat.set(height, polygons);
      }
    }
    const tiers = [...flat].map(([baseHeight, polygons]) => ({
      baseHeight,
      polygons: unionClippingPolygons(polygons),
    }));
    if (
      tiers.length === 1 &&
      !slopes.length &&
      ceilings.reduce((ids, ceiling) => {
        ceiling.roomIds.forEach((id) => ids.add(id));
        return ids;
      }, new Set<string>()).size === rooms.length
    ) {
      // A continuous ceiling also covers wall tops and enclosed construction
      // seams, rather than reproducing room-level gaps in the finished roof.
      tiers[0].polygons = domain;
    }
    const regions = tiers.flatMap((tier) => {
      const higher = tiers.filter((other) => other.baseHeight > tier.baseHeight + 0.001);
      const maxRise = Math.max(
        0,
        Math.min(
          ROOF_MAX_RISE_METERS,
          ...floors
            .slice(index + 1)
            .map(
              (other, offset) =>
                levels[index + 1 + offset].elevationMeters +
                other.defaultCeilingHeightMeters +
                0.16 -
                tier.baseHeight -
                ROOF_THICKNESS_METERS,
            ),
          ...higher.map((other) => other.baseHeight - tier.baseHeight - ROOF_THICKNESS_METERS),
          ...slopes
            .map((slope) => slope.baseHeight - tier.baseHeight - ROOF_THICKNESS_METERS)
            .filter((height) => height > 0),
        ),
      );
      return differenceClippingGeometry(
        tier.polygons,
        ...above,
        ...higher.map((other) => other.polygons),
        ...slopes.map((slope) => slope.polygon),
      ).map((polygon) => ({ floorId: floor.id, polygon, baseHeight: tier.baseHeight, maxRise }));
    });
    return [
      ...regions,
      ...slopes.flatMap((slope) =>
        differenceClippingGeometry(slope.polygon, ...above).map((polygon) => ({
          ...slope,
          polygon,
        })),
      ),
    ];
  });
}
