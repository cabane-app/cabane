import type { StairSpec, StairShapeGeometry } from "./types";
import { uShapedGeometry } from "./u-shaped-geometry";
import { lShapedGeometry } from "./l-shaped-geometry";
import { spiralGeometry } from "./spiral-geometry";

export function stairShapeGeometry(
  stair: StairSpec,
  riseMeters: number,
  stepCount: number,
): StairShapeGeometry {
  if (stair.shape === "u-shaped") return uShapedGeometry(stair, riseMeters, stepCount);
  if (stair.shape === "l-shaped") return lShapedGeometry(stair, riseMeters, stepCount);
  if (stair.shape === "spiral") return spiralGeometry(stair, riseMeters, stepCount);
  const w = stair.widthMeters,
    r = stair.runMeters;
  return {
    widthMeters: w,
    runMeters: r,
    path: [
      { x: 0, z: 0, elevation: 0 },
      { x: 0, z: r, elevation: riseMeters },
    ],
    footprint: [
      [-w / 2, 0],
      [w / 2, 0],
      [w / 2, r],
      [-w / 2, r],
    ],
    treads: Array.from({ length: stepCount }, (_, i) => ({
      elevation: (riseMeters * (i + 1)) / stepCount,
      polygon: [
        [-w / 2, (r * i) / stepCount],
        [w / 2, (r * i) / stepCount],
        [w / 2, (r * (i + 1)) / stepCount],
        [-w / 2, (r * (i + 1)) / stepCount],
      ],
    })),
  };
}
