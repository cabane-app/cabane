import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { createPetRoaming } = await load("/packages/pet/src/roaming.ts");
  const bounds = { minX: 0, maxX: 4, minZ: 0, maxZ: 4 };

  test("pet routes through a passage rather than crossing a wall", () => {
    const isWalkable = ({ x, z }) => !(x > 1.85 && x < 2.15 && z < 3);
    const pet = createPetRoaming({
      bounds,
      isWalkable,
      spawn: { x: 1, z: 1 },
      random: () => 0.999,
    });
    let reachedOtherSide = false;
    let previous = { ...pet.position };
    for (let frame = 0; frame < 2000; frame++) {
      pet.step(0.05);
      assert.ok(isWalkable(pet.position));
      assert.ok(Math.hypot(pet.position.x - previous.x, pet.position.z - previous.z) <= 0.01401);
      if (pet.position.x > 2.15) reachedOtherSide = true;
      previous = { ...pet.position };
    }
    assert.ok(reachedOtherSide, "pet explores the connected room through the passage");
  });

  test("pet stays in its connected component and does not jump after a long frame", () => {
    const pet = createPetRoaming({
      bounds,
      isWalkable: ({ x }) => x < 1.9 || x > 2.1,
      spawn: { x: 1, z: 1 },
      random: () => 0.999,
    });
    for (let frame = 0; frame < 300; frame++) {
      const previous = { ...pet.position };
      pet.step(30);
      assert.ok(pet.position.x < 1.9);
      assert.ok(Math.hypot(pet.position.x - previous.x, pet.position.z - previous.z) <= 0.02801);
    }
  });

  test("pet stops when an obstacle closes its next segment", () => {
    let closed = false;
    const pet = createPetRoaming({
      bounds,
      isWalkable: ({ x }) => !closed || x < 2,
      spawn: { x: 1, z: 1 },
      random: () => 0.999,
    });
    closed = true;
    for (let frame = 0; frame < 600; frame++) {
      pet.step(0.05);
      assert.ok(pet.position.x < 2);
    }
  });

  test("navigation rebuild preserves the exact prior position without snapping across walls", () => {
    const spawn = { x: 1.13, z: 1.17 };
    const pet = createPetRoaming({ bounds, isWalkable: () => true, spawn });
    assert.deepEqual(pet.position, spawn);
    const blocked = createPetRoaming({ bounds, isWalkable: ({ x }) => x > 2, spawn });
    assert.equal(blocked.position, null);
  });

  test("navigation rebuild preserves heading and rejects non-finite initial yaw", () => {
    const spawn = { x: 1.13, z: 1.17 };
    const options = { bounds, spawn, isWalkable: () => true };
    const rebuilt = createPetRoaming({ ...options, initialYaw: -1.2 });
    assert.deepEqual(rebuilt.position, spawn);
    assert.equal(rebuilt.yaw, -1.2);
    assert.equal(createPetRoaming({ ...options, initialYaw: NaN }).yaw, 0);
    assert.equal(createPetRoaming({ ...options, initialYaw: Infinity }).yaw, 0);
  });

  test("follow target projects onto the reachable side of a wall", () => {
    const pet = createPetRoaming({
      bounds,
      spawn: { x: 1, z: 1 },
      isWalkable: ({ x }) => x < 1.9 || x > 2.1,
    });
    for (let frame = 0; frame < 1200; frame++) {
      pet.step(0.05, { x: 3, z: 1 });
      assert.ok(pet.position.x < 1.9);
    }
    assert.ok(pet.position.x > 1.6);
    assert.equal(pet.actualSpeed, 0);
  });

  test("follow mode updates a moving goal and reports displacement speed", () => {
    const pet = createPetRoaming({ bounds, spawn: { x: 1, z: 1 }, isWalkable: () => true });
    for (const target of [
      { x: 1, z: 3 },
      { x: 3, z: 3 },
    ]) {
      for (let frame = 0; frame < 500; frame++) {
        const previous = { ...pet.position };
        pet.step(0.05, target);
        const distance = Math.hypot(pet.position.x - previous.x, pet.position.z - previous.z);
        assert.ok(Math.abs(pet.actualSpeed - distance / 0.05) < 1e-9);
        assert.ok(pet.actualSpeed <= 0.280001);
        if (distance > 1e-7) {
          assert.ok(Math.abs((pet.position.x - previous.x) / distance - Math.sin(pet.yaw)) < 1e-7);
          assert.ok(Math.abs((pet.position.z - previous.z) / distance - Math.cos(pet.yaw)) < 1e-7);
        }
      }
      assert.ok(Math.hypot(pet.position.x - target.x, pet.position.z - target.z) <= 0.05);
    }
    const idleYaw = pet.yaw;
    pet.step(0.05, { x: 3, z: 3 });
    assert.equal(pet.yaw, idleYaw, "stopped pet keeps looking in its travel direction");
  });

  test("pet takes small steps through a half-turn instead of pivoting in place", () => {
    const pet = createPetRoaming({ bounds, spawn: { x: 2, z: 2 }, isWalkable: () => true });
    pet.step(0.05, { x: 2, z: 0.5 });
    assert.ok(pet.actualSpeed > 0);
    assert.ok(pet.position.z > 2, "first step follows the initial heading into an arc");
    assert.ok(pet.gaitSpeed > 0);
    let previousSpeed = pet.actualSpeed;
    for (let frame = 0; frame < 25; frame++) {
      pet.step(0.05, { x: 2, z: 0.5 });
      assert.ok(pet.actualSpeed - previousSpeed <= 0.65 * 0.05 + 1e-8);
      previousSpeed = pet.actualSpeed;
    }
    assert.ok(pet.actualSpeed > 0);
  });

  test("pet keeps stepping in a blocked turn without crossing the wall", () => {
    const pet = createPetRoaming({
      bounds,
      spawn: { x: 2, z: 1.999 },
      isWalkable: ({ z }) => z < 2,
    });
    pet.step(0.05, { x: 2, z: 0.5 });
    assert.equal(pet.actualSpeed, 0);
    assert.ok(pet.gaitSpeed > 0, "feet keep stepping while turning in limited space");
    for (let i = 0; i < 1600; i++) {
      pet.step(0.05, { x: 2, z: 0.5 });
      assert.ok(pet.position.z < 2);
    }
    assert.ok(Math.hypot(pet.position.x - 2, pet.position.z - 0.5) < 0.05);
  });

  test("pet remains absent when no floor point is available", () => {
    const pet = createPetRoaming({ bounds, isWalkable: () => false });
    pet.step(10);
    assert.equal(pet.position, null);
    assert.equal(pet.moving, false);
  });
});
