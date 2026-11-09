import { leanWorldRings } from "../architecture-geometry/wall-lean";
import type { FloorSpec } from "../types";
import { walkJumpVerticalRange } from "./walk-jump";
import type {
  SegmentWalkCollider,
  WalkCollider,
  WalkPoint,
  WalkVerticalRange,
} from "./walk-navigation-contract";

const cross = (a: WalkPoint, b: WalkPoint, c: WalkPoint) =>
  (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);

/** The projection of a sheared wall slab is the convex hull of its two end slices. */
const convexHull = (points: WalkPoint[]): WalkPoint[] => {
  const sorted = points.sort((a, b) => a.x - b.x || a.z - b.z);
  const half = (vertices: WalkPoint[]) => {
    const result: WalkPoint[] = [];
    for (const point of vertices) {
      while (result.length > 1 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
};

export const leanWallCollider = (
  collider: SegmentWalkCollider,
  floor: FloorSpec,
  elevation: number,
): WalkCollider => {
  if (!floor.walls.some((wall) => wall.leanMeters)) return collider;
  const dx = collider.to.x - collider.from.x;
  const dz = collider.to.z - collider.from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-8) return collider;
  const nx = (-dz / length) * collider.halfThickness;
  const nz = (dx / length) * collider.halfThickness;
  const ring: [number, number][] = [
    [collider.from.x + nx, collider.from.z + nz],
    [collider.to.x + nx, collider.to.z + nz],
    [collider.to.x - nx, collider.to.z - nz],
    [collider.from.x - nx, collider.from.z - nz],
  ];
  const atUnitHeight = leanWorldRings([ring], floor, 1)[0];
  if (atUnitHeight.every(([x, z], i) => x === ring[i][0] && z === ring[i][1])) return collider;
  const minY = collider.minY ?? elevation;
  const maxY = collider.maxY ?? elevation + floor.defaultWallHeightMeters;
  const footprintForRange = (range: WalkVerticalRange) =>
    range.maxY <= minY || range.minY >= maxY
      ? []
      : convexHull(
          [Math.max(minY, range.minY), Math.min(maxY, range.maxY)].flatMap((height) =>
            ring.map(([x, z], i) => ({
              x: x + (atUnitHeight[i][0] - x) * (height - elevation),
              z: z + (atUnitHeight[i][1] - z) * (height - elevation),
            })),
          ),
        );
  return {
    kind: "polygon",
    id: collider.id,
    minY,
    maxY,
    points: footprintForRange(walkJumpVerticalRange(elevation, 0)),
    footprintForRange,
  };
};
