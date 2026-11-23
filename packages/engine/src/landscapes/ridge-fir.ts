import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import { gardenRandom } from "./garden-layout";

/** A tapered stem and individual, pitched boughs. Their forked shoots and needles
 * are painted into the original fir-bough cutout, with a white chip for bark. */
export function ridgeFir(distant = false) {
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const color = new Color();
  function vertex(x: number, y: number, z: number, u: number, v: number) {
    positions.push(x, y, z);
    uvs.push(u, v);
    colors.push(color.r, color.g, color.b);
  }
  const stemX = (h: number) => 0.013 * h * Math.sin(h * 4.2);
  const stemZ = (h: number) => 0.018 * h * h;
  const sides = distant ? 4 : 6;
  for (const height of distant ? [-0.025, 1] : [-0.025, 0.31, 0.68, 1]) {
    const start = positions.length / 3;
    const radius = 0.014 * (1.05 - height);
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
      color.set("#776552").multiplyScalar(0.82 + 0.24 * Math.sin(angle * 2 + 1));
      vertex(
        stemX(height) + radius * Math.cos(angle),
        height,
        stemZ(height) + radius * Math.sin(angle),
        0.007,
        0.985,
      );
      if (start) {
        const j = (i + 1) % sides;
        indices.push(
          start + i - sides,
          start + i,
          start + j - sides,
          start + j - sides,
          start + i,
          start + j,
        );
      }
    }
  }
  const random = gardenRandom(72961);
  for (let tier = 0; tier < 10; tier++) {
    const base = 0.19 + tier * 0.084;
    const count = tier < 6 ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const angle = tier * 2.37 + ((i + random() * 0.39) * Math.PI * 2) / count;
      const height = base + (random() - 0.5) * 0.055;
      const length = (0.029 + 0.345 * Math.pow(1 - height, 0.86)) * (0.8 + random() * 0.3);
      const pitch = -0.34 + height * 0.86 + (random() - 0.5) * 0.49;
      const span = length * (0.42 + random() * 0.17);
      const tilt = (random() - 0.5) * 0.72;
      const sin = Math.sin(angle),
        cos = Math.cos(angle);
      const start = positions.length / 3;
      const tone = 0.7 + 0.16 * height + random() * 0.25;
      // Subpixel shoots share two folded triangles on the far globe. Sample the same
      // growth sequence at both resolutions to preserve the silhouette.
      if (distant && (tier === 2 || tier === 6 || i === 4)) continue;
      function shootVertex(t: number, side: number) {
        const width = side * span * (t === 0 ? 0.5 : 1);
        const distance = t * length;
        const droop = Math.abs(width) * (0.38 + 0.34 * (1 - height));
        const y =
          height + length * (pitch * t - 0.12 * Math.sin(t * Math.PI)) - droop + width * tilt;
        color.setRGB(0.9, 0.97, 0.94).multiplyScalar(tone * (0.69 + 0.31 * t));
        vertex(
          stemX(height) + distance * cos - width * sin,
          y,
          stemZ(height) + distance * sin + width * cos,
          t,
          0.5 + 0.458 * side,
        );
      }
      if (distant) {
        shootVertex(0, 0);
        shootVertex(0.48, -1);
        shootVertex(1, 0);
        shootVertex(0.48, 1);
        indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
        continue;
      }
      for (const t of [0, 0.5, 1]) {
        for (const side of [-1, 0, 1]) shootVertex(t, side);
      }
      for (const offset of [0, 1, 3, 4]) {
        const a = start + offset;
        indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
