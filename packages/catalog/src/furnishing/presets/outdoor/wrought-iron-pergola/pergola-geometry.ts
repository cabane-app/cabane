import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  IcosahedronGeometry,
  CylinderGeometry,
  LatheGeometry,
  Vector2,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { wisteriaLeaf } from "./wisteria-leaf";

/** Deterministic, batched ironwork and climbing wisteria; all dimensions in metres. */
export function createPergolaGeometry() {
  const iron: BufferGeometry[] = [],
    wood: BufferGeometry[] = [];
  const leaves: BufferGeometry[][] = [[], [], []],
    flowers: BufferGeometry[] = [];
  const cable: BufferGeometry[] = [],
    bulbs: BufferGeometry[] = [],
    sockets: BufferGeometry[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number) =>
    new BoxGeometry(w, h, d).translate(x, y, z);
  const tube = (points: Vector3[], radius: number, segments = 20) =>
    new TubeGeometry(new CatmullRomCurve3(points), segments, radius, 5, false);
  for (const x of [-1.88, 1.88]) iron.push(box(x, 2.57, 0, 0.046, 0.062, 2.8));
  for (const z of [-1.38, 1.38]) iron.push(box(0, 2.57, z, 3.8, 0.062, 0.046));
  for (const z of [-1.46, 1.46]) iron.push(box(0, 2.65, z, 4, 0.1, 0.08));
  for (const x of [-1.96, 1.96]) iron.push(box(x, 2.65, 0, 0.08, 0.1, 3));
  for (let i = 0; i < 9; i++) iron.push(box(-1.8 + i * 0.45, 2.61, 0, 0.024, 0.035, 2.9));
  for (const z of [-0.8, 0, 0.8]) iron.push(box(0, 2.63, z, 3.9, 0.022, 0.022));
  for (const x of [-1.88, 1.88])
    for (const z of [-1.38, 1.38]) {
      // Flared collars and curled knee braces meet each post and overhead rail.
      iron.push(box(x, 0.12, z, 0.11, 0.06, 0.11), box(x, 2.605, z, 0.142, 0.105, 0.142));
      for (const axis of [0, 2]) {
        const sign = (axis === 0 ? x : z) > 0 ? -1 : 1;
        const points = Array.from({ length: 25 }, (_, i) => {
          const t = i / 24,
            p = new Vector3(x, 2.03 + 0.55 * Math.sin((t * Math.PI) / 2), z);
          p.setComponent(
            axis,
            p.getComponent(axis) + sign * 0.56 * (1 - Math.cos((t * Math.PI) / 2)),
          );
          return p;
        });
        iron.push(tube(points, 0.016));
        const curl = Array.from({ length: 33 }, (_, i) => {
          const t = i / 32,
            angle = t * Math.PI * 2.2,
            r = 0.14 * (1 - t * 0.78);
          const p = points[14].clone();
          p.y += Math.sin(angle) * r;
          p.setComponent(axis, p.getComponent(axis) + sign * (0.14 - Math.cos(angle) * r));
          return p;
        });
        iron.push(tube(curl, 0.011));
      }
      const stem = Array.from({ length: 49 }, (_, i) => {
        const t = i / 48;
        return new Vector3(
          x + Math.sin(t * 19) * 0.065,
          0.02 + t * 2.53,
          z + Math.cos(t * 19) * 0.065,
        );
      });
      wood.push(tube(stem, 0.018, 24));
      for (let i = 9; i < 47; i += 2) {
        const p = stem[i];
        leaves[i % 3].push(
          wisteriaLeaf
            .clone()
            .scale(0.78, 0.9, 0.7)
            .rotateX(Math.sin(i * 0.7) * 0.55)
            .rotateY(Math.atan2(-x, -z) + Math.sin(i * 2.4) * 0.9)
            .translate(p.x, p.y, p.z),
        );
      }
    }
  // Asymmetric leafy runners leave the central roof open to the sky.
  for (let row = 0; row < 6; row++) {
    const z = -0.98 + row * 0.39;
    const points = Array.from({ length: 49 }, (_, i) => {
      const x = -1.86 + (i / 48) * 3.72;
      return new Vector3(
        x,
        2.54 + Math.sin(i * 0.37 + row) * 0.035,
        z + Math.sin(i * 0.28 + row) * 0.12,
      );
    });
    wood.push(tube(points, 0.012, 24));
    points.forEach((p, i) => {
      if ((i + row * 3) % 7 < 2) return;
      for (const side of [-1, 1])
        leaves[(i + row) % 3].push(
          wisteriaLeaf
            .clone()
            .rotateX(-0.15 + Math.cos(i) * 0.25)
            .rotateY((side < 0 ? Math.PI : 0) + 0.52 * Math.sin(i * 0.85))
            .translate(p.x, p.y, p.z),
        );
      if (i % 9 === row % 9) {
        for (let j = 0; j < 5; j++)
          flowers.push(
            new IcosahedronGeometry(1, 0)
              .scale(0.04 * (1 - j * 0.14), 0.038, 0.04 * (1 - j * 0.14))
              .translate(p.x + Math.sin(j * 2) * 0.017, p.y - 0.027 - j * 0.049, p.z),
          );
      }
    });
  }
  for (let row = 0; row < 3; row++) {
    const z = -0.98 + row * 0.98;
    const point = (t: number) =>
      new Vector3(-1.88 + t * 3.76, 2.57 - 0.27 * Math.sin(t * Math.PI), z);
    cable.push(
      tube(
        Array.from({ length: 33 }, (_, i) => point(i / 32)),
        0.008,
        20,
      ),
    );
    for (let i = 1; i <= 7; i++) {
      const p = point(i / 8);
      const drop = i % 2 === 0 ? 0.092 : 0.058;
      sockets.push(
        new CylinderGeometry(0.007, 0.007, drop, 6).translate(p.x, p.y - drop / 2, p.z),
        new CylinderGeometry(0.02, 0.023, 0.034, 8).translate(p.x, p.y - drop - 0.014, p.z),
      );
      const globe = new LatheGeometry(
        [
          [0, -0.103],
          [0.025, -0.097],
          [0.041, -0.077],
          [0.043, -0.055],
          [0.031, -0.037],
          [0.018, -0.029],
        ].map(([r, y]) => new Vector2(r, y)),
        10,
      );
      bulbs.push(globe.translate(p.x, p.y - drop, p.z));
    }
  }
  const merge = (parts: BufferGeometry[]) => {
    const geometry = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    return geometry;
  };
  return {
    iron: merge(iron),
    wood: merge(wood),
    leaves: leaves.map(merge),
    flowers: merge(flowers),
    strand: merge([...cable, ...sockets]),
    bulbs: merge(bulbs),
  };
}
