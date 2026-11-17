import { Vector2, type UVGenerator } from "three";
import { floorFinishPreset } from "../../floor-finishes/presets";
import type { PlanPoint } from "../../types";

export type TreadFinish = "light-oak" | "limestone" | "painted-plaster";

/** Align the photographed oak grain across each tread, including turned and radial steps. */
export function treadUV(
  polygon: readonly PlanPoint[],
  finish: TreadFinish,
  baseY: number,
): UVGenerator {
  const scale = finish === "painted-plaster" ? 1 : 1 / floorFinishPreset(finish).repeatMeters;
  let axisX = 0,
    axisZ = 1;
  if (finish === "light-oak") {
    let longest = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      if (length > longest) {
        longest = length;
        axisX = dx / length;
        axisZ = dz / length;
      }
    }
  }
  return {
    generateTopUV(_, vertices, a, b, c) {
      return [a, b, c].map((i) => {
        const x = vertices[i * 3],
          z = -vertices[i * 3 + 1];
        return new Vector2((x * axisZ - z * axisX) * scale, (x * axisX + z * axisZ) * scale);
      });
    },
    generateSideWallUV(_, vertices, a, b, c, d) {
      const dx = vertices[b * 3] - vertices[a * 3],
        dy = vertices[b * 3 + 1] - vertices[a * 3 + 1];
      const length = Math.hypot(dx, dy) || 1;
      return [a, b, c, d].map((i) => {
        const along = (dx * vertices[i * 3] + dy * vertices[i * 3 + 1]) / length;
        const height = baseY + vertices[i * 3 + 2];
        return finish === "light-oak"
          ? new Vector2(height * scale, along * scale)
          : new Vector2(along * scale, height * scale);
      });
    },
  };
}
