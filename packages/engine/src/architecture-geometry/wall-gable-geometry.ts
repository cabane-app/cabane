import polygonClipping, { type MultiPolygon, type Polygon as ClipPolygon } from "polygon-clipping";
import { ShapeUtils, Vector2 } from "three";
import { openingCutTop, pointInsidePolygon } from "../geometry";
import type { FloorSpec, OpeningSpec, PlanPoint, SlopedCeilingSpec, WallSpec } from "../types";
import { MAX_GABLE_COLUMNS, MAX_GABLE_TRANSOMS } from "../wall-types";
import { EPSILON } from "./architecture-geometry-contract";
import { physicalFloor } from "./physical-floor";
import { slopedCeilingHeightSampler } from "./sloped-ceiling-plane";
import { wallFrame } from "./wall-coordinate-frame";

type Plane = SlopedCeilingSpec["planes"][number];
type Vertex = readonly [number, number, number];

const GABLE_FRAME_METERS = 0.05;
const GABLE_MULLION_METERS = 0.035;
export const DEFAULT_GABLE_FRAME_COLOR = "#2b2724";

const onSegment = (point: PlanPoint, a: PlanPoint, b: PlanPoint, tolerance: number) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared < 1e-12
      ? 0
      : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy) <= tolerance;
};

const planeCovers = (plane: Plane, point: PlanPoint, tolerance: number) =>
  pointInsidePolygon(point, plane.boundary) ||
  plane.boundary.some((vertex, index) =>
    onSegment(point, vertex, plane.boundary[(index + 1) % plane.boundary.length], tolerance),
  );

/** Where the wall a→b crosses a boundary edge within the wall's half-width. */
const crossing = (a: PlanPoint, b: PlanPoint, p: PlanPoint, q: PlanPoint, tolerance: number) => {
  const rx = b[0] - a[0],
    ry = b[1] - a[1],
    sx = q[0] - p[0],
    sy = q[1] - p[1];
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-12) return null;
  const alongEdge = ((p[0] - a[0]) * ry - (p[1] - a[1]) * rx) / denominator;
  const margin = (tolerance * Math.hypot(rx, ry)) / Math.abs(denominator);
  if (alongEdge < -margin || alongEdge > 1 + margin) return null;
  return ((p[0] - a[0]) * sy - (p[1] - a[1]) * sx) / denominator;
};

const preparePlanes = (ceilings: NonNullable<FloorSpec["ceilings"]>) =>
  ceilings.flatMap((ceiling) =>
    ceiling.kind === "sloped"
      ? ceiling.planes.map((plane) => {
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
          for (const [x, y] of plane.boundary) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
          return { plane, minX, minY, maxX, maxY, heightAt: slopedCeilingHeightSampler(plane) };
        })
      : [],
  );
const preparedPlanes = new WeakMap<
  NonNullable<FloorSpec["ceilings"]>,
  ReturnType<typeof preparePlanes>
>();
const planesFor = (floor: FloorSpec) => {
  if (!floor.ceilings) return [];
  const existing = preparedPlanes.get(floor.ceilings);
  if (existing) return existing;
  const planes = preparePlanes(floor.ceilings);
  preparedPlanes.set(floor.ceilings, planes);
  return planes;
};

/**
 * The sloped ceiling over a wall's centerline, as a polyline of [meters along
 * the wall, height] points. Gaps where no plane covers the wall are omitted, so
 * the result may hold several runs.
 */
