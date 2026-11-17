import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { createVergeBlades } = await load("/packages/engine/src/floor-finishes/verge-blades.ts");
  const { GROUND_ELEVATION_METERS } = await load("/packages/engine/src/ground-elevation.ts");
  const coordinates = { metersPerPlanUnit: 0.5, origin: [100, 60] };
  const edge = {
    from: [108, 64],
    to: [156, 64],
    lawnNormal: [0, 1],
    finish: { kind: "preset", preset: "pine-bark" },
    platform: false,
  };
  const terrain = { offsetAt: (x, z) => 0.2 + x * 0.04 + z * 0.08 };

  test("lawn detail stays rooted along the sloped verge in physical metres", () => {
    const geometry = createVergeBlades([edge], coordinates, "#91a06a", terrain);
    const positions = geometry.getAttribute("position");
    let lowest = Infinity;
    let tallest = -Infinity;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const height = positions.getY(i) - GROUND_ELEVATION_METERS - terrain.offsetAt(x, z);
      assert.ok(x >= 3.9 && x <= 28.1 && Math.abs(z - 2) < 0.25);
      lowest = Math.min(lowest, height);
      tallest = Math.max(tallest, height);
    }
    assert.ok(lowest < 0.001 && lowest > -0.009, "roots meet the turf");
    assert.ok(tallest > 0.025 && tallest < 0.09, "tips stay at lawn height");
    geometry.dispose();
  });

  test("long loose verges retain a fixed budget and stable geometry across remounts", () => {
    const runs = Array.from({ length: 300 }, (_, i) => ({
      ...edge,
      from: [108, 64 + i],
      to: [156, 64 + i],
    }));
    const first = createVergeBlades(runs, coordinates, "#88996b", null);
    const next = createVergeBlades(runs, coordinates, "#88996b", null);
    assert.ok(first.index.count > 0 && first.index.count / 3 <= 6000);
    assert.deepEqual(first.attributes.position.array, next.attributes.position.array);
    first.dispose();
    next.dispose();
    assert.equal(createVergeBlades([], coordinates, "#88996b", null), null);
  });

  test("the grass lives on its support and disappears where a deck separates from grade", () => {
    const grassDeck = { ...edge, platform: false, explicitGrass: true, lawnPlatform: true };
    const blades = createVergeBlades([grassDeck], coordinates, "#aa1212", null);
    blades.computeBoundingBox();
    assert.ok(Math.abs(blades.boundingBox.min.y - 0.001) < 1e-6, "roots sit on the deck");
    blades.dispose();
    const raisedDeck = { ...edge, platform: true };
    assert.equal(createVergeBlades([raisedDeck], coordinates, "#91a06a", terrain), null);
  });
});
