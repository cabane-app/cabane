import { BufferGeometry, Float32BufferAttribute } from "three";

/** A mitred section with a front and back glazing bead and a recessed gasket. */
export function sashGeometry(
  width: number,
  height: number,
  rail: number,
  depth: number,
  bottomRail = rail,
  leftRail = rail,
  rightRail = rail,
) {
  const half = depth / 2;
  const bevel = Math.min(0.003, depth * 0.05, rail * 0.08);
  const bead = Math.min(0.013, depth * 0.32);
  // Inset from the perimeter, depth, and linear tint of the outgoing face.
  const profile = [
    [0, -half + bevel, 0.91],
    [0, half - bevel, 1],
    [bevel, half, 1],
    [rail * 0.64, half, 0.83],
    [rail * 0.64 + bevel, half - bevel, 0.76],
    [rail * 0.64 + bevel, half - bevel * 2, 0.93],
    [rail * 0.91, bead, 0.26],
    [rail, bead, 0.26],
    [rail, -bead, 0.26],
    [rail * 0.91, -bead, 0.93],
    [rail * 0.64 + bevel, -half + bevel * 2, 0.76],
    [rail * 0.64 + bevel, -half + bevel, 0.83],
    [rail * 0.64, -half, 1],
    [bevel, -half, 1],
  ];
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  for (let ring = 0; ring < profile.length; ring++) {
    const from = profile[ring],
      to = profile[(ring + 1) % profile.length];
    for (let corner = 0; corner < 4; corner++) {
      const a = corners[corner],
        b = corners[(corner + 1) % 4];
      const start = positions.length / 3;
      for (const [section, sign] of [
        [from, a],
        [from, b],
        [to, b],
        [to, a],
      ]) {
        const x =
          sign[0] * (width / 2 - section[0] * (sign[0] < 0 ? leftRail / rail : rightRail / rail));
        const y = sign[1] * (height / 2 - section[0] * (sign[1] < 0 ? bottomRail / rail : 1));
        positions.push(x, y, section[1]);
        uvs.push(section[0] / 0.86 + corner * 0.22, (corner % 2 === 0 ? x : y) / 1.86);
        colors.push(from[2], from[2], from[2]);
      }
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.preservePlanarFaces = true;
  return geometry;
}
