import { Color, IcosahedronGeometry, Quaternion, Euler, CircleGeometry } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { LandscapeGeometry, type Point } from "./geometry-builder";
import type { CountrysideLayout } from "./landscape-layout";
import type { botanicalModels } from "./botanical-models";

export function paintRuralStructures(
  layout: CountrysideLayout,
  masonry: LandscapeGeometry,
  water: LandscapeGeometry,
  plants: ReturnType<typeof botanicalModels>,
  random: () => number,
) {
  const { height, halfX, halfZ, pond, pondRadii, walls } = layout;
  const block = new RoundedBoxGeometry(1, 1, 1, 1, 0.08);
  const rock = new IcosahedronGeometry(1, 0);
  const pad = new CircleGeometry(1, 16, 0.2, Math.PI * 2 - 0.4);
  pad.rotateX(-Math.PI / 2);
  const colors = ["#aaa58b", "#bbb69b", "#94957c", "#c2bda0", "#a6a68b"];
  for (const line of walls) {
    for (let row = 0; row < 4; row++) {
      let carry = row % 2 ? 0.24 : 0;
      for (let i = 1; i < line.length; i++) {
        const [ax, az] = line[i - 1],
          [bx, bz] = line[i];
        const segment = Math.hypot(bx - ax, bz - az),
          angle = -Math.atan2(bz - az, bx - ax);
        carry += segment;
        if (carry < 0.47) continue;
        carry -= 0.47;
        const x = bx - ((bx - ax) * carry) / segment,
          z = bz - ((bz - az) * carry) / segment;
        masonry.add(
          block,
          colors[Math.floor(random() * colors.length)],
          [x, height(x, z) + 0.11 + row * 0.23, z],
          [0.44 + random() * 0.045, 0.21 + random() * 0.02, row === 3 ? 0.62 : 0.53],
          new Quaternion().setFromEuler(
            new Euler((random() - 0.5) * 0.08, angle, (random() - 0.5) * 0.08),
          ),
        );
        if (row === 3 && Math.sin(x * 2 + z * 0.7) > 0.55)
          masonry.add(rock, "#70823d", [x, height(x, z) + 0.91, z], [0.18, 0.018, 0.19]);
      }
    }
  }
  // A substantial five-bar timber gate across the break in the meadow wall.
  const gx = halfX + 5.15,
    gz = halfZ * 0.5,
    gy = height(gx, gz);
  for (const dz of [-1.2, 1.2]) {
    plants.branch([gx, gy, gz + dz], [gx, gy + 1.2, gz + dz], 0.1);
  }
  for (const y of [0.25, 0.48, 0.71, 0.94])
    plants.branch([gx, gy + y, gz - 1.15], [gx, gy + y, gz + 1.15], 0.042);
  plants.branch([gx + 0.03, gy + 0.25, gz - 1.15], [gx + 0.03, gy + 0.94, gz + 1.15], 0.048);
  // A broad, irregular pond: layered depth colour, reflections and real lily pads.
  const waterY = height(...pond) + 0.16;
  const edge = (a: number, r: number): Point => {
    const ripple = 1 + Math.sin(a * 3) * 0.055 + Math.sin(a * 7) * 0.025;
    return [
      pond[0] + Math.cos(a) * pondRadii[0] * r * ripple,
      waterY,
      pond[1] + Math.sin(a) * pondRadii[1] * r * ripple,
    ];
  };
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2,
      b = ((i + 1) / 96) * Math.PI * 2;
    const tint = (r: number) =>
      "#" + new Color("#547f83").lerp(new Color("#809d8d"), r ** 3).getHexString();
    for (let j = 0; j < 8; j++) {
      const r = (j / 8) * 0.9,
        s = ((j + 1) / 8) * 0.9;
      water.triangle(edge(a, r), edge(b, s), edge(a, s), [tint(r), tint(s), tint(s)]);
      if (j > 0) water.triangle(edge(a, r), edge(b, r), edge(b, s), [tint(r), tint(r), tint(s)]);
    }
    if (i % 5 === 0) {
      const [x, , z] = edge(a, 1.04);
      masonry.add(
        rock,
        colors[i % 5],
        [x, height(x, z) + 0.08, z],
        [0.32 + random() * 0.3, 0.22, 0.35],
        new Quaternion().setFromEuler(new Euler(0.15, a, 0.2)),
      );
    }
    if (i < 60 && i % 2 === 0) {
      const [x, , z] = edge(a, 0.97);
      for (let j = 0; j < 5; j++) {
        const bx = x + random() * 0.25,
          bz = z + random() * 0.25,
          h = 0.8 + random() * 0.7;
        plants.branch([bx, waterY, bz], [bx + 0.09, waterY + h, bz], 0.013);
        plants.meadow.add(
          rock,
          "#625335",
          [bx + 0.09, waterY + h - 0.03, bz],
          [0.038, 0.16, 0.038],
        );
        plants.grass(bx, waterY, bz, h * 0.75, false);
      }
    }
  }
  for (let i = 0; i < 22; i++) {
    const a = random() * Math.PI * 2,
      r = Math.sqrt(random()) * 0.65,
      p = edge(a, r);
    p[1] += 0.025;
    water.add(
      pad,
      i % 2 ? "#9eac55" : "#849747",
      p,
      [0.13 + random() * 0.1, 1, 0.12 + random() * 0.1],
      new Quaternion().setFromEuler(new Euler(0, a, 0)),
    );
  }
  // Thin, broken reflected sky strokes, modelled on the water surface.
  for (let i = 0; i < 16; i++) {
    const x = pond[0] + (random() - 0.5) * 2.5,
      z = pond[1] + (random() - 0.5) * 3;
    water.add(block, "#b4ccc0", [x, waterY + 0.006, z], [0.12 + random() * 0.45, 0.004, 0.025]);
  }
  block.dispose();
  rock.dispose();
  pad.dispose();
}
