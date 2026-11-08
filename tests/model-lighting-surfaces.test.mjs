import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { create } from "@react-three/test-renderer";
import * as THREE from "three";
import { withModules } from "./test-server.mjs";
import { testGlb } from "./fixtures/personal-glb.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { GardenBench } = await load(
    "/packages/catalog/src/furnishing/presets/outdoor/garden-bench.tsx",
  );
  const { TelevisionModel } = await load(
    "/packages/catalog/src/device/presets/media/television.tsx",
  );
  const { ModelLightingSurface } = await load(
    "/packages/engine/src/model-lighting/ModelLightingSurface.tsx",
  );
  const { makeThreeFloorProject } = await load("/tests/fixtures/multiple-floors.ts");
  const light = { position: [0, 0.5, 0], color: "#ff0000", maxIntensity: 2, distance: 5 };
  const state = {
    entityId: "light.synthetic",
    state: "on",
    attributes: {},
    available: true,
    stale: false,
  };
  const part = (root, key) =>
    root.getObjectsByProperty("isMesh", true).find((mesh) => mesh.userData.modelGlowKey === key);

  await test("bench keys survive variants and wrappers; legacy ordinals cannot glow the cushion", async () => {
    const scenes = [];
    try {
      for (const variant of ["default", "sage"])
        scenes.push(await create(React.createElement(GardenBench, { variant })));
      const roots = scenes.map((scene) => scene.scene.children[0].instance);
      const legs = roots.map((root) => part(root, "bench.leg.back-left"));
      // Keep Fiber's own Three constructors: replacing its global catalogue
      // breaks color prop conversion in every later test in a shared shard.
      assert.equal(legs[0].material.color.getHexString(), "414e49");
      const id = api.modelLightingSurfaceAt(roots[0], legs[0]);
      assert.equal(id, "surface:key:bench.leg.back-left");
      const wrapper = new THREE.Group();
      roots[1].add(wrapper);
      wrapper.add(legs[1]);
      assert.equal(api.modelLightingSurfaceAt(roots[1], legs[1]), id);
      const settings = JSON.parse(JSON.stringify({ ...light, emissiveSurfaces: [id] }));
      assert.equal(
        api.parseHomeProjectSchema({ ...makeThreeFloorProject(), modelLights: { bench: settings } })
          .valid,
        true,
      );
      const cushion = part(roots[1], "bench.seat-pad");
      const original = cushion.material;
      for (const root of roots) {
        const control = api.controlModelLightMaterials(root, settings);
        control.update(state, light.color);
        assert.equal(part(root, "bench.leg.back-left").material.emissive.getHexString(), "ff0000");
        control.dispose();
        const old = api.controlModelLightMaterials(root, { emissiveSurfaces: ["surface:0:0"] });
        old.update(state, light.color);
        assert.equal(part(root, "bench.leg.back-left").material.emissive.getHexString(), "000000");
        old.dispose();
      }
      assert.equal(cushion.material, original);
      assert.equal(original.emissive.getHexString(), "000000");
      const duplicate = legs[1].clone();
      roots[1].add(duplicate);
      assert.equal(api.modelLightingSurfaceAt(roots[1], legs[1]), undefined);
    } finally {
      for (const scene of scenes) await scene.unmount();
    }
  });

  await test("a TV leg keeps its selected glow when on/off geometry changes", async () => {
    const settings = { ...light, emissiveSurfaces: ["surface:key:tv.leg.left.foot"] };
    const render = (visualState) =>
      React.createElement(
        ModelLightingSurface,
        { light: settings, state },
        React.createElement(TelevisionModel, { visualState, reducedMotion: true }),
      );
    const scene = await create(render("connected-inactive"));
    try {
      for (const visualState of ["connected-active", "connected-inactive"]) {
        await scene.update(render(visualState));
        const root = scene.scene.children[0].instance;
        const leg = part(root, "tv.leg.left.foot");
        assert.equal(api.modelLightingSurfaceAt(root, leg), settings.emissiveSurfaces[0]);
        assert.equal(leg.material.emissive.getHexString(), "ff0000");
      }
    } finally {
      await scene.unmount();
    }
  });

  await test("immutable GLBs retain ordinal and named selections through copied transforms", async () => {
    const preview = await api.openGlbPreview(
      testGlb({
        mutate: (json) => {
          json.materials[0].name = "Diffuser";
        },
      }),
    );
    try {
      const copy = preview.root.clone(true);
      copy.rotation.y = 0.7;
      copy.scale.setScalar(3);
      const mesh = copy.getObjectsByProperty("isMesh", true)[0];
      const original = mesh.material;
      assert.equal(api.modelLightingSurfaceAt(copy, mesh), "surface:0:0");
      for (const selections of [
        { emissiveSurfaces: ["surface:0:0"] },
        { emissiveMaterials: ["Diffuser"] },
      ]) {
        const control = api.controlModelLightMaterials(copy, selections);
        control.update(state, light.color);
        assert.notEqual(mesh.material, original);
        assert.equal(mesh.material.emissive.getHexString(), "ff0000");
        assert.equal(mesh.geometry, preview.root.getObjectsByProperty("isMesh", true)[0].geometry);
        control.dispose();
        assert.equal(mesh.material, original);
      }
    } finally {
      preview.release();
    }
  });

  const { FloorLampModel } = await load(
    "/packages/catalog/src/device/presets/lighting/floor-lamp.tsx",
  );
  const { CeilingSurfaces } = await load(
    "/packages/engine/src/architecture-scene/CeilingSurfaces.tsx",
  );
  const { ArchedBookcaseFrame } = await load(
    "/packages/catalog/src/furnishing/presets/living-room/arched-bookcase-frame.tsx",
  );
  const { TuftedDiamondRug } = await load(
    "/packages/catalog/src/furnishing/presets/living-room/tufted-diamond-rug.tsx",
  );
  const h = React.createElement;

  await test("light state renders preserve static geometry and identify the changing lamp parts", async () => {
    const footprint = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ];
    const floor = {
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1 },
      footprint,
      rooms: [{ id: "room", polygon: footprint }],
      defaultCeilingHeightMeters: 2.4,
    };
    const render = (on) =>
      h(
        React.Fragment,
        null,
        h(FloorLampModel, {
          visualState: on ? "connected-active" : "connected-inactive",
          state: {
            entityId: "light.fixture",
            state: on ? "on" : "off",
            attributes: {},
            available: true,
            stale: false,
          },
        }),
        h(CeilingSurfaces, { floor }),
        h(ArchedBookcaseFrame),
        h(TuftedDiamondRug),
      );
    const mounted = await create(render(false));
    const scene = mounted.scene.instance;
    let staticGeometry;
    try {
      for (const on of [false, true, false]) {
        await mounted.update(render(on));
        const nextGeometry = [
          ...scene.getObjectByName("floor-ceilings").children,
          scene.getObjectByName("double-arched-case"),
          ...scene.getObjectsByProperty("name", "raised-rug-diamond"),
        ].map((mesh) => mesh.geometry);
        assert.equal(nextGeometry.length, 8);
        if (staticGeometry)
          nextGeometry.forEach((geometry, index) => assert.equal(geometry, staticGeometry[index]));
        staticGeometry = nextGeometry;
        const emitter = scene.getObjectByName("floor-lamp-emitter");
        assert.equal(emitter.material.emissiveIntensity, on ? 0.65 : 0);
        assert.equal(emitter.userData.skipStaticBatch, true);
        const beacon = scene.getObjectByName(
          `device-state-connected-${on ? "active" : "inactive"}`,
        );
        const parts = beacon.getObjectsByProperty("isMesh", true);
        assert.equal(parts.length, on ? 2 : 1);
        assert.ok(parts.every((mesh) => mesh.userData.skipStaticBatch === true));
      }
    } finally {
      await mounted.unmount();
    }
  });
});