export function wallCeilingProfile(wall: WallSpec, floor: FloorSpec): [number, number][][] {
  const tolerance = wall.thicknessMeters / 2 / floor.coordinates.metersPerPlanUnit + 1e-6;
  const planes = planesFor(floor).filter(
    ({ minX, minY, maxX, maxY }) =>
      minX <= Math.max(wall.from[0], wall.to[0]) + tolerance &&
      maxX >= Math.min(wall.from[0], wall.to[0]) - tolerance &&
      minY <= Math.max(wall.from[1], wall.to[1]) + tolerance &&
      maxY >= Math.min(wall.from[1], wall.to[1]) - tolerance,
  );
  if (!planes.length) return [];
  const length = wallFrame(wall, floor).length;
  const at = (t: number): PlanPoint => [
    wall.from[0] + (wall.to[0] - wall.from[0]) * t,
    wall.from[1] + (wall.to[1] - wall.from[1]) * t,
  ];
  const breaks = new Set([0, 1]);
  for (const { plane } of planes) {
    plane.boundary.forEach((vertex, index) => {
      const t = crossing(
        wall.from,
        wall.to,
        vertex,
        plane.boundary[(index + 1) % plane.boundary.length],
        tolerance,
      );
      if (t !== null && t > 0 && t < 1) breaks.add(t);
    });
  }
  const ts = [...breaks].sort((a, b) => a - b);
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  for (let index = 0; index < ts.length - 1; index += 1) {
    const [t0, t1] = [ts[index], ts[index + 1]];
    if ((t1 - t0) * length < 1e-6) continue;
    const middle = at((t0 + t1) / 2);
    const covering = planes.filter(({ plane }) => planeCovers(plane, middle, tolerance));
    if (!covering.length) {
      if (run.length) runs.push(run);
      run = [];
      continue;
    }
    const height = (t: number) => {
      const point = at(t);
      return covering.reduce((top, { heightAt }) => Math.max(top, heightAt(point)), -Infinity);
    };
    const start: [number, number] = [t0 * length, height(t0)];
    const last = run.at(-1);
    if (!last || Math.abs(last[0] - start[0]) > 1e-6) {
      if (run.length) runs.push(run);
      run = [start];
    } else if (Math.abs(last[1] - start[1]) > EPSILON) run.push(start);
    run.push([t1 * length, height(t1)]);
  }
  if (run.length) runs.push(run);
  return runs;
}

const rectangle = (s0: number, y0: number, s1: number, y1: number): ClipPolygon => [
  [
    [s0, y0],
    [s1, y0],
    [s1, y1],
    [s0, y1],
  ],
];

const area = (geometry: MultiPolygon) =>
  geometry.reduce(
    (sum, polygon) =>
      sum +
      polygon.reduce((ringSum, ring, ringIndex) => {
        let twice = 0;
        for (let index = 0; index < ring.length - 1; index += 1)
          twice += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
        return ringSum + (ringIndex === 0 ? Math.abs(twice) : -Math.abs(twice)) / 2;
      }, 0),
    0,
  );

/** A strip of the given width centered on every edge of every ring. */
const edgeStrips = (geometry: MultiPolygon, width: number): ClipPolygon[] =>
  geometry.flatMap((polygon) =>
    polygon.flatMap((ring) =>
      ring.slice(0, -1).flatMap((a, index): ClipPolygon[] => {
        const b = ring[index + 1];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 1e-9) return [];
        const nx = (-(b[1] - a[1]) / length) * (width / 2),
          ny = ((b[0] - a[0]) / length) * (width / 2);
        return [
          [
            [
              [a[0] + nx, a[1] + ny],
              [b[0] + nx, b[1] + ny],
              [b[0] - nx, b[1] - ny],
              [a[0] - nx, a[1] - ny],
            ],
          ],
        ];
      }),
    ),
  );

export interface WallGableShapes {
  /** The band renderer draws the wall up to here; the gable continues above. */
  bandTop: number;
  wallHeightMeters: number;
  /** In wall-plane coordinates: [meters along the wall, height above the floor]. */
  solid: MultiPolygon;
  frame: MultiPolygon;
  glass: MultiPolygon;
  profile: readonly (readonly [number, number][])[];
}

