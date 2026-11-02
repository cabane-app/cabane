import { planPointToWorld, pointInsidePolygon, segmentsIntersect } from "../geometry";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";
import type { TerrainSurface } from "../terrain/terrain-surface";
import type { FloorSpec, HedgeSpec } from "../types";

/** A boundary on authored indoor/platform support retains that support's level. */
export function terrainForHedge(floor: FloorSpec, hedge: HedgeSpec, terrain: TerrainSurface) {
  if (floor.id !== terrain?.floorId) return null;
  const supports = [...floor.rooms, ...(floor.outdoorPlatforms ?? [])];
  const onSupport = supports.some(
    ({ polygon }) =>
      pointInsidePolygon(hedge.from, polygon) ||
      pointInsidePolygon(hedge.to, polygon) ||
      polygon.some((point, i) =>
        segmentsIntersect(hedge.from, hedge.to, point, polygon[(i + 1) % polygon.length]),
      ),
  );
  return onSupport ? null : terrain;
}

/** Short continuous envelopes keep jump clearance local to the visible grade. */
export function terrainHedgeRuns(
  floor: FloorSpec,
  hedge: HedgeSpec,
  terrain: NonNullable<TerrainSurface>,
) {
  const [x, z] = planPointToWorld(hedge.from, floor.coordinates);
  const [tx, tz] = planPointToWorld(hedge.to, floor.coordinates);
  const dx = tx - x,
    dz = tz - z,
    length = Math.hypot(dx, dz);
  const cuts = new Set([0, 1]);
  const count = Math.ceil(length / 0.25);
  for (let i = 1; i < count; i++) cuts.add(i / count);
  for (const [values, start, delta] of [
    [terrain.gridX, x, dx],
    [terrain.gridZ, z, dz],
  ] as const) {
    if (Math.abs(delta) < 1e-8) continue;
    for (const value of values) {
      const t = (value - start) / delta;
      if (t > 0 && t < 1) cuts.add(t);
    }
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  return sorted.slice(1).map((end, i) => {
    const from = { x: x + dx * sorted[i], z: z + dz * sorted[i] };
    const to = { x: x + dx * end, z: z + dz * end };
    const heights = [from, to].flatMap((point) =>
      [-1, 0, 1].map(
        (side) =>
          GROUND_ELEVATION_METERS +
          terrain.offsetAt(
            point.x - (((side * dz) / length) * hedge.widthMeters) / 2,
            point.z + (((side * dx) / length) * hedge.widthMeters) / 2,
          ),
      ),
    );
    return {
      from,
      to,
      minY: Math.min(...heights),
      maxY: Math.max(...heights) + hedge.heightMeters,
    };
  });
}
