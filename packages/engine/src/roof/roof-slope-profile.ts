import type { Polygon as ClipPolygon } from "polygon-clipping";
import {
  differenceClippingGeometry,
  intersectClippingGeometry,
} from "../architecture-geometry/architecture-clipping";
import { roofWallCenterlinePoint, type RoofRimSegment } from "./roof-rim";

type Point = [number, number];
type SlopeProgress = (point: Point) => number;
const LEVEL_EDGES = [0, 1] as const;
const PROGRESS_TOLERANCE = 1e-7;
const between = (a: number, b: number, value: number) =>
  Math.min(a, b) < value - PROGRESS_TOLERANCE && Math.max(a, b) > value + PROGRESS_TOLERANCE;
const along = (a: Point, b: Point, t: number): Point => [
  a[0] + t * (b[0] - a[0]),
  a[1] + t * (b[1] - a[1]),
];

/** A miter can extend the rim beyond a low or high level edge. Keep that kink in the fascia. */
export function splitSlopeRim(rim: RoofRimSegment[], progressAt: SlopeProgress): RoofRimSegment[] {
  return rim.flatMap((segment) => {
    const { from, to, gabled, support } = segment;
    const spans = [[progressAt(from), progressAt(to)]];
    if (gabled && support) {
      spans.push([
        progressAt(roofWallCenterlinePoint(from, support)),
        progressAt(roofWallCenterlinePoint(to, support)),
      ]);
    }
    const cuts = spans.flatMap(([a, b]) =>
      LEVEL_EDGES.filter((level) => between(a, b, level)).map((level) => (level - a) / (b - a)),
    );
    if (!cuts.length) return [segment];
    const points = [0, ...new Set(cuts), 1].sort((a, b) => a - b).map((t) => along(from, to, t));
    return points.slice(1).map((point, i) => ({ ...segment, from: points[i], to: point }));
  });
}

/** Triangulate the slope and any level strips separately so they meet the fascia at the same height. */
export function splitSlopeSurface(polygon: ClipPolygon, progressAt: SlopeProgress): ClipPolygon[] {
  let low = Infinity;
  let high = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of polygon[0]) {
    const progress = progressAt(point);
    low = Math.min(low, progress);
    high = Math.max(high, progress);
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minZ = Math.min(minZ, point[1]);
    maxZ = Math.max(maxZ, point[1]);
  }
  const cuts = LEVEL_EDGES.filter((level) => between(low, high, level));
  if (!cuts.length) return [polygon];

  const bounds: Point[] = [
    [minX - 1, minZ - 1],
    [maxX + 1, minZ - 1],
    [maxX + 1, maxZ + 1],
    [minX - 1, maxZ + 1],
  ];
  const progress = bounds.map(progressAt);
  const pieces: ClipPolygon[] = [];
  let remaining = [polygon];
  for (const level of cuts) {
    const limit: Point[] = [];
    for (const [index, point] of bounds.entries()) {
      const next = (index + 1) % bounds.length;
      const a = progress[index];
      const b = progress[next];
      if (a <= level) limit.push(point);
      if (a <= level !== b <= level) limit.push(along(point, bounds[next], (level - a) / (b - a)));
    }
    pieces.push(...intersectClippingGeometry(remaining, [limit]));
    remaining = differenceClippingGeometry(remaining, [limit]);
  }
  return [...pieces, ...remaining];
}
