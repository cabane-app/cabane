import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { create } from "@react-three/test-renderer";
import { Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { sampleLaserPulse, LASER_TRAIL_LENGTH } = await load(
    "/packages/walk-laser/src/laser-pulse.ts",
  );
  const { LaserShot } = await load("/packages/walk-laser/src/LaserShot.tsx");
  const { LaserGun } = await load("/packages/walk-laser/src/LaserGun.tsx");
  test("pulse has a bounded moving tail, reaches the hit, and expires even after a slow frame", () => {
    assert.equal(
      sampleLaserPulse(1, 1 / 30).traveling,
      true,
      "nearby shots remain visible at 30 FPS",
    );
    for (const distance of [0, 0.1, 3, 20, 100]) {
      const duration = sampleLaserPulse(distance, 0).travelSeconds;
      for (let step = 0; step <= 10; step++) {
        const sample = sampleLaserPulse(distance, (duration * step) / 10);
        assert.ok(sample.head - sample.tail <= LASER_TRAIL_LENGTH + 1e-9);
        assert.ok(sample.tail >= 0 && sample.head <= distance);
      }
      assert.equal(sampleLaserPulse(distance, duration).traveling, false);
      assert.equal(sampleLaserPulse(distance, duration).impact, true);
      assert.equal(sampleLaserPulse(distance, 10).done, true);
      assert.equal(sampleLaserPulse(distance, 10).impact, false);
    }
  });
  test("rendered energy travels as a short pulse and turns into a fading impact, not a static beam", async () => {
    const renderer = await create(
      React.createElement(LaserShot, {
        shot: {
          id: 1,
          start: new Vector3(0, 0, 0),
          end: new Vector3(0, 0, -10),
          hit: true,
        },
      }),
    );
    try {
      const pulse = renderer.scene.findByProps({ name: "laser-pulse" }).instance;
      const impact = renderer.scene.findByProps({ name: "laser-impact" }).instance;
      await renderer.advanceFrames(1, 1 / 60);
      const firstZ = pulse.position.z;
      assert.equal(pulse.visible, true);
      assert.ok(pulse.scale.z <= LASER_TRAIL_LENGTH);
      await renderer.advanceFrames(1, 1 / 60);
      assert.ok(pulse.position.z < firstZ);
      await renderer.advanceFrames(12, 1 / 60);
      assert.equal(pulse.visible, false);
      assert.equal(impact.visible, true);
      assert.ok(impact.children[0].material.opacity < 1);
      await renderer.advanceFrames(40, 1 / 60);
      assert.equal(impact.visible, false);
      const scorch = renderer.scene.findByProps({ name: "electric-scorch" }).instance;
      assert.equal(scorch.visible, true, "scorch persists after the electrical flash");
      await renderer.advanceFrames(150, 1 / 60);
      assert.equal(scorch.visible, false, "scorch fades completely");
    } finally {
      await renderer.unmount();
    }
  });
  test("portal zaps reuse the electrical arc and impact with the selected color, without burning the portal", async () => {
    for (const color of ["#42cfff", "#efa632"]) {
      const renderer = await create(
        React.createElement(LaserShot, {
          shot: {
            id: 1,
            start: new Vector3(),
            end: new Vector3(0, 0, -2),
            hit: true,
            color,
            scorch: false,
          },
        }),
      );
      try {
        const arc = renderer.scene.findByProps({ name: "laser-electric-arc" }).instance;
        assert.equal("#" + arc.material.emissive.getHexString(), color);
        assert.equal(renderer.scene.findAllByProps({ name: "electric-scorch" }).length, 0);
        await renderer.advanceFrames(1, 1 / 60);
        assert.equal(arc.visible, true);
        await renderer.advanceFrames(11, 1 / 60);
        const impact = renderer.scene.findByProps({ name: "laser-impact" }).instance;
        assert.equal(impact.visible, true);
        assert.equal("#" + impact.children[0].material.emissive.getHexString(), color);
        await renderer.advanceFrames(40, 1 / 60);
        assert.equal(arc.visible, false);
        assert.equal(impact.visible, false);
      } finally {
        await renderer.unmount();
      }
    }
  });
  test("a miss has no impact burst", async () => {
    const renderer = await create(
      React.createElement(LaserShot, {
        shot: { id: 1, start: new Vector3(), end: new Vector3(0, 0, -2), hit: false },
      }),
    );
    try {
      for (const frames of [3, 12, 40]) {
        await renderer.advanceFrames(frames, 1 / 60);
        const visibleImpacts = renderer.scene
          .findAllByProps({ name: "laser-impact" })
          .filter((impact) => impact.instance.visible);
        assert.equal(visibleImpacts.length, 0);
      }
    } finally {
      await renderer.unmount();
    }
  });
  test("rebuilt gun exposes its actual muzzle and uses toon materials; muzzle flash is brief", async () => {
    const muzzleRef = { current: null };
    const renderer = await create(React.createElement(LaserGun, { muzzleRef, shotId: 1 }));
    try {
      assert.ok(muzzleRef.current);
      muzzleRef.current.updateWorldMatrix(true, false);
      assert.ok(muzzleRef.current.getWorldPosition(new Vector3()).z < -0.4);
      let meshes = 0;
      renderer.scene.instance.traverse((object) => {
        if (object.isMesh) {
          meshes++;
          assert.equal(object.material.type, "MeshToonMaterial");
          assert.ok(object.material.gradientMap);
        }
      });
      assert.ok(meshes > 0);
      const flash = renderer.scene.findByProps({ name: "laser-muzzle-flash" }).instance;
      await renderer.advanceFrames(1, 1 / 60);
      assert.equal(flash.visible, true);
      await renderer.advanceFrames(4, 1 / 60);
      assert.equal(flash.visible, false);
    } finally {
      await renderer.unmount();
    }
  });
});
