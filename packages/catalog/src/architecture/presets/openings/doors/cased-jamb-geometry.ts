import { BufferGeometry, Float32BufferAttribute } from "three";
import { DOOR_FRAME_JAMB_WIDTH_METERS } from "./door-frame-dimensions";

/** The two legs and lintel meet on mitres. The casing covers both wall faces. */
export function casedFrameGeometry(width: number, height: number, depth: number) {
  const rail = DOOR_FRAME_JAMB_WIDTH_METERS;
  const half = depth / 2;
  const section = [
    [0, -half + 0.005, 0.85],
    [0, half - 0.005, 0.82],
    [0.003, half - 0.002, 0.92],
    [0.011, half - 0.002, 0.83],
    [0.014, half, 1],
    [rail - 0.006, half, 0.98],
    [rail, half - 0.004, 0.9],
    [rail, -half + 0.004, 0.9],
    [rail - 0.006, -half, 0.98],
    [0.014, -half, 1],
    [0.011, -half + 0.002, 0.83],
    [0.003, -half + 0.002, 0.92],
  ];
  const positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const geometry = new BufferGeometry();
  for (let member = 0; member < 3; member++) {
    const first = indices.length;
    for (let i = 0; i < section.length; i++) {
      const a = section[i],
        b = section[(i + 1) % section.length];
      const start = positions.length / 3;
      for (const [s, end] of [
        [a, 0],
        [a, 1],
        [b, 1],
        [b, 0],
      ] as const) {
        const [u, z] = s;
        const inset = rail / 2 - u;
        const mitre = height - 0.008 + u;
        const x = member === 0 ? inset : member === 1 ? width - inset : end ? width - inset : inset;
        const y = member === 2 ? mitre : end ? mitre : 0;
        positions.push(x, y, z);
        uvs.push(u / 0.86 + member * 0.17, (member === 2 ? x : y) / 1.86);
        colors.push(a[2], a[2], a[2]);
      }
      if (member === 1) indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
      else indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
    geometry.addGroup(first, indices.length - first, 0);
  }
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.preservePlanarFaces = true;
  return geometry;
}
