import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import { wallSurfaceU } from "../architecture-geometry/wall-coordinate-frame";
import { paintedWallU } from "../architecture-geometry/wall-surface-geometry";
import { wallSurfaceRepeatHeight, type WallSurfaceFinish } from "../wall-types";
import { appendRimFace } from "./roof-rim";
import type { RoofWallFace } from "./roof-wall-finish";

type InfillBatch = {
  finish: WallSurfaceFinish | undefined;
  positions: number[];
  colors: number[];
  uvs: number[];
};

/** Wall closures under the roof skin share the wall's finish, UV orientation and local height. */
export function createRoofInfill() {
  const batches = new Map<string, InfillBatch>();
  return {
    add(quad: number[][], face: RoofWallFace, floorElevation: number, wallTop?: number) {
      const { finish, support, side } = face;
      const key =
        finish?.pattern === "custom-image"
          ? finish.image.dataUrl
          : finish
            ? `${finish.pattern}:${finish.color}`
            : "paint";
      let batch = batches.get(key);
      if (!batch) {
        batch = { finish, positions: [], colors: [], uvs: [] };
        batches.set(key, batch);
      }
      const start = batch.positions.length;
      appendRimFace(batch.positions, quad, wallTop);
      const color = new Color(finish ? "white" : face.color);
      const dx = quad[3][0] - quad[0][0],
        dz = quad[3][2] - quad[0][2];
      const length = Math.hypot(dx, dz);
      const elevation = support?.elevation ?? floorElevation;
      for (let i = start; i < batch.positions.length; i += 3) {
        const x = batch.positions[i],
          y = batch.positions[i + 1],
          z = batch.positions[i + 2];
        const u =
          finish && support && side
            ? wallSurfaceU(support.unlean?.([x, z]) ?? [x, z], support.frame, finish, side)
            : paintedWallU(x, z, dz / length, -dx / length);
        batch.uvs.push(u, (y - elevation) / wallSurfaceRepeatHeight(finish));
        batch.colors.push(color.r, color.g, color.b);
      }
    },
    geometry() {
      const parts = [...batches.values()].filter((part) => part.positions.length);
      const result = Object.assign(new BufferGeometry(), {
        surfaces: parts.map(({ finish }) => ({ finish })),
      });
      let start = 0;
      for (const [index, part] of parts.entries()) {
        const count = part.positions.length / 3;
        result.addGroup(start, count, index);
        start += count;
      }
      result.setAttribute(
        "position",
        new Float32BufferAttribute(
          parts.flatMap((part) => part.positions),
          3,
        ),
      );
      result.setAttribute(
        "color",
        new Float32BufferAttribute(
          parts.flatMap((part) => part.colors),
          3,
        ),
      );
      result.setAttribute(
        "uv",
        new Float32BufferAttribute(
          parts.flatMap((part) => part.uvs),
          2,
        ),
      );
      result.computeVertexNormals();
      result.computeBoundingSphere();
      return result;
    },
  };
}
