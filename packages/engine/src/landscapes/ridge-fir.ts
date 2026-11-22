import { BufferGeometry, Color, Float32BufferAttribute } from "three";

// Overlapping whorls make a broken silhouette in low sun. All crown and
// trunk faces share one opaque material, even when hundreds grow on the rim.
export function ridgeFir() {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const color = new Color();
  const sides = 10;
  function ring(height: number, radius: number, rotation: number, tips: boolean, tint: string) {
    const start = positions.length / 3;
    for (let i = 0; i < sides; i++) {
      const angle = rotation + (i * 2 * Math.PI) / sides;
      const tip = tips && i % 2 === 0;
      const r = radius * (tip ? 1.12 : 0.84) * (1 + 0.09 * Math.sin(i * 4 + rotation * 6));
      positions.push(Math.cos(angle) * r, height - (tip ? 0.036 : 0), Math.sin(angle) * r);
      color.set(tint).multiplyScalar(0.92 + 0.12 * Math.cos(i + rotation));
      colors.push(color.r, color.g, color.b);
    }
    return start;
  }
  function join(lower: number, upper: number) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      indices.push(lower + i, upper + i, lower + j, lower + j, upper + i, upper + j);
    }
  }
  join(ring(-0.025, 0.03, 0, false, "#443a30"), ring(0.63, 0.015, 0, false, "#665441"));
  for (let tier = 0; tier < 5; tier++) {
    const height = 0.2 + tier * 0.143,
      radius = 0.24 - tier * 0.037,
      turn = tier * 0.81;
    const base = ring(height, radius, turn, true, "#304d40");
    join(ring(height - 0.015, radius * 0.17, turn, false, "#273b35"), base);
    const shoulder = ring(height + 0.09, radius * 0.72, turn, false, "#486853");
    join(base, shoulder);
    const tip = positions.length / 3;
    positions.push(0, height + 0.26, 0);
    color.set("#698061");
    colors.push(color.r, color.g, color.b);
    for (let i = 0; i < sides; i++) indices.push(shoulder + i, tip, shoulder + ((i + 1) % sides));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
