import { wallFrame } from "../architecture-geometry/wall-coordinate-frame";
import { wallGablesForFloor } from "../architecture-geometry/wall-gable-geometry";
import type { FloorSpec } from "../types";
import { ROOF_CEILING_DEPTH_METERS } from "./roof-settings";
import type { RoofWallSupport } from "./roof-wall-finish";

type Point = [number, number];
const TOLERANCE_METERS = 1e-6;
type RoofGableSpan = RoofWallSupport & { start: number; end: number };

/** Roof edge spans already closed by a physical gable up to the ceiling height. */
export function createRoofGableSpans(floor: FloorSpec, elevationMeters: number) {
  const gables = wallGablesForFloor(floor);
  const walls = floor.walls.flatMap((wall) => {
    const shapes = gables.get(wall.id);
    return shapes ? [{ frame: wallFrame(wall, floor), wall, shapes }] : [];
  });
  const ceilingOffset = elevationMeters + ROOF_CEILING_DEPTH_METERS;
  return (from: Point, to: Point, heightAt: (point: Point) => number) => {
    const spans: RoofGableSpan[] = [];
    for (const { frame, wall, shapes } of walls) {
      const along = ([x, z]: Point) =>
        (x - frame.from[0]) * frame.direction[0] + (z - frame.from[1]) * frame.direction[1];
      const across = ([x, z]: Point) =>
        (x - frame.from[0]) * frame.normal[0] + (z - frame.from[1]) * frame.normal[1];
      const halfWidth = wall.thicknessMeters / 2 + TOLERANCE_METERS;
      const fromAcross = across(from);
      const toAcross = across(to);
      if (
        Math.abs(fromAcross) > halfWidth ||
        Math.abs(toAcross) > halfWidth ||
        Math.abs(toAcross - fromAcross) > TOLERANCE_METERS
      )
        continue;
      const fromAlong = along(from);
      const distance = along(to) - fromAlong;
      if (Math.abs(distance) < TOLERANCE_METERS) continue;
      for (const run of shapes.profile) {
        for (let index = 1; index < run.length; index++) {
          const [a, aHeight] = run[index - 1];
          const [b, bHeight] = run[index];
          if (b - a < TOLERANCE_METERS) continue;
          const aAt = (a - fromAlong) / distance;
          const bAt = (b - fromAlong) / distance;
          const start = Math.max(0, Math.min(aAt, bAt));
          const end = Math.min(1, Math.max(aAt, bAt));
          if ((end - start) * Math.abs(distance) < TOLERANCE_METERS) continue;
          const matches = (t: number) => {
            const height =
              aHeight + ((fromAlong + t * distance - a) / (b - a)) * (bHeight - aHeight);
            const point: Point = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
            return Math.abs(heightAt(point) - ceilingOffset - height) <= TOLERANCE_METERS;
          };
          if (matches(start) && matches(end)) spans.push({ start, end, wall, frame });
        }
      }
    }
    return spans;
  };
}
