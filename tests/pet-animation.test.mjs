import assert from "node:assert/strict";
import test from "node:test";
import { Bone, Group, Quaternion, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { walkPlaybackRate } = await load("/packages/pet/src/gait.ts");
  const { petAttention } = await load("/packages/pet/src/attention.ts");
  test("pet greets only a visitor in its room and releases the target on departure", () => {
    const pet = { x: 3, z: 0 },
      visitor = { x: 0, z: 0 };
    assert.deepEqual(petAttention(pet, visitor, "room", "room", true).target, { x: 1, z: 0 });
    assert.deepEqual(petAttention({ x: 0.7, z: 0 }, visitor, "room", "room", true).target, {
      x: 0.7,
      z: 0,
    });
    assert.equal(petAttention(pet, visitor, "room", "other", true), null);
    assert.equal(petAttention(pet, visitor, "room", undefined, true), null);
    assert.equal(petAttention(pet, visitor, "room", "room", false), null);
  });
  const { createLookAhead } = await load("/packages/pet/src/look-ahead.ts");
  test("pet gait covers the measured ground distance, including scaled models and stops", () => {
    const stride = 0.15 / 0.7;
    for (const scale of [0.5, 1, 2])
      for (const speed of [0, 0.04, 0.28]) {
        const rate = walkPlaybackRate(speed, 1.25, stride, scale);
        assert.ok(Math.abs((rate * stride * scale) / 1.25 - speed) < 1e-10);
      }
    assert.equal(walkPlaybackRate(0.28, 1.25, 0), 1);
    assert.equal(walkPlaybackRate(0.28, 1.25, undefined), 1);
  });
  test("calibrated head faces actor forward after turns without accumulating rotations", () => {
    const actor = new Group(),
      root = new Group(),
      neck = new Bone(),
      head = new Bone();
    head.name = "test-head";
    actor.add(root);
    root.add(neck);
    neck.add(head);
    const forward = new Vector3(0.6, -0.15, 0.8).normalize();
    const look = createLookAhead(root, { bone: "test-head", forward: forward.toArray() });
    for (const yaw of [0, 0.7, -1.4, 2.8]) {
      look.restore();
      actor.rotation.y = yaw;
      neck.rotation.z = 0.08;
      head.rotation.x = 0.02;
      const before = head.quaternion.clone();
      look.update(actor);
      const actual = forward.clone().applyQuaternion(head.getWorldQuaternion(new Quaternion()));
      const expected = new Vector3(0, 0, 1).applyQuaternion(
        actor.getWorldQuaternion(new Quaternion()),
      );
      assert.ok(actual.distanceTo(expected) < 1e-8);
      look.restore();
      assert.ok(head.quaternion.angleTo(before) < 1e-7);
    }
  });
  test("pet head turns toward the visitor and smoothly returns forward after departure", () => {
    const actor = new Group(),
      head = new Bone();
    head.name = "head";
    actor.add(head);
    const look = createLookAhead(actor, { bone: "head", forward: [0, 0, 1] });
    const target = new Vector3(2, 1, 2);
    for (let frame = 0; frame < 60; frame++) {
      look.restore();
      look.update(actor, target, 0.05);
    }
    const direction = new Vector3(0, 0, 1).applyQuaternion(
      head.getWorldQuaternion(new Quaternion()),
    );
    assert.ok(
      direction.x > 0.5 && direction.y > 0.2,
      "head visibly turns and lifts toward visitor",
    );
    for (let frame = 0; frame < 60; frame++) {
      look.restore();
      look.update(actor, undefined, 0.05);
    }
    const returned = new Vector3(0, 0, 1).applyQuaternion(
      head.getWorldQuaternion(new Quaternion()),
    );
    assert.ok(returned.distanceTo(new Vector3(0, 0, 1)) < 1e-7);
  });
});
