import {
  CylinderGeometry,
  OctahedronGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  Quaternion,
  Euler,
} from "three";
import { paintOak } from "./oak-model";
import { branchTransform, LandscapeGeometry, type Point } from "./geometry-builder";

const leaves = ["#536c2b", "#7b8b36", "#939d40", "#48602c", "#a2a84b", "#6d8135"];
const bark = ["#73614b", "#897357", "#9a8160"];

/** Broad oak crowns with visible branching and individually modelled leaf sprays. */
export function botanicalModels(random: () => number) {
  const twig = new CylinderGeometry(0.65, 1, 1, 7);
  const lobe = new OctahedronGeometry(1, 0);
  const oakLeaf = new BufferGeometry();
  const leafPoints = [
    [0, 0.1, -1],
    [0.45, 0, -0.65],
    [0.25, 0.05, -0.35],
    [0.6, 0, -0.05],
    [0.35, 0.04, 0.2],
    [0.42, 0, 0.5],
    [0, 0.05, 1],
    [-0.42, 0, 0.5],
    [-0.35, 0.04, 0.2],
    [-0.6, 0, -0.05],
    [-0.25, 0.05, -0.35],
    [-0.45, 0, -0.65],
  ];
  oakLeaf.setAttribute(
    "position",
    new Float32BufferAttribute(
      leafPoints.flatMap((p, i) => [0, 0.1, 0, ...leafPoints[(i + 1) % leafPoints.length], ...p]),
      3,
    ),
  );
  oakLeaf.computeVertexNormals();
  const leaf = new OctahedronGeometry(1, 0);
  const wood = new LandscapeGeometry(),
    foliage = new LandscapeGeometry(),
    meadow = new LandscapeGeometry();
  const pick = (colors: string[]) => colors[Math.floor(random() * colors.length)];
  function branch(a: Point, b: Point, radius: number) {
    const { position, length, rotation } = branchTransform(a, b);
    wood.add(twig, pick(bark), position, [radius, length, radius], rotation);
  }
  function spray(x: number, y: number, z: number, radius: number, shade: string) {
    foliage.add(
      lobe,
      shade,
      [x, y - radius * 0.12, z],
      [radius * 0.8, radius * 0.38, radius * 0.75],
    );
    for (let i = 0; i < 8; i++) {
      const angle = i * 2.399 + random() * 0.4,
        r = radius * (0.5 + random() * 0.55);
      const tint = new Color(shade).multiplyScalar(0.9 + random() * 0.22);
      foliage.add(
        oakLeaf,
        "#" + tint.getHexString(),
        [x + Math.cos(angle) * r, y + (random() - 0.15) * radius * 0.6, z + Math.sin(angle) * r],
        [radius * 0.8, radius * 0.8, radius * 0.8],
        new Quaternion().setFromEuler(
          new Euler((random() - 0.5) * 1.1, angle, (random() - 0.5) * 0.7),
        ),
      );
    }
  }
  function oak(x: number, y: number, z: number, size: number) {
    paintOak(wood, spray, random, x, y, z, size);
  }
  function shrub(x: number, y: number, z: number, size: number) {
    const shade = pick(leaves);
    for (let j = 0; j < 32; j++) {
      const angle = j * 2.399,
        r = Math.sqrt(random()) * size;
      spray(
        x + Math.cos(angle) * r,
        y + 0.2 + (1 - r / size) * size * 0.65,
        z + Math.sin(angle) * r,
        size * 0.23,
        shade,
      );
    }
  }
  function grass(x: number, y: number, z: number, size: number, flowers: boolean) {
    for (let j = 0; j < 7; j++) {
      const a = random() * Math.PI * 2,
        h = size * (0.5 + random() * 0.7);
      const bx = x + (random() - 0.5) * size,
        bz = z + (random() - 0.5) * size;
      const tip: Point = [bx + Math.cos(a) * h * 0.4, y + h, bz + Math.sin(a) * h * 0.4];
      const w = h * 0.09;
      const left: Point = [bx - Math.sin(a) * w, y, bz + Math.cos(a) * w];
      const right: Point = [bx + Math.sin(a) * w, y, bz - Math.cos(a) * w];
      const mid: Point = [bx + Math.cos(a) * h * 0.12, y + h * 0.65, bz + Math.sin(a) * h * 0.12];
      const shade = pick(leaves);
      meadow.triangle(
        left,
        [mid[0] - Math.sin(a) * w * 0.6, mid[1], mid[2] + Math.cos(a) * w * 0.6],
        right,
        shade,
      );
      meadow.triangle(
        right,
        [mid[0] - Math.sin(a) * w * 0.6, mid[1], mid[2] + Math.cos(a) * w * 0.6],
        tip,
        shade,
      );
      if (flowers && j < 1) {
        meadow.add(leaf, "#d5b65c", tip, [0.028, 0.023, 0.028]);
        for (let k = 0; k < 5; k++) {
          const angle = k * Math.PI * 0.4;
          meadow.add(
            leaf,
            "#f5efd7",
            [tip[0] + Math.cos(angle) * 0.045, tip[1], tip[2] + Math.sin(angle) * 0.045],
            [0.046, 0.015, 0.025],
            new Quaternion().setFromEuler(new Euler(0, -angle, 0)),
          );
        }
      }
    }
  }
  function fern(x: number, y: number, z: number, size: number) {
    const autumn = random() > 0.8;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      for (let j = 1; j <= 9; j++) {
        const t = j / 10,
          r = size * t;
        for (const side of [-1, 1]) {
          const width = size * 0.23 * Math.sin(t * Math.PI);
          const center: Point = [
            x + Math.cos(angle) * r,
            y + size * Math.sin(t * Math.PI * 0.85) * 0.65,
            z + Math.sin(angle) * r,
          ];
          meadow.triangle(
            center,
            [
              center[0] + Math.cos(angle + side * 1.1) * width,
              center[1] + width * 0.14,
              center[2] + Math.sin(angle + side * 1.1) * width,
            ],
            [
              center[0] + Math.cos(angle) * size * 0.12,
              center[1] + 0.02,
              center[2] + Math.sin(angle) * size * 0.12,
            ],
            autumn ? (i % 3 ? "#a68b4f" : "#bd9a5b") : i % 3 ? "#79913b" : "#a4b151",
          );
        }
      }
    }
  }
  function parsley(x: number, y: number, z: number) {
    const h = 0.5 + random() * 0.35;
    for (let i = 0; i < 5; i++) {
      const a = i * 2.399,
        r = i === 0 ? 0 : 0.22 + random() * 0.1;
      const bx = x + Math.cos(a) * r,
        bz = z + Math.sin(a) * r,
        by = y + h - r * 0.4;
      meadow.triangle([x - 0.008, y, z], [bx, by, bz], [x + 0.008, y, z], "#718142");
      for (let k = 0; k < 8; k++) {
        const t = k * 2.399,
          d = k === 0 ? 0 : 0.09 + random() * 0.04;
        const fx = bx + Math.cos(t) * d,
          fz = bz + Math.sin(t) * d;
        // Millimetre-thin florets retain their silhouette without hidden solid faces.
        meadow.triangle(
          [fx - 0.05, by + 0.02, fz],
          [fx, by + 0.024, fz + 0.05],
          [fx + 0.05, by + 0.02, fz],
          "#f4f1d9",
        );
        meadow.triangle(
          [fx - 0.05, by + 0.02, fz],
          [fx + 0.05, by + 0.02, fz],
          [fx, by + 0.024, fz - 0.05],
          "#f4f1d9",
        );
      }
    }
  }
  function foxglove(x: number, y: number, z: number) {
    for (let stem = 0; stem < 3; stem++) {
      const bx = x + (random() - 0.5) * 0.35,
        bz = z + (random() - 0.5) * 0.35;
      const h = 0.8 + random() * 0.6;
      branch([bx, y, bz], [bx, y + h, bz], 0.012);
      for (let j = 0; j < 14; j++) {
        const a = j * 2.399,
          r = 0.07 * (1 - j / 22);
        meadow.add(
          leaf,
          j % 3 ? "#b2769d" : "#d5a0b3",
          [bx + Math.cos(a) * r, y + h * (0.35 + j / 22), bz + Math.sin(a) * r],
          [0.05, 0.065, 0.05],
        );
      }
      grass(bx, y, bz, 0.25, false);
    }
  }
  return {
    parsley,
    foxglove,
    oak,
    shrub,
    grass,
    fern,
    branch,
    wood,
    foliage,
    meadow,
    dispose() {
      twig.dispose();
      lobe.dispose();
      leaf.dispose();
      oakLeaf.dispose();
    },
  };
}
