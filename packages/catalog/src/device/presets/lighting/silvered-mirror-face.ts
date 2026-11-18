import { BufferGeometry, Color, Float32BufferAttribute } from "three";

// Chords share endpoints across the disc. The angled bands read as one reflection
// under a flat sky and remain exactly coplanar without overlay geometry.
const radius = 0.361;
const bands = [
  [-radius, "#9aafb3"],
  [-0.25, "#afc2c3"],
  [-0.155, "#afc2c3"],
  [-0.14, "#c0d1d0"],
  [-0.11, "#d3ded9"],
  [-0.062, "#d3ded9"],
  [-0.055, "#bfcece"],
  [0.13, "#bbcaca"],
  [0.145, "#cad7d5"],
  [0.175, "#cad7d5"],
  [0.181, "#b8c9ca"],
  [radius, "#9eafb5"],
] as const;
const stops = new Set<number>(bands.map(([u]) => u));
for (let i = 0; i <= 40; i++) stops.add(radius * Math.cos((i / 40) * Math.PI));
const positions: number[] = [],
  colors: number[] = [],
  indices: number[] = [];
for (const u of [...stops].sort((a, b) => a - b)) {
  const index = positions.length / 3;
  const upper = Math.max(
    1,
    bands.findIndex(([threshold]) => threshold >= u),
  );
  const [u0, c0] = bands[upper - 1],
    [u1, c1] = bands[upper];
  const tint = new Color(c0).lerp(new Color(c1), (u - u0) / (u1 - u0));
  const half = Math.sqrt(Math.max(0, radius ** 2 - u ** 2));
  for (const v of [-half, half]) {
    positions.push(u, v, 0);
    colors.push(tint.r, tint.g, tint.b);
  }
  if (index) indices.push(index - 2, index, index - 1, index - 1, index, index + 1);
}
export const silveredFace = new BufferGeometry();
silveredFace.setAttribute("position", new Float32BufferAttribute(positions, 3));
silveredFace.setAttribute("color", new Float32BufferAttribute(colors, 3));
silveredFace.setIndex(indices);
silveredFace.computeVertexNormals();
silveredFace.rotateZ(-0.52).translate(0, 0, 0.0335);