/** The shape of a gable wall above the height its horizontal bands can draw. */
export function wallGableShapes(
  wall: WallSpec,
  floor: FloorSpec,
  openings: readonly OpeningSpec[],
): WallGableShapes | null {
  if (!wall.gable) return null;
  const runs = wallCeilingProfile(wall, floor);
  if (!runs.length) return null;
  const height = wall.heightMeters ?? floor.defaultWallHeightMeters;
  const length = wallFrame(wall, floor).length;
  // Outside the ceiling's runs the wall keeps its usual flat top.
  const top: [number, number][] = [];
  let cursor = 0;
  for (const run of runs) {
    if (run[0][0] > cursor + 1e-6) top.push([cursor, height], [run[0][0], height]);
    top.push(...run);
    cursor = run.at(-1)![0];
  }
  if (cursor < length - 1e-6) top.push([cursor, height], [length, height]);
  const bandTop = Math.max(0, Math.min(height, ...top.map(([, y]) => y)));
  if (Math.max(...top.map(([, y]) => y)) <= bandTop + EPSILON && height <= bandTop + EPSILON)
    return null;
  const outline: ClipPolygon = [
    [[0, bandTop], [length, bandTop], ...top.slice().reverse(), [0, bandTop]].filter(
      (point, index, points) =>
        index === 0 ||
        Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]) > 1e-9,
    ) as [number, number][],
  ];
  const scale = floor.coordinates.metersPerPlanUnit;
  const ceilingTop = Math.max(...top.map(([, y]) => y)) + 1;
  const cuts = openings
    .filter((opening) => opening.wallId === wall.id)
    .map((opening) =>
      rectangle(
        opening.offsetFromWallStartPlanUnits * scale,
        opening.sillHeightMeters,
        (opening.offsetFromWallStartPlanUnits + opening.widthPlanUnits) * scale,
        openingCutTop(opening, ceilingTop),
      ),
    );
  const below = polygonClipping.intersection(outline, rectangle(-1, bandTop, length + 1, height));
  const above = polygonClipping.intersection(
    outline,
    rectangle(-1, height, length + 1, ceilingTop),
  );
  const empty = {
    bandTop,
    wallHeightMeters: height,
    profile: runs,
    solid: [],
    frame: [],
    glass: [],
  };
  if (wall.gable.fill === "solid") {
    const solid = polygonClipping.difference(polygonClipping.union(below, above), ...cuts);
    return area(solid) > 1e-6 ? { ...empty, solid } : null;
  }
  // Glass stops at the faces of the walls it meets, not their centerlines.
  const inset = wall.thicknessMeters / 2;
  const pane = polygonClipping.difference(
    polygonClipping.intersection(above, rectangle(inset, height, length - inset, ceilingTop)),
    ...cuts,
  );
  const columns = Math.min(MAX_GABLE_COLUMNS, Math.max(1, wall.gable.columns ?? 2));
  const [minS, maxS] = pane.length
    ? [
        Math.min(...pane.flatMap((polygon) => polygon[0].map(([s]) => s))),
        Math.max(...pane.flatMap((polygon) => polygon[0].map(([s]) => s))),
      ]
    : [0, 0];
  const mullions: ClipPolygon[] = [
    ...Array.from({ length: columns - 1 }, (_, index) => {
      const s = minS + ((maxS - minS) * (index + 1)) / columns;
      return rectangle(s - GABLE_MULLION_METERS, height, s + GABLE_MULLION_METERS, ceilingTop);
    }),
    ...(wall.gable.transomHeightsMeters ?? [])
      .slice(0, MAX_GABLE_TRANSOMS)
      .filter((y) => y > height && y < ceilingTop)
      .map((y) => rectangle(minS, y - GABLE_MULLION_METERS, maxS, y + GABLE_MULLION_METERS)),
  ];
  const bars = polygonClipping.union(
    rectangle(-1, -1, -1 + 1e-3, -1 + 1e-3),
    ...edgeStrips(pane, GABLE_FRAME_METERS * 2),
    ...mullions,
  );
  return {
    bandTop,
    wallHeightMeters: height,
    profile: runs,
    solid: polygonClipping.difference(
      polygonClipping.union(below, polygonClipping.difference(above, pane)),
      ...cuts,
    ),
    frame: polygonClipping.intersection(pane, bars),
    glass: polygonClipping.difference(pane, bars),
  };
}

