import { BufferGeometry, Float32BufferAttribute } from "three";
import { Scenery } from "./scenery";

const crops = ["#b7b878", "#8eaa6c", "#bcaa71", "#a1ad76", "#aeb67e", "#c7b680", "#899d70"];

function fieldPoint(u: number, v: number): [number, number, number] {
  const x = u + 5 * Math.sin(v / 41) + 2.5 * Math.sin(v / 19);
  const z = v + 4 * Math.sin(u / 45);
  const distance = Math.hypot(x, z);
  const rise = Math.min(1, Math.max(0, (distance - 16) / 70));
  const y =
    rise * (5 + 5 * Math.sin(x / 24 + z / 47) + 4 * Math.cos(z / 26) + 2 * Math.sin(x / 14));
  return [x, y, z];
}

function field(s: Scenery, u: number, v: number, w: number, d: number, color: string) {
  const positions: number[] = [];
  const indices: number[] = [];
  const steps = 5;
  for (let j = 0; j <= steps; j++) {
    for (let i = 0; i <= steps; i++) {
      positions.push(...fieldPoint(u + (w * i) / steps, v + (d * j) / steps));
      if (i === steps || j === steps) continue;
      const a = j * (steps + 1) + i;
      indices.push(a, a + steps + 1, a + 1, a + 1, a + steps + 1, a + steps + 2);
    }
  }
  const patch = new BufferGeometry();
  patch.setAttribute("position", new Float32BufferAttribute(positions, 3));
  patch.setIndex(indices);
  patch.computeVertexNormals();
  s.geometry(patch, [0, 0, 0], [1, 1, 1], color, 1);
  patch.dispose();
}

export function countryside() {
  const s = new Scenery();
  for (let col = -6; col <= 6; col++) {
    for (let row = -6; row <= 6; row++) {
      const u = col * 32 - 16;
      const v = row * 23 - 11.5;
      const color = crops[Math.floor(s.random() * crops.length)];
      field(s, u, v, 32, 23, color);
      // Narrow headlands follow the field edges. Gaps break the tree line
      // and open longer views between close foliage and the far slopes.
      if (Math.abs(col) > 4 || Math.abs(row) > 4) continue;
      for (let k = 0; k < 7; k++) {
        if (s.random() < 0.21) continue;
        const [x, y, z] = fieldPoint(u + k * 4.7, v);
        if (Math.abs(x) < 14 && Math.abs(z) < 12) continue;
        const h = 0.75 + s.random() * 0.85;
        s.plant([x, y - 0.1, z], 4.3 + s.random() * 2.7, h * 1.5, "hedge");
        if (s.random() < 0.18) {
          const height = 3.8 + s.random() * 4.8;
          s.plant([x + 0.8, y - 0.1, z + 0.65], height * (1.1 + s.random() * 0.4), height, "oak");
        }
      }
    }
  }
  // A post-and-rail fence close to the home gives the first-person view scale.
  for (let i = 0; i <= 8; i++) {
    const [x, y, z] = fieldPoint(-14 + i * 2.3, 13);
    s.part("box", [x, y + 0.59, z], [0.14, 1.18, 0.14], "#807058");
    if (i === 8) break;
    const [nx, ny, nz] = fieldPoint(-14 + (i + 1) * 2.3, 13);
    for (const height of [0.42, 0.85])
      s.part(
        "box",
        [(x + nx) / 2, (y + ny) / 2 + height, (z + nz) / 2],
        [Math.hypot(nx - x, nz - z), 0.12, 0.085],
        "#a18f72",
        0,
        -Math.atan2(nz - z, nx - x),
      );
  }
  for (const [u, v] of [
    [-42, -31],
    [71, 29],
    [-68, 62],
  ]) {
    const [x, y, z] = fieldPoint(u, v);
    s.part("box", [x, y + 1.1, z], [6, 3, 3.7], "#d5c7a8");
    s.part("gable", [x, y + 3.12, z], [6.5, 1.22, 2.4], "#9b6755");
    s.part("box", [x + 1.65, y + 3.8, z - 0.4], [0.48, 1.5, 0.52], "#a17d65");
  }
  return s.finish();
}
