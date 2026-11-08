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
      }
      for (const [x, z] of layout.trail) {
        assert.ok(layout.fraction(x, z) > 0, "the open path clears the authored home");
        assert.ok(layout.fraction(x, z) < 1, "the open path stays on the island");
        assert.ok(layout.pathDistance(x, z) < 1e-6);
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
      const positions = geometry.ground.getAttribute("position"),
        normals = geometry.ground.getAttribute("normal");
      assert.ok(normals.getY(0) > 0.9);
      for (let i = 0; i < normals.count; i++) {
        if (Math.abs(normals.getY(i)) < 0.5) {
          assert.ok(
            positions.getX(i) * normals.getX(i) + positions.getZ(i) * normals.getZ(i) > 0,
            "the exposed plinth faces outward instead of disappearing through backface culling",
          );
        }
      }
    } finally {
      Object.values(geometry).forEach((part) => part.dispose());
    }
  });
});
