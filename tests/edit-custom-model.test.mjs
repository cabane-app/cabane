import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";
import { testGlb } from "./fixtures/personal-glb.mjs";

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { editCustomModel } = api;
  const { ModelImportDialog } = await load("/apps/web/src/custom-models/ModelImportDialog.tsx");
  const { CustomModelLibrary } = await load("/apps/web/src/custom-models/CustomModelLibrary.tsx");
  const { makeThreeFloorProject } = await load("/tests/fixtures/multiple-floors.ts");
  const bytes = testGlb();
  const asset = { bytes, byteLength: bytes.length, sha256: await api.modelAssetHash(bytes) };
  const decoded = await api.loadGlb(bytes);
  const native = { furnishingModels: {}, deviceModels: {} };
  const model = {
    id: "custom:11111111-2222-4333-8444-555555555555",
    name: "Fixture lamp",
    profile: "light",
    placement: "floor",
    asset: { sha256: asset.sha256, byteLength: asset.byteLength },
    normalization: api.normalizeGlb(decoded.root, "floor"),
    complexity: decoded.complexity,
    light: { position: [0, 0.3, 0], color: "#ffe3b4", maxIntensity: 2, distance: 5 },
  };
  const fixture = () => {
    const project = { ...makeThreeFloorProject(), customModels: [model] };
    project.sceneItems = project.floors.map((floor, i) => ({
      id: `copy-${i}`,
      floorId: floor.id,
      modelId: model.id,
      kind: "device",
      size: model.normalization.size.map((n) => n * (i + 1)),
      placement: { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0.4 },
      lightState: "always-on",
      entitySlots: [
        {
          id: `slot-${i}`,
          compatibleDomains: ["light"],
          required: true,
          autoMap: "manual",
          deviceRole: "primary",
          presentation: { label: "Fixture", dashboardRole: "primary" },
        },
      ],
    }));
    const profile = {
      schemaVersion: 1,
      homeId: project.home.id,
      roomAreaIds: Object.fromEntries(
        project.floors.flatMap((floor) =>
          floor.rooms.map((room) => [room.id, `fixture-${room.id}`]),
        ),
      ),
      entityIdsBySlotId: Object.fromEntries(
        project.sceneItems.map((item, i) => [`slot-${i}`, `light.fixture_${i}`]),
      ),
    };
    return {
      project,
      bindings: Object.fromEntries(
        ["https://fixture.invalid", "https://other.invalid"].map((origin) => [
          origin,
          {
            draft: structuredClone(profile),
            published: structuredClone(profile),
            manualRoomIds: [],
            manualSlotIds: ["slot-0", "slot-1", "slot-2"],
          },
        ]),
      ),
    };
  };

  test("light edits preserve identity, exact copy transforms/sizes and mappings on every floor", () => {
    const before = fixture();
    const changed = {
      ...model,
      name: "Updated",
      light: { position: [0.1, 0.2, 0.3], color: "#abcdef", maxIntensity: 4, distance: 7 },
    };
    const next = editCustomModel(before, changed);
    assert.deepEqual(next.project.customModels, [changed]);
    assert.equal(next.project.customModels[0].asset, model.asset);
    assert.deepEqual(next.project.sceneItems, before.project.sceneItems);
    assert.equal(next.bindings, before.bindings);
    assert.deepEqual(before.project.customModels, [model]);
    const definition = api.resolveProjectModels(next.project, native).deviceModels[model.id];
    assert.deepEqual(definition.sceneLight, changed.light);
    assert.deepEqual(api.validateHomeProject(next.project, native).issues, []);
  });

  test("normalization corrections resize all copies by their own multiplier without remounting", () => {
    const before = fixture();
    before.project.sceneItems[1].placement = {
      kind: "wall",
      wallId: before.project.floors[1].walls[0].id,
      face: "right",
      offsetFromWallStartPlanUnits: 2,
      elevationMeters: 1.3,
      depthOffsetMeters: 0.02,
      rotationOffsetRadians: 0.2,
    };
    before.project.sceneItems[2].placement = {
      kind: "ceiling",
      roomId: before.project.floors[2].rooms[0].id,
      at: [2, 2],
      dropMeters: 0.2,
      rotationYRadians: 0.7,
    };
    const normalization = api.normalizeGlb(decoded.root, "ceiling", [0, Math.PI / 2, 0], 1.2);
    const next = editCustomModel(before, { ...model, placement: "ceiling", normalization });
    next.project.sceneItems.forEach((item, i) => {
      item.size.forEach((n, axis) =>
        assert.ok(Math.abs(n - normalization.size[axis] * (i + 1)) < 1e-10),
      );
      assert.deepEqual(item.placement, before.project.sceneItems[i].placement);
      assert.equal(item.floorId, before.project.sceneItems[i].floorId);
      assert.deepEqual(item.entitySlots, before.project.sceneItems[i].entitySlots);
    });
    const validation = api.validateHomeProject(next.project, native);
    assert.equal(validation.valid, true, JSON.stringify(validation.issues));
    assert.deepEqual(
      validation.issues.map(({ code, path, severity }) => ({ code, path, severity })),
      [
        {
          code: "project.item-elevation",
          path: "sceneItems[0].placement.elevationMeters",
          severity: "warning",
        },
      ],
    );
  });

  for (const profile of ["sensor", "furniture"])
    test(`changing Light to ${profile} clears only draft connections, with atomic history`, () => {
      const before = fixture();
      const { light: _light, ...base } = model;
      const next = editCustomModel(before, { ...base, profile });
      for (const state of Object.values(next.bindings)) {
        assert.deepEqual(state.draft.entityIdsBySlotId, {});
        assert.deepEqual(state.manualSlotIds, []);
        assert.deepEqual(state.published, Object.values(before.bindings)[0].published);
      }
      for (const item of next.project.sceneItems) {
        assert.equal(item.kind, profile === "furniture" ? "furnishing" : "device");
        assert.equal("lightState" in item, false);
        if (profile === "sensor") {
          assert.deepEqual(item.entitySlots[0].compatibleDomains, ["sensor"]);
          assert.ok(!item.entitySlots[0].id.startsWith("slot-"));
        } else assert.equal("entitySlots" in item, false);
      }
      assert.deepEqual(api.validateHomeProject(next.project, native).issues, []);
      const history = api.commitWorkspaceSnapshot(api.createWorkspaceHistory(before), next);
      const undo = api.undoWorkspaceHistory(history);
      assert.deepEqual(undo.present, before);
      assert.deepEqual(api.redoWorkspaceHistory(undo).present, next);
    });

  test("profile conversions retain independent readings and mappings while replacing only primary controls", () => {
    const before = fixture();
    const readings = before.project.sceneItems.map((item, index) => {
      const slot = {
        id: `reading-${index}`,
        compatibleDomains: ["sensor"],
        required: false,
        autoMap: "manual",
        deviceRole: "secondary",
        presentation: {
          label: `Temperature ${index}`,
          dashboardRole: "secondary",
          showInScene: true,
        },
      };
      item.entitySlots.push(slot);
      for (const state of Object.values(before.bindings)) {
        state.draft.entityIdsBySlotId[slot.id] = `sensor.fixture_${index}`;
        state.published.entityIdsBySlotId[slot.id] = `sensor.fixture_${index}`;
        state.manualSlotIds.push(slot.id);
      }
      return slot;
    });
    const { light: _light, ...base } = model;
    const furniture = editCustomModel(before, { ...base, profile: "furniture" });
    const sensor = editCustomModel(before, { ...base, profile: "sensor" });
    const deviceAgain = editCustomModel(furniture, model);
    for (const next of [furniture, sensor, deviceAgain]) {
      next.project.sceneItems.forEach((item, index) => {
        assert.deepEqual((item.entitySlots ?? []).filter(api.isAuxiliaryEntitySlot), [
          readings[index],
        ]);
      });
      for (const [origin, state] of Object.entries(next.bindings)) {
        assert.deepEqual(
          state.draft.entityIdsBySlotId,
          Object.fromEntries(readings.map((slot, index) => [slot.id, `sensor.fixture_${index}`])),
        );
        assert.deepEqual(
          state.manualSlotIds,
          readings.map((slot) => slot.id),
        );
        assert.deepEqual(state.published, before.bindings[origin].published);
      }
      assert.deepEqual(api.validateHomeProject(next.project, native).issues, []);
      const history = api.commitWorkspaceSnapshot(api.createWorkspaceHistory(before), next);
      assert.deepEqual(api.undoWorkspaceHistory(history).present, before);
      assert.deepEqual(api.redoWorkspaceHistory(api.undoWorkspaceHistory(history)).present, next);
    }
    const ids = deviceAgain.project.sceneItems.flatMap((item) =>
      item.entitySlots.map((slot) => slot.id),
    );
    assert.equal(new Set(ids).size, ids.length);
  });

  test("furniture to device gives each copy a unique unmapped primary slot and preserves other models", () => {
    const source = editCustomModel(
      fixture(),
      (({ light: _light, ...model }) => ({ ...model, profile: "furniture" }))(model),
    );
    const unrelated = {
      ...source.project.sceneItems[0],
      id: "other-copy",
      modelId: "missing-fixture",
    };
    source.project.sceneItems.push(unrelated);
    const next = editCustomModel(source, model);
    const slots = next.project.sceneItems.slice(0, 3).map((item) => item.entitySlots[0]);
    assert.equal(new Set(slots.map((slot) => slot.id)).size, 3);
    assert.ok(slots.every((slot) => slot.autoMap === "manual" && slot.deviceRole === "primary"));
    assert.equal(next.project.sceneItems.at(-1), unrelated);
    assert.throws(
      () =>
        editCustomModel(source, { ...model, asset: { ...model.asset, sha256: "a".repeat(64) } }),
      /cannot replace/,
    );
    const added = { ...model, id: "custom:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" };
    assert.equal(editCustomModel(source, added).project.customModels.length, 2);
  });

  test("edited definitions and copies reload from real IndexedDB without duplicating GLB assets", () =>
    withStorageDom(async (dom) => {
      const before = fixture();
      await api.stageModelAssets([asset]);
      const repository = api.createWorkspaceRepository(dom.indexedDB, native);
      const seed = api.createSeedProjectRecord(before.project);
      seed.bindings = before.bindings;
      const entry = await repository.create(seed, {
        name: "Edit fixture",
      });
      const record = entry.record;
      const next = editCustomModel(
        { project: record.draft, bindings: record.bindings },
        {
          ...model,
          name: "Edited lamp",
          normalization: api.normalizeGlb(decoded.root, "floor", [0, 0, 0], 0.8),
        },
      );
      const records = api.createHomeProjectRepository(
        api.createIndexedDbProjectRecordStore(dom.indexedDB),
        native,
      );
      const lifecycle = api.createHomeProjectLifecycle(records, record.draft);
      const saved = await lifecycle.autosave(record, next.project, undefined, next.bindings);
      assert.equal(saved.status, "saved", saved.error?.message);
      assert.equal(saved.record.draft.customModels[0].id, model.id);
      const loaded = await repository.read(record.homeId);
      assert.deepEqual(
        loaded.record.draft.customModels,
        JSON.parse(JSON.stringify(next.project.customModels)),
      );
      assert.deepEqual(loaded.record.draft.sceneItems, next.project.sceneItems);
      const { light: _light, ...base } = saved.record.draft.customModels[0];
      const converted = editCustomModel(
        { project: saved.record.draft, bindings: saved.record.bindings },
        { ...base, profile: "sensor" },
      );
      const convertedSave = await lifecycle.autosave(
        saved.record,
        converted.project,
        undefined,
        converted.bindings,
      );
      assert.equal(convertedSave.status, "saved", convertedSave.error?.message);
      const convertedRecord = (await repository.read(record.homeId)).record;
      assert.equal(convertedRecord.draft.customModels[0].profile, "sensor");
      assert.equal(convertedRecord.published.customModels[0].profile, "light");
      for (const [origin, state] of Object.entries(convertedRecord.bindings)) {
        assert.deepEqual(state.draft.entityIdsBySlotId, {});
        assert.deepEqual(state.published, saved.record.bindings[origin].published);
      }
      assert.equal(
        (await api.createModelAssetRepository(dom.indexedDB).verify([model.asset])).length,
        1,
      );
    }));

  test("definition updates add and remove lighting on existing furniture copies", () => {
    const { light, ...base } = model;
    const furniture = { ...base, profile: "furniture" };
    const unlit = editCustomModel(fixture(), furniture);
    const lit = editCustomModel(unlit, { ...furniture, light });
    assert.ok(lit.project.sceneItems.every((item) => item.lightSlotId));
    const removed = editCustomModel(lit, furniture);
    assert.ok(removed.project.sceneItems.every((item) => !item.lightSlotId));
    for (const snapshot of [lit, removed])
      assert.deepEqual(api.validateHomeProject(snapshot.project, native).issues, []);
  });

  test("restoring or replacing missing definitions preserves compatible slots and saved sizes", () => {
    const before = fixture();
    before.project.customModels = [];
    const restored = editCustomModel(before, model);
    assert.deepEqual(restored.project.sceneItems, before.project.sceneItems);
    assert.deepEqual(restored.bindings, before.bindings);
    const replacement = { ...model, id: "custom:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" };
    const replaced = editCustomModel(before, replacement, { modelId: model.id, kind: "device" });
    assert.deepEqual(
      replaced.project.sceneItems,
      before.project.sceneItems.map((item) => ({ ...item, modelId: replacement.id })),
    );
    assert.deepEqual(replaced.bindings, before.bindings);
    assert.deepEqual(api.validateHomeProject(replaced.project, native).issues, []);
  });

  test("same-asset model-pack profile updates reconcile placed copies through the library", () =>
    withStorageDom(async (dom) => {
      const before = fixture();
      const { light: _light, ...base } = model;
      const changed = { ...base, profile: "sensor" };
      const bytes = api.createCabaneModelPack([changed], [asset]);
      let committed,
        commits = 0;
      await dom.mount(async () => {
        const container = dom.document.createElement("div");
        dom.document.body.append(container);
        const root = createRoot(container);
        root.render(
          React.createElement(CustomModelLibrary, {
            workspace: {
              snapshot: before,
              modelAssetReferences: [model.asset],
              commit: (next) => {
                committed = next;
                commits++;
              },
              flush: async () => ({ status: "saved" }),
            },
            disabled: false,
            onBrowse: () => {},
            editingModel: null,
            onCloseEditor: () => {},
            onEditSnapshot: () => {},
          }),
        );
        return { unmount: () => root.unmount() };
      });
      const input = dom.document.querySelector('input[accept^=".zip"]');
      Object.defineProperty(input, "files", {
        value: [{ name: "fixture.zip", size: bytes.length, arrayBuffer: async () => bytes.buffer }],
      });
      await React.act(async () =>
        input.dispatchEvent(new dom.window.Event("change", { bubbles: true })),
      );
      await dom.click("Import pack");
      await dom.until(() => committed);
      assert.equal(commits, 1);
      assert.deepEqual(api.validateHomeProject(committed.project, native).issues, []);
      assert.deepEqual(committed.bindings, editCustomModel(before, changed).bindings);
      assert.deepEqual(
        await api.createModelAssetRepository(dom.indexedDB).read(asset.sha256),
        asset.bytes,
      );
    }));

  test("missing stored assets leave the model unchanged, block Save, and allow cancellation", () =>
    withStorageDom(async (dom) => {
      dom.window.HTMLElement.prototype.attachEvent = () => {};
      dom.window.HTMLElement.prototype.detachEvent = () => {};
      let imports = 0;
      const opener = dom.document.createElement("button");
      dom.document.body.append(opener);
      opener.focus();
      await dom.mount(async () => {
        const container = dom.document.createElement("div");
        dom.document.body.append(container);
        const root = createRoot(container);
        root.render(
          React.createElement(ModelImportDialog, {
            existingModel: { ...model, asset: { ...model.asset, sha256: "f".repeat(64) } },
            missingModelOptions: [],
            onImport: async () => {
              imports++;
            },
            onCancel: () => root.render(null),
          }),
        );
        return { unmount: () => root.unmount() };
      });
      await dom.until(() => dom.document.querySelector('[role="alert"]'));
      assert.equal(dom.button("Save changes").disabled, true);
      assert.equal(dom.document.querySelector("input").value, model.name);
      await dom.click("Cancel");
      assert.equal(dom.document.querySelector("dialog"), null);
      assert.equal(dom.document.activeElement, opener);
      assert.equal(imports, 0);
    }));
});
