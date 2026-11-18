import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from "three";
import stems from "./assets/hedgerow-stems.json";
import { distanceToLawn, groundHeight, type FieldPlot } from "./country-survey";

/** Lidar canopy maxima locate the stems. Forks taper into the measured crown. */
export function hedgerowWood(plot: FieldPlot) {
  const vertices: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const first = new Vector3(),
    second = new Vector3(),
    axis = new Vector3(),
    side = new Vector3(),
    front = new Vector3();
  const bark = new Color("#615744"),
    ridge = new Color("#95836a"),
    color = new Color();
  let seed = 7837;
  const rand = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
  function limb(from: Vector3, to: Vector3, base: number, tip: number, sides: number) {
    axis.subVectors(to, from).normalize();
    side.set(1, 0, 0).cross(axis).normalize();
    front.crossVectors(axis, side);
    const start = vertices.length / 3;
    for (let k = 0; k < sides; k++) {
      const a = (k * Math.PI * 2) / sides,
        cx = Math.cos(a),
        sz = Math.sin(a);
      color.copy(bark).lerp(ridge, 0.1 + rand() * 0.59);
      first
        .copy(from)
        .addScaledVector(side, cx * base)
        .addScaledVector(front, sz * base);
      second
        .copy(to)
        .addScaledVector(side, cx * tip)
        .addScaledVector(front, sz * tip);
      vertices.push(...first.toArray(), ...second.toArray());
      colors.push(...color.toArray(), ...color.toArray());
      const i = start + 2 * k,
        next = start + 2 * ((k + 1) % sides);
      indices.push(i, next, i + 1, next, next + 1, i + 1);
    }
  }
  for (const [sx, sz, soil, height] of stems) {
    const scale = plot.surveyScale,
      x = sx * scale,
      z = sz * scale,
      wx = plot.surveyX + x,
      wz = plot.surveyZ + z;
    const near = Math.hypot(sx, sz) < 100,
      h = height * scale;
    if (distanceToLawn(plot, wx, wz) < 1.4 || h < 2.6) continue;
    const root = new Vector3(x, groundHeight(plot, wx, wz, soil + 1.37) - 0.09, z);
    const fork = root
      .clone()
      .add(
        new Vector3(
          (rand() - 0.5) * h * 0.038,
          h * (0.24 + rand() * 0.13),
          (rand() - 0.5) * h * 0.05,
        ),
      );
    const radius = h * (0.012 + rand() * 0.011);
    limb(root, fork, radius * 1.16, radius * 0.77, near ? 8 : 5);
    for (let j = 0; j < (near ? 4 : 2); j++) {
      const a = (j + rand() * 0.66) * 2.4,
        run = h * (0.075 + 0.08 * rand());
      const bough = fork
        .clone()
        .add(new Vector3(Math.cos(a) * run, h * (0.17 + 0.16 * rand()), Math.sin(a) * run));
      limb(fork, bough, radius * (0.45 + rand() * 0.23), radius * 0.25, near ? 6 : 4);
      if (near)
        for (const split of [-0.58, 0.63]) {
          const end = bough
            .clone()
            .add(
              new Vector3(
                Math.cos(a + split) * run * 0.8,
                h * (0.14 + 0.14 * rand()),
                Math.sin(a + split) * run * 0.8,
              ),
            );
          limb(bough, end, radius * 0.24, radius * 0.036, 4);
        }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
