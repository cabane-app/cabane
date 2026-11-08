import { CatmullRomCurve3, Vector3, Color } from "three";
import { LandscapeGeometry, type Point } from "./geometry-builder";

type Spray = (x: number, y: number, z: number, radius: number, shade: string) => void;

/** Swept, fluted wood: continuous taper, curved boughs and low buttress roots. */
function timber(wood: LandscapeGeometry, points: Point[], radius: number, tip: number) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  const frames = curve.computeFrenetFrames(14, false);
  const rings: Point[][] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14,
      center = curve.getPointAt(t);
    const r = radius * (1 - t) ** 0.8 + tip * t;
    rings.push(
      Array.from({ length: 12 }, (_, j) => {
        const a = (j / 12) * Math.PI * 2,
          flute = 1 + 0.13 * Math.sin(a * 5 + t * 4);
        return center
          .clone()
          .addScaledVector(frames.normals[i], Math.cos(a) * r * flute)
          .addScaledVector(frames.binormals[i], Math.sin(a) * r * flute)
          .toArray() as Point;
      }),
    );
  }
  for (let i = 0; i < 14; i++)
    for (let j = 0; j < 12; j++) {
      const k = (j + 1) % 12;
      const shade = ["#786344", "#897253", "#a18a65", "#6e5d43"][j % 4];
      wood.triangle(rings[i][j], rings[i + 1][k], rings[i + 1][j], shade);
      wood.triangle(rings[i][j], rings[i][k], rings[i + 1][k], shade);
    }
}

export function paintOak(
  wood: LandscapeGeometry,
  spray: Spray,
  random: () => number,
  x: number,
  y: number,
  z: number,
  size: number,
) {
  const p = (a: number, b: number, c: number): Point => [x + a * size, y + b * size, z + c * size];
  timber(
    wood,
    [p(0, 0, 0), p(-0.12, 0.9, 0.08), p(0.04, 1.8, 0), p(0.35, 2.7, -0.1)],
    size * 0.29,
    size * 0.13,
  );
  for (let i = 0; i < 6; i++) {
    const a = i * 2.399;
    timber(
      wood,
      [
        p(0, 0.6, 0),
        p(Math.cos(a) * 0.28, 0.12, Math.sin(a) * 0.28),
        p(Math.cos(a) * 0.8, 0.015, Math.sin(a) * 0.8),
      ],
      size * 0.12,
      size * 0.015,
    );
  }
  const boughs = [
    [-1.9, 2.4, 0.35],
    [1.5, 2.65, 0.8],
    [-0.3, 2.7, -1.5],
    [-1.2, 3.1, -0.6],
    [0.85, 3.25, -0.4],
    [0.15, 2.95, 1.2],
    [-0.2, 3.75, 0],
    [2.3, 3.2, 0.05],
    [-2.0, 3.3, 0],
  ];
  for (const [i, [bx, by, bz]] of boughs.entries()) {
    timber(
      wood,
      [
        p(0, 1.2 + i * 0.05, 0),
        p(bx * 0.4, 1.85, bz * 0.4),
        p(bx * 0.8, by - 0.28, bz * 0.8),
        p(bx, by, bz),
      ],
      size * 0.12,
      size * 0.025,
    );
    for (let j = 0; j < 40; j++) {
      const angle = j * 2.399,
        r = Math.sqrt(random());
      const lift = Math.sqrt(1 - r * r) * 0.42;
      const q = p(
        bx + Math.cos(angle) * r * 1.05,
        by + lift + (random() - 0.5) * 0.18,
        bz + Math.sin(angle) * r * 0.83,
      );
      // Broad patches of coherent light and shade, rather than random confetti.
      const tint = new Color(i < 3 ? "#526d2c" : "#688038").lerp(
        new Color("#9eaa49"),
        i < 3 ? lift * 0.9 : lift * 1.0 + 0.2,
      );
      spray(...q, size * (0.21 + random() * 0.12), "#" + tint.getHexString());
    }
  }
}
