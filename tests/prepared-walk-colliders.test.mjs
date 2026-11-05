import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { prepareWalkColliders } = await load(
    "/packages/engine/src/navigation/prepared-walk-colliders.ts",
  );
  const { deriveWalkColliders } = await load("/packages/engine/src/navigation/walk-colliders.ts");
  const { prepareBuildingWalk, moveBuildingWalker } = await load(
    "/packages/engine/src/stairs/stair-navigation.ts",
  );
  const { makeStairProject } = await load("/tests/fixtures/multiple-floors.ts");
  const { safeBuildingSpawn } = await load("/packages/engine/src/stairs/stair-navigation.ts");
  const { useWalkFloorAvailability } = await load(
    "/packages/engine/src/navigation/useWalkFloorAvailability.ts",
  );
  test("Walk floor availability reuses spawn searches across UI updates and detects physics edits", async () => {
    const building = makeStairProject();
    let unavailable;
    const hypot = Math.hypot;
    let searches = 0;
    Math.hypot = (...args) => {
      searches++;
      return hypot(...args);
    };
    function Probe({ active }) {
      unavailable = useWalkFloorAvailability(building, active);
      return null;
    }
    const fresh = () =>
      Object.fromEntries(
        building.floors
          .filter((floor) => !safeBuildingSpawn(building, floor.id))
          .map((floor) => [floor.id, "No clear walking entry"]),
      );
    let renderer;
    try {
      renderer = await create(createElement(Probe, { active: false }));
      assert.equal(searches, 0, "Orbit must not search for every walking entry");
      await renderer.update(createElement(Probe, { active: true }));
      assert.ok(searches > 0, "entering Walk performs the actual collision-backed spawn search");
      assert.deepEqual(unavailable, fresh());
      const first = unavailable;
      searches = 0;
      await renderer.update(createElement(Probe, { active: true, targetId: "lamp" }));
      assert.equal(
        searches,
        0,
        "crosshair, room and door UI updates must not repeat spawn searches",
      );
      assert.equal(unavailable, first);
      Object.defineProperty(building.floors[0].walls[0], "faceFinishes", {
        get() {
          throw new Error("decorative image bytes must not enter the navigation key");
        },
        configurable: true,
        enumerable: true,
      });
      await renderer.update(createElement(Probe, { active: true, targetId: "other-lamp" }));
      assert.equal(unavailable, first);
      building.sceneItems.push({
        id: "blocker",
        kind: "furnishing",
        modelId: "box",
        floorId: building.floors[0].id,
        size: [100, 3, 100],
        placement: { kind: "absolute", at: [4, 4], elevationMeters: 0, rotationYRadians: 0 },
      });
      await renderer.update(createElement(Probe, { active: true }));
      assert.equal(unavailable[building.floors[0].id], "No clear walking entry");
      assert.deepEqual(unavailable, fresh());
      building.sceneItems[0].placement.at = [1000, 1000];
      await renderer.update(createElement(Probe, { active: true }));
      assert.deepEqual(unavailable, fresh());
      const previous = unavailable;
      building.floors[0].walls[0].thicknessMeters += 0.1;
      await renderer.update(createElement(Probe, { active: true }));
      assert.notEqual(unavailable, previous, "in-place architecture changes invalidate the result");
      assert.deepEqual(unavailable, fresh());
    } finally {
      Math.hypot = hypot;
      await renderer?.unmount();
    }
  });
  test("prepared collision matches fresh geometry, invalidating mutable doors and furniture", () => {
    const floor = makeStairProject().floors[0],
      get = prepareWalkColliders(floor),
      open = new Set(),
      furniture = [];
    const original = get(open, furniture);
    assert.deepEqual(original, deriveWalkColliders(floor, open, furniture));
    assert.equal(get(new Set(), []), original);
    open.add(floor.openings[0]?.id ?? "door");
    assert.deepEqual(get(open, furniture), deriveWalkColliders(floor, open, furniture));
    assert.notEqual(get(open, furniture), original);
    furniture.push({ kind: "box", id: "moving-item", minX: 1, maxX: 2, minZ: 1, maxZ: 2 });
    const before = get(open, furniture);
    furniture[0].minX = 0.5;
    assert.deepEqual(get(open, furniture), deriveWalkColliders(floor, open, furniture));
    assert.notEqual(get(open, furniture), before);
    open.clear();
    furniture.length = 0;
    assert.deepEqual(get(open, furniture), original);
  });
  test("prepared stairs and collision replay the same ascent, descent and landing frames", () => {
    const building = makeStairProject(),
      prepared = prepareBuildingWalk(building),
      open = new Set();
    let expected = { x: 4, z: 1.4, floorId: "ground", elevation: 0 },
      actual = { ...expected };
    for (const direction of [1, -1])
      for (let i = 0; i < 43; i++) {
        const movement = { x: 0, z: 0.1 * direction };
        expected = moveBuildingWalker(building, expected, movement, open);
        actual = moveBuildingWalker(building, actual, movement, open, [], prepared);
        assert.deepEqual(actual, expected);
      }
    building.floors[0].footprint[0][0] -= 0.1;
    const revised = prepareBuildingWalk(building);
    assert.deepEqual(
      moveBuildingWalker(building, actual, { x: 0.02, z: 0 }, open, [], revised),
      moveBuildingWalker(building, actual, { x: 0.02, z: 0 }, open),
    );
  });
});
