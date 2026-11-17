import { floorZonePointWithinRoom } from "../floor-finishes/finish-geometry";
import { polygonSignedArea, planPointToWorld } from "../geometry";
import type { ElevationSettings, FloorSpec, PlanPoint, Polygon } from "../types";

export interface ElevationArea {
  id: string;
  polygon: Polygon;
  elevation: ElevationSettings;
  roomId?: string;
}

export function elevationAreas(
  floor: Pick<FloorSpec, "rooms" | "outdoorPlatforms">,
): ElevationArea[] {
  return [
    ...floor.rooms.flatMap((room) =>
      (room.floorZones ?? []).flatMap((zone) =>
        zone.elevation
          ? [{ id: zone.id, polygon: zone.polygon, elevation: zone.elevation, roomId: room.id }]
          : [],
      ),
    ),
    ...(floor.outdoorPlatforms ?? []).flatMap((p) =>
      p.elevation ? [{ id: p.id, polygon: p.polygon, elevation: p.elevation }] : [],
    ),
  ];
}

/** Mitered outer corners keep adjacent edge transitions watertight. */
export function transitionOutline(area: ElevationArea, scale: number): Polygon {
  const p = area.polygon,
    sign = Math.sign(polygonSignedArea(p));
  const lines = p.map((a, i) => {
    const b = p[(i + 1) % p.length],
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    const t = area.elevation.edges[i]?.transition;
    const width = t?.kind === "sloped" ? t.widthMeters / scale : 0;
    return {
      x: a[0] + ((sign * dy) / length) * width,
      y: a[1] - ((sign * dx) / length) * width,
      dx,
      dy,
    };
  });
  return lines.map((b, i): PlanPoint => {
    const a = lines[(i + lines.length - 1) % lines.length];
    const cross = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(cross) < 1e-8) return [b.x, b.y];
    const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / cross;
    return [a.x + t * a.dx, a.y + t * a.dy];
  }) as unknown as Polygon;
}

export function transitionBands(area: ElevationArea, scale: number) {
  const outer = transitionOutline(area, scale);
  return area.polygon.flatMap((a, i) => {
    if (area.elevation.edges[i]?.transition?.kind !== "sloped") return [];
    const j = (i + 1) % outer.length;
    return [{ edge: i, polygon: [a, area.polygon[j], outer[j], outer[i]] as Polygon }];
  });
}

export function elevationCutouts(floor: FloorSpec, exceptId?: string): Polygon[] {
  return elevationAreas(floor)
    .filter((area) => area.id !== exceptId)
    .flatMap((area) => [
      area.polygon,
      ...transitionBands(area, floor.coordinates.metersPerPlanUnit).map((band) => band.polygon),
    ]);
}

/** Height interpolation uses the same two triangles as the rendered transition. */
export function triangleHeight(
  point: PlanPoint,
  points: readonly PlanPoint[],
  heights: readonly number[],
  bounded = true,
): number | null {
  const [a, b, c] = points;
  const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(det) < 1e-10) return null;
  const u = ((b[1] - c[1]) * (point[0] - c[0]) + (c[0] - b[0]) * (point[1] - c[1])) / det;
  const v = ((c[1] - a[1]) * (point[0] - c[0]) + (a[0] - c[0]) * (point[1] - c[1])) / det;
  return !bounded || (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
    ? u * heights[0] + v * heights[1] + (1 - u - v) * heights[2]
    : null;
}

export function localSurfaceAt(
  floor: Pick<FloorSpec, "id" | "rooms" | "outdoorPlatforms" | "coordinates">,
  point: PlanPoint,
  groundAt: (point: PlanPoint) => number = () => 0,
) {
  const areas = elevationAreas(floor);
  for (const area of areas)
    if (floorZonePointWithinRoom(point, area.polygon))
      return {
        id: area.id,
        floorId: floor.id,
        elevation: area.elevation.offsetMeters,
        sloped: false,
      };
  for (const area of areas) {
    for (const triangle of transitionTriangles(
      area,
      floor.coordinates.metersPerPlanUnit,
      groundAt,
    )) {
      const elevation = triangleHeight(point, triangle.polygon, triangle.heights);
      if (elevation !== null) return { id: area.id, floorId: floor.id, elevation, sloped: true };
    }
  }
  return { id: floor.id, floorId: floor.id, elevation: 0, sloped: false };
}

export function terrainLocalHeight(floor: FloorSpec, offsetAt?: (x: number, z: number) => number) {
  return (point: PlanPoint) => {
    const [x, z] = planPointToWorld(point, floor.coordinates);
    return (offsetAt?.(x, z) ?? 0) - 0.05;
  };
}

/** Keep edge identity when an outline is moved, split or shortened. */
export function elevationWithPolygon(
  settings: ElevationSettings,
  before: Polygon,
  after: Polygon,
): ElevationSettings {
  const used = new Set(settings.edges.map((edge) => edge.id));
  let serial = 1;
  return {
    ...settings,
    edges: after.map((point, index) => {
      const old =
        before.length === after.length
          ? index
          : before.findIndex((p) => Math.hypot(p[0] - point[0], p[1] - point[1]) < 1e-7);
      if (old >= 0 && settings.edges[old]) return settings.edges[old];
      while (used.has(`elevation-edge-${serial}`)) serial++;
      const id = `elevation-edge-${serial++}`;
      used.add(id);
      return { id };
    }),
  };
}

/** Shared subdivision keeps long transitions close to curved surrounding terrain. */
export function transitionTriangles(
  area: ElevationArea,
  scale: number,
  groundAt: (point: PlanPoint) => number,
) {
  return transitionBands(area, scale).flatMap((band) => {
    const [a, b, c, d] = band.polygon;
    const mix = (p: PlanPoint, q: PlanPoint, t: number): PlanPoint => [
      p[0] + (q[0] - p[0]) * t,
      p[1] + (q[1] - p[1]) * t,
    ];
    const count = area.roomId
      ? 1
      : Math.max(1, Math.ceil((Math.hypot(c[0] - d[0], c[1] - d[1]) * scale) / 0.15));
    return Array.from({ length: Math.min(count, 256) }, (_, i) => {
      const n = Math.min(count, 256),
        u = i / n,
        v = (i + 1) / n;
      const points = [mix(a, b, u), mix(a, b, v), mix(d, c, v), mix(d, c, u)];
      const heights = [
        area.elevation.offsetMeters,
        area.elevation.offsetMeters,
        area.roomId ? 0 : groundAt(points[2]),
        area.roomId ? 0 : groundAt(points[3]),
      ];
      return [
        [0, 1, 2],
        [0, 2, 3],
      ].map((indices) => ({
        edge: band.edge,
        polygon: indices.map((index) => points[index]) as unknown as Polygon,
        heights: indices.map((index) => heights[index]),
      }));
    }).flat();
  });
}
