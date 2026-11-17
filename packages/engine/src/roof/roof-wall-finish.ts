import {
  createWallAssemblyPointTest,
  wallAssemblyFootprintPolygons,
} from "../architecture-geometry/wall-solid-footprints";
import { leanPlanPolygon, leanWorldRings } from "../architecture-geometry/wall-lean";
import { EPSILON } from "../architecture-geometry/architecture-geometry-contract";
import { pointInsidePolygon } from "../geometry";
import { wallFaceFinish } from "../architecture-geometry/wall-face-finish";
import { wallFrame } from "../architecture-geometry/wall-coordinate-frame";
import { wallStructuralHeight } from "../architecture-geometry/wall-structural-height";
import { physicalFloor } from "../architecture-geometry/physical-floor";
import type { FloorSpec, WallSpec, WallSurfaceFinish } from "../types";

type Point = readonly [number, number];
export type RoofWallSupport = {
  wall: WallSpec;
  frame: ReturnType<typeof wallFrame>;
  elevation: number;
  unlean?: ((point: Point) => Point) | undefined;
};
export type RoofWallFace = {
  color: string;
  finish?: WallSurfaceFinish | undefined;
  support?: RoofWallSupport;
  side?: "left" | "right";
};

export function roofWallFace(
  support: RoofWallSupport | undefined,
  from: Point,
  to: Point,
  fallback: string,
  outside = true,
): RoofWallFace {
  if (!support) return { color: fallback };
  const { wall, frame } = support;
  // Rings keep solid material on the left, so their visible face points right.
  const facing = (to[1] - from[1]) * frame.normal[0] - (to[0] - from[0]) * frame.normal[1];
  const side = facing >= 0 === outside ? "left" : "right";
  return {
    color: wallFaceFinish(wall, side, outside, fallback),
    finish: wall.faceFinishes?.[side],
    side,
    support,
  };
}

/** Keep roof infill aligned with the finish boundaries of the walls below it. */
export function createRoofWallLookup(
  requestedFloor: FloorSpec,
  level?: { elevationMeters: number; hasAbove: boolean },
  leanHeight = 0,
) {
  const floor = physicalFloor(requestedFloor);
  const walls = floor.walls.map((wall) => {
    const frame = wallFrame(wall, floor);
    if (!leanHeight)
      return { wall, frame, rimFrame: frame, contains: createWallAssemblyPointTest(wall, floor) };
    // Roof coverage shears the assembled footprint, including the ends and
    // miters of walls meeting a lean. Match the same shapes at this ceiling.
    const rings = wallAssemblyFootprintPolygons(wall, floor).flatMap((polygon) =>
      leanWorldRings(polygon, floor, leanHeight),
    );
    const [from, to] = leanPlanPolygon([wall.from, wall.to] as const, floor, leanHeight);
    const rimFrame = wallFrame({ ...wall, from, to }, floor);
    return {
      wall,
      frame,
      rimFrame,
      // Wall UVs are assigned before vertices lean. Interpolate their shift
      // between the endpoints and translate the corner miter with its endpoint.
      unlean: ([x, z]: Point): Point => {
        const along =
          (x - rimFrame.from[0]) * rimFrame.direction[0] +
          (z - rimFrame.from[1]) * rimFrame.direction[1];
        const t = Math.max(0, Math.min(1, along / (rimFrame.length || 1)));
        return [
          x + (frame.from[0] - rimFrame.from[0]) * (1 - t) + (frame.to[0] - rimFrame.to[0]) * t,
          z + (frame.from[1] - rimFrame.from[1]) * (1 - t) + (frame.to[1] - rimFrame.to[1]) * t,
        ];
      },
      contains: ([x, z]: Point) => {
        // Union edges are rounded to the clipping grid. Probe a micron on
        // either side of the rim so rotated exterior faces include their edge.
        const dx = EPSILON * rimFrame.normal[0],
          dz = EPSILON * rimFrame.normal[1];
        return rings.some(
          (ring) =>
            pointInsidePolygon([x + dx, z + dz], ring) ||
            pointInsidePolygon([x - dx, z - dz], ring),
        );
      },
    };
  });
  const wallTops = new Map<WallSpec, number>();
  return {
    elevation: level?.elevationMeters ?? 0,
    top(wall: WallSpec): number {
      const cached = wallTops.get(wall);
      if (cached !== undefined) return cached;
      const height = level?.hasAbove
        ? wallStructuralHeight(wall, floor)
        : (wall.heightMeters ?? floor.defaultWallHeightMeters);
      const top = (level?.elevationMeters ?? 0) + height;
      wallTops.set(wall, top);
      return top;
    },
    find(from: Point, to: Point): RoofWallSupport | undefined {
      const center: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      let result: RoofWallSupport | undefined;
      let nearest = Infinity;
      for (const { wall, frame, rimFrame, contains, unlean } of walls) {
        if (!contains(center)) continue;
        const alignment = Math.abs(
          ((to[0] - from[0]) * rimFrame.direction[0] + (to[1] - from[1]) * rimFrame.direction[1]) /
            length,
        );
        if (alignment < 0.999) continue;
        const dx = center[0] - rimFrame.from[0];
        const dz = center[1] - rimFrame.from[1];
        const across = dx * rimFrame.normal[0] + dz * rimFrame.normal[1];
        const distance = Math.abs(Math.abs(across) - wall.thicknessMeters / 2);
        if (distance >= nearest) continue;
        nearest = distance;
        result = { wall, frame, unlean, elevation: level?.elevationMeters ?? 0 };
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
      for (const { rimFrame: frame } of walls) {
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
