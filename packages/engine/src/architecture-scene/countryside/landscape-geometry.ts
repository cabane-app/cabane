import { Color, IcosahedronGeometry, Quaternion, Euler } from "three";
import { LandscapeGeometry, seededRandom, type Point } from "./geometry-builder";
import { botanicalModels } from "./botanical-models";
import type { CountrysideLayout } from "./landscape-layout";

const tau = Math.PI * 2;

export function createCountrysideGeometry(layout: CountrysideLayout, groundColor: string) {
  const random = seededRandom(7419);
  const { point, height, half, pond, pondDistance, pathFraction } = layout;
  const ground = new LandscapeGeometry(),
    masonry = new LandscapeGeometry(),
    water = new LandscapeGeometry();
  const plants = botanicalModels(random);
  const rock = new IcosahedronGeometry(1, 1);
  const grassColor = (p: Point) =>
    "#" +
    new Color(groundColor)
      .lerp(
        new Color("#91a451").lerp(
          new Color("#a0af60"),
          (Math.sin(p[0] * 1.4) * Math.cos(p[2] * 1.1) + 1) * 0.5,
        ),
        Math.min(1, Math.max(0, layout.fraction(p[0], p[2])) * 3),
      )
      .getHexString();
  const grassTriangle = (a: Point, b: Point, c: Point) =>
    ground.triangle(a, b, c, [grassColor(a), grassColor(b), grassColor(c)]);
  const stoneColors = ["#aaa58b", "#bdb69c", "#96977e", "#c8bea1", "#a8a78d"];
  const at = (angle: number, t: number, lift = 0): Point => {
    const [x, z] = point(angle, t);
    return [x, height(x, z) + lift, z];
  };
  const rotation = (angle: number) => new Quaternion().setFromEuler(new Euler(0, angle, 0));
  // A subdivided organic island, gently hilled and coloured per small triangle.
  for (let i = 0; i < 192; i++) {
    const a = (i / 192) * tau,
      b = ((i + 1) / 192) * tau;
    for (let j = 0; j < 18; j++) {
      const t = j / 18,
        u = (j + 1) / 18;
      grassTriangle(at(a, t), at(b, t), at(b, u));
      grassTriangle(at(a, t), at(b, u), at(a, u));
    }
    const p = at(a, 1),
      q = at(b, 1);
    const bottom = -0.9 - half * 0.005;
    ground.triangle(p, [p[0], bottom, p[2]], q, "#8b8062");
    ground.triangle(q, [p[0], bottom, p[2]], [q[0], bottom, q[2]], "#8b8062");
    // Exposed, irregular limestone along the cut edge of the miniature.
    for (let k = 0; k < 2; k++) {
      masonry.add(
        rock,
        stoneColors[(i + k) % stoneColors.length],
        [p[0], p[1] - 0.28 - k * 0.35, p[2]],
        [0.38 + random() * 0.2, 0.23 + random() * 0.07, 0.3 + random() * 0.12],
        rotation(a),
      );
    }
    // A winding sand path with real width, following the terrain.
    const width = 0.052;
    const pa = pathFraction(a),
      pb = pathFraction(b);
    ground.triangle(
      at(a, pa - width, 0.018),
      at(b, pb - width, 0.018),
      at(b, pb + width, 0.018),
      "#cbbd97",
    );
    ground.triangle(
      at(a, pa - width, 0.018),
      at(b, pb + width, 0.018),
      at(a, pa + width, 0.018),
      "#cbbd97",
    );
  }
  // Dry-stone walls: individually offset courses, rounded stones and coping.
  for (const [start, end] of [
    [0.45, 1.35],
    [1.55, 2.6],
    [3.15, 4.15],
    [4.3, 5.8],
  ]) {
    const count = Math.ceil(((end - start) * (half + 4)) / 0.48);
    for (let i = 0; i < count; i++) {
      for (let row = 0; row < 4; row++) {
        const a = start + ((end - start) * (i + (row % 2) * 0.45)) / count;
        const [x, z] = point(a, 0.73 + Math.sin(a * 5) * 0.03);
        const next = point(a + 0.01, 0.73 + Math.sin((a + 0.01) * 5) * 0.03);
        const tangent = -Math.atan2(next[1] - z, next[0] - x);
        masonry.add(
          rock,
          stoneColors[Math.floor(random() * stoneColors.length)],
          [x, height(x, z) + 0.12 + row * 0.2, z],
          [0.29, 0.13, row === 3 ? 0.26 : 0.22],
          rotation(tangent),
        );
        if (row === 3 && random() > 0.55)
          masonry.add(rock, "#889650", [x, height(x, z) + 0.82, z], [0.22, 0.035, 0.17]);
      }
    }
  }
  // Gate in the near wall opening, with split rails and diagonal bracing.
  const gate = point(1.45, 0.73),
    gy = height(...gate);
  for (const dx of [-0.9, 0.9])
    plants.branch([gate[0] + dx, gy, gate[1]], [gate[0] + dx, gy + 1.05, gate[1]], 0.09);
  for (const y of [0.3, 0.72])
    plants.branch([gate[0] - 0.9, gy + y, gate[1]], [gate[0] + 0.9, gy + y, gate[1]], 0.052);
  plants.branch([gate[0] - 0.85, gy + 0.27, gate[1]], [gate[0] + 0.85, gy + 0.82, gate[1]], 0.045);
  // Pond with shallow shoreline, water rings, lily pads and a reed bed.
  const waterY = height(...pond) + 0.15;
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * tau,
      b = ((i + 1) / 80) * tau;
    const edge = (angle: number, r: number): Point => [
      pond[0] + Math.cos(angle) * 1.35 * r,
      waterY,
      pond[1] + Math.sin(angle) * 2.0 * r,
    ];
    water.triangle([pond[0], waterY, pond[1]], edge(b, 0.91), edge(a, 0.91), "#719c95");
    if (i % 3 === 0) {
      const [x, , z] = edge(a, 1.06);
      masonry.add(
        rock,
        stoneColors[i % 5],
        [x, height(x, z) + 0.05, z],
        [0.24 + random() * 0.12, 0.18, 0.24],
      );
      if (i % 2 === 0) plants.fern(x, height(x, z), z, 0.55);
    }
    if (i % 2 === 0 && i < 50) {
      const [x, , z] = edge(a, 0.94);
      for (let j = 0; j < 4; j++) {
        const bx = x + random() * 0.18,
          bz = z + random() * 0.18,
          h = 0.55 + random() * 0.6;
        plants.branch([bx, waterY, bz], [bx + 0.07, waterY + h, bz], 0.014);
        plants.meadow.add(rock, "#706442", [bx + 0.07, waterY + h, bz], [0.036, 0.13, 0.036]);
        plants.grass(bx, waterY, bz, h * 0.75, false);
      }
    }
  }
  for (let i = 0; i < 17; i++) {
    const a = random() * tau,
      r = Math.sqrt(random()) * 0.7;
    water.add(
      rock,
      i % 2 ? "#9eaf61" : "#849b51",
      [pond[0] + Math.cos(a) * r * 1.35, waterY + 0.018, pond[1] + Math.sin(a) * r * 2.0],
      [0.13, 0.012, 0.11],
    );
  }
  // Tall silhouettes stay at the back; low shrubs frame the foreground.
  for (const [a, t, scale] of [
    [3.5, 0.82, 1.7],
    [4.0, 0.82, 2.2],
    [4.65, 0.85, 2.0],
    [5.3, 0.8, 1.8],
    [2.8, 0.8, 1.25],
    [0.65, 0.86, 1.0],
  ]) {
    const [x, z] = point(a, t);
    plants.oak(x, height(x, z), z, scale);
  }
  for (let i = 0; i < 65; i++) {
    const a = random() * tau,
      t = 0.64 + random() * 0.29;
    const [x, z] = point(a, t);
    if (pondDistance(x, z) < 1.4) continue;
    plants.shrub(x, height(x, z), z, 0.6 + random() * 0.65);
    if (i % 2 === 0) plants.fern(x + 0.7, height(x + 0.7, z), z, 0.6 + random() * 0.25);
  }
  const tufts = Math.min(5200, Math.round(sizeArea(layout) * 8));
  for (let i = 0; i < tufts; i++) {
    const a = random() * tau,
      t = 0.05 + random() * 0.92;
    const [x, z] = point(a, t);
    if (Math.abs(t - pathFraction(a)) < 0.07 || pondDistance(x, z) < 1.13) continue;
    plants.grass(x, height(x, z), z, 0.17 + random() * 0.28, Math.sin(x * 1.7 + z) > 0.68);
    if (i % 123 === 0) plants.foxglove(x, height(x, z), z);
    if (i % 65 === 0) {
      masonry.add(rock, "#b9b79b", [x, height(x, z) + 0.12, z], [0.35, 0.3, 0.3]);
      plants.fern(x + 0.3, height(x + 0.3, z), z, 0.65);
    }
  }
  rock.dispose();
  plants.dispose();
  return {
    ground: ground.finish(),
    masonry: masonry.finish(),
    wood: plants.wood.finish(),
    foliage: plants.foliage.finish(),
    meadow: plants.meadow.finish(),
    water: water.finish(),
  };
}

function sizeArea({ halfX, halfZ, width }: CountrysideLayout) {
  return (halfX + width) * (halfZ + width) * 4 - halfX * halfZ * 4;
}
