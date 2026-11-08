import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { countrysideLayout } = await load(
    "/packages/engine/src/architecture-scene/countryside/landscape-layout.ts",
  );
  const { createCountrysideGeometry } = await load(
    "/packages/engine/src/architecture-scene/countryside/landscape-geometry.ts",
  );
  test("landscape keeps its ring outside small, long and large plots and joins translated terrain", () => {
    for (const [width, depth] of [
      [7, 7],
      [12, 45],
      [80, 7],
      [200, 200],
    ]) {
      const terrain = { offsetAt: (x, z) => 0.01 * x + 0.02 * z };
      const layout = countrysideLayout(width, depth, terrain, 100, -50);
      for (let i = 0; i < 360; i++) {
        const angle = (i * Math.PI) / 180;
        const [inner, outer] = layout.radii(angle);
        assert.ok(outer - inner >= 3.49, "the outer ring never folds across the plot");
        const [x, z] = layout.point(angle, 0);
        assert.ok(
          Math.abs(layout.height(x, z) - (-0.047 + terrain.offsetAt(x + 100, z - 50))) < 1e-6,
        );
        const t = layout.pathFraction(angle);
        assert.ok(t > 0.1 && t < 0.65, "the path stays inside the landscape band");
      }
    }
  });
  test("countryside geometry has finite buffers, upward ground and a bounded botanical budget", () => {
    const geometry = createCountrysideGeometry(countrysideLayout(20, 30, null, 0, 0), "#91a06a");
    try {
      let triangles = 0;
      for (const part of Object.values(geometry)) {
        for (const name of ["position", "normal", "color"]) {
          assert.ok(part.getAttribute(name).array.every(Number.isFinite), name);
        }
        triangles += part.getAttribute("position").count / 3;
      }
      assert.ok(triangles < 800_000, `bounded merged geometry: ${triangles}`);
      assert.ok(geometry.ground.getAttribute("normal").getY(0) > 0.9);
    } finally {
      Object.values(geometry).forEach((part) => part.dispose());
    }
  });
});
