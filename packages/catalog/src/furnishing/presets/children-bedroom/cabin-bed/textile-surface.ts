import { BufferGeometry, Float32BufferAttribute } from "three";

export function textileSurface(
  columns: number,
  rows: number,
  point: (u: number, v: number) => number[],
) {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      const u = col / columns,
        v = row / rows;
      positions.push(...point(u, v));
      uvs.push(u * 4, v * 6);
      if (row === rows || col === columns) continue;
      const a = row * (columns + 1) + col,
        b = a + columns + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
