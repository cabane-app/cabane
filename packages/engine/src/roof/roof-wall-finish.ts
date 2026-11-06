import { createWallAssemblyPointTest } from "../architecture-geometry/wall-solid-footprints";
import { wallFaceFinish } from "../architecture-geometry/wall-face-finish";
import { wallFrame } from "../architecture-geometry/wall-coordinate-frame";
import { physicalFloor } from "../architecture-geometry/physical-floor";
import type { FloorSpec, WallSpec } from "../types";

type Point = readonly [number, number];
export type RoofWallSupport = { wall: WallSpec; frame: ReturnType<typeof wallFrame> };

export function roofWallFaceColor(
  support: RoofWallSupport | undefined,
  from: Point,
  to: Point,
  fallback: string,
) {
  if (!support) return fallback;
  const { wall, frame } = support;
  // Rings keep solid material on the left, so their visible face points right.
  const facing = (to[1] - from[1]) * frame.normal[0] - (to[0] - from[0]) * frame.normal[1];
  return wallFaceFinish(wall, facing >= 0 ? "left" : "right", true, fallback);
}

/** Keep roof infill aligned with the finish boundaries of the walls below it. */
export function createRoofWallLookup(requestedFloor: FloorSpec) {
  const floor = physicalFloor(requestedFloor);
  const walls = floor.walls.map((wall) => ({
    wall,
    frame: wallFrame(wall, floor),
    contains: createWallAssemblyPointTest(wall, floor),
  }));
  return {
    find(from: Point, to: Point): RoofWallSupport | undefined {
      const center: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      let result: RoofWallSupport | undefined;
      let nearest = Infinity;
      for (const { wall, frame, contains } of walls) {
        if (!contains(center)) continue;
        const alignment = Math.abs(
          ((to[0] - from[0]) * frame.direction[0] + (to[1] - from[1]) * frame.direction[1]) /
            length,
        );
        if (alignment < 0.999) continue;
        const dx = center[0] - frame.from[0];
        const dz = center[1] - frame.from[1];
        const across = dx * frame.normal[0] + dz * frame.normal[1];
        const distance = Math.abs(Math.abs(across) - wall.thicknessMeters / 2);
        if (distance >= nearest) continue;
        nearest = distance;
        result = { wall, frame };
      }
      return result;
    },
    /** Split long union edges where adjacent walls can change exterior color. */
    breaks(from: Point, to: Point): number[] {
      const dx = to[0] - from[0];
      const dz = to[1] - from[1];
      const length = Math.hypot(dx, dz);
      if (length < 1e-6) return [];
      const breaks: number[] = [];
      for (const { frame } of walls) {
        if (Math.abs((dx * frame.direction[0] + dz * frame.direction[1]) / length) < 0.999)
          continue;
        for (const point of [frame.from, frame.to]) {
          const t = ((point[0] - from[0]) * dx + (point[1] - from[1]) * dz) / length ** 2;
          if (t > 1e-6 && t < 1 - 1e-6) breaks.push(t);
        }
      }
      return breaks;
    },
  };
}
