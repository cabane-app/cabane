import { createWallAssemblyPointTest } from "../architecture-geometry/wall-solid-footprints";
import { wallFaceFinish } from "../architecture-geometry/wall-face-finish";
import { wallFrame } from "../architecture-geometry/wall-coordinate-frame";
import { physicalFloor } from "../architecture-geometry/physical-floor";
import type { FloorSpec } from "../types";

type Point = readonly [number, number];

/** Keep roof infill aligned with the finish boundaries of the walls below it. */
export function createRoofWallFinish(requestedFloor: FloorSpec) {
  const floor = physicalFloor(requestedFloor);
  const walls = floor.walls.map((wall) => ({
    wall,
    frame: wallFrame(wall, floor),
    contains: createWallAssemblyPointTest(wall, floor),
  }));
  return (from: Point, to: Point, fallback: string): string => {
    const center: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    let result = fallback,
      nearest = Infinity;
    for (const { wall, frame, contains } of walls) {
      if (!contains(center)) continue;
      const alignment = Math.abs(
        ((to[0] - from[0]) * frame.direction[0] + (to[1] - from[1]) * frame.direction[1]) / length,
      );
      if (alignment < 0.999) continue;
      const dx = center[0] - frame.from[0],
        dz = center[1] - frame.from[1];
      const across = dx * frame.normal[0] + dz * frame.normal[1];
      const distance = Math.abs(Math.abs(across) - wall.thicknessMeters / 2);
      if (distance >= nearest) continue;
      nearest = distance;
      // Clipped roof rings keep solid material on the left, so their visible
      // face points right. Position alone is ambiguous for authored slopes
      // whose edge lies on the wall centerline.
      const facing = (to[1] - from[1]) * frame.normal[0] - (to[0] - from[0]) * frame.normal[1];
      result = wallFaceFinish(wall, facing >= 0 ? "left" : "right", true, fallback);
    }
    return result;
  };
}

/** Split long union edges where adjacent walls can change exterior color. */
export function roofWallBreaks(requestedFloor: FloorSpec, from: Point, to: Point): number[] {
  const floor = physicalFloor(requestedFloor);
  const dx = to[0] - from[0],
    dz = to[1] - from[1];
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared < 1e-12) return [];
  return floor.walls.flatMap((wall) => {
    const frame = wallFrame(wall, floor);
    if (
      Math.abs((dx * frame.direction[0] + dz * frame.direction[1]) / Math.sqrt(lengthSquared)) <
      0.999
    )
      return [];
    return [frame.from, frame.to]
      .map((point) => ((point[0] - from[0]) * dx + (point[1] - from[1]) * dz) / lengthSquared)
      .filter((t) => t > 1e-6 && t < 1 - 1e-6);
  });
}
