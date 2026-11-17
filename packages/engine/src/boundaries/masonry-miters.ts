import type { TerrainSurface } from "../terrain/terrain-surface";
import type { HedgeSpec } from "../types";

export type MasonryMiters = { from?: number | undefined; to?: number | undefined };
type Run = { hedge: HedgeSpec; terrain: TerrainSurface };
type End = Run & { side: "from" | "to"; dx: number; dz: number; length: number };

/** Meet each pair of equal cross-sections on the bisector of their centerlines. */
export function masonryMiters(runs: Run[], metersPerPlanUnit: number) {
  const endpoints = new Map<string, End[]>();
  for (const { hedge, terrain } of runs) {
    if (hedge.style !== "masonry") continue;
    const dx = hedge.to[0] - hedge.from[0],
      dz = hedge.to[1] - hedge.from[1];
    const length = Math.hypot(dx, dz);
    for (const side of ["from", "to"] as const) {
      const key = hedge[side].join(",");
      const ends = endpoints.get(key) ?? [];
      const sign = side === "from" ? 1 : -1;
      ends.push({
        hedge,
        terrain,
        side,
        dx: (sign * dx) / length,
        dz: (sign * dz) / length,
        length: length * metersPerPlanUnit,
      });
      endpoints.set(key, ends);
    }
  }
  const miters = new Map<HedgeSpec, MasonryMiters>();
  for (const ends of endpoints.values()) {
    if (ends.length !== 2) continue;
    const [a, b] = ends;
    if (
      a.terrain !== b.terrain ||
      a.hedge.heightMeters !== b.hedge.heightMeters ||
      a.hedge.widthMeters !== b.hedge.widthMeters
    )
      continue;
    const denominator = 1 - a.dx * b.dx - a.dz * b.dz;
    if (denominator < 1e-6) continue;
    const slope = (a.dx * b.dz - a.dz * b.dx) / denominator;
    // Avoid an outsized spike or folding very short runs back over themselves.
    if (
      Math.abs(slope) > 3 ||
      Math.abs(slope) * a.hedge.widthMeters >= Math.min(a.length, b.length)
    )
      continue;
    for (const end of ends) {
      const miter = miters.get(end.hedge) ?? {};
      miter[end.side] = end === a ? slope : -slope;
      miters.set(end.hedge, miter);
    }
  }
  return miters;
}
