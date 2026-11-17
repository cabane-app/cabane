import { buildRecessedWallGeometry } from "./recessed-wall-geometry";
import { openingCutTop, planPointToWorld } from "../geometry";

import type { FloorSpec, OpeningSpec, WallSpec } from "../types";
import {
  EPSILON,
  JUNCTION_SEAM_OVERLAP_METERS,
  MaterialBucket,
} from "./architecture-geometry-contract";
import { geometryFromBuckets, pushTriangle, uniqueSorted } from "./architecture-mesh-buckets";
import { junctionArmHalfLength, wallExteriorNormal, wallFrame } from "./wall-coordinate-frame";

export function buildContinuousWallGeometry(
  wall: WallSpec,
  floor: FloorSpec,
  openings: readonly OpeningSpec[],
) {
  const frame = wallFrame(wall, floor);
  const ownsEndpoint = (point: readonly [number, number]) =>
    floor.wallJunctions.some(
      (junction) =>
        junction.wallIds.includes(wall.id) &&
        Math.hypot(junction.at[0] - point[0], junction.at[1] - point[1]) <= EPSILON,
    );
  const startOwnedByJunction = ownsEndpoint(wall.from);
  const endOwnedByJunction = ownsEndpoint(wall.to);
  const height = wall.heightMeters ?? floor.defaultWallHeightMeters;
  const scale = floor.coordinates.metersPerPlanUnit;
  const wallOpenings = openings
    .filter((opening) => opening.wallId === wall.id)
    .map((opening) => ({
      start: opening.offsetFromWallStartPlanUnits * scale,
      end: (opening.offsetFromWallStartPlanUnits + opening.widthPlanUnits) * scale,
      bottom: opening.sillHeightMeters,
      top: openingCutTop(opening, height),
    }));
  const trimIntervals = floor.wallJunctions
    .filter((junction) => junction.wallIds.includes(wall.id))
    .map((junction) => {
      const at = planPointToWorld(junction.at, floor.coordinates);
      const distance =
        (at[0] - frame.from[0]) * frame.direction[0] + (at[1] - frame.from[1]) * frame.direction[1];
      const halfLength = Math.max(
        0,
        junctionArmHalfLength(junction, floor) - JUNCTION_SEAM_OVERLAP_METERS,
      );
      return [
        Math.max(0, distance - halfLength),
        Math.min(frame.length, distance + halfLength),
      ] as const;
    });
  const xs = uniqueSorted([
    0,
    frame.length,
    ...wallOpenings.flatMap((opening) => [opening.start, opening.end]),
    ...trimIntervals.flatMap((interval) => interval),
  ]);
  const ys = uniqueSorted([
    0,
    height,
    ...wallOpenings.flatMap((opening) => [opening.bottom, opening.top]),
  ]);
  const occupied = Array.from({ length: xs.length - 1 }, (_, x) =>
    Array.from({ length: ys.length - 1 }, (_, y) => {
      const middleX = (xs[x] + xs[x + 1]) / 2;
      const middleY = (ys[y] + ys[y + 1]) / 2;
      const removedByOpening = wallOpenings.some(
        (opening) =>
          middleX > opening.start - EPSILON &&
          middleX < opening.end + EPSILON &&
          middleY > opening.bottom - EPSILON &&
          middleY < opening.top + EPSILON,
      );
      const removedByJunction = trimIntervals.some(
        ([start, end]) => middleX > start - EPSILON && middleX < end + EPSILON,
      );
      return !removedByOpening && !removedByJunction;
    }),
  );
  const buckets: [number[], number[]] = [[], []];
  const half = wall.thicknessMeters / 2;
  const exteriorNormal = wallExteriorNormal(wall, floor);
  const plusMaterial: MaterialBucket =
    exteriorNormal &&
    exteriorNormal[0] * frame.normal[0] + exteriorNormal[1] * frame.normal[1] > 0.5
      ? 1
      : 0;
  const minusMaterial: MaterialBucket =
    exteriorNormal &&
    exteriorNormal[0] * frame.normal[0] + exteriorNormal[1] * frame.normal[1] < -0.5
      ? 1
      : 0;
  if (wall.niches?.length)
    return buildRecessedWallGeometry(
      wall,
      floor,
      wallOpenings,
      trimIntervals,
      plusMaterial,
      minusMaterial,
      !startOwnedByJunction,
      !endOwnedByJunction,
    );
  const point = (distance: number, y: number, side: number): readonly [number, number, number] => [
    frame.from[0] + frame.direction[0] * distance + frame.normal[0] * half * side,
    y,
    frame.from[1] + frame.direction[1] * distance + frame.normal[1] * half * side,
  ];
  for (let x = 0; x < occupied.length; x += 1)
    for (let y = 0; y < occupied[x].length; y += 1) {
      if (!occupied[x][y]) continue;
      const [x0, x1] = [xs[x], xs[x + 1]];
      const [y0, y1] = [ys[y], ys[y + 1]];
      const p0 = point(x0, y0, 1);
      const p1 = point(x1, y0, 1);
      const p2 = point(x1, y1, 1);
      const p3 = point(x0, y1, 1);
      pushTriangle(buckets, plusMaterial, p0, p1, p2);
      pushTriangle(buckets, plusMaterial, p0, p2, p3);
      const m0 = point(x0, y0, -1);
      const m1 = point(x1, y0, -1);
      const m2 = point(x1, y1, -1);
      const m3 = point(x0, y1, -1);
      pushTriangle(buckets, minusMaterial, m0, m2, m1);
      pushTriangle(buckets, minusMaterial, m0, m3, m2);
      if ((x > 0 && !occupied[x - 1][y]) || (x === 0 && !startOwnedByJunction)) {
        pushTriangle(buckets, 0, m0, p0, p3);
        pushTriangle(buckets, 0, m0, p3, m3);
      }
      if (
        (x < occupied.length - 1 && !occupied[x + 1][y]) ||
        (x === occupied.length - 1 && !endOwnedByJunction)
      ) {
        pushTriangle(buckets, 0, p1, m1, m2);
        pushTriangle(buckets, 0, p1, m2, p2);
      }
      if (y === 0 || !occupied[x][y - 1]) {
        pushTriangle(buckets, 0, m0, m1, p1);
        pushTriangle(buckets, 0, m0, p1, p0);
      }
      if (y === occupied[x].length - 1 || !occupied[x][y + 1]) {
        pushTriangle(buckets, 0, p3, p2, m2);
        pushTriangle(buckets, 0, p3, m2, m3);
      }
    }
  return geometryFromBuckets(buckets);
}
