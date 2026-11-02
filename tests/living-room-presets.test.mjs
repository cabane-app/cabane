import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const furnishing = await load("/packages/catalog/src/furnishing/index.ts");
  const device = await load("/packages/catalog/src/device/index.ts");
  test("living-room case has six doors and genuinely open arched fronts", async () => {
    let renderer = await create(
      createElement(furnishing.stableFurnishingRegistry["six-door-oak-sideboard"].component),
    );
    assert.equal(renderer.scene.findAllByProps({ name: "oak-sideboard-door" }).length, 6);
    await renderer.unmount();
    renderer = await create(
      createElement(furnishing.stableFurnishingRegistry["double-arched-bookcase"].component),
    );
    const frame = renderer.scene.findByProps({ name: "double-arched-case" }).instance;
    frame.updateMatrixWorld(true);
    for (const x of [-0.245, 0.245])
      assert.equal(
        new Raycaster(new Vector3(x, 1.5, 1), new Vector3(0, 0, -1)).intersectObject(frame).length,
        0,
      );
    assert.ok(
      new Raycaster(new Vector3(0, 1.5, 1), new Vector3(0, 0, -1)).intersectObject(frame).length >
        0,
    );
    await renderer.unmount();
  });
  test("tapered wall shade stays within its envelope and has an open top", async () => {
    const definition = furnishing.stableFurnishingRegistry["white-tapered-wall-sconce"];
    const renderer = await create(createElement(definition.component));
    renderer.scene.instance.updateMatrixWorld(true);
    const box = new Box3().setFromObject(renderer.scene.instance);
    box
      .getSize(new Vector3())
      .toArray()
      .forEach((v, i) => assert.ok(Math.abs(v - definition.defaultSize[i]) < 0.001));
    const hits = new Raycaster(new Vector3(0, 0.4, 0), new Vector3(0, -1, 0)).intersectObject(
      renderer.scene.instance,
      true,
    );
    assert.ok(hits.length > 0);
    assert.ok(
      hits.every((hit) => hit.point.y < 0.17),
      "top must remain genuinely open",
    );
    await renderer.unmount();
  });
  test("six lamp spokes meet the hub and globe interiors", async () => {
    const renderer = await create(
      createElement(furnishing.stableFurnishingRegistry["six-globe-ceiling-lamp"].component),
    );
    renderer.scene.instance.updateMatrixWorld(true);
    const arms = renderer.scene.findAllByProps({ name: "ceiling-lamp-arm" });
    const globes = renderer.scene.findAllByProps({ name: "ceiling-lamp-globe" });
    assert.equal(arms.length, 6);
    assert.equal(globes.length, 6);
    for (const arm of arms) {
      const half = arm.instance.geometry.parameters.height / 2;
      const ends = [new Vector3(0, -half, 0), new Vector3(0, half, 0)].map((v) =>
        arm.instance.localToWorld(v),
      );
      assert.ok(ends.some((v) => v.distanceTo(new Vector3(0, 0.18, 0)) < 1e-6));
      assert.ok(
        ends.some((v) =>
          globes.some((g) => v.distanceTo(g.instance.getWorldPosition(new Vector3())) < 0.1),
        ),
      );
    }
    await renderer.unmount();
  });
  test("compact media television keeps wall contact and bounds in every connection state", async () => {
    const definition = device.stableDeviceRegistry["compact-wall-television"];
    assert.deepEqual(definition.supportedDomains, ["media_player", "switch"]);
    for (const visualState of [
      "connected-active",
      "connected-inactive",
      "disconnected",
      "unavailable",
    ]) {
      const renderer = await create(
        createElement(definition.component, {
          visualState,
          reducedMotion: true,
          walkMode: false,
          onInteract() {},
        }),
      );
      const box = new Box3().setFromObject(renderer.scene.instance);
      box
        .getSize(new Vector3())
        .toArray()
        .forEach((v, i) => assert.ok(Math.abs(v - definition.defaultSize[i]) < 0.001));
      assert.ok(Math.abs(box.min.z) < 0.001);
      assert.ok(Math.abs(box.min.y) < 0.001);
      await renderer.unmount();
    }
  });
});
