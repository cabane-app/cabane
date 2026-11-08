import { CylinderGeometry, OctahedronGeometry, SphereGeometry, Quaternion, Euler } from "three";
import { branchTransform, LandscapeGeometry, type Point } from "./geometry-builder";

const leaves = ["#718d39", "#8a9c42", "#a0ad4b", "#657e35", "#b0b85b", "#829746"];
const bark = ["#73614b", "#897357", "#9a8160"];

/** Broad oak crowns with visible branching and individually modelled leaf sprays. */
export function botanicalModels(random: () => number) {
  const twig = new CylinderGeometry(0.65, 1, 1, 7);
  const lobe = new SphereGeometry(1, 7, 4);
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
    foliage.add(lobe, shade, [x, y, z], [radius, radius * 0.6, radius * 0.85]);
    for (let i = 0; i < 9; i++) {
      const angle = random() * Math.PI * 2,
        r = radius * (0.65 + random() * 0.5);
      foliage.add(
        leaf,
        pick(leaves),
        [x + Math.cos(angle) * r, y + (random() - 0.2) * radius, z + Math.sin(angle) * r],
        [radius * 0.38, radius * 0.15, radius * 0.3],
        new Quaternion().setFromEuler(new Euler(random(), angle, random())),
      );
    }
  }
  function oak(x: number, y: number, z: number, size: number) {
    const point = (a: number, b: number, c: number): Point => [
      x + a * size,
      y + b * size,
      z + c * size,
    ];
    branch(point(0, 0, 0), point(0.12, 2.15, -0.1), size * 0.27);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.399;
      branch(point(Math.cos(a) * 0.65, 0.025, Math.sin(a) * 0.65), point(0, 0.7, 0), size * 0.13);
    }
    for (let i = 0; i < 11; i++) {
      const angle = i * 2.399,
        r = i < 8 ? 1.25 + random() * 0.5 : 0.55;
      const bx = Math.cos(angle) * r,
        bz = Math.sin(angle) * r;
      const by = 2.5 + random() * 0.75 + (i >= 8 ? 0.9 : 0);
      branch(
        point(0.1, 1.35 + random() * 0.4, 0),
        point(bx * 0.65, by - 0.4, bz * 0.65),
        size * 0.12,
      );
      branch(point(bx * 0.65, by - 0.4, bz * 0.65), point(bx, by, bz), size * 0.065);
      for (let j = 0; j < 23; j++) {
        const a = j * 2.399,
          r = Math.sqrt(random()) * 0.95;
        const p = point(bx + Math.cos(a) * r, by + (random() - 0.3) * 0.65, bz + Math.sin(a) * r);
        spray(...p, size * (0.18 + random() * 0.16), pick(leaves));
      }
    }
  }
  function shrub(x: number, y: number, z: number, size: number) {
    for (let j = 0; j < 20; j++) {
      const angle = j * 2.399,
        r = Math.sqrt(random()) * size;
      spray(
        x + Math.cos(angle) * r,
        y + 0.2 + (1 - r / size) * size * 0.65,
        z + Math.sin(angle) * r,
        size * 0.23,
        pick(leaves),
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
      meadow.triangle([bx - 0.025, y, bz], tip, [bx + 0.025, y, bz + 0.025], pick(leaves));
      if (flowers && j < 3) {
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
            i % 3 ? "#8d9b46" : "#b2af65",
          );
        }
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
    },
  };
}
