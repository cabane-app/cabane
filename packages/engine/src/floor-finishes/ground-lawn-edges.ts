import { elevationCutouts } from "../elevation/surfaces";
import {
  pointInsidePolygon,
  worldBoundsForPolygon,
  worldPointToPlan,
  type WorldBounds,
} from "../geometry";
import { floorSlabPolygons } from "../outdoor-platforms/platform-geometry";
import { polygonEdgeSplits } from "../polygon-edge-splits";
import { poolOuterFootprint } from "../pools/pool-footprint";
import type { FloorFinishSpec, FloorSpec, OutdoorPlatformSpec, PlanPoint, Polygon } from "../types";
import { isFloorZoneOutline } from "./finish-geometry";

export interface GroundLawnEdge {
  /** Points follow the authored edge. The unit normal points toward living grass. */
  from: PlanPoint;
  to: PlanPoint;
  lawnNormal: PlanPoint;
  finish: Exclude<FloorFinishSpec, { kind: "grass" }>;
  surfaceId: string;
  /** The higher visible surface owns the outline, including a grass patch over paving. */
  sourceId: string;
  edgeIndex: number;
  platform: boolean;
  explicitGrass: boolean;
  lawnPlatform: boolean;
}

interface Surface {
  id: string;
  polygon: Polygon;
  finish: FloorFinishSpec;
  platform?: OutdoorPlatformSpec;
}

const near = (a: WorldBounds, b: WorldBounds) =>
  a.minX <= b.maxX + 0.0001 &&
  a.maxX >= b.minX - 0.0001 &&
  a.minZ <= b.maxZ + 0.0001 &&
  a.maxZ >= b.minZ - 0.0001;

const along = (a: PlanPoint, b: PlanPoint, t: number): PlanPoint => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

/** Walk the visible interfaces, splitting at intersections and T-junctions before classifying
 * either side. This also keeps coincident edges and partially buried patches from doubling up. */
export function groundLawnEdges(
  floor: FloorSpec,
  cutouts: readonly Polygon[] = [],
): GroundLawnEdge[] {
  const zones = (floor.groundZones ?? []).filter((zone) => isFloorZoneOutline(zone.polygon));
  const platforms = (floor.outdoorPlatforms ?? []).filter((p) => isFloorZoneOutline(p.polygon));
  // Ground patches use their authored order. Rigid platform tops sit above those patches.
  const surfaces: Surface[] = [
    ...zones,
    ...platforms.map((platform) => ({ ...platform, platform })),
  ];
  if (!surfaces.some((surface) => surface.finish.kind !== "grass")) return [];
  const blocked = [
    ...cutouts,
    ...floorSlabPolygons(floor),
    ...elevationCutouts(floor),
    ...(floor.pools ?? []).flatMap((pool) =>
      poolOuterFootprint(pool.polygon, floor.coordinates).map(([outer]) =>
        outer.slice(0, -1).map(([x, z]) => worldPointToPlan({ x, z }, floor.coordinates)),
      ),
    ),
  ];
  const blockers = blocked.map((polygon) => ({
    polygon,
    bounds: worldBoundsForPolygon(polygon, floor.coordinates),
  }));
  const layers = surfaces.map((surface, priority) => ({
    ...surface,
    priority,
    bounds: worldBoundsForPolygon(surface.polygon, floor.coordinates),
  }));
  const results: GroundLawnEdge[] = [];

  // Sample just off an edge in physical units so cm- and metre-based plans classify alike.
  const epsilon = 0.0001 / floor.coordinates.metersPerPlanUnit;
  for (const surface of layers) {
    // Only neighbouring outlines can split or cover this patch. Keep the layer priority intact.
    const neighbors = layers.filter((layer) => near(surface.bounds, layer.bounds)).reverse();
    const cuts = blockers
      .filter((blocker) => near(surface.bounds, blocker.bounds))
      .map((b) => b.polygon);
    const outlines = [
      ...cuts,
      ...neighbors.filter((layer) => layer !== surface).map((layer) => layer.polygon),
    ];
    const visibleSurface = (p: PlanPoint) =>
      neighbors.find((layer) => pointInsidePolygon(p, layer.polygon));
    for (const [edgeIndex, a] of surface.polygon.entries()) {
      const b = surface.polygon[(edgeIndex + 1) % surface.polygon.length];
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = Math.hypot(dx, dy);
      if (length <= epsilon) continue;
      const platform = surface.platform;
      if (
        platform &&
        (platform.edges[edgeIndex]?.configuration ?? platform.defaultEdge).kind !== "open"
      )
        continue;
      const nx = -dy / length,
        ny = dx / length;
      const splits = polygonEdgeSplits(a, b, outlines);
      for (let i = 1; i < splits.length; i++) {
        if ((splits[i] - splits[i - 1]) * length <= epsilon) continue;
        const mid = along(a, b, (splits[i] + splits[i - 1]) / 2);
        const left: PlanPoint = [mid[0] + nx * epsilon, mid[1] + ny * epsilon];
        const right: PlanPoint = [mid[0] - nx * epsilon, mid[1] - ny * epsilon];
        if (
          cuts.some(
            (polygon) => pointInsidePolygon(left, polygon) || pointInsidePolygon(right, polygon),
          )
        )
          continue;
        const leftSurface = visibleSurface(left);
        const rightSurface = visibleSurface(right);
        if (
          Math.max(leftSurface?.priority ?? -1, rightSurface?.priority ?? -1) !== surface.priority
        )
          continue;
        const leftIsLawn = !leftSurface || leftSurface.finish.kind === "grass";
        const lawn = leftIsLawn ? leftSurface : rightSurface;
        const hard = leftIsLawn ? rightSurface : leftSurface;
        if ((lawn && lawn.finish.kind !== "grass") || !hard || hard.finish.kind === "grass")
          continue;
        results.push({
          from: along(a, b, splits[i - 1]),
          to: along(a, b, splits[i]),
          lawnNormal: leftIsLawn ? [nx, ny] : [-nx, -ny],
          sourceId: surface.id,
          edgeIndex,
          finish: hard.finish,
          surfaceId: hard.id,
          platform: Boolean(hard.platform),
          explicitGrass: Boolean(lawn),
          lawnPlatform: Boolean(lawn?.platform),
        });
      }
    }
  }
  return results;
}
