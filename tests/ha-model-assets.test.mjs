import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { withModules } from "./test-server.mjs";
import { testGlb } from "./fixtures/personal-glb.mjs";

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { createAssetAwareHaWorkspaceClient, HaAssetUpgradeRequiredError } = await load(
    "/apps/web/src/workspaces/ha-model-assets.ts",
  );
  const { createSessionStorageSender } = await load(
    "/packages/engine/src/home-assistant-storage-session.ts",
  );
  const { createWorkspaceSyncCoordinator } = await load(
    "/apps/web/src/workspaces/workspace-sync-coordinator.ts",
  );
  const { fingerprintWorkspace } = await load("/apps/web/src/workspaces/workspace-sync-state.ts");
  const { exportWorkspaceBackup } = await load("/apps/web/src/workspaces/workspace-transfer.ts");
  const { restoreRemoteWorkspace } = await load(
    "/apps/web/src/workspaces/workspace-remote-transfer.ts",
  );
  const { ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  const origin = "https://synthetic-ha.test";
  const bytes = testGlb({ padding: 600000 });
  const asset = { bytes, byteLength: bytes.length, sha256: await api.modelAssetHash(bytes) };
  const model = {
    id: "custom:11111111-2222-3333-4444-555555555555",
    name: "Personal cabinet",
    placement: "floor",
    profile: "furniture",
    asset: { sha256: asset.sha256, byteLength: asset.byteLength },
    normalization: {
      rotation: [0, 0, 0],
      scale: 1,
      offset: [0, 0.25, 0],
      size: [1, 0.5, 0.4],
      bounds: { min: [-0.5, 0, -0.2], max: [0.5, 0.5, 0.2] },
    },
    complexity: { visibleMeshes: 1, triangles: 12 },
  };

  function server() {
    const files = new Map(),
      uploads = new Map(),
      documents = new Map(),
      calls = [];
    let fail = false,
      old = false;
    const send = async (message) => {
      calls.push(message);
      const { type } = message;
      if (old && type.startsWith("cabane/assets/")) throw { code: "unknown_command" };
      if (type.endsWith("capabilities")) return { version: 1, chunk_bytes: 262144 };
      if (type === "cabane/assets/has")
        return { missing: message.hashes.filter((h) => !files.has(h)) };
      if (type === "cabane/assets/begin") {
        const key = String(uploads.size);
        uploads.set(key, { ...message, bytes: [] });
        return { upload_id: key };
      }
      if (type === "cabane/assets/upload") {
        if (fail && message.offset > 0) throw new Error("Disconnected during upload");
        const pending = uploads.get(message.upload_id),
          block = Buffer.from(message.data, "base64");
        assert.ok(block.length <= 262144);
        pending.bytes.push(block);
        return { offset: message.offset + block.length };
      }
      if (type === "cabane/assets/finish") {
        const pending = uploads.get(message.upload_id),
          data = new Uint8Array(Buffer.concat(pending.bytes));
        assert.equal(await api.modelAssetHash(data), pending.sha256);
        files.set(pending.sha256, data);
        return { sha256: pending.sha256 };
      }
      if (type === "cabane/assets/get") {
        const data = files.get(message.sha256);
        if (!data) throw new Error("Missing GLB");
        return {
          offset: message.offset,
          byte_length: data.length,
          data: Buffer.from(data.subarray(message.offset, message.offset + 262144)).toString(
            "base64",
          ),
        };
      }
      if (type === "cabane/workspaces/get") return documents.get(message.home_id) ?? null;
      if (type === "cabane/workspaces/put") {
        const previous = documents.get(message.home_id);
        if ((previous?.version ?? null) !== message.expected_version) throw { code: "conflict" };
        for (const asset of api.documentModelReferences(message.document))
          assert.ok(files.has(asset.sha256));
        const version = (previous?.version ?? 0) + 1;
        documents.set(message.home_id, { version, document: message.document });
        return version;
      }
      throw new Error(`Unexpected ${type}`);
    };
    return {
      send,
      files,
      documents,
      calls,
      fail: (value) => {
        fail = value;
      },
      old: () => {
        old = true;
      },
    };
  }
  const source = (map) => ({
    read: async (hash) => map.get(hash) ?? null,
    verify: async (refs) =>
      refs.map((ref) => {
        const bytes = map.get(ref.sha256);
        if (!bytes) throw new Error("Missing local GLB");
        return { ...ref, bytes };
      }),
  });

  test("GLB synchronization verifies and uploads assets without SubtleCrypto", async (context) => {
    const descriptor = Object.getOwnPropertyDescriptor(crypto, "subtle");
    context.after(() => {
      if (descriptor) Object.defineProperty(crypto, "subtle", descriptor);
      else delete crypto.subtle;
    });
    Object.defineProperty(crypto, "subtle", { configurable: true, value: undefined });
    const remote = server();
    const client = createAssetAwareHaWorkspaceClient(
      remote.send,
      source(new Map([[asset.sha256, bytes]])),
    );
    await client.put("http-home", JSON.stringify({ customModels: [model] }), null);
    assert.deepEqual(remote.files.get(asset.sha256), bytes);
    assert.equal(remote.documents.get("http-home").version, 1);
  });

  test("only absent GLB files upload, in bounded chunks, before the lightweight document", async () => {
    const remote = server(),
      client = createAssetAwareHaWorkspaceClient(
        remote.send,
        source(new Map([[asset.sha256, bytes]])),
      );
    const json = JSON.stringify({
      draft: { customModels: [model, model] },
      published: { customModels: [] },
    });
    await client.put("home", json, null);
    const first = remote.calls.filter((c) => c.type === "cabane/assets/upload").length;
    assert.equal(first, 3);
    assert.equal(remote.files.size, 1);
    assert.ok(
      remote.calls.findIndex((c) => c.type === "cabane/assets/finish") <
        remote.calls.findIndex((c) => c.type === "cabane/workspaces/put"),
    );
    await client.put("home", json, 1);
    assert.equal(remote.calls.filter((c) => c.type === "cabane/assets/upload").length, first);
    assert.ok(Buffer.byteLength(json) < 5 * 1024 * 1024);
  });
  test("interrupted uploads and missing downloads leave the previous document intact; retry succeeds", async () => {
    const remote = server(),
      client = createAssetAwareHaWorkspaceClient(
        remote.send,
        source(new Map([[asset.sha256, bytes]])),
      );
    await client.put("home", "{}", null);
    const json = JSON.stringify({ customModels: [model] });
    remote.fail(true);
    await assert.rejects(client.put("home", json, 1), /Disconnected/);
    assert.equal(remote.documents.get("home").document, "{}");
    remote.fail(false);
    await client.put("home", json, 1);
    assert.equal(remote.documents.get("home").version, 2);
    remote.files.clear();
    const other = createAssetAwareHaWorkspaceClient(remote.send, source(new Map()));
    await assert.rejects(other.get("home"), /Missing GLB/);
  });
  test("old integrations preserve native sync and request an update for houses with GLB", async () => {
    const remote = server();
    remote.old();
    const client = createAssetAwareHaWorkspaceClient(
      remote.send,
      source(new Map([[asset.sha256, bytes]])),
    );
    await client.put("home", "{}", null);
    await assert.rejects(
      client.put("home", JSON.stringify({ customModels: [model] }), 1),
      HaAssetUpgradeRequiredError,
    );
    assert.equal(remote.documents.get("home").version, 1);
  });
  test("a complete HA copy repairs an unreadable local asset before restoring the house", async () => {
    const remote = server();
    const writer = createAssetAwareHaWorkspaceClient(
      remote.send,
      source(new Map([[asset.sha256, bytes]])),
    );
    const document = JSON.stringify({ customModels: [model] });
    await writer.put("home", document, null);
    const reader = createAssetAwareHaWorkspaceClient(remote.send, {
      ...source(new Map()),
      read: async () => {
        throw new Error("Stored GLB is damaged.");
      },
    });
    assert.equal((await reader.get("home")).document, document);
    const factory = new IDBFactory();
    const repository = api.createModelAssetRepository(factory);
    await repository.restore(await repository.verify([asset]));
    assert.deepEqual(await repository.read(asset.sha256), bytes);
  });
  test("two browser clients restore complete assets and keep local edits when revisions conflict", async () => {
    const remote = server(),
      registries = { furnishingModels: {}, deviceModels: {} };
    function browser(factory) {
      const repository = api.createWorkspaceRepository(factory, registries);
      const client = createAssetAwareHaWorkspaceClient(
        remote.send,
        api.createModelAssetRepository(factory),
      );
      const cursors = new Map();
      const coordinator = createWorkspaceSyncCoordinator({
        repository,
        client,
        cursors: {
          read: async (o, id) => cursors.get(`${o}:${id}`) ?? null,
          write: async (c) => cursors.set(`${c.origin}:${c.homeId}`, c),
          remove: async (o, id) => cursors.delete(`${o}:${id}`),
        },
        fingerprint: (entry) => fingerprintWorkspace(entry.metadata, entry.record),
        serialize: (entry) => exportWorkspaceBackup(entry.metadata, entry.record),
        restore: (json, revision, id) =>
          restoreRemoteWorkspace(repository, json, revision, id, origin),
      });
      return { repository, client, coordinator };
    }
    const a = browser(new IDBFactory()),
      factoryB = new IDBFactory(),
      b = browser(factoryB);
    await api.stageModelAssets([asset]);
    const entry = await a.repository.create(
      api.createSeedProjectRecord({ ...ownerHomeProject, sceneItems: [], customModels: [model] }),
      { name: "A", homeAssistantUrl: origin },
    );
    const id = entry.metadata.id;
    assert.equal((await a.coordinator.enableSync(id, origin)).kind, "synced");
    await b.coordinator.openRemote(id, origin);
    assert.deepEqual(await api.createModelAssetRepository(factoryB).read(asset.sha256), bytes);
    assert.equal((await b.repository.read(id)).record.draft.customModels.length, 1);
    const aEntry = await a.repository.read(id),
      bEntry = await b.repository.read(id);
    await a.repository.rename(id, aEntry.record.revision, "Changed on A");
    await b.repository.rename(id, bEntry.record.revision, "Changed on B");
    assert.equal((await a.coordinator.reconcile(id, origin)).kind, "synced");
    assert.equal((await b.coordinator.reconcile(id, origin)).kind, "conflict");
    assert.equal((await b.repository.read(id)).metadata.name, "Changed on B");
    assert.equal(remote.files.size, 1);
  });
  test("storage blocks cannot cross HA origins or continue after session replacement", async () => {
    let state = {
      origin,
      lifecycle: 1,
      status: "connected",
      connection: {
        sendMessagePromise: async () => {
          state = { ...state, lifecycle: 2 };
          return "ok";
        },
      },
    };
    const send = createSessionStorageSender(origin, () => state);
    await assert.rejects(send({ type: "cabane/assets/get" }), /no longer active/);
    state = { ...state, origin: "https://another-synthetic-ha.test" };
    await assert.rejects(send({ type: "cabane/assets/get" }), /this storage session/);
    assert.throws(
      () =>
        api.documentModelReferences(
          JSON.stringify({
            customModels: [{ asset: { sha256: "a".repeat(64), byteLength: 9999999999 } }],
          }),
        ),
      /Invalid GLB reference/,
    );
  });
});
