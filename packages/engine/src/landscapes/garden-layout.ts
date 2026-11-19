import type { FieldPlot } from "./country-survey";
import stems from "./assets/hedgerow-stems.json";

export function gardenRandom(seed: number) {
  return () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
}

export interface Plant {
  x: number;
  z: number;
  size: number;
  width: number;
  angle: number;
  tone: number;
}
const tau = Math.PI * 2;

/** Short, irregular drifts separated by open grass. All coordinates are local to the survey. */
export function gardenLayout(plot: FieldPlot) {
  const lot = plot.plantingLot;
  const garden = {
    trees: [] as Plant[],
    shrubs: [] as Plant[],
    ferns: [] as Plant[],
    rosettes: [] as Plant[],
    sedges: [] as Plant[],
    stones: [] as Plant[],
    litter: [] as Plant[],
    grasses: [] as Plant[],
    distant: [] as Plant[],
    boughs: [] as Plant[],
    drifts: [] as { x: number; z: number; rx: number; rz: number }[],
  };
  const cx = lot.centerX - plot.surveyX,
    cz = lot.centerZ - plot.surveyZ;
  const clear = (x: number, z: number) =>
    Math.max(Math.abs(x - cx) - lot.width / 2, Math.abs(z - cz) - lot.depth / 2);
  const native: Plant[] = [];
  const nativeRandom = gardenRandom(8217);
  for (const [sx, sz, , treeHeight] of stems) {
    const x = sx * plot.surveyScale,
      z = sz * plot.surveyScale;
    const size = Math.min(17, treeHeight * plot.surveyScale * 0.79);
    if (size < 3 || clear(x, z) < Math.max(2.1, size * 0.33)) continue;
    if (native.some((p) => Math.hypot(p.x - x, p.z - z) < (p.size + size) * 0.24)) continue;
    native.push({
      x,
      z,
      size,
      width: 0.91 + 0.37 * nativeRandom(),
      angle: nativeRandom() * tau,
      tone: nativeRandom(),
    });
  }
  garden.distant = native.filter((p) => clear(p.x, p.z) > 21);
  garden.trees.push(...native.filter((p) => clear(p.x, p.z) <= 21));
  for (let side = 0; side < 4; side++) {
    const random = gardenRandom(25309 + side * 731);
    const alongX = side % 2 === 0,
      sign = side < 2 ? -1 : 1;
    const length = alongX ? lot.width : lot.depth,
      half = (alongX ? lot.depth : lot.width) / 2;
    const edgePoint = (along: number, out: number) => ({
      x: cx + (alongX ? along : sign * (half + out)),
      z: cz + (alongX ? sign * (half + out) : along),
    });
    const plant = (x: number, z: number, size: number, width: number = 1): Plant => ({
      x,
      z,
      size,
      width,
      angle: random() * tau,
      tone: random(),
    });
    const count = Math.max(2, Math.min(12, Math.ceil(length / 13)));
    for (let i = 0; i < count; i++) {
      const along = ((i + 0.18 + 0.64 * random()) / count - 0.5) * length;
      const near = edgePoint(along, 1.15 + random() * 3.5);
      const inner = edgePoint(along + (random() - 0.5) * 3, 3.8 + random() * 5.4);
      // Keep a nearby measured tree where it already frames this part of the garden.
      if (!native.some(({ x, z }) => Math.hypot(inner.x - x, inner.z - z) < 5.8)) {
        garden.trees.push(plant(inner.x, inner.z, 4.5 + random() * 4.4, 0.8 + random() * 0.35));
      }
      if (i === Math.floor(count / 2) || random() < 0.32) {
        const back = edgePoint(along + (random() - 0.5) * 9, 12 + random() * 6);
        if (!native.some(({ x, z }) => Math.hypot(back.x - x, back.z - z) < 4.8))
          garden.trees.push(plant(back.x, back.z, 6.1 + random() * 3.8, 0.85 + random() * 0.32));
      }
      // A grove has several ages of tree and an open side facing the lawn.
      // Offset its centre uphill and sideways so successive crowns overlap in depth.
      if (i % 2 === side % 2 || i === Math.floor(count / 2)) {
        const sweep = (random() < 0.5 ? -1 : 1) * (5 + random() * 6);
        for (let j = 0; j < 10; j++) {
          const t = j / 9;
          const where = edgePoint(
            along + sweep * t + (random() - 0.5) * 8,
            4.1 + t * 18 + random() * 5,
          );
          const size = 6.2 + random() * 7.8;
          if (
            garden.trees.some(
              (p) => Math.hypot(p.x - where.x, p.z - where.z) < (size + p.size) * 0.15,
            )
          )
            continue;
          const stem = plant(where.x, where.z, size, 0.93 + random() * 0.4);
          garden.trees.push(stem);
        }
        const nurse = edgePoint(along + (random() - 0.5) * 4, 2.3 + random() * 2.8);
        garden.boughs.push(plant(nurse.x, nurse.z, 0.85 + random() * 0.85));
      }
      const radius = 2.6 + random() * 2.7;
      garden.drifts.push({
        x: near.x,
        z: near.z,
        rx: radius * (alongX ? 1.45 : 0.84),
        rz: radius * (alongX ? 0.84 : 1.45),
      });
      // A plant community has one or two dominant species, rather than equal amounts of each.
      const damp = random() > 0.43;
      const outcrop = edgePoint(along + (random() - 0.5) * radius, 2 + random() * 4);
      if (random() > 0.43) {
        garden.stones.push(
          plant(outcrop.x, outcrop.z, 0.65 + random() * 0.7, 1.05 + random() * 0.5),
        );
        for (let k = 0; k < 2; k++)
          garden.stones.push(
            plant(
              outcrop.x + (random() - 0.5) * 1.2,
              outcrop.z + (random() - 0.5) * 1.1,
              0.23 + random() * 0.43,
            ),
          );
      }
      for (let j = 0; j < 48; j++) {
        const a = random() * tau,
          r = Math.sqrt(random()) * radius;
        const x = near.x + Math.cos(a) * r * (alongX ? 1.45 : 0.84);
        const z = near.z + Math.sin(a) * r * (alongX ? 0.84 : 1.45);
        if (clear(x, z) < 0.5) continue;
        if (j < 4) garden.shrubs.push(plant(x, z, 0.42 + random() * 1.03, 1.2 + random() * 0.48));
        else if (j < 8)
          garden.stones.push(plant(x, z, 0.14 + random() * 0.38, 0.95 + random() * 0.5));
        else if (j < 19 && damp) garden.ferns.push(plant(x, z, 0.42 + random() * 0.56));
        else if (j < 32) garden.sedges.push(plant(x, z, 0.35 + random() * 0.54));
        else garden.litter.push(plant(x, z, 0.62 + random() * 0.6));
      }
    }
  }
  // Layer fern colonies beneath crowns, where shade, litter and longer grass coincide.
  const understory = gardenRandom(6259);
  for (const tree of garden.trees) {
    const radius = tree.size * (0.29 + understory() * 0.18);
    garden.drifts.push({ x: tree.x, z: tree.z, rx: radius * 1.25, rz: radius });
    for (let i = 0; i < 14; i++) {
      const angle = understory() * tau,
        r = Math.sqrt(understory()) * radius;
      const x = tree.x + Math.cos(angle) * r * 1.25,
        z = tree.z + Math.sin(angle) * r;
      if (clear(x, z) < 0.65) continue;
      const p = {
        x,
        z,
        angle: understory() * tau,
        width: 1.05 + understory() * 0.56,
        size: 0.67 + understory() * 0.83,
        tone: understory(),
      };
      if (i < 4) garden.ferns.push(p);
      else if (i === 4) garden.shrubs.push(p);
      else if (i < 9) garden.rosettes.push(p);
      else garden.sedges.push(p);
    }
  }
  const grassRandom = gardenRandom(8729);
  for (const drift of garden.drifts) {
    const count = Math.min(135, Math.ceil(drift.rx * drift.rz * 8));
    for (let i = 0; i < count; i++) {
      const angle = grassRandom() * tau,
        r = Math.sqrt(grassRandom());
      const x = drift.x + Math.cos(angle) * r * drift.rx,
        z = drift.z + Math.sin(angle) * r * drift.rz;
      if (clear(x, z) < 0.32) continue;
      garden.grasses.push({
        x,
        z,
        angle: grassRandom() * tau,
        size: 0.53 + (1 - r * 0.43) * grassRandom(),
        width: 0.9 + grassRandom() * 0.36,
        tone: grassRandom(),
      });
    }
  }
  // Short grass continues through the sunny gaps between the taller colonies.
  for (let side = 0; side < 4; side++) {
    const alongX = side % 2 === 0,
      sign = side < 2 ? -1 : 1,
      length = alongX ? lot.width : lot.depth;
    const half = (alongX ? lot.depth : lot.width) * 0.5;
    const count = Math.min(700, Math.ceil(length * 9));
    for (let i = 0; i < count; i++) {
      const along = (grassRandom() - 0.5) * length,
        out = 0.45 + grassRandom() * 15;
      garden.grasses.push({
        x: cx + (alongX ? along : sign * (half + out)),
        z: cz + (alongX ? sign * (half + out) : along),
        size: 0.34 + grassRandom() * 0.37,
        width: 1.1 + grassRandom() * 0.66,
        angle: grassRandom() * tau,
        tone: grassRandom(),
      });
    }
  }
  return garden;
}
