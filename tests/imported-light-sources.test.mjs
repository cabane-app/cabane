import assert from "node:assert/strict";
import test from "node:test";
import React, { act, useState } from "react";
import { create } from "@react-three/test-renderer";
import { createRoot } from "react-dom/client";
import { Mesh, Texture, Vector3 } from "three";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";
import { testGlb } from "./fixtures/personal-glb.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { controlImportedLightMaterials } = await load(
    "/packages/engine/src/imported-models/light-materials.ts",
  );
  const { ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  const { personalScaleFixture } = await load("/tests/fixtures/personal-models-scale.ts");
  const { LightingFields } = await load("/apps/web/src/model-lighting/LightingFields.tsx");
  const light = { position: [-2, 0.2, 0], color: "#ffe3b4", maxIntensity: 6, distance: 5 };
  const state = (changes = {}) => ({
    entityId: "light.synthetic",
    state: "on",
    available: true,
    stale: false,
    attributes: { brightness: 128, rgb_color: [0, 0, 255] },
    ...changes,
  });

  test("legacy, multiple-point and strip light settings survive project and model-pack round trips", async () => {
    const preview = await api.openGlbPreview(testGlb());
    try {
      const base = personalScaleFixture().project.customModels[0];
      for (const settings of [
        light,
        {
          ...light,
          points: [
            [0, 0.2, 0],
            [2, 0.2, 0],
          ],
          emissiveMaterials: ["Diffuser"],
        },
        { ...light, strip: { end: [2, 0.2, 0], samples: 20 }, emissiveMaterials: ["Diffuser"] },
        { ...light, strip: { end: [2, 0.2, 0], samples: 4294967296 } },
        { ...light, points: Array.from({ length: 20 }, (_, i) => [i / 10, 0.2, 0]) },
        {
          ...light,
          illuminate: false,
          sources: [
            { kind: "point", position: [0, 0.2, 0] },
            ...Array.from({ length: 4 }, (_, i) => ({
              kind: "strip",
              start: [-1, i / 4, 0],
              end: [1, i / 4, 0],
              samples: 12,
            })),
          ],
        },
      ]) {
        const model = {
          ...base,
          light: settings,
          asset: { sha256: preview.asset.sha256, byteLength: preview.asset.byteLength },
        };
        const project = { ...structuredClone(ownerHomeProject), customModels: [model] };
        const parsed = api.parseHomeProjectSchema(JSON.parse(JSON.stringify(project)));
        assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
        assert.deepEqual(parsed.project.customModels[0].light, settings);
        const pack = api.createCabaneModelPack([model], [preview.asset]);
        const restored = await api.readCabaneModelPack(pack);
        assert.deepEqual(restored.models[0].light, settings);
      }
      for (const invalid of [
        { points: [[0, NaN, 0]] },
        { strip: { end: [2, 0, 0], samples: 1 } },
        { sources: [{ kind: "strip", start: [0, 0, 0], end: [0, 0, 0], samples: 2 }] },
        { sources: [{ kind: "strip", start: [0, 0, 0], end: [1, 0, 0], samples: 2.5 }] },
        { sources: [{ kind: "point", position: [0, 0, 0], extra: true }] },
        { sources: [{ kind: "area", position: [0, 0, 0] }] },
        { sources: [], points: [] },
        { strip: { end: [2, 0, 0], samples: 1.5 } },
        { strip: { end: light.position, samples: 5 } },
        { strip: { end: [2, 0, 0], samples: 5 }, points: [] },
        { emissiveMaterials: ["Diffuser", "Diffuser"] },
        { emissiveMaterials: [""] },
        { emissiveMaterials: Array.from({ length: 17 }, (_, i) => `Material ${i}`) },
        { maxIntensity: -1 },
        { distance: Infinity },
      ]) {
        const parsed = api.parseHomeProjectSchema({
          ...structuredClone(ownerHomeProject),
          customModels: [{ ...base, light: { ...light, ...invalid } }],
        });
        assert.equal(parsed.valid, false, JSON.stringify(invalid));
      }
    } finally {
      preview.release();
    }
  });

  test("strip samples span both endpoints and conserve total intensity", () => {
    for (const samples of [2, 5, 20]) {
      const sources = api.importedLightSources({ ...light, strip: { end: [2, 0.2, 0], samples } });
      assert.equal(sources.length, samples);
      assert.deepEqual(sources[0].position, light.position);
      assert.deepEqual(sources.at(-1).position, [2, 0.2, 0]);
      assert.ok(
        Math.abs(
          sources.reduce((sum, source) => sum + source.maxIntensity, 0) - light.maxIntensity,
        ) < 1e-8,
      );
    }
    const mixed = api.importedLightSources({
      ...light,
      sources: [
        { kind: "point", position: [0, 0, 0] },
        { kind: "strip", start: [-1, 1, 0], end: [1, 1, 0], samples: 4 },
        { kind: "strip", start: [-1, 2, 0], end: [1, 2, 0], samples: 12 },
      ],
    });
    assert.equal(mixed.length, 17);
    assert.equal(mixed[0].maxIntensity, 2);
    assert.ok(
      Math.abs(mixed.slice(1, 5).reduce((sum, source) => sum + source.maxIntensity, 0) - 2) < 1e-8,
    );
    assert.ok(Math.abs(mixed.reduce((sum, source) => sum + source.maxIntensity, 0) - 6) < 1e-8);
    assert.deepEqual(api.importedLightSources({ ...light, sources: [] }), []);
    assert.deepEqual(api.importedLightSources(light), [light]);
  });

  test("schema-valid excessive sample requests use bounded execution without rewriting intent", () => {
    for (const samples of [4294967296, Number.MAX_SAFE_INTEGER]) {
      for (const settings of [
        { ...light, strip: { end: [2, 0.2, 0], samples } },
        {
          ...light,
          sources: [{ kind: "strip", start: light.position, end: [2, 0.2, 0], samples }],
        },
      ]) {
        const original = structuredClone(settings);
        const emitters = api.importedLightSources(settings);
        assert.ok(emitters.length > 1 && emitters.length <= api.SCENE_LIGHT_BUDGET);
        assert.deepEqual(emitters[0].position, light.position);
        assert.deepEqual(emitters.at(-1).position, [2, 0.2, 0]);
        assert.ok(Math.abs(emitters.reduce((sum, s) => sum + s.maxIntensity, 0) - 6) < 1e-8);
        assert.deepEqual(settings, original);
      }
    }
  });

  test("the execution budget fairly samples strips, merges all logical contributions and skips glow-only work", () => {
    const settings = {
      ...light,
      sources: [
        { kind: "point", position: [0, 0, 0] },
        { kind: "strip", start: [-2, 1, 0], end: [2, 1, 0], samples: 4294967296 },
        { kind: "strip", start: [-2, 2, 0], end: [2, 2, 0], samples: Number.MAX_SAFE_INTEGER },
      ],
    };
    const execution = api.modelLightingExecution(settings);
    assert.equal(api.SCENE_LIGHT_BUDGET, 64);
    assert.equal(execution.lights.length, api.SCENE_LIGHT_BUDGET);
    assert.equal(execution.approximated, true);
    for (const y of [0, 1, 2])
      assert.ok(
        Math.abs(
          execution.lights
            .filter((s) => s.position[1] === y)
            .reduce((sum, s) => sum + s.intensity, 0) - 2,
        ) < 1e-8,
      );
    for (const y of [1, 2])
      for (const x of [-2, 2])
        assert.ok(execution.lights.some((s) => s.position[0] === x && s.position[1] === y));
    const many = {
      ...light,
      maxIntensity: 257,
      sources: Array.from({ length: 257 }, (_, i) => ({ kind: "point", position: [i, 1, 0] })),
    };
    const merged = api.modelLightingExecution(many);
    assert.equal(merged.lights.length, api.SCENE_LIGHT_BUDGET);
    assert.equal(merged.requested, 257);
    assert.ok(Math.abs(merged.lights.reduce((sum, s) => sum + s.intensity, 0) - 257) < 1e-8);
    assert.ok(
      Math.abs(
        merged.lights.reduce((sum, s) => sum + s.position[0] * s.intensity, 0) - (256 * 257) / 2,
      ) < 1e-8,
      "even sources beyond the budget contribute their energy and position",
    );
    assert.deepEqual(api.importedLightSources({ ...settings, illuminate: false }), []);
    assert.deepEqual(api.importedLightSources({ ...settings, maxIntensity: 0 }), []);
    assert.deepEqual(api.importedLightSources({ ...settings, sources: [] }), []);
    for (const samples of [0, -1, NaN, Infinity, 2.5]) {
      const emitters = api.importedLightSources({ ...light, strip: { end: [2, 0.2, 0], samples } });
      assert.equal(emitters.length, 2, "in-progress typed input cannot drive array sizes");
    }
  });

  test("runtime sources follow normalized placement, instance resize, shared HA state and local light modes", async () => {
    const fixture = personalScaleFixture();
    const model = {
      ...fixture.project.customModels[0],
      light: { ...light, strip: { end: [2, 0.2, 0], samples: 5 } },
    };
    const registries = api.resolveProjectModels(
      { customModels: [model] },
      { deviceModels: {}, furnishingModels: {} },
    );
    const original = fixture.project.sceneItems[0];
    const item = {
      ...original,
      size: original.size.map((n) => n * 2),
      placement: {
        kind: "absolute",
        at: [3, 4],
        elevationMeters: 1,
        rotationYRadians: Math.PI / 2,
      },
    };
    const roomId = fixture.manifest.floors[0].rooms[0].id;
    const resolved = {
      slot: { ...original, model: model.id, entitySlots: item.entitySlots },
      entities: [{ domain: "light", slotId: item.entitySlots[0].id, state: state() }],
    };
    const render = (current = item, snapshot = state(), enabled = true, count = 1) =>
      React.createElement(api.HomeAssistantSceneLighting, {
        floor: fixture.manifest.floors[0],
        deviceModels: registries.deviceModels,
        extensionDeviceModels: {},
        enabled,
        sceneItems: Array.from({ length: count }, (_, index) => ({
          ...current,
          id: index ? `extra-${index}` : item.id,
        })),
        resolvedBindings: {
          rooms: {
            [roomId]: {
              devices: [{ ...resolved, entities: [{ ...resolved.entities[0], state: snapshot }] }],
              sections: {},
            },
          },
        },
      });
    const renderer = await create(render());
    try {
      const lights = renderer.scene
        .findAll((node) => node.instance.isPointLight)
        .map((node) => node.instance);
      assert.equal(lights.length, 5);
      const transform = api.resolveItemTransform(item.placement, fixture.manifest.floors[0]);
      const expected = new Vector3(-4, 0.4, 0)
        .applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
        .add(new Vector3(...transform.position));
      assert.ok(lights[0].position.distanceTo(expected) < 1e-8);
      assert.equal(lights[0].distance, 10);
      assert.ok(
        Math.abs(lights.reduce((sum, source) => sum + source.intensity, 0) - (6 * 128) / 255) <
          1e-8,
      );
      assert.ok(lights.every((source) => source.color.b > source.color.r && !source.castShadow));
      for (const snapshot of [
        state({ state: "off" }),
        state({ available: false }),
        state({ stale: true }),
        undefined,
      ]) {
        await renderer.update(render(item, snapshot ?? state({ available: false })));
        const current = renderer.scene
          .findAll((node) => node.instance.isPointLight)
          .map((node) => node.instance);
        assert.deepEqual(current, lights);
        assert.ok(current.every((source) => source.intensity === 0));
      }
      await renderer.update(
        render({ ...item, lightState: "always-on" }, state({ available: false })),
      );
      assert.equal(
        lights.reduce((sum, source) => sum + source.intensity, 0),
        6,
      );
      const withManyOff = render(item, state(), true, 25);
      await renderer.update(
        React.cloneElement(withManyOff, {
          sceneItems: [...withManyOff.props.sceneItems].reverse(),
        }),
      );
      assert.equal(renderer.scene.findAll((node) => node.instance.isPointLight).length, 5);
      assert.ok(
        renderer.scene
          .findAll((node) => node.instance.isPointLight)
          .every((node) => node.instance.intensity > 0),
        "120 earlier off sources cannot crowd out the on light",
      );
      await renderer.update(render({ ...item, lightState: "always-on" }, state(), true, 25));
      assert.equal(
        renderer.scene.findAll((node) => node.instance.isPointLight).length,
        api.SCENE_LIGHT_BUDGET,
      );
      const pool = renderer.scene
        .findAll((node) => node.instance.isPointLight)
        .map((node) => node.instance);
      assert.ok(Math.abs(pool.reduce((sum, source) => sum + source.intensity, 0) - 150) < 1e-8);
      await renderer.update(render(item, state({ state: "off" }), true, 25));
      assert.deepEqual(
        renderer.scene.findAll((node) => node.instance.isPointLight).map((node) => node.instance),
        pool,
      );
      assert.ok(pool.every((source) => source.intensity === 0));
      await renderer.update(render({ ...item, lightState: "always-on" }, state(), true, 100));
      const crowded = renderer.scene
        .findAll((node) => node.instance.isPointLight)
        .map((node) => node.instance);
      assert.equal(
        crowded.length,
        api.SCENE_LIGHT_BUDGET,
        "copies share a floor budget before expanding strip samples",
      );
      assert.ok(Math.abs(crowded.reduce((sum, source) => sum + source.intensity, 0) - 600) < 1e-8);
      const withRoom = render({ ...item, lightState: "always-on" }, state(), true, 100);
      const roomBindings = withRoom.props.resolvedBindings.rooms[roomId];
      await renderer.update(
        React.cloneElement(withRoom, {
          resolvedBindings: {
            rooms: {
              [roomId]: {
                ...roomBindings,
                sections: {
                  lighting: [
                    {
                      slotId: "synthetic-room-budget",
                      domain: "light",
                      state: state({ attributes: {} }),
                    },
                  ],
                },
              },
            },
          },
        }),
      );
      const shared = renderer.scene
        .findAll((node) => node.instance.isPointLight)
        .map((node) => node.instance);
      assert.equal(
        shared.length,
        api.SCENE_LIGHT_BUDGET,
        "room lights and copies share the same physical budget",
      );
      assert.ok(Math.abs(shared.reduce((sum, source) => sum + source.intensity, 0) - 605) < 1e-8);
      await renderer.update(render(item, state(), false));
      assert.equal(renderer.scene.findAll((node) => node.instance.isPointLight).length, 0);
    } finally {
      await renderer.unmount();
    }
  });

  test("emissive materials are instance-owned, state-driven and disposed without touching shared maps or geometry", async () => {
    const resource = await api.openGlbPreview(
      testGlb({
        mutate: (json) => {
          json.materials[0].name = "Diffuser";
        },
      }),
    );
    try {
      assert.deepEqual(api.importedEmissiveMaterialNames(resource.root), ["Diffuser"]);
      const first = resource.root.clone(true),
        second = resource.root.clone(true);
      let meshA, meshB;
      first.traverse((object) => {
        if (object instanceof Mesh) meshA = object;
      });
      second.traverse((object) => {
        if (object instanceof Mesh) meshB = object;
      });
      const original = meshA.material,
        geometry = meshA.geometry;
      const map = new Texture();
      original.emissiveMap = map;
      let mapDisposals = 0,
        geometryDisposals = 0,
        originalDisposals = 0,
        cloneDisposals = 0;
      map.addEventListener("dispose", () => mapDisposals++);
      geometry.addEventListener("dispose", () => geometryDisposals++);
      original.addEventListener("dispose", () => originalDisposals++);
      const a = controlImportedLightMaterials(first, ["Diffuser"]),
        b = controlImportedLightMaterials(second, ["Diffuser"]);
      const clone = meshA.material;
      clone.addEventListener("dispose", () => cloneDisposals++);
      assert.notEqual(clone, meshB.material);
      assert.notEqual(clone, original);
      assert.equal(clone.emissiveMap, map);
      assert.equal(meshA.geometry, meshB.geometry);
      a.update(state(), light.color);
      b.update(state({ state: "off" }), light.color);
      assert.equal(clone.emissiveIntensity, 128 / 255);
      assert.equal(meshB.material.emissiveIntensity, 0);
      assert.ok(clone.emissive.b > clone.emissive.r);
      for (const snapshot of [undefined, state({ available: false }), state({ stale: true })]) {
        a.update(snapshot, light.color);
        assert.equal(clone.emissiveIntensity, 0);
      }
      a.dispose();
      a.dispose();
      assert.equal(meshA.material, original);
      assert.equal(cloneDisposals, 1);
      assert.deepEqual([mapDisposals, geometryDisposals, originalDisposals], [0, 0, 0]);
      b.dispose();
      original.emissiveMap = null;
      map.dispose();
      // Non-selected materials remain shared, including the untouched base colour.
      const untouched = controlImportedLightMaterials(first, ["Missing"]);
      assert.equal(meshA.material, original);
      untouched.dispose();
      const surface = await create(
        React.createElement(api.ImportedModelSurface, {
          root: second,
          light: { ...light, emissiveMaterials: ["Diffuser"] },
          state: state(),
        }),
      );
      const mountedMaterial = meshB.material;
      assert.equal(mountedMaterial.emissiveIntensity, 128 / 255);
      await surface.update(
        React.createElement(api.ImportedModelSurface, {
          root: second,
          light: { ...light, emissiveMaterials: ["Diffuser"] },
          state: state({ state: "off" }),
        }),
      );
      assert.equal(meshB.material.emissiveIntensity, 0);
      assert.equal(original.emissiveIntensity, 1);
      await surface.unmount();
      assert.equal(meshB.material, original);
    } finally {
      resource.release();
    }
  });

  test("source controls mix unlimited points and strips, preserve sample counts and nudge chosen endpoints", () =>
    withStorageDom(async (dom) => {
      let current, currentPicking;
      function Harness() {
        const [value, setValue] = useState({ ...light, emissiveSurfaces: ["surface:0:0"] });
        const [picking, setPicking] = useState(null);
        const [selected, onSelect] = useState({ index: 0 });
        const [step, onStep] = useState(0.01);
        current = value;
        currentPicking = picking;
        return React.createElement(LightingFields, {
          light: value,
          onChange: setValue,
          bounds: { min: [-2, 0, -0.1], max: [2, 0.4, 0.1] },
          selected,
          onSelect,
          step,
          onStep,
          picking,
          onPicking: setPicking,
          surfaces: [{ id: "surface:0:0", label: "Diffuser", supported: true }],
        });
      }
      await dom.mount(async () => {
        const root = createRoot(dom.document.body);
        root.render(React.createElement(Harness));
        return { unmount: () => root.unmount() };
      });
      for (let i = 0; i < 10; i++) await dom.click("Add point");
      assert.equal(dom.button("Add point").disabled, false);
      assert.equal(current.sources.length, 11);
      await act(async () => dom.document.querySelector('[aria-label="Remove point 2"]').click());
      assert.equal(current.sources.length, 10);
      await dom.click("Choose in preview");
      assert.equal(currentPicking, "surface");
      await dom.click("Choose in preview");
      assert.equal(currentPicking, null);
      assert.deepEqual(current.emissiveSurfaces, ["surface:0:0"]);
      await dom.click("Add LED strip");
      assert.equal(current.sources.length, 11);
      const strip = current.sources.at(-1);
      assert.equal(strip.samples, 7);
      await dom.click("End");
      await act(async () => dom.document.querySelector('[aria-label="Increase Y"]').click());
      assert.equal(current.sources.at(-1).end[1], Number((strip.end[1] + 0.01).toFixed(6)));
      assert.deepEqual(current.sources.at(-1).start, strip.start);
      assert.equal(current.sources.at(-1).samples, 7);
      await dom.click("Duplicate source");
      assert.equal(current.sources.length, 12);
      assert.equal(current.sources.at(-1).samples, 7);
      assert.deepEqual(current.emissiveSurfaces, ["surface:0:0"]);
      assert.equal(current.sources.filter((source) => source.kind === "point").length, 10);
      await act(async () => {
        const step = dom.document.querySelector('[aria-label="Movement step"]');
        step.value = "0.001";
        step.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      const start = current.sources.at(-1).start;
      await act(async () => dom.document.querySelector('[aria-label="Decrease X"]').click());
      assert.equal(current.sources.at(-1).start[0], Number((start[0] - 0.001).toFixed(6)));
      await act(async () => {
        const input = dom.document.querySelector('[aria-label="Strip sample count"]');
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
          input,
          "12",
        );
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      await dom.click("Fit along model");
      assert.equal(
        current.sources.at(-1).samples,
        12,
        "fitting does not overwrite the chosen count",
      );
      await act(async () => {
        const input = dom.document.querySelector('[aria-label="Strip sample count"]');
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
          input,
          "4294967296",
        );
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      assert.equal(current.sources.at(-1).samples, 4294967296);
      assert.match(
        dom.document.querySelector('[role="status"]').textContent,
        /Preview approximates.*64 physical lights/,
      );
      assert.equal(api.importedLightSources(current).length, api.SCENE_LIGHT_BUDGET);
    }));
});
