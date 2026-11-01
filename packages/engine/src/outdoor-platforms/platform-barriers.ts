import { planPointToWorld } from "../geometry";
import type { FloorSpec, OutdoorPlatformEdgeConfiguration, PlanPoint } from "../types";
import { isOutdoorPlatformOutline } from "./platform-geometry";
export const OUTDOOR_PLATFORM_EDGE_PRESETS = [
  { id: "railing", name: "Railing", configuration: { kind: "railing", heightMeters: 1 } },
  { id: "low-wall", name: "Low wall", configuration: { kind: "low-wall", heightMeters: 0.3 } },
  { id: "open", name: "Open", configuration: { kind: "open" } },
] as const;
export const validPlatformEdgeConfiguration = (
  value: unknown,
): value is OutdoorPlatformEdgeConfiguration => {
  if (!value || typeof value !== "object") return false;
  const c = value as OutdoorPlatformEdgeConfiguration;
  return (
    c.kind === "open" ||
    (["railing", "low-wall"].includes(c.kind) &&
      "heightMeters" in c &&
      Number.isFinite(c.heightMeters) &&
      c.heightMeters > 0)
  );
};
export interface OutdoorPlatformBarrier {
  platformId: string;
  edgeId: string;
  from: PlanPoint;
  to: PlanPoint;
  configuration: Exclude<OutdoorPlatformEdgeConfiguration, { kind: "open" }>;
}
/** Subtract collinear facade runs, including their door/passage apertures. */
export function deriveOutdoorPlatformBarriers(floor: FloorSpec): OutdoorPlatformBarrier[] {
  return (floor.outdoorPlatforms ?? []).flatMap((platform) => {
    if (!isOutdoorPlatformOutline(platform.polygon)) return [];
    return platform.polygon.flatMap((point, index): OutdoorPlatformBarrier[] => {
      const edge = platform.edges[index];
      const configuration = edge?.configuration ?? platform.defaultEdge;
      if (!edge || !validPlatformEdgeConfiguration(configuration) || configuration.kind === "open")
        return [];
      const from = planPointToWorld(point, floor.coordinates),
        to = planPointToWorld(
          platform.polygon[(index + 1) % platform.polygon.length],
          floor.coordinates,
        );
      const dx = to[0] - from[0],
        dz = to[1] - from[1],
        length = Math.hypot(dx, dz);
      const ux = dx / length,
        uz = dz / length;
      const intervals = floor.walls
        .filter((w) => w.classification === "exterior" && !w.virtual)
        .flatMap((w) => {
          const a = planPointToWorld(w.from, floor.coordinates),
            b = planPointToWorld(w.to, floor.coordinates);
          const crossA = Math.abs((a[0] - from[0]) * uz - (a[1] - from[1]) * ux),
            crossB = Math.abs((b[0] - from[0]) * uz - (b[1] - from[1]) * ux);
          if (crossA > w.thicknessMeters / 2 + 0.002 || crossB > w.thicknessMeters / 2 + 0.002)
            return [];
          const start = (a[0] - from[0]) * ux + (a[1] - from[1]) * uz,
            end = (b[0] - from[0]) * ux + (b[1] - from[1]) * uz;
          return [[Math.max(0, Math.min(start, end)), Math.min(length, Math.max(start, end))]];
        })
        .filter(([a, b]) => b > a)
        .sort((a, b) => a[0] - b[0]);
      const exposed: number[][] = [];
      let cursor = 0;
      for (const [start, end] of intervals) {
        if (start > cursor + 0.001) exposed.push([cursor, start]);
        cursor = Math.max(cursor, end);
      }
      if (cursor < length - 0.001) exposed.push([cursor, length]);
      return exposed.map(([a, b]) => ({
        platformId: platform.id,
        edgeId: edge.id,
        from: [from[0] + ux * a, from[1] + uz * a],
        to: [from[0] + ux * b, from[1] + uz * b],
        configuration,
      }));
    });
  });
}
