import { BufferGeometry, Float32BufferAttribute } from "three";
import { wallFrame } from "./wall-coordinate-frame";
import type { FloorSpec, WallSpec, WallSurfaceFinish } from "../types";

/** Partition the existing standalone mesh without changing its junction trims or cutouts. */
export function splitWallSurfaceGeometry(source: BufferGeometry, wall: WallSpec, floor: FloorSpec) {
  if (!wall.faceFinishes) return [{ geometry: source, finish: undefined }];
  const frame = wallFrame(wall, floor);
  const positions = source.getAttribute("position"),
    normals = source.getAttribute("normal"),
    colors = source.getAttribute("color");
  const groups = new Map<
    string,
    { positions: number[]; colors: number[]; uvs: number[]; finish: WallSurfaceFinish | undefined }
  >();
  for (let start = 0; start < positions.count; start += 3) {
    const alignment = normals.getX(start) * frame.normal[0] + normals.getZ(start) * frame.normal[1];
    const finish =
      Math.abs(alignment) > 0.999
        ? wall.faceFinishes[alignment >= 0 ? "left" : "right"]
        : undefined;
    const key = finish ? JSON.stringify(finish) : "paint";
    let group = groups.get(key);
    if (!group) {
      group = { positions: [], colors: [], uvs: [], finish };
      groups.set(key, group);
    }
    for (let i = start; i < start + 3; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i);
      group.positions.push(x, y, z);
      group.colors.push(...(finish ? [1, 1, 1] : [colors.getX(i), colors.getY(i), colors.getZ(i)]));
      group.uvs.push(
        ((x - frame.from[0]) * frame.direction[0] + (z - frame.from[1]) * frame.direction[1]) /
          (finish?.repeatMeters ?? 1),
        y / (finish?.repeatMeters ?? 1),
      );
    }
  }
  source.dispose();
  return [...groups.values()].map((group) => {
    const geometry = new BufferGeometry();
    geometry.userData.preservePlanarFaces = true;
    geometry.setAttribute("position", new Float32BufferAttribute(group.positions, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(group.colors, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(group.uvs, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return { geometry, finish: group.finish };
  });
}
