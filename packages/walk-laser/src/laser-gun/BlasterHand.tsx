import { glovePalette } from "./glove-palette";
import { useEffect, useMemo } from "react";
import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Vector3 } from "three";
import { ToonMaterial } from "@cabane/engine";

type Section = [x: number, y: number, z: number, width: number, height: number];
const { leather, padding, seam, armor, trim, sleeve } = glovePalette;

// Sections are sculpted in blaster coordinates so the inside of each curl follows
// the sloped front strap. Width lies across the stroke, height follows the knuckles.
function sculptGlove() {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  function sweep(sections: Section[], finish: (along: number, around: number) => string) {
    const path = new CatmullRomCurve3(sections.map(([x, y, z]) => new Vector3(x, y, z)));
    const steps = (sections.length - 1) * 5,
      sides = 24;
    const start = positions.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        u = t * (sections.length - 1),
        k = Math.min(sections.length - 2, Math.floor(u)),
        f = u - k;
      const w = sections[k][3] * (1 - f) + sections[k + 1][3] * f;
      const h = sections[k][4] * (1 - f) + sections[k + 1][4] * f;
      const center = path.getPoint(t),
        forward = path.getTangent(t);
      const across = new Vector3(0, 1, 0).cross(forward).normalize();
      const up = forward.clone().cross(across);
      for (let j = 0; j < sides; j++) {
        const angle = (j * 2 * Math.PI) / sides;
        const point = center
          .clone()
          .addScaledVector(across, w * Math.cos(angle))
          .addScaledVector(up, h * Math.sin(angle));
        positions.push(point.x, point.y, point.z);
        const c = new Color(finish(t, angle));
        colors.push(c.r, c.g, c.b);
        if (i < steps) {
          const a = start + i * sides + j,
            b = start + i * sides + ((j + 1) % sides);
          indices.push(a, b, a + sides, b, b + sides, a + sides);
        }
      }
    }
  }
  // Heel of the hand flows into the wrist. The larger section sits behind
  // the knuckles, and narrows before the cuff.
  sweep(
    [
      [-0.064, -0.171, 0.119, 0.012, 0.041],
      [-0.068, -0.17, 0.148, 0.033, 0.072],
      [-0.062, -0.169, 0.182, 0.046, 0.085],
      [-0.042, -0.161, 0.216, 0.056, 0.079],
      [-0.015, -0.148, 0.249, 0.058, 0.062],
      [0.012, -0.155, 0.281, 0.052, 0.048],
      [0.039, -0.184, 0.309, 0.05, 0.047],
      [0.075, -0.203, 0.349, 0.052, 0.049],
    ],
    (t, a) => (t > 0.74 ? leather : a > 2.4 && a < 3.9 ? padding : leather),
  );
  // Asymmetric finger lengths and staggered knuckles on the visible side.
  for (const [i, y, z, r] of [
    [0, -0.142, 0.082, 0.023],
    [1, -0.184, 0.098, 0.022],
    [2, -0.225, 0.122, 0.0195],
  ]) {
    sweep(
      [
        [-0.045, y + 0.019, 0.238 + i * 0.007, 0.008, 0.012],
        [-0.075, y + 0.011, 0.195 + i * 0.01, r * 1.1, r * 1.15],
        [-0.094, y + 0.016, 0.167 + i * 0.012, r * 1.24, r * 1.21],
        [-0.09, y + 0.004, 0.133 + i * 0.015, r * 0.99, r * 0.91],
        [-0.078, y - 0.002, z + 0.016, r * 1.13, r],
        [-0.057, y - 0.003, z - 0.003, r, r * 0.91],
        [-0.021, y - 0.008, z - 0.01, r * 0.93, r * 0.87],
        [0.019, y - 0.012, z - 0.006, r * 0.85, r * 0.82],
        [0.048, y - 0.013, z + 0.009, r * 0.66, r * 0.7],
        [0.054, y - 0.012, z + 0.022, 0.002, 0.002],
      ],
      (t, a) =>
        t > 0.14 && t < 0.52 && a < 2.8 ? (t > 0.31 && t < 0.35 ? seam : padding) : leather,
    );
  }
  sweep(
    [
      [-0.05, -0.127, 0.205, 0.032, 0.033],
      [-0.074, -0.109, 0.149, 0.028, 0.028],
      [-0.076, -0.097, 0.105, 0.024, 0.022],
      [-0.061, -0.099, 0.06, 0.022, 0.021],
      [-0.042, -0.106, 0.031, 0.023, 0.022],
      [-0.014, -0.12, 0.022, 0.017, 0.018],
      [0.005, -0.127, 0.028, 0.003, 0.003],
    ],
    (t, a) => (t < 0.8 && a < 2.8 ? padding : leather),
  );
  // Thumb crosses the upper rear of the grip, diagonally above the curled fingers.
  sweep(
    [
      [0.003, -0.169, 0.272, 0.009, 0.012],
      [-0.046, -0.15, 0.258, 0.046, 0.043],
      [-0.078, -0.128, 0.224, 0.044, 0.041],
      [-0.095, -0.117, 0.194, 0.035, 0.033],
      [-0.101, -0.115, 0.161, 0.026, 0.025],
      [-0.092, -0.122, 0.13, 0.023, 0.024],
      [-0.083, -0.13, 0.116, 0.014, 0.016],
      [-0.079, -0.132, 0.109, 0.002, 0.002],
    ],
    (t, a) => (a > 4.35 && a < 5.68 ? padding : t < 0.83 && a < 2.8 ? padding : leather),
  );
  sweep(
    [
      [0.03, -0.171, 0.302, 0.051, 0.046],
      [0.039, -0.178, 0.311, 0.058, 0.054],
      [0.044, -0.182, 0.318, 0.06, 0.056],
      [0.066, -0.198, 0.344, 0.061, 0.056],
      [0.09, -0.216, 0.371, 0.054, 0.051],
    ],
    (t) => (t < 0.22 ? seam : t < 0.31 ? trim : armor),
  );
  sweep(
    [
      [0.074, -0.204, 0.353, 0.05, 0.047],
      [0.095, -0.222, 0.378, 0.054, 0.051],
      [0.19, -0.305, 0.5, 0.066, 0.064],
      [0.48, -0.58, 0.81, 0.085, 0.08],
    ],
    () => sleeve,
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function BlasterHand() {
  const geometry = useMemo(sculptGlove, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="blaster-gloved-hand" geometry={geometry}>
      <ToonMaterial vertexColors />
    </mesh>
  );
}
