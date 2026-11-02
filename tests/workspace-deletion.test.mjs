import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const { createWorkspaceRepository, HomeAssistantRuntimeValueProvider, readCabaneArchive } =
    await load("/packages/engine/src/index.ts");
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const { WorkspaceDeletionContent } = await load("/apps/web/src/workspaces/WorkspaceDeletion.tsx");
  const { exportWorkspaceBackup } = await load("/apps/web/src/workspaces/workspace-transfer.ts");
  const { writeSyncCursor, readSyncCursor } = await load(
    "/apps/web/src/workspaces/workspace-sync-state.ts",
  );
  async function mount(options = {}) {
    const repository = createWorkspaceRepository(indexedDB, ownerProjectRegistries);
    const blank = await repository.createBlank("Lake house");
    const entry = options.localOnly
      ? blank
      : await repository.setConnection(blank.metadata.id, blank.record.revision, "https://ha.test");
    const other = await repository.createBlank("Keep me");
    const id = entry.metadata.id;
    let remote = options.localOnly
      ? null
      : {
          version: 7,
          document: options.corrupt
            ? "{broken"
            : exportWorkspaceBackup(
                { ...entry.metadata, homeAssistantUrl: "https://old-ha.test" },
                entry.record,
              ),
          corrupt: options.corrupt,
        };
    if (options.remoteOnly) await repository.delete(id, await repository.readRaw(id));
    else if (!options.localOnly)
      await writeSyncCursor(indexedDB, {
        origin: "https://ha.test",
        homeId: id,
        enabled: true,
        remoteVersion: 7,
        acknowledgedFingerprint: "old",
      });
    const requests = [];
    let finished = false;
    const runtime = {
      status: options.offline ? "disconnected" : "connected",
      origin: "https://ha.test",
      error: null,
      connect() {},
      retry() {},
      sendStorageMessage: async (message) => {
        requests.push(message);
        if (message.type === "cabane/workspaces/get") return remote;
        if (message.type === "cabane/workspaces/delete") {
          if (!remote || message.expected_version !== remote.version)
            throw new Error(
              "The workspace changed on Home Assistant. Cancel and reopen Delete to review it.",
            );
          remote = null;
          return null;
        }
        throw new Error(`Unexpected request: ${message.type}`);
      },
    };
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    root.render(
      React.createElement(
        HomeAssistantRuntimeValueProvider,
        { value: runtime },
        React.createElement(WorkspaceDeletionContent, {
          repository,
          target: options.remoteOnly
            ? {
                saved: { home_id: id, name: entry.metadata.name, version: 7 },
                origin: "https://ha.test",
              }
            : { entry },
          onDeleteLocal: async () => repository.delete(id, await repository.readRaw(id)),
          onDeleted: async () => {
            finished = true;
          },
          onCancel() {},
          onBusyChange() {},
        }),
      ),
    );
    return {
      unmount: () => root.unmount(),
      id,
      repository,
      requests,
      otherId: other.metadata.id,
      get remote() {
        return remote;
      },
      get finished() {
        return finished;
      },
      changeRemote() {
        remote = { ...remote, version: 8 };
      },
    };
  }
  async function permanent(dom) {
    await dom.click("Delete permanently");
  }

  test("local removal leaves the HA copy and clears automatic sync", () =>
    withStorageDom(async (dom) => {
      const h = await dom.mount(mount);
      await dom.until(() => dom.document.body.textContent.includes("Other devices may still"));
      assert.equal(dom.document.querySelector('input[type="radio"]'), null);
      await dom.click("Remove locally");
      await dom.until(() => h.finished);
      assert.equal(await h.repository.read(h.id), null);
      assert.ok(h.remote);
      assert.equal(await readSyncCursor(indexedDB, "https://ha.test", h.id), null);
      assert.ok((await h.repository.read(h.otherId)).record);
      assert.ok(!h.requests.some((message) => message.type.endsWith("/delete")));
    }));
  test("permanent deletion removes the observed HA version and local copy", () =>
    withStorageDom(async (dom) => {
      const h = await dom.mount(mount);
      await dom.until(() => dom.document.body.textContent.includes("Other devices may still"));
      await permanent(dom);
      await dom.until(() => h.finished);
      assert.equal(h.remote, null);
      assert.equal(await h.repository.read(h.id), null);
      assert.equal(
        h.requests.find((message) => message.type.endsWith("/delete")).expected_version,
        7,
      );
      assert.ok((await h.repository.read(h.otherId)).record);
    }));
  test("concurrent HA edits preserve both copies and keep the dialog retryable", () =>
    withStorageDom(async (dom) => {
      const h = await dom.mount(mount);
      await dom.until(() => dom.document.body.textContent.includes("Other devices may still"));
      h.changeRemote();
      await permanent(dom);
      await dom.until(() => dom.document.querySelector('[role="alert"]'));
      assert.match(
        dom.document.querySelector('[role="alert"]').textContent,
        /changed on Home Assistant/,
      );
      assert.ok((await h.repository.read(h.id)).record);
      assert.equal(h.remote.version, 8);
      assert.equal(h.finished, false);
      assert.equal(dom.button("Delete permanently").disabled, true);
      assert.ok(dom.button("Retry Home Assistant"));
    }));
  test("concurrent local edits stop permanent deletion before touching HA", () =>
    withStorageDom(async (dom) => {
      const h = await dom.mount(mount);
      await dom.until(() => dom.document.body.textContent.includes("Other devices may still"));
      const current = await h.repository.read(h.id);
      await h.repository.rename(h.id, current.record.revision, "Newer changes");
      await permanent(dom);
      await dom.until(() => dom.document.querySelector('[role="alert"]'));
      assert.match(dom.document.querySelector('[role="alert"]').textContent, /workspace changed/);
      assert.ok(h.remote);
      assert.ok(!h.requests.some((message) => message.type.endsWith("/delete")));
    }));
  test("remote-only mismatched and corrupt copies can be deleted without parsing, restoring, or fetching models", async () => {
    for (const corrupt of [false, true])
      await withStorageDom(async (dom) => {
        const h = await dom.mount(mount, { remoteOnly: true, corrupt });
        await permanent(dom);
        await dom.until(() => h.finished);
        assert.equal(h.remote, null);
        assert.deepEqual(
          h.requests.map((message) => message.type),
          ["cabane/workspaces/delete"],
        );
        assert.equal(await h.repository.read(h.id), null);
        assert.ok((await h.repository.read(h.otherId)).record);
      });
  });
  test("offline HA does not prevent local removal", () =>
    withStorageDom(async (dom) => {
      const h = await dom.mount(mount, { offline: true });
      assert.equal(dom.button("Delete permanently").disabled, true);
      await dom.click("Remove locally");
      await dom.until(() => h.finished);
      assert.ok(h.remote);
      assert.deepEqual(h.requests, []);
    }));
  test("backup downloads a restorable archive without deleting or closing the dialog", async () => {
    for (const remoteOnly of [false, true])
      await withStorageDom(async (dom) => {
        const blobs = [];
        const original = URL.createObjectURL;
        URL.createObjectURL = (blob) => {
          blobs.push(blob);
          return "blob:test";
        };
        dom.window.HTMLAnchorElement.prototype.click = () => {};
        try {
          const h = await dom.mount(mount, { localOnly: !remoteOnly, remoteOnly });
          await dom.click("Download backup");
          await dom.until(() => blobs.length > 0 && !dom.button("Download backup").disabled);
          assert.ok(dom.document.querySelector("dialog"));
          assert.equal(Boolean((await h.repository.read(h.id))?.record), !remoteOnly);
          assert.equal(h.finished, false);
          const archive = await readCabaneArchive(new Uint8Array(await blobs[0].arrayBuffer()));
          assert.equal(JSON.parse(archive.json).record.homeId, h.id);
          await permanent(dom);
          await dom.until(() => h.finished);
          assert.equal(await h.repository.read(h.id), null);
        } finally {
          URL.createObjectURL = original;
        }
      });
  });
});
