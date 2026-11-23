import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { countryPlanet, planetGeometry } = await load(
    "/packages/engine/src/landscapes/country-planet.ts",
  );
  const lot = { centerX: 14, centerZ: -8, width: 51, depth: 17 };
  const plot = { plantingLot: lot, surveyX: 8, surveyZ: 25 };
  const grade = (x, z) => 0.021 * x - 0.014 * z;
  const world = countryPlanet(plot, grade);
  test("curvature preserves authored grade through the corners of an off-centre parcel", () => {
    for (const dx of [-0.5, 0, 0.5])
      for (const dz of [-0.5, 0, 0.5]) {
        const x = world.cx + dx * lot.width,
          z = world.cz + dz * lot.depth;
        const p = new Vector3(),
          up = new Vector3();
        world.point(x, z, p, up, new Vector3());
        assert.ok(p.distanceTo(new Vector3(x, grade(x, z), z)) < 1e-8);
        assert.ok(up.distanceTo(new Vector3(0, 1, 0)) < 1e-8);
      }
  });
  test("the first grove remains visible from the parcel and the distant outline is round", () => {
    const planet = countryPlanet(plot, () => 0);
    const p = new Vector3(),
      up = new Vector3(),
      cover = new Vector3();
    planet.point(planet.cx + lot.width / 2 + 12, planet.cz, p, up, cover);
    assert.ok(p.y > -1.8 && p.y < 0, "near trees grow on a gentle descent");
    const equator = planet.distanceAt(Math.PI / 2);
    planet.point(planet.cx + equator, planet.cz, p, up, cover);
    assert.ok(Math.abs(p.y + planet.centerDepth) < 0.01);
    assert.ok(
      planet.centerDepth / planet.radius > 0.95,
      "home crown fits the spherical silhouette",
    );
  });
  test("the shoulder outside a parcel corner has a continuous slope in orbit", () => {
    const planet = countryPlanet(plot, () => 0);
    const x = planet.cx + lot.width / 2 + 21,
      z = planet.cz + lot.depth / 2 + 21;
    const p = new Vector3(),
      up = new Vector3(),
      cover = new Vector3();
    const height = (offset) => {
      planet.point(x + offset, z - offset, p, up, cover);
      return p.y;
    };
    const step = 0.005;
    const changeInSlope = (height(step) - 2 * height(0) + height(-step)) / step;
    assert.ok(Math.abs(changeInSlope) < 0.003);
  });
  test("the exterior is a closed outward-facing surface, including both poles", () => {
    const geometry = planetGeometry(world, 1);
    try {
      const index = geometry.getIndex().array,
        edges = new Map();
      for (let i = 0; i < index.length; i += 3)
        for (let side = 0; side < 3; side++) {
          const a = index[i + side],
            b = index[i + ((side + 1) % 3)];
          const key = Math.min(a, b) * 65536 + Math.max(a, b);
          edges.set(key, (edges.get(key) ?? 0) + (a < b ? 1 : -1));
        }
      for (const balance of edges.values()) assert.equal(balance, 0);
      const normals = geometry.getAttribute("normal");
      assert.ok(normals.getY(0) > 0.99 && normals.getY(normals.count - 1) < 0);
      const p = new Vector3(),
        up = new Vector3();
      world.point(world.cx + world.distanceAt(Math.PI * 0.68), world.cz, p, up, new Vector3());
      assert.ok(up.x > 0.7 && up.y < 0 && p.y < -world.radius);
    } finally {
      geometry.dispose();
    }
  });
});
