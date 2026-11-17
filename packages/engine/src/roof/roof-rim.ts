import type { RoofWallFace, RoofWallSupport } from "./roof-wall-finish";

type Point = [number, number];
const TOLERANCE_METERS = 1e-6;

export interface RoofRimSegment {
  from: Point;
  to: Point;
  seam: boolean;
  gabled: boolean;
  face: RoofWallFace;
  support?: RoofWallSupport | undefined;
  wallTop?: number | undefined;
  offset?: Point | undefined;
}

export function roofWallCenterlinePoint(point: Point, { frame }: RoofWallSupport): Point {
  const across =
    (point[0] - frame.from[0]) * frame.normal[0] + (point[1] - frame.from[1]) * frame.normal[1];
  return [point[0] - across * frame.normal[0], point[1] - across * frame.normal[1]];
}

/** Fill the part of the exterior wall cap beyond an authored roof boundary. */
export function roofRimOffset(
  support: RoofWallSupport | undefined,
  from: Point,
  to: Point,
  face: "inside" | "outside" = "outside",
): Point | undefined {
  if (support?.wall.classification !== "exterior") return;
  const { wall, frame } = support;
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  if (length < TOLERANCE_METERS) return;
  if (Math.abs((dx * frame.normal[0] + dz * frame.normal[1]) / length) > TOLERANCE_METERS) return;
  const outward: Point = [dz / length, -dx / length];
  const across = (from[0] - frame.from[0]) * outward[0] + (from[1] - frame.from[1]) * outward[1];
  const halfWidth = wall.thicknessMeters / 2;
  if (Math.abs(across) > halfWidth + TOLERANCE_METERS) return;
  const shift = (face === "inside" ? -halfWidth : halfWidth) - across;
  if (face === "outside" && shift <= TOLERANCE_METERS) return;
  return [outward[0] * shift, outward[1] * shift];
}

function rimCorner(
  before: RoofRimSegment,
  after: RoofRimSegment,
  anchor: Point,
): Point | undefined {
  const rx = before.to[0] - before.from[0];
  const rz = before.to[1] - before.from[1];
  const sx = after.to[0] - after.from[0];
  const sz = after.to[1] - after.from[1];
  const cross = rx * sz - rz * sx;
  if (Math.abs(cross) < TOLERANCE_METERS * Math.hypot(rx, rz) * Math.hypot(sx, sz)) return;
  const dx = after.from[0] - before.to[0];
  const dz = after.from[1] - before.to[1];
  const t = (dx * sz - dz * sx) / cross;
  const point: Point = [before.to[0] + t * rx, before.to[1] + t * rz];
  // At a sharp corner, bevel instead of growing a long spike.
  const limit =
    2 * Math.max(Math.hypot(...(before.offset ?? [0, 0])), Math.hypot(...(after.offset ?? [0, 0])));
  return Math.hypot(point[0] - anchor[0], point[1] - anchor[1]) <= limit + TOLERANCE_METERS
    ? point
    : undefined;
}

export function alignRoofRim(rim: RoofRimSegment[]): RoofRimSegment[] {
  if (!rim.some((segment) => segment.offset)) return rim;
  const shift = (point: Point, offset: Point): Point => [
    point[0] + offset[0],
    point[1] + offset[1],
  ];
  const projected = rim.map((segment) =>
    segment.offset
      ? {
          ...segment,
          from: shift(segment.from, segment.offset),
          to: shift(segment.to, segment.offset),
        }
      : { ...segment },
  );
  const corners = projected.map((after, index) => {
    const before = projected[(index + projected.length - 1) % projected.length];
    return rimCorner(before, after, rim[index].from);
  });
  return projected.flatMap((part, index) => {
    const nextIndex = (index + 1) % projected.length;
    const from = corners[index] ?? part.from;
    const to = corners[nextIndex] ?? part.to;
    const aligned = { ...part, from, to };
    const next = projected[nextIndex];
    const nextFrom = corners[nextIndex] ?? next.from;
    if (Math.hypot(to[0] - nextFrom[0], to[1] - nextFrom[1]) < TOLERANCE_METERS) return [aligned];
    const border = part.offset ? part : next;
    return [
      aligned,
      { ...border, from: to, to: nextFrom, seam: false, support: undefined, wallTop: undefined },
    ];
  });
}

/** A taller facade can conceal all, or just the low end, of a sloping fascia. */
export function appendRimFace(target: number[], quad: number[][], wallTop = -Infinity) {
  if (quad.every((p) => p[1] <= wallTop)) return;
  const visible: number[][] = [];
  let previous = quad[quad.length - 1];
  for (const point of quad) {
    const from = previous[1] - wallTop;
    const to = point[1] - wallTop;
    if ((from < 0 && to > 0) || (from > 0 && to < 0)) {
      const t = from / (from - to);
      visible.push([
        previous[0] + t * (point[0] - previous[0]),
        wallTop,
        previous[2] + t * (point[2] - previous[2]),
      ]);
    }
    if (to >= 0) visible.push(point);
    previous = point;
  }
  for (let i = 2; i < visible.length; i++)
    target.push(...visible[0], ...visible[i - 1], ...visible[i]);
}
