import { planPointToWorld, pointInsidePolygon, segmentsIntersect } from "../geometry";
import { wallSolidFootprintPolygons } from "../architecture-geometry";
import { isPoolOutline, poolOuterFootprint } from "../pools/pool-footprint";
import type {
  FloorCoordinates,
  ManifestIssue,
  PlanPoint,
  WallSpec,
  WallJunctionSpec,
} from "../types";
import {
  isFiniteNumber,
  isObject,
  isPlanPoint,
  isPolygon,
  issue,
  registerId,
  type RawObject,
  type ValidationContext,
} from "./core";

type Footprint = readonly (readonly (readonly PlanPoint[])[])[];
const insideFootprint = (point: PlanPoint, footprint: Footprint) =>
  footprint.some(
    ([outer, ...holes]) =>
      pointInsidePolygon(point, outer) && !holes.some((hole) => pointInsidePolygon(point, hole)),
  );
const footprintsMeet = (a: Footprint, b: Footprint) => {
  const aRings = a.flat(),
    bRings = b.flat();
  return (
    aRings.some((ring) => ring.some((point) => insideFootprint(point, b))) ||
    bRings.some((ring) => ring.some((point) => insideFootprint(point, a))) ||
    aRings.some((ring) =>
      bRings.some((other) =>
        ring.some((from, i) =>
          other.some((to, j) =>
            segmentsIntersect(from, ring[(i + 1) % ring.length], to, other[(j + 1) % other.length]),
          ),
        ),
      ),
    )
  );
};

export function validatePools(
  floor: RawObject,
  path: string,
  context: ValidationContext,
): ManifestIssue[] {
  if (floor.pools === undefined) return [];
  if (!Array.isArray(floor.pools))
    return [issue("pool.collection", `${path}.pools`, "Pools must be an array.")];
  const issues: ManifestIssue[] = [];
  const coordinates =
    isObject(floor.coordinates) &&
    isPlanPoint(floor.coordinates.origin) &&
    isFiniteNumber(floor.coordinates.metersPerPlanUnit) &&
    floor.coordinates.metersPerPlanUnit > 0
      ? (floor.coordinates as unknown as FloorCoordinates)
      : null;
  const buildings: PlanPoint[][] = [];
  if (coordinates) {
    const regions = Array.isArray(floor.footprintRegions)
      ? floor.footprintRegions
      : [floor.footprint];
    for (const region of regions)
      if (isPolygon(region)) buildings.push(region.map((p) => planPointToWorld(p, coordinates)));
    const walls: WallSpec[] = [];
    for (const wall of Array.isArray(floor.walls) ? floor.walls : []) {
      if (
        !isObject(wall) ||
        !isPlanPoint(wall.from) ||
        !isPlanPoint(wall.to) ||
        !isFiniteNumber(wall.thicknessMeters)
      )
        continue;
      const [x, z] = planPointToWorld(wall.from, coordinates),
        [tx, tz] = planPointToWorld(wall.to, coordinates);
      const length = Math.hypot(tx - x, tz - z);
      if (length <= 1e-8 || wall.thicknessMeters <= 0) continue;
      walls.push({
        id: String(wall.id),
        from: wall.from,
        to: wall.to,
        thicknessMeters: wall.thicknessMeters,
        classification: wall.classification === "exterior" ? "exterior" : "interior",
      });
    }
    const wallJunctions: WallJunctionSpec[] = [];
    for (const junction of Array.isArray(floor.wallJunctions) ? floor.wallJunctions : []) {
      if (
        !isObject(junction) ||
        !isPlanPoint(junction.at) ||
        !Array.isArray(junction.wallIds) ||
        junction.wallIds.length < 2 ||
        !junction.wallIds.every((id) => typeof id === "string")
      )
        continue;
      wallJunctions.push({
        id: String(junction.id),
        at: junction.at,
        wallIds: [junction.wallIds[0], junction.wallIds[1], ...junction.wallIds.slice(2)],
      });
    }
    // Use the renderer's actual solids rather than wall centerlines or bounding boxes.
    const validRegions = regions.filter(isPolygon);
    if (validRegions[0])
      buildings.push(
        ...wallSolidFootprintPolygons({
          walls,
          wallJunctions,
          coordinates,
          footprint: validRegions[0],
          footprintRegions: validRegions,
        }).map((polygon) => polygon[0]),
      );
  }
  const previous: Array<{ id: unknown; footprint: Footprint }> = [];
  floor.pools.forEach((pool, index) => {
    const poolPath = `${path}.pools[${index}]`;
    if (!isObject(pool)) {
      issues.push(issue("pool.type", poolPath, "Each pool must be an object."));
      return;
    }
    issues.push(...registerId(context, pool.id, `${poolPath}.id`));
    if (pool.type !== undefined && pool.type !== "in-ground" && pool.type !== "above-ground-wood")
      issues.push(
        issue("pool.kind", `${poolPath}.type`, "Choose an in-ground or above-ground wooden pool."),
      );
    if (
      pool.heightMeters !== undefined &&
      (typeof pool.heightMeters !== "number" ||
        !Number.isFinite(pool.heightMeters) ||
        pool.heightMeters < 0.3 ||
        pool.heightMeters > 5)
    )
      issues.push(
        issue(
          "pool.height",
          `${poolPath}.heightMeters`,
          "Pool height or depth must be between 0.3 and 5 metres.",
        ),
      );
    if (!isPoolOutline(pool.polygon)) {
      issues.push(
        issue(
          "pool.polygon",
          `${poolPath}.polygon`,
          "Use at least three distinct corners forming a closed, non-crossing pool outline with non-zero area.",
        ),
      );
      return;
    }
    if (!coordinates) return;
    const footprint = poolOuterFootprint(pool.polygon, coordinates);
    if (
      footprintsMeet(
        footprint,
        buildings.map((building) => [building]),
      )
    )
      issues.push(
        issue(
          "pool.building-overlap",
          `${poolPath}.polygon`,
          "The pool and its rim must stay outside buildings and clear of house walls.",
          "error",
        ),
      );
    for (const other of previous)
      if (footprintsMeet(footprint, other.footprint))
        issues.push(
          issue(
            "pool.overlap",
            `${poolPath}.polygon`,
            `Pool “${typeof pool.id === "string" ? pool.id : "unknown"}” and its rim overlap or touch pool “${typeof other.id === "string" ? other.id : "unknown"}”.`,
            "error",
          ),
        );
    previous.push({ id: pool.id, footprint });
  });
  return issues;
}
