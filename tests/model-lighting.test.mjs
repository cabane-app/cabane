import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { create } from "@react-three/test-renderer";
import { createRoot } from "react-dom/client";
import { BoxGeometry, Group, Mesh, MeshToonMaterial } from "three";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";
import { testGlb } from "./fixtures/personal-glb.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { ActiveSceneLightPool } = await load("/packages/engine/src/SceneLightPool.tsx");
  const { planSceneLights } = await load("/packages/engine/src/model-lighting/execution.ts");
  const { collectConstructContextualIssues } = await load(
    "/apps/web/src/editor-preview/construct/contextual-validation.ts",
  );
  const { EditorValidationPanel } = await load(
    "/apps/web/src/editor-workspace/EditorValidationPanel.tsx",
  );
  const { makeThreeFloorProject } = await load("/tests/fixtures/multiple-floors.ts");
  const { createCatalogItem } = await load(
    "/apps/web/src/editor-preview/furnish/placement/item-creation.ts",
  );
  const { duplicateSceneItem } = await load(
    "/apps/web/src/editor-preview/furnish/duplicate-item.ts",
  );
  const { lightingError, renormalizeLighting, withLightSources } = await load(
    "/apps/web/src/model-lighting/lighting-layout.ts",
  );
  const descriptor = {
    label: "Cabinet",
    category: "Storage",
    defaultRoomType: "living-room",
    defaultSize: [1, 1, 1],
    bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    outlineContact: false,
    complexity: { triangles: 12, visibleMeshes: 1 },
  };
  const native = {
    furnishingModels: { cabinet: { ...descriptor, component: () => null } },
    deviceModels: {
      tv: {
        ...descriptor,
        label: "TV",
        component: () => null,
        mountKind: "surface",
        supportedDomains: ["media_player"],
        interaction: { tapTolerancePixels: 8 },
      },
      lamp: {
        ...descriptor,
        label: "Lamp",
        component: () => null,
        mountKind: "surface",
        supportedDomains: ["light"],
        sceneLight: { position: [0, 0.8, 0], color: "#ffe3b4", maxIntensity: 2, distance: 5 },
        interaction: { tapTolerancePixels: 8 },
      },
    },
  };
  const light = {
    position: [-0.3, 0.7, 0],
    points: [[0.3, 0.7, 0]],
    color: "#ffc999",
    maxIntensity: 6,
    distance: 5,
  };
  const slot = (id, domain) => ({
    id,
    compatibleDomains: [domain],
    required: true,
    autoMap: "manual",
    deviceRole: "primary",
    presentation: { label: id, dashboardRole: "primary" },
  });
  const item = (id, modelId, kind = "furnishing") => ({
    id,
    modelId,
    kind,
    floorId: "ground",
    placement: { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
    size: [1, 1, 1],
    ...(kind === "device"
      ? { entitySlots: [slot(`${id}-primary`, modelId === "tv" ? "media_player" : "light")] }
      : {}),
  });
  const fixture = () => {
    const project = {
      ...makeThreeFloorProject(),
      sceneItems: [
        item("cabinet-a", "cabinet"),
        { ...item("cabinet-b", "cabinet"), floorId: "first" },
        item("tv", "tv", "device"),
        item("lamp", "lamp", "device"),
      ],
    };
    const profile = {
      schemaVersion: 1,
      homeId: project.home.id,
      roomAreaIds: {},
      entityIdsBySlotId: {
        "tv-primary": "media_player.synthetic",
        "lamp-primary": "light.synthetic",
      },
    };
    return {
      project,
      bindings: Object.fromEntries(
        ["https://one.invalid", "https://two.invalid"].map((origin) => [
          origin,
          {
            draft: structuredClone(profile),
            published: structuredClone(profile),
            manualRoomIds: [],
            manualSlotIds: Object.keys(profile.entityIdsBySlotId),
          },
        ]),
      ),
    };
  };
  const personalCabinet = (profile = "furniture") => {
    const modelId = "custom:00000000-0000-4000-8000-000000000001";
    return {
      ...fixture().project,
      customModels: [
        {
          id: modelId,
          name: "Display cabinet",
          profile,
          placement: "floor",
          asset: { sha256: "0".repeat(64), byteLength: 1 },
          complexity: descriptor.complexity,
          normalization: {
            rotation: [0, 0, 0],
            scale: 1,
            offset: [0, 0, 0],
            size: descriptor.defaultSize,
            bounds: descriptor.bounds,
          },
        },
      ],
      sceneItems: [item("display-cabinet", modelId, profile === "light" ? "device" : "furnishing")],
    };
  };
  const cabinetLighting = (samples = 4) => ({
    position: [0, 0, 0],
    color: light.color,
    maxIntensity: light.maxIntensity,
    distance: light.distance,
    sources: Array.from({ length: 4 }, (_, index) => ({
      kind: "strip",
      start: [-0.4, index / 4, 0],
      end: [0.4, index / 4, 0],
      samples,
    })),
  });
  test("a saved four-strip cabinet remains renderable after manifest composition", () => {
    for (const profile of ["furniture", "light"]) {
      const project = personalCabinet(profile);
      const modelId = project.customModels[0].id;
      for (const lighting of [
        cabinetLighting(),
        cabinetLighting(4294967296),
        { ...cabinetLighting(), illuminate: false },
        { ...cabinetLighting(), maxIntensity: 0 },
        { ...cabinetLighting(), distance: 0 },
        { ...cabinetLighting(), sources: [] },
        { ...light, strip: { end: [0.4, 0.7, 0], samples: 20 }, points: undefined },
      ]) {
        const edited = api.editModelLighting({ project, bindings: {} }, modelId, lighting, native);
        const parsed = api.parseHomeProjectSchema(JSON.parse(JSON.stringify(edited.project)));
        assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
        const manifest = api.composeHomeManifest(parsed.project, { ...native, openingModels: {} });
        const execution = api.modelLightingExecution(lighting);
        assert.equal(
          manifest.extensions.deviceModels[`lighting:${modelId}`].sceneLights.length,
          execution.lights.length,
        );
        if (
          lighting.sources?.[0]?.samples === 4 &&
          lighting.illuminate !== false &&
          lighting.maxIntensity > 0
        )
          assert.equal(execution.lights.length, 16);
        const validation = api.validateHomeManifest(manifest);
        assert.equal(validation.canRender, true, JSON.stringify(validation.issues));
        assert.equal(api.assertValidHomeManifest(manifest), manifest);
        assert.deepEqual(
          parsed.project.customModels[0].light,
          JSON.parse(JSON.stringify(lighting)),
        );
        const checked = api.validateHomeProject(parsed.project, native);
        assert.equal(checked.valid, true, JSON.stringify(checked.issues));
        const warnings = checked.issues.filter(
          (issue) => issue.code === "project.model-lighting-approximation",
        );
        assert.equal(warnings.length, execution.approximated ? 1 : 0);
        if (execution.approximated) {
          assert.equal(warnings[0].path, "sceneItems[0].modelId");
          assert.equal(warnings[0].severity, "warning");
          assert.match(warnings[0].message, /Display cabinet.*64 physical lights/);
        }
      }
    }
  });
  test("an existing dense cabinet reopens, publishes and can be repaired without rewriting saved samples", () =>
    withStorageDom(async (dom) => {
      const project = personalCabinet();
      const bytes = testGlb();
      const asset = {
        bytes,
        byteLength: bytes.byteLength,
        sha256: await api.modelAssetHash(bytes),
      };
      await api.stageModelAssets([asset]);
      project.customModels[0].asset = { sha256: asset.sha256, byteLength: asset.byteLength };
      const modelId = project.customModels[0].id;
      const configured = api.editModelLighting(
        { project, bindings: {} },
        modelId,
        cabinetLighting(4294967296),
        native,
      );
      const repository = api.createHomeProjectRepository(
        api.createIndexedDbProjectRecordStore(dom.indexedDB),
        native,
      );
      const lifecycle = api.createHomeProjectLifecycle(repository, configured.project);
      const opened = await lifecycle.load();
      assert.equal(opened.status, "ready");
      const published = await lifecycle.publish(opened.record, { confirmWarnings: true });
      assert.equal(published.status, "published");
      const reopened = await lifecycle.load();
      assert.equal(reopened.status, "ready");
      assert.deepEqual(
        reopened.record.published.customModels[0].light,
        cabinetLighting(4294967296),
      );
      const diagnostics = collectConstructContextualIssues({
        project: reopened.record.draft,
        floor: reopened.record.draft.floors[0],
        projectIssues: api.validateHomeProject(reopened.record.draft, native).issues,
      });
      const warning = diagnostics.find(
        (issue) => issue.code === "project.model-lighting-approximation",
      );
      assert.deepEqual(warning.target, { kind: "scene-item", id: "display-cabinet" });
      assert.match(warning.suggestion, /save.*Arrange.*Lighting/);
      assert.equal(
        api.validateHomeManifest(
          api.composeHomeManifest(reopened.record.published, { ...native, openingModels: {} }),
        ).canRender,
        true,
      );
      const repaired = api.editModelLighting(
        { project: reopened.record.draft, bindings: reopened.record.bindings },
        modelId,
        cabinetLighting(),
        native,
      );
      const saved = await lifecycle.autosave(reopened.record, repaired.project);
      assert.equal(saved.status, "saved");
      assert.equal(
        saved.record.draft.sceneItems[0].lightSlotId,
        configured.project.sceneItems[0].lightSlotId,
      );
      assert.deepEqual(saved.record.published, reopened.record.published);
      assert.equal(
        api
          .validateHomeProject(saved.record.draft, native)
          .issues.some((issue) => issue.code === "project.model-lighting-approximation"),
        false,
      );
    }));
  test("shared lighting settings retain all copies, device controls and per-copy connections", () => {
    const before = fixture();
    const next = api.editModelLighting(before, "cabinet", light, native);
    assert.equal(next.project.sceneItems[0].kind, "furnishing");
    assert.equal(next.project.sceneItems[1].kind, "furnishing");
    assert.deepEqual(
      next.project.sceneItems.map(({ lightSlotId, ...rest }) => rest),
      before.project.sceneItems,
    );
    const ids = next.project.sceneItems.slice(0, 2).map((item) => item.lightSlotId);
    assert.equal(new Set(ids).size, 2);
    assert.ok(ids.every(Boolean));
    assert.deepEqual(next.bindings, before.bindings);
    const tv = api.editModelLighting(next, "tv", light, native);
    assert.deepEqual(
      tv.project.sceneItems[2].entitySlots,
      before.project.sceneItems[2].entitySlots,
    );
    const manifest = api.composeHomeBindingManifest(tv.project, { ...native, openingModels: {} });
    const descriptors = api.collectBindingSlots(manifest);
    assert.ok(descriptors.some((slot) => slot.slotId === "tv-primary"));
    assert.equal(descriptors.filter((slot) => slot.slotId.endsWith("-entity")).length, 3);
    assert.ok(
      manifest.floors[0].rooms
        .flatMap((room) => room.devices)
        .some((device) => device.entitySlots[0].presentation.label === "TV lighting"),
    );
    const updated = api.editModelLighting(tv, "cabinet", { ...light, maxIntensity: 10 }, native);
    assert.deepEqual(updated.project.sceneItems, tv.project.sceneItems);
    const parsed = api.parseHomeProjectSchema(JSON.parse(JSON.stringify(updated.project)));
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
    assert.equal(api.validateHomeProject(updated.project, native).valid, true);
    assert.deepEqual(before.project.modelLights, undefined);
  });
  test("broken optional lighting keeps geometry and healthy illumination, with warnings in editor Issues", async () => {
    const configured = api.editModelLighting(fixture(), "cabinet", cabinetLighting(), native);
    const project = {
      ...configured.project,
      sceneItems: configured.project.sceneItems
        .filter((item) => item.floorId === "ground" && item.modelId !== "tv")
        .map((item) => ({ ...item, lightState: "always-on" })),
    };
    const original = api.composeHomeManifest(project, { ...native, openingModels: {} });
    const bad = original.extensions.deviceModels["lighting:cabinet"];
    bad.sceneLights = [{ ...bad.sceneLights[0], maxIntensity: NaN }];
    original.extensions.furnishingModels.cabinet.lighting = {
      ...cabinetLighting(),
      sources: [{ kind: "unknown" }],
    };
    const validation = api.validateHomeManifest(original);
    assert.equal(validation.canRender, true, JSON.stringify(validation.issues));
    assert.equal(validation.issues.length, 2);
    const recovered = validation.manifest;
    assert.equal(recovered.extensions.furnishingModels.cabinet.lighting, undefined);
    assert.equal(
      recovered.extensions.furnishingModels.cabinet.component,
      original.extensions.furnishingModels.cabinet.component,
    );
    assert.equal(original.extensions.deviceModels["lighting:cabinet"], bad);
    assert.ok(
      Number.isNaN(bad.sceneLights[0].maxIntensity),
      "runtime recovery never overwrites the source definition",
    );
    const renderer = await create(
      React.createElement(api.HomeAssistantSceneLighting, {
        floor: recovered.floors[0],
        resolvedBindings: { rooms: {} },
        deviceModels: native.deviceModels,
        extensionDeviceModels: recovered.extensions.deviceModels,
        sceneItems: project.sceneItems,
      }),
    );
    try {
      const lights = renderer.scene.findAllByType("PointLight");
      assert.equal(lights.length, 1, "the healthy lamp still illuminates the scene");
      assert.equal(lights[0].instance.intensity, 2);
    } finally {
      await renderer.unmount();
    }
    await withStorageDom(async (dom) => {
      const brokenNative = {
        ...native,
        furnishingModels: {
          ...native.furnishingModels,
          cabinet: {
            ...native.furnishingModels.cabinet,
            lighting: { ...cabinetLighting(), distance: -1 },
          },
        },
      };
      const draft = fixture().project;
      const checked = api.validateHomeProject(draft, brokenNative);
      assert.equal(checked.valid, true, JSON.stringify(checked.issues));
      const issues = collectConstructContextualIssues({
        project: draft,
        floor: draft.floors[0],
        projectIssues: checked.issues,
      });
      const warnings = issues.filter((issue) => issue.code === "project.model-lighting-disabled");
      assert.deepEqual(
        warnings.map(({ severity, floorId, target }) => ({ severity, floorId, target })),
        [
          {
            severity: "warning",
            floorId: "ground",
            target: { kind: "scene-item", id: "cabinet-a" },
          },
          {
            severity: "warning",
            floorId: "first",
            target: { kind: "scene-item", id: "cabinet-b" },
          },
        ],
      );
      const container = dom.document.createElement("div");
      dom.document.body.append(container);
      const root = createRoot(container);
      const selected = [];
      try {
        await React.act(async () =>
          root.render(
            React.createElement(EditorValidationPanel, {
              issues,
              expanded: true,
              onSelect: (issue) => selected.push(issue.target.id),
            }),
          ),
        );
        assert.ok(container.querySelector('[aria-label="Editor validation"]'));
        const row = [...container.querySelectorAll('li[data-severity="warning"]')].find((row) =>
          /Cabinet.*disabled/.test(row.textContent),
        );
        assert.ok(row);
        assert.match(row.textContent, /save with this warning.*Lighting/);
        await React.act(async () => row.querySelector('button[aria-label^="Select"]').click());
        assert.deepEqual(selected, ["cabinet-a"]);
      } finally {
        await React.act(async () => root.unmount());
      }
    });
  });
  test("removing lighting clears only its draft mappings and undo restores settings and stable identities", () => {
    const enabled = api.editModelLighting(fixture(), "cabinet", light, native);
    const id = api.lightingEntitySlotId(enabled.project.sceneItems[0].lightSlotId);
    for (const state of Object.values(enabled.bindings)) {
      state.draft.entityIdsBySlotId[id] = "light.cabinet";
      state.published.entityIdsBySlotId[id] = "light.cabinet";
      state.manualSlotIds.push(id);
    }
    const history = api.createWorkspaceHistory(enabled);
    const removed = api.editModelLighting(enabled, "cabinet", null, native);
    assert.ok(
      removed.project.sceneItems.every((item) => item.modelId !== "cabinet" || !item.lightSlotId),
    );
    for (const state of Object.values(removed.bindings)) {
      assert.equal(state.draft.entityIdsBySlotId[id], undefined);
      assert.equal(state.published.entityIdsBySlotId[id], "light.cabinet");
      assert.equal(state.draft.entityIdsBySlotId["tv-primary"], "media_player.synthetic");
    }
    assert.deepEqual(
      api.undoWorkspaceHistory(api.commitWorkspaceSnapshot(history, removed)).present,
      enabled,
    );
    assert.deepEqual(
      api.editModelLighting(removed, "cabinet", undefined, native).project.modelLights,
      undefined,
    );
  });
  test("native default reset preserves an existing primary light and never mutates shared registries", () => {
    const before = fixture();
    const original = native.deviceModels.lamp;
    const next = api.editModelLighting(
      before,
      "lamp",
      { ...light, emissiveSurfaces: ["surface:0:0"] },
      native,
    );
    assert.deepEqual(next.project.sceneItems, before.project.sceneItems);
    const resolved = api.resolveProjectModels(next.project, native);
    assert.equal(resolved.deviceModels.lamp.sceneLights.length, 2);
    assert.equal(native.deviceModels.lamp, original);
    assert.equal(original.lighting, undefined);
    assert.equal(
      api.resolveDeviceModelDefinition("lamp", native.deviceModels, resolved.deviceModels)
        .component,
      original.component,
    );
    assert.equal(
      api.resolveDeviceModelDefinition("lamp", native.deviceModels, resolved.deviceModels)
        .sceneLights.length,
      2,
    );
    const reset = api.editModelLighting(next, "lamp", undefined, native);
    assert.equal(reset.project.modelLights, undefined);
    assert.deepEqual(api.projectModelLighting(reset.project, "lamp", native), original.sceneLight);
    assert.deepEqual(reset.bindings, before.bindings);
  });
  test("placement and duplication create fresh unmapped lighting identities, with all IDs reserved", () => {
    const configured = api.editModelLighting(fixture(), "cabinet", light, native);
    const definitions = api.resolveProjectModels(configured.project, native);
    const entry = {
      key: "furnishing:cabinet",
      modelId: "cabinet",
      kind: "furnishing",
      definition: definitions.furnishingModels.cabinet,
    };
    const added = createCatalogItem(
      entry,
      configured.project.sceneItems[0].placement,
      configured.project.sceneItems,
      api.collectProjectIds(configured.project),
      "ground",
    );
    assert.equal(added.kind, "furnishing");
    assert.ok(added.lightSlotId);
    const copied = duplicateSceneItem(
      configured.project.sceneItems[0],
      configured.project.sceneItems,
      undefined,
      api.collectProjectIds(configured.project),
    );
    assert.notEqual(copied.lightSlotId, configured.project.sceneItems[0].lightSlotId);
    const ids = api.collectProjectIds({
      ...configured.project,
      sceneItems: [...configured.project.sceneItems, added, copied],
    });
    assert.equal(ids.length, new Set(ids).size);
  });
  test("lighting fields round-trip through real storage; failed writes leave the preceding saved record intact", () =>
    withStorageDom(async (dom) => {
      const before = fixture();
      const repository = api.createWorkspaceRepository(dom.indexedDB, native);
      const entry = await repository.create(api.createSeedProjectRecord(before.project), {
        name: "Lighting fixture",
      });
      const records = api.createHomeProjectRepository(
        api.createIndexedDbProjectRecordStore(dom.indexedDB),
        native,
      );
      const lifecycle = api.createHomeProjectLifecycle(records, entry.record.draft);
      const next = api.editModelLighting(
        { project: entry.record.draft, bindings: entry.record.bindings },
        "cabinet",
        withLightSources(light, [
          { kind: "point", position: [-0.2, 0.7, 0] },
          ...Array.from({ length: 4 }, (_, i) => ({
            kind: "strip",
            start: [-0.4, 0.2 + i * 0.2, 0],
            end: [0.4, 0.2 + i * 0.2, 0],
            samples: 12,
          })),
        ]),
        native,
      );
      const saved = await lifecycle.autosave(entry.record, next.project, undefined, next.bindings);
      assert.equal(saved.status, "saved", saved.error?.message);
      assert.equal(
        api.validateHomeManifest(
          api.composeHomeManifest(saved.record.draft, { ...native, openingModels: {} }),
        ).canRender,
        true,
      );
      assert.deepEqual(
        (await repository.read(entry.record.homeId)).record.draft.modelLights,
        next.project.modelLights,
      );
      const failStore = {
        async read() {
          return saved.record;
        },
        async write() {
          throw new Error("Synthetic disk full");
        },
      };
      const failedLifecycle = api.createHomeProjectLifecycle(
        api.createHomeProjectRepository(failStore, native),
        saved.record.draft,
      );
      const modified = api.editModelLighting(
        next,
        "cabinet",
        { ...light, maxIntensity: 11 },
        native,
      );
      const failed = await failedLifecycle.autosave(
        saved.record,
        modified.project,
        undefined,
        modified.bindings,
      );
      assert.equal(failed.status, "storage-error");
      assert.deepEqual(
        (await repository.read(entry.record.homeId)).record.draft.modelLights,
        next.project.modelLights,
      );
    }));
  test("native furnishing sources follow independent state, rotated nonuniform copies and retained off emitters", async () => {
    let snapshot = api.editModelLighting(fixture(), "cabinet", light, native);
    const object = {
      ...snapshot.project.sceneItems[0],
      size: [2, 3, 4],
      placement: {
        kind: "absolute",
        at: [2, 2],
        elevationMeters: 1,
        rotationYRadians: Math.PI / 2,
      },
    };
    snapshot = { ...snapshot, project: { ...snapshot.project, sceneItems: [object] } };
    const manifest = api.composeHomeBindingManifest(snapshot.project, {
      ...native,
      openingModels: {},
    });
    const floor = manifest.floors[0];
    const device = floor.rooms
      .flatMap((room) => room.devices)
      .find((device) => device.id === object.lightSlotId);
    const state = {
      entityId: "light.synthetic",
      state: "on",
      attributes: { brightness: 128, rgb_color: [0, 0, 255] },
      available: true,
      stale: false,
    };
    const resolved = {
      rooms: Object.fromEntries(
        floor.rooms.map((room) => [
          room.id,
          {
            room,
            displayName: room.name,
            pictureUrl: null,
            sections: { primary: [], secondary: [], diagnostic: [] },
            devices: room.devices.map((slot) => ({
              slot,
              entities: [
                {
                  slotId: slot.entitySlots[0].id,
                  domain: "light",
                  entityId: "light.synthetic",
                  state,
                },
              ],
              issues: [],
            })),
            issues: [],
          },
        ]),
      ),
      openings: {},
      issues: [],
    };
    assert.ok(device);
    const render = (resolvedBindings = resolved) =>
      React.createElement(api.HomeAssistantSceneLighting, {
        floor,
        resolvedBindings,
        deviceModels: native.deviceModels,
        extensionDeviceModels: manifest.extensions.deviceModels,
        sceneItems: [
          object,
          {
            ...object,
            id: "other-floor-copy",
            floorId: "first",
            lightSlotId: "other-floor-light",
            lightState: "always-on",
          },
        ],
      });
    const scene = await create(render());
    try {
      const emitters = scene.scene.findAllByType("PointLight").map((node) => node.instance);
      assert.equal(emitters.length, 2);
      assert.ok(Math.abs(emitters[0].position.y - 3.1) < 1e-6);
      assert.ok(
        Math.abs(
          emitters[0].position.z -
            (api.resolveItemTransform(object.placement, floor).position[2] + 0.6),
        ) < 1e-6,
      );
      assert.equal(emitters[0].intensity, (3 * 128) / 255);
      const off = structuredClone(resolved);
      for (const room of Object.values(off.rooms))
        for (const device of room.devices) device.entities[0].state.state = "off";
      await scene.update(render(off));
      assert.equal(scene.scene.findAllByType("PointLight").length, 2);
      assert.ok(
        scene.scene.findAllByType("PointLight").every((node) => node.instance.intensity === 0),
      );
    } finally {
      await scene.unmount();
    }
  });
  test("the light pool borrows off slots while retaining sources that stay on", async () => {
    const floor = { ...fixture().project.floors[0], rooms: [], walls: [], openings: [] };
    const source = (name, x, intensity = 1) => ({
      name,
      position: [x, 1, 0],
      color: "#ffffff",
      intensity,
      distance: 5,
    });
    const render = (sources) => React.createElement(ActiveSceneLightPool, { floor, sources });
    const scene = await create(render([source("a", 0), source("b", 1)]));
    try {
      const lights = () => scene.scene.findAllByType("PointLight").map((node) => node.instance);
      const [a, b] = lights();
      await scene.update(render([source("a", 0, 0), source("b", 1)]));
      assert.equal(
        lights().find((light) => light.name === "b"),
        b,
      );
      assert.equal(a.intensity, 0);
      await scene.update(render([source("c", 2), source("b", 1)]));
      assert.equal(lights().length, 2);
      assert.equal(
        lights().find((light) => light.name === "c"),
        a,
      );
      assert.equal(
        lights().find((light) => light.name === "b"),
        b,
      );
      assert.equal(a.position.x, 2);
      await scene.update(render([source("c", 2), source("a", 0), source("b", 1, 0)]));
      assert.deepEqual(
        lights()
          .map((light) => light.name)
          .sort(),
        ["a", "c"],
      );
      assert.equal(
        lights().find((light) => light.name === "a"),
        b,
      );
      assert.ok(lights().every((light) => light.intensity === 1));
    } finally {
      await scene.unmount();
    }
  });
  test("the bounded pool includes every active source, blends linear color and retains a safe peak layout", async () => {
    const floor = { ...fixture().project.floors[0], rooms: [], walls: [], openings: [] };
    const sources = Array.from({ length: 256 }, (_, i) => ({
      name: `copy-${i}`,
      position: [Math.floor(i / 2), 1, 0],
      color: i % 2 ? "#0000ff" : "#ff0000",
      intensity: i % 2 ? 3 : 1,
      distance: i % 2 ? 0 : 5,
    }));
    const execution = planSceneLights(sources);
    assert.equal(execution.lights.length, api.SCENE_LIGHT_BUDGET);
    assert.ok(
      execution.lights.every((source) => source.color === "#8900e1" && source.distance === 0),
    );
    assert.equal(
      execution.lights.reduce((sum, source) => sum + source.intensity, 0),
      512,
    );
    const render = (sources) => React.createElement(ActiveSceneLightPool, { floor, sources });
    const scene = await create(render(sources));
    const lights = () => scene.scene.findAllByType("PointLight").map((node) => node.instance);
    try {
      const peak = lights();
      assert.equal(peak.length, api.SCENE_LIGHT_BUDGET);
      await scene.update(render(sources.map((source) => ({ ...source, intensity: 0 }))));
      assert.deepEqual(lights(), peak);
      assert.ok(lights().every((source) => source.intensity === 0));
      await scene.update(render([sources[0]]));
      assert.deepEqual(lights(), peak);
      assert.equal(
        lights().reduce((sum, source) => sum + source.intensity, 0),
        1,
      );
    } finally {
      await scene.unmount();
    }
  });
  test("native off sources prewarm only spare budget and retain slots on their first activation", async () => {
    const floor = { ...fixture().project.floors[0], rooms: [], walls: [], openings: [] };
    const off = Array.from({ length: 256 }, (_, i) => ({
      name: `native-${i}`,
      position: [i, 1, 0],
      color: "#ffffff",
      intensity: 0,
      distance: 5,
      prewarm: true,
    }));
    assert.equal(planSceneLights(off).lights.length, api.SCENE_LIGHT_BUDGET);
    assert.equal(planSceneLights(off).requested, 0);
    const active = { ...off[0], name: "custom-on", intensity: 3, prewarm: false };
    const prioritized = planSceneLights([...off, active]);
    assert.equal(prioritized.lights.length, api.SCENE_LIGHT_BUDGET);
    assert.equal(prioritized.lights.find((source) => source.name === active.name).intensity, 3);
    const render = (sources) => React.createElement(ActiveSceneLightPool, { floor, sources });
    const scene = await create(render([off[0]]));
    try {
      const initial = scene.scene.findByProps({ name: off[0].name }).instance;
      assert.equal(initial.intensity, 0);
      await scene.update(render([{ ...off[0], intensity: 2 }]));
      assert.equal(scene.scene.findByProps({ name: off[0].name }).instance, initial);
      assert.equal(initial.intensity, 2);
    } finally {
      await scene.unmount();
    }
  });
  test("native surface glow is isolated between copies and preview highlights preserve shared geometry/materials", () => {
    const original = new MeshToonMaterial({ color: "#aabbcc" });
    const geometry = new BoxGeometry();
    const first = new Group();
    const a = new Mesh(geometry, original);
    a.name = "Diffuser";
    first.add(a);
    const second = first.clone();
    const b = second.children[0];
    const outline = new Mesh(geometry, original);
    outline.userData.sceneOutline = true;
    a.add(outline);
    const options = api.modelLightingSurfaces(first);
    assert.equal(options.length, 1);
    assert.equal(options[0].label, "Diffuser");
    assert.equal(api.modelLightingSurfaceAt(first, a), options[0].id);
    const control = api.controlModelLightMaterials(first, { emissiveSurfaces: [options[0].id] });
    control.update(
      {
        entityId: "light.test",
        state: "on",
        attributes: { brightness: 128 },
        available: true,
        stale: false,
      },
      "#ff0000",
    );
    assert.notEqual(a.material, original);
    assert.equal(b.material, original);
    assert.equal(a.geometry, geometry);
    assert.equal(a.material.emissiveIntensity, 128 / 255);
    assert.equal(a.material.emissive.getHexString(), "ff0000");
    control.dispose();
    control.dispose();
    assert.equal(a.material, original);
    geometry.dispose();
    original.dispose();
  });
  test("glow-only mode, invalid fields, unbounded sources and normalization corrections are explicit", () => {
    assert.ok(
      api
        .importedLightSources({ ...light, illuminate: false })
        .every((source) => source.maxIntensity === 0),
    );
    for (const fields of [
      { emissiveSurfaces: ["invalid"] },
      { illuminate: "yes" },
      { color: "invalid" },
    ])
      assert.equal(
        api.parseHomeProjectSchema({
          ...fixture().project,
          modelLights: { cabinet: { ...light, ...fields } },
        }).valid,
        false,
      );
    assert.match(lightingError({ ...light, position: [NaN, 0, 0] }), /finite/);
    const many = api.editModelLighting(
      fixture(),
      "cabinet",
      { ...light, points: Array(7).fill([0, 1, 0]) },
      native,
    );
    const repeated = Array.from({ length: 5 }, (_, i) => ({
      ...many.project.sceneItems[0],
      id: `many-${i}`,
      lightSlotId: `many-light-${i}`,
    }));
    const project = { ...many.project, sceneItems: repeated };
    assert.equal(api.modelLightingPointCount(project, "ground", native), 40);
    assert.equal(
      api
        .validateHomeProject(project, native)
        .issues.some((issue) => issue.code === "project.light-budget"),
      false,
    );
    for (const illuminate of [true, false])
      assert.equal(
        api.parseHomeProjectSchema({
          ...fixture().project,
          modelLights: {
            cabinet: { ...light, illuminate },
          },
        }).valid,
        true,
      );

    const previous = {
      rotation: [0, 0, 0],
      scale: 1,
      offset: [0, 0, 0],
      size: [1, 1, 1],
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
    };
    const corrected = renormalizeLighting(light, previous, {
      ...previous,
      scale: 2,
      rotation: [0, Math.PI / 2, 0],
      offset: [0, 1, 0],
    });
    assert.ok(Math.abs(corrected.position[1] - 2.4) < 1e-8);
    assert.ok(Math.abs(corrected.position[2] - 0.6) < 1e-8);
    assert.equal(corrected.distance, 10);
    const mixed = withLightSources(light, [
      { kind: "point", position: [1, 0, 0] },
      { kind: "strip", start: [1, 0, 0], end: [1, 1, 0], samples: 12 },
    ]);
    const normalized = renormalizeLighting(mixed, previous, {
      ...previous,
      scale: 2,
      offset: [0, 1, 0],
      rotation: [0, Math.PI / 2, 0],
    });
    assert.ok(Math.abs(normalized.sources[0].position[2] + 2) < 1e-8);
    assert.ok(Math.abs(normalized.sources[1].start[1] - 1) < 1e-8);
    assert.ok(Math.abs(normalized.sources[1].end[1] - 3) < 1e-8);
    assert.equal(normalized.sources[1].samples, 12);
  });
});
