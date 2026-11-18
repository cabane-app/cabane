import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import type { FieldPlot } from "./country-survey";

/** Small stands of bent blades and seed heads, planted at the actual site grade. */
export function vergeGrasses(plot: FieldPlot) {
  let seed = 42712;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const root = new Color("#586740"),
    tip = new Color("#859650"),
    straw = new Color("#d2bd80"),
    color = new Color();
  const vertex = (x: number, y: number, z: number, shade: Color) => {
    positions.push(x, y, z);
    colors.push(shade.r, shade.g, shade.b);
  };
  const halfX = plot.width / 2,
    halfZ = plot.depth / 2;
  const perimeter = 2 * (plot.width + plot.depth);
  for (let clump = 0; clump < Math.min(480, Math.ceil(1.9 * perimeter)); clump++) {
    const edge = random() * perimeter;
    const out = 0.1 + random() ** 1.5 * 4.0;
    let x, z;
    if (edge < plot.width) {
      x = edge - halfX;
      z = -halfZ - out;
    } else if (edge < plot.width + plot.depth) {
      x = halfX + out;
      z = edge - plot.width - halfZ;
    } else if (edge < 2 * plot.width + plot.depth) {
      x = edge - plot.width - plot.depth - halfX;
      z = halfZ + out;
    } else {
      x = -halfX - out;
      z = edge - 2 * plot.width - plot.depth - halfZ;
    }
    if (Math.sin(x * 0.35 + z * 0.12) + Math.cos(z * 0.24 - x * 0.18) < -0.45) continue;
    const patch = 0.14 + 0.32 * random(),
      height = 0.13 + 0.31 * random();
    const count = 9 + Math.floor(random() * 17);
    for (let j = 0; j < count; j++) {
      const angle = random() * Math.PI * 2,
        dx = Math.cos(angle),
        dz = Math.sin(angle);
      const spread = patch * Math.sqrt(random()),
        bx = x + dx * spread,
        bz = z + dz * spread;
      const by = (plot.terrain?.offsetAt(plot.x + bx, plot.z + bz) ?? 0) - 0.015,
        h = height * (0.5 + random()),
        bend = h * (0.18 + random() * 0.7);
      const w = 0.009 + random() * 0.008;
      const first = positions.length / 3;
      color.copy(root).lerp(tip, random() * 0.24);
      vertex(bx - dz * w, by, bz + dx * w, color);
      vertex(bx + dz * w, by, bz - dx * w, color);
      const mx = bx + dx * bend * 0.3,
        mz = bz + dz * bend * 0.3;
      color.lerp(tip, 0.46);
      vertex(mx - dz * w * 0.7, by + h * 0.69, mz + dx * w * 0.7, color);
      vertex(mx + dz * w * 0.7, by + h * 0.69, mz - dx * w * 0.7, color);
      color.copy(tip).lerp(straw, random() * 0.7);
      vertex(bx + dx * bend, by + h, bz + dz * bend, color);
      indices.push(
        first,
        first + 1,
        first + 2,
        first + 1,
        first + 3,
        first + 2,
        first + 2,
        first + 3,
        first + 4,
      );
      if (j % 7 === 0) {
        const fx = bx + dx * bend,
          fz = bz + dz * bend;
        const base = positions.length / 3;
        color.copy(straw).multiplyScalar(0.66 + 0.3 * random());
        vertex(fx, by + h - 0.015, fz, color);
        vertex(fx - dz * 0.014 + dx * 0.022, by + h + 0.042, fz + dx * 0.014 + dz * 0.022, color);
        vertex(fx + dz * 0.014 + dx * 0.022, by + h + 0.042, fz - dx * 0.014 + dz * 0.022, color);
        vertex(fx + dx * 0.06, by + h + 0.093, fz + dz * 0.06, color);
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
  }
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(positions, 3));
  result.setAttribute("color", new Float32BufferAttribute(colors, 3));
  result.setIndex(indices);
  result.computeVertexNormals();
  result.computeBoundingSphere();
  return result;
}
