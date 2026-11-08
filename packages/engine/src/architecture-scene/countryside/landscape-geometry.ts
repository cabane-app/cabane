import { IcosahedronGeometry, Quaternion, Euler } from "three";
import { LandscapeGeometry, seededRandom } from "./geometry-builder";
import { botanicalModels } from "./botanical-models";
import type { CountrysideLayout } from "./landscape-layout";
import { paintLandscapeSurfaces } from "./landscape-surfaces";
import { paintRuralStructures } from "./rural-structures";

/** Compose distinct woodland, meadow and waterside habitats around the house. */
export function createCountrysideGeometry(layout: CountrysideLayout, groundColor: string) {
  const random = seededRandom(7419);
  const { height, halfX, halfZ, pondDistance, pathDistance, fraction } = layout;
  const ground = new LandscapeGeometry(),
    masonry = new LandscapeGeometry(),
    water = new LandscapeGeometry();
  const plants = botanicalModels(random),
    rock = new IcosahedronGeometry(1, 0);
  paintLandscapeSurfaces(layout, ground, masonry, groundColor, random);
  paintRuralStructures(layout, masonry, water, plants, random);
  // A grove along the long left boundary, with overlapping, spreading oak crowns.
  const trees = [
    [-halfX - 5.8, -halfZ * 0.62, 2.05],
    [-halfX - 6.1, halfZ * 0.03, 2.3],
    [-halfX - 5.4, halfZ * 0.73, 1.65],
    [-halfX - 1.4, -halfZ - 5.1, 1.85],
    [halfX * 0.45, -halfZ - 5.8, 1.45],
  ];
  for (const [x, z, scale] of trees) plants.oak(x, height(x, z), z, scale);
  // Plant broad, uneven thickets in small groups, leaving a legible open path.
  const thickets = [
    [-halfX - 4.7, halfZ * 0.4],
    [-halfX - 5.8, -halfZ * 0.4],
    [-halfX - 4.1, halfZ + 3.6],
    [-halfX + 2, halfZ + 6.6],
    [halfX + 6.8, halfZ * 0.35],
    [halfX + 5.0, halfZ + 4.7],
    [halfX + 2, -halfZ - 6],
    [halfX + 6.1, -halfZ * 0.05],
    [halfX + 6.5, -halfZ - 3.2],
    [-halfX - 2.5, -halfZ - 5.5],
  ];
  for (const [cx, cz] of thickets) {
    for (let i = 0; i < 5; i++) {
      const a = i * 2.399,
        r = Math.sqrt(random()) * 1.6;
      const x = cx + Math.cos(a) * r,
        z = cz + Math.sin(a) * r;
      if (fraction(x, z) > 0.93 || pathDistance(x, z) < 1.25 || pondDistance(x, z) < 1.2) continue;
      plants.shrub(x, height(x, z), z, 0.9 + random() * 0.6);
      for (let j = 0; j < 3; j++) {
        const bx = x + (random() - 0.5) * 2.5,
          bz = z + (random() - 0.5) * 2.5;
        plants.fern(bx, height(bx, bz), bz, 0.9 + random() * 0.6);
      }
    }
  }
  // Hero moss-covered limestone outcrops anchor each patch of undergrowth.
  for (const [cx, cz] of [
    [-halfX - 3.5, halfZ * 0.75],
    [halfX + 5.9, halfZ * 0.65],
    [halfX + 6.9, -halfZ * 0.36],
    [-halfX + 1, halfZ + 7],
  ]) {
    for (let i = 0; i < 5; i++) {
      const x = cx + (random() - 0.5) * 1.6,
        z = cz + (random() - 0.5) * 1.4;
      const scale = 0.35 + random() * 0.45,
        y = height(x, z);
      masonry.add(
        rock,
        i % 2 ? "#aaa88d" : "#c0bda0",
        [x, y + scale * 0.23, z],
        [scale, scale * 0.7, scale * 0.8],
        new Quaternion().setFromEuler(new Euler(random() * 0.3, random() * 6, random() * 0.3)),
      );
      masonry.add(rock, "#74873b", [x, y + scale * 0.65, z], [scale * 0.73, 0.045, scale * 0.6]);
      plants.fern(x + scale, y, z + 0.3, 0.85);
      plants.foxglove(x - 0.5, y, z + 0.3);
    }
  }
  // Uniform world-space sampling avoids the previous thin perimeter stripes.
  const area = (halfX + 9) * (halfZ + 9) * 4 - halfX * halfZ * 4;
  const candidates = Math.min(50000, Math.round(area * 45));
  let accepted = 0;
  for (let i = 0; i < candidates && accepted < 14000; i++) {
    const x = (random() - 0.5) * (halfX + 9.5) * 2,
      z = (random() - 0.5) * (halfZ + 9.5) * 2;
    const t = fraction(x, z);
    if (t < 0.015 || t > 0.99 || pathDistance(x, z) < 0.46 || pondDistance(x, z) < 1.08) continue;
    accepted++;
    const patch = Math.sin(x * 1.35 + Math.sin(z)) * Math.cos(z * 1.1);
    const flowers = patch > 0.7 && accepted % 3 === 0;
    plants.grass(x, height(x, z), z, 0.2 + random() * 0.24, flowers);
    if (accepted % 160 === 0 && t > 0.3) plants.fern(x, height(x, z), z, 0.9 + random() * 0.4);
    if (accepted % 150 === 0 && t > 0.12) {
      for (let j = 0; j < 3; j++) {
        const bx = x + (random() - 0.5) * 1.1,
          bz = z + (random() - 0.5) * 1.1;
        if (pathDistance(bx, bz) > 0.6 && pondDistance(bx, bz) > 1.2)
          plants.parsley(bx, height(bx, bz), bz);
      }
    }
    if (accepted % 440 === 0) plants.foxglove(x, height(x, z), z);
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
