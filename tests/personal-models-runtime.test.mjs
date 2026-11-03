import assert from "node:assert/strict";
import test from "node:test";
import { createElement, act } from "react";
import { create } from "@react-three/test-renderer";
import { Box3 } from "three";
import { IDBFactory } from "fake-indexeddb";
import { testGlb } from "./fixtures/personal-glb.mjs";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { personalScaleFixture, personalFixtureAssets } = await load(
    "/tests/fixtures/personal-models-scale.ts",
  );
  test("imported pose instances follow primary state independently and restore the fallback", async () => {
    const bytes = testGlb({ poses: true });
    const asset = { bytes, byteLength: bytes.length, sha256: await api.modelAssetHash(bytes) };
    const decoded = await api.loadGlb(bytes, true);
    const model = {
      id: "custom:11111111-2222-4333-8444-555555555555",
      name: "Pose fixture",
      placement: "floor",
      profile: "input_boolean",
      asset,
      normalization: api.normalizeGlb(decoded.root, "floor", [0, 0, 0], 1, decoded.poses),
      complexity: decoded.complexity,
      poses: { defaultPose: "0", states: { on: "1", off: "0" } },
    };
    const oldWindow = globalThis.window;
    globalThis.window = Object.assign(new EventTarget(), { indexedDB: new IDBFactory() });
    let renderer;
    const state = (value, available = true) => ({
      entityId: "input_boolean.fixture",
      state: value,
      attributes: {},
      available,
      stale: false,
    });
    const render = (first, second) =>
      createElement(
        "group",
        null,
        createElement(api.ImportedModelGeometry, { model, state: first }),
        createElement(api.ImportedModelGeometry, { model, state: second }),
      );
    try {
      await api.createModelAssetRepository(window.indexedDB).restore([asset]);
      renderer = await create(render(state("off"), state("on")));
      const meshes = () => {
        const result = [];
        renderer.scene.instance.traverse((object) => {
          if (object.userData.importedModel) result.push(object);
        });
        return result;
      };
      for (let attempt = 0; attempt < 40 && meshes().length !== 2; attempt++)
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
      assert.deepEqual(
        meshes().map((mesh) => mesh.position.y),
        [0, 1],
      );
      await renderer.update(render(state("on"), state("on", false)));
      assert.deepEqual(
        meshes().map((mesh) => mesh.position.y),
        [1, 0],
      );
      assert.equal(meshes()[0].geometry, meshes()[1].geometry);
    } finally {
      await renderer?.unmount();
      api.disposeGlb(decoded.root);
      globalThis.window = oldWindow;
    }
  });
  test("personal models retain 20 rooms and 100 bindings with Light, Sensor, Camera and static Cover profiles", async () => {
    const fixture = personalScaleFixture();
    assert.equal(fixture.manifest.floors[0].rooms.length, 20);
    assert.equal(api.collectBindingSlots(fixture.manifest).length, 100);
    assert.equal(api.validateRuntimeBindingProfile(fixture.profile, fixture.manifest).valid, true);
    const validation = api.validateHomeProject(fixture.project, fixture.registries);
    assert.equal(validation.valid, true, JSON.stringify(validation.issues));
    const bindings = api.resolveHomeAssistantBindings(
      fixture.manifest,
      fixture.profile,
      fixture.runtime,
      fixture.registries.deviceModels,
    );
    const devices = bindings.rooms["scale-room-0"].devices.slice(0, 4);
    assert.deepEqual(
      devices.map((device) => device.entities[0].domain),
      ["light", "sensor", "camera", "cover"],
    );
    assert.equal(devices[1].entities[0].state.state, "21.5");
    assert.equal(devices[3].entities[0].state.attributes.current_position, 65);
    // Node's renderer has no image decoder; textured preservation is covered in Chromium.
    const asset = personalFixtureAssets[0];
    const project = {
      ...fixture.project,
      customModels: fixture.project.customModels.map((model) => ({
        ...model,
        asset: { sha256: asset.sha256, byteLength: asset.byteLength },
      })),
    };
    const registries = api.resolveProjectModels(project, fixture.registries);
    const oldWindow = globalThis.window;
    globalThis.window = Object.assign(new EventTarget(), { indexedDB: new IDBFactory() });
    let renderer, lighting;
    try {
      await api.createModelAssetRepository(window.indexedDB).restore([asset]);
      const interactions = [];
      const items = project.sceneItems.slice(0, 4);
      const props = (item, index, resolved = devices[index]) => ({
        item,
        floor: project.floors[0],
        ...registries,
        resolvedDevice: resolved,
        entityStatesBySlotId: {},
        reducedMotion: true,
        walkMode: false,
        onInteract: (target) => interactions.push(target),
        liveMediaByEntityId: {},
      });
      const render = (bindings = devices) =>
        createElement(
          "group",
          {},
          ...items.map((item, index) =>
            createElement(api.SceneItemRenderer, {
              ...props(item, index, bindings[index]),
              key: item.id,
            }),
          ),
        );
      renderer = await create(render());
      let meshes = [];
      for (let attempt = 0; attempt < 40 && meshes.length !== 4; attempt++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
        meshes = [];
        renderer.scene.instance.traverse((object) => {
          if (object.userData.importedModel) meshes.push(object);
        });
      }
      assert.equal(meshes.length, 4);
      assert.ok(
        meshes.every(
          (mesh) => mesh.geometry === meshes[0].geometry && mesh.material === meshes[0].material,
        ),
      );
      assert.equal(meshes[0].material.type, "MeshStandardMaterial");
      const floorItem = renderer.scene.findByProps({ name: `scene-item-${items[0].id}` }).instance;
      assert.equal(floorItem.userData.walkCollider, true);
      const wallItem = renderer.scene.findByProps({ name: `scene-item-${items[1].id}` }).instance;
      assert.equal(wallItem.userData.walkCollider, false);
      const box = new Box3().setFromObject(floorItem);
      assert.ok(Math.abs(box.max.y - box.min.y - 0.5) < 0.00001);
      const collider = {
        kind: "box",
        id: items[0].id,
        minX: box.min.x,
        maxX: box.max.x,
        minZ: box.min.z,
        maxZ: box.max.z,
      };
      assert.ok(
        api.deriveWalkColliders(project.floors[0], new Set(), [collider]).includes(collider),
      );
      const camera = renderer.scene.findByProps({ name: `scene-item-${items[2].id}` });
      const event = { pointerId: 1, nativeEvent: { clientX: 0, clientY: 0 }, stopPropagation() {} };
      camera.props.onPointerDown(event);
      camera.props.onPointerUp(event);
      assert.equal(interactions[0].intent, "camera-viewer");
      const coverGeometry = meshes[3].geometry,
        coverBounds = new Box3().setFromObject(meshes[3]);
      const closed = {
        ...devices[3],
        entities: devices[3].entities.map((entity) => ({
          ...entity,
          state: { ...entity.state, state: "closed", attributes: { current_position: 0 } },
        })),
      };
      await renderer.update(render([...devices.slice(0, 3), closed]));
      assert.equal(meshes[3].geometry, coverGeometry);
      assert.deepEqual(new Box3().setFromObject(meshes[3]), coverBounds);
      const lightProps = {
        floor: fixture.manifest.floors[0],
        resolvedBindings: bindings,
        deviceModels: registries.deviceModels,
        extensionDeviceModels: {},
        sceneItems: items,
      };
      lighting = await create(createElement(api.HomeAssistantSceneLighting, lightProps));
      const source = lighting.scene.findByProps({
        name: `ha-device-light-${items[0].id}`,
      }).instance;
      assert.ok(Math.abs(source.intensity - (2 * 128) / 255) < 0.0001);
      assert.ok(source.color.b > source.color.r);
      const unavailable = {
        ...bindings,
        rooms: {
          ...bindings.rooms,
          "scale-room-0": {
            ...bindings.rooms["scale-room-0"],
            devices: devices.map((device) => ({
              ...device,
              entities: device.entities.map((entity) => ({
                ...entity,
                state: { ...entity.state, available: false },
              })),
            })),
          },
        },
      };
      await lighting.update(
        createElement(api.HomeAssistantSceneLighting, {
          ...lightProps,
          resolvedBindings: unavailable,
        }),
      );
      assert.equal(
        lighting.scene.findByProps({ name: `ha-device-light-${items[0].id}` }).instance,
        source,
      );
      assert.equal(source.intensity, 0);
    } finally {
      await lighting?.unmount();
      await renderer?.unmount();
      globalThis.window = oldWindow;
    }
  });
});
