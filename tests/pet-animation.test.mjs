import assert from "node:assert/strict";
import test from "node:test";
import { Bone, Group, Quaternion, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { walkPlaybackRate } = await load("/packages/pet/src/gait.ts");
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
});