const gablesByFloor = new WeakMap<FloorSpec, Map<string, WallGableShapes>>();

/** Share wall sections between the opaque walls, glazing and roof infill. */
export function wallGablesForFloor(
  requestedFloor: FloorSpec,
): ReadonlyMap<string, WallGableShapes> {
  const cached = gablesByFloor.get(requestedFloor);
  if (cached) return cached;
  const floor = physicalFloor(requestedFloor);
  let gables = gablesByFloor.get(floor);
  if (!gables) {
    gables = new Map();
    for (const wall of floor.walls) {
      if (!wall.gable) continue;
      const shapes = wallGableShapes(wall, floor, floor.openings);
      if (shapes) gables.set(wall.id, shapes);
    }
    gablesByFloor.set(floor, gables);
  }
  gablesByFloor.set(requestedFloor, gables);
  return gables;
}

/** Lift wall-plane coordinates onto one face of the wall; side is +1, -1 or 0 (centerline). */
export function wallPlanePoint(
  wall: WallSpec,
  floor: FloorSpec,
  depth: number,
): (point: readonly [number, number], side: number) => Vertex {
  const frame = wallFrame(wall, floor);
  return ([s, y], side) => [
    frame.from[0] + frame.direction[0] * s + frame.normal[0] * (depth / 2) * side,
    y,
    frame.from[1] + frame.direction[1] * s + frame.normal[1] * (depth / 2) * side,
  ];
}

const faceNormal = (a: Vertex, b: Vertex, c: Vertex): Vertex => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
};

export type GableFace = "left" | "right" | "edge";

/**
 * Triangles that extrude wall-plane shapes through a depth centered on the
 * wall, each facing outward: "left" faces point along the wall frame's normal.
 */
export function extrudeWallPlaneShapes(
  geometry: MultiPolygon,
  wall: WallSpec,
  floor: FloorSpec,
  depth: number,
  emit: (a: Vertex, b: Vertex, c: Vertex, face: GableFace) => void,
) {
  const frame = wallFrame(wall, floor);
  const lift = wallPlanePoint(wall, floor, depth);
  const oriented = (a: Vertex, b: Vertex, c: Vertex, toward: Vertex, face: GableFace) => {
    const n = faceNormal(a, b, c);
    if (n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2] >= 0) emit(a, b, c, face);
    else emit(a, c, b, face);
  };
  for (const polygon of geometry) {
    const rings = polygon.map((ring) => ring.slice(0, -1).map(([s, y]) => new Vector2(s, y)));
    const points = rings.flat();
    for (const [first, second, third] of ShapeUtils.triangulateShape(rings[0], rings.slice(1)))
      for (const side of [1, -1]) {
        const [a, b, c] = [first, second, third].map((index) =>
          lift([points[index].x, points[index].y], side),
        );
        oriented(
          a,
          b,
          c,
          [frame.normal[0] * side, 0, frame.normal[1] * side],
          side > 0 ? "left" : "right",
        );
      }
    for (const ring of polygon)
      for (let index = 0; index < ring.length - 1; index += 1) {
        const [p, q] = [ring[index], ring[index + 1]];
        const ds = q[0] - p[0],
          dy = q[1] - p[1];
        // polygon-clipping keeps solid material on each ring's left.
        const length = Math.hypot(ds, dy) || 1;
        const [ns, ny] = [dy / length, -ds / length];
        const toward: Vertex = [frame.direction[0] * ns, ny, frame.direction[1] * ns];
        const [p0, p1, q0, q1] = [lift(p, 1), lift(p, -1), lift(q, 1), lift(q, -1)];
        oriented(p0, p1, q1, toward, "edge");
        oriented(p0, q1, q0, toward, "edge");
      }
  }
}
