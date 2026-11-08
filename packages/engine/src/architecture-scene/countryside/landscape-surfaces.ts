import { Color, IcosahedronGeometry, Quaternion, Euler } from "three";
import { LandscapeGeometry, type Point } from "./geometry-builder";
import type { CountrysideLayout } from "./landscape-layout";

/** Sculpted turf and exposed strata, with a single open footpath through the meadow. */
export function paintLandscapeSurfaces(
  layout: CountrysideLayout,
  ground: LandscapeGeometry,
  masonry: LandscapeGeometry,
  groundColor: string,
  random: () => number,
) {
  const { point, height, half, trail } = layout;
  const at = (a: number, t: number): Point => {
    const [x, z] = point(a, t);
    return [x, height(x, z), z];
  };
  const grassColor = ([x, , z]: Point) => {
    const t = Math.max(0, layout.fraction(x, z));
    const woodland = x < -layout.halfX - 2;
    const color = new Color(woodland ? "#5c742d" : "#819344");
    color.lerp(
      new Color(woodland ? "#78893a" : "#9aa54b"),
      (Math.sin(x * 1.7 + z * 0.5) * Math.cos(z * 1.4) + 1) * 0.5,
    );
    return "#" + new Color(groundColor).lerp(color, Math.min(1, t * 6)).getHexString();
  };
  const turf = (a: Point, b: Point, c: Point) =>
    ground.triangle(a, b, c, [grassColor(a), grassColor(b), grassColor(c)]);
  const rocks = new IcosahedronGeometry(1, 0);
  const earth = ["#7a7053", "#8d8060", "#9b8f70", "#746b51", "#a49b7d"];
  for (let i = 0; i < 256; i++) {
    const a = (i / 256) * Math.PI * 2,
      b = ((i + 1) / 256) * Math.PI * 2;
    for (let j = 0; j < 32; j++) {
      turf(at(a, j / 32), at(b, j / 32), at(b, (j + 1) / 32));
      turf(at(a, j / 32), at(b, (j + 1) / 32), at(a, (j + 1) / 32));
    }
    const p = at(a, 1),
      q = at(b, 1);
    const base = -0.88 - half * 0.005;
    const middleA: Point = [
      p[0] * 0.995,
      (p[1] + base) * 0.5 + Math.sin(i * 1.3) * 0.12,
      p[2] * 0.995,
    ];
    const middleB: Point = [
      q[0] * 0.995,
      (q[1] + base) * 0.5 + Math.sin((i + 1) * 1.3) * 0.12,
      q[2] * 0.995,
    ];
    const bottomA: Point = [p[0] * 0.98, base, p[2] * 0.98],
      bottomB: Point = [q[0] * 0.98, base, q[2] * 0.98];
    ground.triangle(p, q, middleA, earth[i % 5]);
    ground.triangle(q, middleB, middleA, earth[(i + 1) % 5]);
    ground.triangle(middleA, middleB, bottomA, earth[(i + 3) % 5]);
    ground.triangle(middleB, bottomB, bottomA, earth[(i + 2) % 5]);
    // Broken outcrops, never a necklace of regularly repeated boulders.
    if (i % 9 === 0)
      masonry.add(
        rocks,
        "#96977d",
        [p[0] * 0.997, p[1] - 0.35, p[2] * 0.997],
        [0.45 + random() * 0.35, 0.3, 0.4],
        new Quaternion().setFromEuler(new Euler(0.2, a, 0.3)),
      );
  }
  for (let i = 0; i < trail.length - 1; i++) {
    const [x, z] = trail[i],
      [nx, nz] = trail[i + 1];
    const length = Math.hypot(nx - x, nz - z),
      ux = -(nz - z) / length,
      uz = (nx - x) / length;
    const width = 0.38 + Math.sin(i * 0.5) * 0.055;
    const edge = (px: number, pz: number, side: number): Point => {
      const a = px + ux * width * side,
        b = pz + uz * width * side;
      return [a, height(a, b) + 0.025, b];
    };
    ground.triangle(edge(x, z, -1), edge(nx, nz, 1), edge(nx, nz, -1), "#bdad85");
    ground.triangle(edge(x, z, -1), edge(x, z, 1), edge(nx, nz, 1), "#bdad85");
    if (i % 2 === 0) {
      const p = edge(x, z, random() > 0.5 ? 1 : -1);
      masonry.add(rocks, "#c4b897", p, [0.035 + random() * 0.05, 0.02, 0.04]);
    }
  }
  rocks.dispose();
}
