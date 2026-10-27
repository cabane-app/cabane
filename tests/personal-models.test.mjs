import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { withModules } from "./test-server.mjs";
import { testGlb } from "./fixtures/personal-glb.mjs";
import { createHash } from "node:crypto";
import { strToU8, unzipSync, zipSync } from "fflate";

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { acquireGlb } = await load("/packages/engine/src/imported-models/glb-resources.ts");
  const { ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  const { createCatalogItem } = await load(
    "/apps/web/src/editor-preview/furnish/placement/item-creation.ts",
  );
  const native = { furnishingModels: {}, deviceModels: {} };
  const bytes = testGlb();
  const asset = { bytes, byteLength: bytes.length, sha256: await api.modelAssetHash(bytes) };
  const decoded = await api.loadGlb(bytes);
  const model = (
    placement = "floor",
    profile = "furniture",
    id = "custom:11111111-2222-3333-4444-555555555555",
  ) => ({
    id,
    name: "Personal model",
    profile,
    placement,
    asset: { sha256: asset.sha256, byteLength: asset.byteLength },
    normalization: api.normalizeGlb(decoded.root, placement),
    complexity: decoded.complexity,
    ...(profile === "light"
      ? { light: { position: [0, 0.3, 0], color: "#ffe3b4", maxIntensity: 2, distance: 5 } }
      : {}),
  });
  const project = (models = [model()]) => ({
    ...structuredClone(ownerHomeProject),
    customModels: models,
    sceneItems: [],
  });

  test("Blender and Three.js skill exports decode with their authored physical dimensions", async () => {
    for (const source of ["blender", "three"]) {
      const fixture = JSON.parse(
        await readFile(`tests/fixtures/personal-${source}-model.json`, "utf8"),
      );
      const preview = await api.openGlbPreview(Buffer.from(fixture.base64, "base64"));
      try {
        const normalized = api.normalizeGlb(preview.root, "floor");
        assert.ok(Math.abs(normalized.size[0] - 1.2) < 0.001, source);
        assert.ok(Math.abs(normalized.size[1] - 0.75) < 0.001, source);
      } finally {
        preview.release();
      }
    }
  });
  const { createFurnishingEditorState, furnishingEditorReducer } = await load(
    "/apps/web/src/editor-preview/furnish/editor-state.ts",
  );
  for (const placement of [
    { kind: "absolute", at: [2, 2], elevationMeters: 0.2, rotationYRadians: 0.4 },
    { kind: "wall", wallId: "wall", offsetPlanUnits: 1, elevationMeters: 0.2, facing: "front" },
    { kind: "ceiling", at: [2, 2], dropMeters: 0.2, rotationYRadians: 0.4 },
  ])
    test(`personal model ${placement.kind} elevation/resize transactions preserve support and exact history`, () => {
      const item = {
        id: "model",
        kind: "furnishing",
        modelId: model().id,
        floorId: "ground",
        size: [0.7, 1, 0.4],
        placement,
      };
      const definition = api.resolveProjectModels(project(), native).furnishingModels[item.modelId];
      let state = createFurnishingEditorState([item]);
      const dispatch = (action) => {
        state = furnishingEditorReducer(state, action);
      };
      for (const change of [
        {
          type: "update-placement",
          id: item.id,
          placement:
            placement.kind === "ceiling"
              ? { ...placement, dropMeters: -0.3 }
              : { ...placement, elevationMeters: 0.7 },
        },
        {
          type: "update-size",
          id: item.id,
          size: item.size.map((value) => value * 1.5),
          definition,
        },
      ]) {
        const before = structuredClone(state.items);
        const historyLength = state.past.length;
        dispatch({ type: "begin-transaction" });
        dispatch(change);
        dispatch(change);
        assert.equal(state.past.length, historyLength, "pointer moves do not create undo entries");
        dispatch({ type: "commit-transaction" });
        assert.equal(state.past.length, historyLength + 1);
        const after = structuredClone(state.items);
        assert.notDeepEqual(after, before);
        if (change.type === "update-size")
          assert.deepEqual(after[0].placement, before[0].placement);
        else assert.deepEqual(after[0].size, before[0].size);
        dispatch({ type: "undo" });
        assert.deepEqual(state.items, before);
        dispatch({ type: "redo" });
        assert.deepEqual(state.items, after);
        dispatch({ type: "undo" });
        dispatch({ type: "begin-transaction" });
        dispatch(change);
        dispatch({ type: "cancel-transaction" });
        assert.deepEqual(state.items, before);
        assert.equal(state.past.length, historyLength);
        assert.equal(state.transaction, null);
      }
    });

  test("GLB validation rejects external resources, unsupported required extensions and resource limits", () => {
    assert.equal(api.inspectGlb(bytes).complexity.triangles, 12);
    assert.throws(() => api.inspectGlb(new Uint8Array(4)), /complete GLB/);
    assert.throws(() => api.inspectGlb(new Uint8Array(10 * 1024 * 1024 + 1)), /10 MiB/);
    assert.throws(
      () =>
        api.inspectGlb(
          testGlb({
            mutate: (j) => {
              j.buffers[0].uri = "remote.bin";
            },
          }),
        ),
      /External references/,
    );
    assert.throws(
      () =>
        api.inspectGlb(
          testGlb({
            mutate: (j) => {
              j.images = [{ uri: "data:image/png;base64,AA" }];
            },
          }),
        ),
      /External references/,
    );
    assert.throws(
      () =>
        api.inspectGlb(
          testGlb({
            mutate: (j) => {
              j.extensionsRequired = ["KHR_draco_mesh_compression"];
            },
          }),
        ),
      /KHR_draco_mesh_compression/,
    );
    assert.throws(
      () =>
        api.inspectGlb(
          testGlb({
            mutate: (j) => {
              j.accessors[0].count = 300003;
            },
          }),
        ),
      /100,000/,
    );
    assert.throws(
      () =>
        api.inspectGlb(
          testGlb({
            mutate: (j) => {
              j.meshes[0].primitives = Array.from({ length: 129 }, () => j.meshes[0].primitives[0]);
            },
          }),
        ),
      /128 meshes/,
    );
    assert.throws(
      () =>
        api.inspectGlb(
          testGlb({
            mutate: (j) => {
              j.nodes[0].children = [0];
            },
          }),
        ),
      /cycle/,
    );
    assert.equal(api.inspectGlb(testGlb({ textured: true })).complexity.triangles, 12);
  });
  test("SHA-256 identities are identical in HTTPS browsers and HTTP panels without SubtleCrypto", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(crypto, "subtle");
    const expected = createHash("sha256").update(bytes).digest("hex");
    assert.equal(await api.modelAssetHash(bytes), expected);
    try {
      Object.defineProperty(crypto, "subtle", { configurable: true, value: undefined });
      assert.equal(await api.modelAssetHash(bytes), expected);
      assert.equal(
        await api.sha256Hex(new TextEncoder().encode("abc")),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      );
    } finally {
      if (descriptor) Object.defineProperty(crypto, "subtle", descriptor);
      else delete crypto.subtle;
    }
  });
  test("decoded PBR/unlit materials stay intact; embedded animation/camera/light are ignored", async () => {
    const glb = await api.loadGlb(testGlb({ embedded: true }));
    assert.equal(glb.notices.length, 3);
    const objects = [];
    glb.root.traverse((o) => objects.push(o));
    assert.ok(!objects.some((o) => o.isCamera || o.isLight));
    const mesh = objects.find((o) => o.isMesh);
    assert.equal(mesh.material.type, "MeshStandardMaterial");
    assert.equal(mesh.material.roughness, 0.27);
    assert.equal(mesh.material.metalness, 0.65);
    assert.equal(mesh.material.color.g, 0.6);
    assert.equal(mesh.userData.walkCollider, undefined);
    const unlit = await api.loadGlb(testGlb({ unlit: true }));
    assert.equal(unlit.root.children[0].material.type, "MeshBasicMaterial");
    api.disposeGlb(glb.root);
    api.disposeGlb(unlit.root);
  });
  test("normalization anchors floor, wall and ceiling; project resolution is isolated and schema remains V2", () => {
    assert.equal(model("floor").normalization.bounds.min[1], 0);
    assert.equal(model("wall").normalization.bounds.min[2], 0);
    assert.equal(model("ceiling").normalization.bounds.max[1], 0);
    const rotated = api.normalizeGlb(decoded.root, "floor", [0, Math.PI / 2, 0], 2);
    assert.ok(Math.abs(rotated.size[0] - 0.8) < 0.00001);
    const resolved = api.resolveProjectModels(project(), native);
    assert.equal(resolved.furnishingModels[model().id].resizePolicy.kind, "uniform");
    assert.equal(resolved.furnishingModels[model().id].outlineContact, false);
    assert.equal(
      api.resolveProjectModels({ customModels: [] }, native).furnishingModels[model().id],
      undefined,
    );
    assert.equal(api.parseHomeProjectSchema(project()).valid, true);
    assert.equal(api.parseHomeProjectSchema(ownerHomeProject).valid, true);
    assert.equal(api.parseHomeProjectSchema(project([model(), model()])).valid, false);
    const invalid = project();
    invalid.customModels[0].normalization.bounds.min = [5, 5, 5];
    assert.equal(api.parseHomeProjectSchema(invalid).valid, false);
  });
  test("preview leases share resources until the final close and normalization ignores preview parenting", async () => {
    const { Group } = await import("three");
    const first = await api.openGlbPreview(bytes),
      second = await api.openGlbPreview(bytes);
    const mesh = first.root.children[0];
    assert.notEqual(first.root, second.root);
    assert.equal(mesh.geometry, second.root.children[0].geometry);
    assert.equal(mesh.material, second.root.children[0].material);
    let disposed = 0;
    mesh.geometry.addEventListener("dispose", () => disposed++);
    const before = api.normalizeGlb(first.root, "wall", [0, Math.PI / 4, 0]);
    const parent = new Group();
    parent.scale.setScalar(3);
    parent.rotation.y = 1;
    parent.add(first.root);
    parent.updateMatrixWorld(true);
    assert.deepEqual(api.normalizeGlb(first.root, "wall", [0, Math.PI / 4, 0]), before);
    first.release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(disposed, 0);
    second.release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(disposed, 1);
    const unavailable = acquireGlb(asset, { read: async () => null });
    await assert.rejects(unavailable.pending, /Missing or damaged/);
    // The original error placeholder still holds a lease while a valid import retries.
    const restored = await api.openGlbPreview(bytes);
    assert.equal(restored.root.children[0].material.type, "MeshStandardMaterial");
    unavailable.release();
    restored.release();
  });
  test("imported devices reuse controls, camera viewer and light rules; additions create fresh primary slots", () => {
    for (const profile of ["light", "sensor", "camera", "cover", "event"]) {
      const custom = model("floor", profile);
      const definition = api.resolveProjectModels(project([custom]), native).deviceModels[
        custom.id
      ];
      assert.deepEqual(definition.supportedDomains, [profile]);
      assert.equal(api.parseHomeProjectSchema(project([custom])).valid, true);
      assert.equal(
        definition.interaction.target,
        profile === "camera" ? "camera-viewer" : undefined,
      );
      assert.deepEqual(definition.sceneLight, custom.light);
      const entry = { modelId: custom.id, kind: "device", definition };
      const first = createCatalogItem(
        entry,
        { kind: "absolute", at: [5, 5], elevationMeters: 0, rotationYRadians: 0 },
        [],
        [],
        ownerHomeProject.floors[0].id,
      );
      const second = createCatalogItem(entry, first.placement, [first], [], first.floorId);
      assert.notEqual(first.entitySlots[0].id, second.entitySlots[0].id);
      assert.equal(first.entitySlots[0].deviceRole, "primary");
      if (profile === "event") {
        const saved = project([custom]);
        saved.sceneItems = [first];
        assert.equal(api.parseHomeProjectSchema(JSON.parse(JSON.stringify(saved))).valid, true);
        assert.deepEqual(first.entitySlots[0].compatibleDomains, ["event"]);
      }
    }
  });
  test("catalog reference and bytes commit atomically, deduplicate across instances and survive publication/reload", async () => {
    const factory = new IDBFactory(),
      repository = api.createWorkspaceRepository(factory, native);
    await repository.initialize({ ...ownerHomeProject, sceneItems: [] });
    await api.stageModelAssets([asset]);
    const record = api.createSeedProjectRecord(project());
    record.publishedAt = 0;
    const entry = await repository.create(record, { name: "GLB house" });
    assert.deepEqual(await api.createModelAssetRepository(factory).read(asset.sha256), bytes);
    assert.equal((await repository.read(entry.metadata.id)).record.draft.customModels.length, 1);
    const duplicate = await repository.duplicate(entry.metadata.id, entry.record.revision, "Copy");
    assert.equal(duplicate.record.draft.customModels[0].id, model().id);
    const store = api.createIndexedDbProjectRecordStore(factory);
    const pending = { ...entry.record, draft: project(), revision: entry.record.revision + 1 };
    const before = await store.read(entry.metadata.id);
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "home-projects") throw new Error("disk full");
      return put.apply(this, args);
    };
    try {
      await assert.rejects(
        store.compareAndSwap(entry.metadata.id, before, api.serializeHomeProjectRecord(pending)),
        /disk full/,
      );
    } finally {
      IDBObjectStore.prototype.put = put;
    }
    assert.equal(await store.read(entry.metadata.id), before);
    const missing = project();
    missing.customModels[0].asset.sha256 = "a".repeat(64);
    await assert.rejects(
      repository.create(api.createSeedProjectRecord(missing), { name: "Missing" }),
      /Missing or damaged/,
    );
  });
  test("portable/private archives restore all distinct assets and reject integrity failures and missing files", async () => {
    const json = api.serializeCanonicalJson(
      project([model(), model("wall", "furniture", "custom:22222222-2222-3333-4444-555555555555")]),
    );
    const archive = api.createCabaneArchive(json, [asset]);
    const restored = await api.readCabaneArchive(archive);
    assert.equal(restored.assets.length, 1);
    assert.equal(restored.json, json);
    assert.deepEqual(restored.assets[0].bytes, bytes);
    await assert.rejects(api.readCabaneArchive(api.createCabaneArchive(json, [])), /missing GLB/);
    await assert.rejects(api.stageModelAssets([{ ...asset, sha256: "f".repeat(64) }]), /integrity/);
    assert.equal(
      (await api.readCabaneFile(new Blob([api.serializeCanonicalJson(ownerHomeProject)]))).assets
        .length,
      0,
    );
  });
  test("model packs preserve custom IDs and reject unreferenced files", async () => {
    const models = [
      model(),
      model("wall", "furniture", "custom:22222222-3333-4444-5555-666666666666"),
    ];
    const pack = api.createCabaneModelPack(models, [asset]);
    const restored = await api.readCabaneModelPack(pack);
    assert.deepEqual(
      restored.models.map((entry) => entry.id),
      models.map((entry) => entry.id),
    );
    assert.deepEqual(restored.assets[0].bytes, bytes);
    const files = unzipSync(pack);
    files[`assets/${"a".repeat(64)}.glb`] = bytes;
    await assert.rejects(api.readCabaneModelPack(zipSync(files, { level: 0 })), /unreferenced/);
    const manifestOnly = zipSync(
      {
        "manifest.json": strToU8(
          JSON.stringify({ format: "cabane-model-pack", version: 1, models }),
        ),
      },
      { level: 0 },
    );
    await assert.rejects(api.readCabaneModelPack(manifestOnly), /missing GLB/);
  });
});
