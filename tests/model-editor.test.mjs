import assert from "node:assert/strict";
import test from "node:test";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from "three";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";
import { testGlb } from "./fixtures/personal-glb.mjs";

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { ProjectModelEditor } = await load("/apps/web/src/model-editor/ProjectModelEditor.tsx");
  const { ModelImportDialog } = await load("/apps/web/src/custom-models/ModelImportDialog.tsx");
  const { ModelVisual } = await load(
    "/apps/web/src/editor-preview/furnish/catalog/ModelVisual.tsx",
  );
  const { saveModelEditor } = await load("/apps/web/src/model-editor/save-model-editor.ts");
  const { useEditorWorkspace } = await load("/apps/web/src/editor-preview/useEditorWorkspace.ts");
  const { makeThreeFloorProject } = await load("/tests/fixtures/multiple-floors.ts");
  const bytes = testGlb();
  const asset = { bytes, sha256: await api.modelAssetHash(bytes), byteLength: bytes.length };
  const preview = await api.openGlbPreview(bytes);
  const model = {
    id: "custom:11111111-2222-4333-8444-555555555555",
    name: "Personal cabinet",
    profile: "furniture",
    placement: "floor",
    asset: { sha256: asset.sha256, byteLength: asset.byteLength },
    normalization: api.normalizeGlb(preview.root, "floor"),
    complexity: preview.complexity,
  };
  preview.release();
  const light = { position: [0, 0.3, 0.2], color: "#ffe3b4", maxIntensity: 2, distance: 5 };
  const native = { furnishingModels: {}, deviceModels: {} };
  const fixture = () => ({
    ...makeThreeFloorProject(),
    customModels: [structuredClone(model)],
    sceneItems: [
      {
        id: "copy",
        kind: "furnishing",
        modelId: model.id,
        floorId: "ground",
        size: model.normalization.size,
        placement: { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
      },
    ],
  });

  const withEditorDom = async (run) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "screen");
    try {
      return await withStorageDom(async (dom) => {
        Object.defineProperty(globalThis, "screen", {
          configurable: true,
          value: dom.window.screen,
        });
        return run(dom);
      });
    } finally {
      if (previous) Object.defineProperty(globalThis, "screen", previous);
      else delete globalThis.screen;
    }
  };

  async function mount(dom, Component) {
    dom.window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    dom.window.HTMLElement.prototype.attachEvent = () => {};
    dom.window.HTMLElement.prototype.detachEvent = () => {};
    dom.window.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    dom.document.body.innerHTML = '<button id="opener">Edit model</button><div id="root"></div>';
    dom.document.querySelector("#opener").focus();
    return dom.mount(async () => {
      const root = createRoot(dom.document.querySelector("#root"));
      root.render(React.createElement(Component));
      return { unmount: () => root.unmount() };
    });
  }
  const submit = async (dom) =>
    act(async () =>
      dom.document
        .querySelector("form")
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    );
  const tab = (dom, name) =>
    [...dom.document.querySelectorAll('[role="tab"]')].find((node) => node.textContent === name);

  test("lighting preview state stays separate from unrelated primary device visuals", () =>
    withEditorDom(async (dom) => {
      const seen = {};
      const entry = (domain) => ({
        key: domain,
        modelId: domain,
        kind: "device",
        definition: {
          supportedDomains: [domain],
          component: (props) => {
            seen[domain] = props;
            return null;
          },
        },
      });
      const off = {
        entityId: "light.preview",
        state: "off",
        attributes: { brightness: 0 },
        available: true,
        stale: false,
      };
      await mount(dom, () =>
        React.createElement(
          api.ModelLightingStateContext.Provider,
          { value: { state: off } },
          React.createElement(ModelVisual, { entry: entry("media_player"), previewOn: true }),
          React.createElement(ModelVisual, { entry: entry("light"), previewOn: true }),
        ),
      );
      assert.equal(seen.media_player.state.state, "on");
      assert.deepEqual(seen.media_player.state.attributes, {});
      assert.equal(seen.light.state, off);
      assert.equal(seen.light.visualState, "connected-inactive");
    }));

  test("preview materials retain identity through source edits, glow selection and hover without disposing shared assets", () => {
    const geometry = new BoxGeometry();
    const texture = new Texture();
    const material = new MeshStandardMaterial({
      map: texture,
      emissive: "#123456",
      emissiveIntensity: 0.2,
    });
    const root = new Group();
    const first = new Mesh(geometry, material),
      second = new Mesh(geometry, material);
    root.add(first, second);
    const sibling = root.clone();
    const options = api.modelLightingSurfaces(root);
    let sharedDisposals = 0,
      ownedDisposals = 0;
    for (const resource of [geometry, texture, material])
      resource.addEventListener("dispose", () => sharedDisposals++);
    const owner = api.controlPreviewLightMaterials(root);
    const owned = first.material;
    const other = second.material;
    owned.addEventListener("dispose", () => ownedDisposals++);
    const on = {
      entityId: "light.preview",
      state: "on",
      attributes: { brightness: 128 },
      available: true,
      stale: false,
    };
    const selected = { ...light, emissiveSurfaces: [options[0].id] };
    for (let index = 0; index < 5; index++) {
      owner.update({ ...selected, maxIntensity: index }, on);
      assert.equal(first.material, owned);
      assert.equal(second.material, other);
      assert.ok(Math.abs(owned.emissiveIntensity - 128 / 255) < 1e-9);
      assert.equal(other.emissiveIntensity, 0.2);
      owner.update(selected, on, options[1].id);
      assert.equal(second.material, other);
      assert.equal(other.emissiveIntensity, 1.3);
      owner.update(null, on);
      assert.equal(owned.emissiveIntensity, 0.2);
      assert.ok(owned.emissive.equals(material.emissive));
    }
    assert.equal(sharedDisposals, 0);
    assert.equal(ownedDisposals, 0);
    assert.equal(sibling.children[0].material, material);
    assert.equal(first.geometry, sibling.children[0].geometry);
    assert.equal(owned.map, texture);
    owner.dispose();
    owner.dispose();
    assert.equal(first.material, material);
    assert.equal(second.material, material);
    assert.equal(ownedDisposals, 1);
    assert.equal(sharedDisposals, 0);
    geometry.dispose();
    material.dispose();
    texture.dispose();
  });

  test("combined personal model and lighting save is one undoable history edit with immutable assets", () =>
    withEditorDom(async (dom) => {
      await api.stageModelAssets([asset]);
      const repository = api.createWorkspaceRepository(dom.indexedDB, native);
      const entry = await repository.create(api.createSeedProjectRecord(fixture()), {
        name: "Model edit",
      });
      const records = api.createHomeProjectRepository(
        api.createIndexedDbProjectRecordStore(dom.indexedDB),
        native,
      );
      const lifecycle = api.createHomeProjectLifecycle(records, entry.record.draft);
      let workspace;
      await mount(dom, () => {
        workspace = useEditorWorkspace({ initialRecord: entry.record, lifecycle });
        return null;
      });
      await dom.until(() => workspace.snapshot.references !== undefined);
      const before = structuredClone(workspace.snapshot);
      const changed = {
        ...model,
        name: "Edited cabinet",
        light,
        normalization: {
          ...model.normalization,
          scale: 2,
          size: model.normalization.size.map((n) => n * 2),
          bounds: {
            min: model.normalization.bounds.min.map((n) => n * 2),
            max: model.normalization.bounds.max.map((n) => n * 2),
          },
          offset: model.normalization.offset.map((n) => n * 2),
        },
      };
      await act(async () =>
        saveModelEditor(workspace, { kind: "personal", model: changed }, native),
      );
      assert.equal(workspace.snapshot.project.customModels[0].name, changed.name);
      assert.deepEqual(workspace.snapshot.project.customModels[0].light, light);
      assert.deepEqual(workspace.snapshot.project.sceneItems[0].size, changed.normalization.size);
      assert.ok(workspace.snapshot.project.sceneItems[0].lightSlotId);
      assert.deepEqual(
        workspace.record.published,
        JSON.parse(JSON.stringify(entry.record.published)),
      );
      assert.equal(
        (await api.createModelAssetRepository(dom.indexedDB).verify([model.asset])).length,
        1,
      );
      await act(async () => workspace.undo());
      assert.deepEqual(workspace.snapshot, before);
      assert.equal(workspace.canUndo, false);
      await act(async () => workspace.redo());
      assert.equal(workspace.snapshot.project.customModels[0].name, changed.name);
    }));

  test("personal editor keeps model and lighting drafts together across keyboard sections, failures, busy cancellation and retry", () =>
    withEditorDom(async (dom) => {
      await api.stageModelAssets([asset]);
      const before = structuredClone(model);
      const changes = [];
      let release;
      let closed = false;
      function Harness() {
        const [open, setOpen] = useState(true);
        return open
          ? React.createElement(ModelImportDialog, {
              existingModel: model,
              copyCount: 1,
              missingModelOptions: [],
              onCancel: () => {
                closed = true;
                setOpen(false);
              },
              onImport: async (next) => {
                changes.push(next);
                if (changes.length === 1) {
                  await new Promise((resolve) => {
                    release = resolve;
                  });
                  throw new Error("Synthetic storage failure. Retry Save.");
                }
                setOpen(false);
              },
            })
          : null;
      }
      await mount(dom, Harness);
      await dom.until(() => !dom.button("Save changes").disabled);
      assert.match(dom.document.body.textContent, /its placed copy/);
      await dom.click("Lighting");
      await act(async () => dom.document.querySelector(".lighting-enable input").click());
      await dom.click("Add LED strip");
      const lightTab = tab(dom, "Lighting");
      await act(async () =>
        lightTab.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
        ),
      );
      assert.equal(dom.document.activeElement, tab(dom, "Model"));
      assert.equal(tab(dom, "Model").getAttribute("aria-selected"), "true");
      const width = dom.document.querySelector('input[aria-label="Width"]');
      await act(async () => {
        width.focus();
        width.value = "2";
        width.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      await act(async () => {
        width.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      });
      assert.deepEqual(model, before);
      await dom.click("Lighting");
      await act(async () => dom.document.querySelector(".lighting-enable input").click());
      await act(async () => dom.document.querySelector(".lighting-enable input").click());
      await submit(dom);
      assert.ok(dom.button("Saving…").disabled);
      assert.equal(dom.button("Cancel").disabled, true);
      await act(async () =>
        dom.document
          .querySelector("dialog")
          .dispatchEvent(new dom.window.Event("cancel", { cancelable: true })),
      );
      assert.equal(closed, false);
      await act(async () => release());
      await dom.until(() => dom.document.querySelector('[role="alert"]'));
      assert.match(
        dom.document.querySelector('[role="alert"]').textContent,
        /Synthetic storage failure/,
      );
      await dom.click("Lighting");
      assert.equal(dom.document.querySelector(".lighting-enable input").checked, true);
      assert.equal(changes[0].normalization.size[0], 2);
      assert.ok(changes[0].light.sources.some((source) => source.kind === "strip"));
      changes[0].light.sources[0].position.forEach((n, axis) =>
        assert.ok(Math.abs(n - [0, 0.5, 0.4][axis]) < 1e-7),
      );
      await submit(dom);
      await dom.until(() => !dom.document.querySelector("dialog"));
      assert.deepEqual(changes[1], changes[0]);
      assert.deepEqual(model, before);
      assert.equal(dom.document.activeElement.id, "opener");
    }));

  test("catalog entry exposes supported model information, keeps preview state local, cancels and resets home lighting", () =>
    withEditorDom(async (dom) => {
      const definition = {
        label: "Catalog cabinet",
        defaultSize: [1, 1, 1],
        bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
        component: () => null,
      };
      const registries = { furnishingModels: { cabinet: definition }, deviceModels: {} };
      const project = { ...makeThreeFloorProject(), modelLights: { cabinet: light } };
      const before = structuredClone(project);
      const changes = [];
      function Harness() {
        const [open, setOpen] = useState(true);
        return React.createElement(
          React.Fragment,
          null,
          React.createElement("button", { onClick: () => setOpen(true) }, "Reopen"),
          open
            ? React.createElement(ProjectModelEditor, {
                project,
                modelId: "cabinet",
                native: registries,
                onSave: async (change) => changes.push(change),
                onCancel: () => setOpen(false),
              })
            : null,
        );
      }
      await mount(dom, Harness);
      assert.equal(dom.document.querySelector('input[aria-label="Profile"]'), null);
      assert.match(dom.document.body.textContent, /Catalog geometry and profiles are fixed/);
      await dom.click("Lighting");
      await act(async () => dom.document.querySelector(".lighting-enable input").click());
      await dom.click("Cancel");
      assert.deepEqual(changes, []);
      assert.deepEqual(project, before);
      await dom.click("Reopen");
      await dom.click("Lighting");
      assert.equal(dom.document.querySelector(".lighting-enable input").checked, true);
      await dom.click("Reset to default");
      await submit(dom);
      assert.deepEqual(changes, [{ kind: "catalog", modelId: "cabinet", light: undefined }]);
      assert.deepEqual(project, before);
    }));
});
