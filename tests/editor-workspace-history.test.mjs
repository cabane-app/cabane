import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { testGlb } from "./fixtures/personal-glb.mjs";
import { act, createElement, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";
import { waitForAsyncCondition } from "./async-condition.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { parseWorkspaceImport } = await load("/apps/web/src/workspaces/workspace-transfer.ts");
  const { useEditorExitRequest } = await load("/apps/web/src/editor-workspace/useEditorSession.ts");
  const { EditorDraftStatus } = await load("/apps/web/src/editor-workspace/EditorDraftStatus.tsx");
  const { ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const { useEditorWorkspace } = await load("/apps/web/src/editor-preview/useEditorWorkspace.ts");
  const {
    createWorkspaceHistory,
    commitWorkspaceSnapshot,
    undoWorkspaceHistory,
    redoWorkspaceHistory,
  } = engine;
  const origin = "https://fixture.invalid";
  const seed = structuredClone(ownerHomeProject);
  const roomId = seed.floors[0].rooms[0].id;
  const profile = {
    schemaVersion: 1,
    homeId: seed.home.id,
    roomAreaIds: { [roomId]: "fixture-area" },
    entityIdsBySlotId: {},
  };
  const bindings = {
    [origin]: { draft: profile, published: profile, manualRoomIds: [roomId], manualSlotIds: [] },
  };
  const before = { project: seed, bindings };
  const after = {
    project: { ...seed, floors: [{ ...seed.floors[0], rooms: seed.floors[0].rooms.slice(1) }] },
    bindings: {
      [origin]: { ...bindings[origin], draft: { ...profile, roomAreaIds: {} }, manualRoomIds: [] },
    },
  };

  test("workspace history restores deletion and private mapping cleanup together", () => {
    const history = createWorkspaceHistory(before);
    const changed = commitWorkspaceSnapshot(history, after);
    assert.deepEqual(undoWorkspaceHistory(changed).present, before);
    assert.deepEqual(redoWorkspaceHistory(undoWorkspaceHistory(changed)).present, after);
    assert.equal(commitWorkspaceSnapshot(changed, after), changed);
    assert.equal(
      commitWorkspaceSnapshot(changed, {
        bindings: structuredClone(after.bindings),
        project: { ...after.project },
      }),
      changed,
    );
    assert.equal(
      commitWorkspaceSnapshot(undoWorkspaceHistory(changed), { ...before, bindings: {} }).future
        .length,
      0,
    );
  });

  test("one device deletion step restores and removes its item and slot references together", () => {
    const device = seed.sceneItems.find((item) => item.kind === "device");
    assert.ok(device);
    const slotIds = device.entitySlots.map((slot) => slot.id);
    const mappedProfile = {
      ...profile,
      entityIdsBySlotId: Object.fromEntries(
        slotIds.map((id, index) => [id, `light.fixture_${index}`]),
      ),
    };
    const deviceBefore = {
      project: seed,
      bindings: {
        [origin]: {
          draft: mappedProfile,
          published: structuredClone(mappedProfile),
          manualRoomIds: [roomId],
          manualSlotIds: slotIds,
        },
      },
    };
    const deviceAfter = {
      project: { ...seed, sceneItems: seed.sceneItems.filter((item) => item.id !== device.id) },
      bindings: {
        [origin]: {
          ...deviceBefore.bindings[origin],
          draft: { ...mappedProfile, entityIdsBySlotId: {} },
          manualSlotIds: [],
        },
      },
    };

    const changed = commitWorkspaceSnapshot(createWorkspaceHistory(deviceBefore), deviceAfter);
    assert.equal(changed.past.length, 1);
    assert.deepEqual(undoWorkspaceHistory(changed).present, deviceBefore);
    assert.deepEqual(redoWorkspaceHistory(undoWorkspaceHistory(changed)).present, deviceAfter);
  });

  test("workspace history clones inputs, bounds history at the existing 100 entries, and ignores no-ops", () => {
    const input = structuredClone(before);
    let history = createWorkspaceHistory(input);
    input.project.home.name = "Mutated outside history";
    input.bindings[origin].manualRoomIds.push("outside");
    assert.deepEqual(history.present, before);
    const next = structuredClone(after);
    history = commitWorkspaceSnapshot(history, next);
    next.bindings[origin].draft.roomAreaIds[roomId] = "outside";
    assert.deepEqual(history.present, after);
    for (let index = 0; index < 110; index += 1)
      history = commitWorkspaceSnapshot(history, {
        ...history.present,
        project: { ...seed, home: { ...seed.home, name: `Edit ${index}` } },
      });
    assert.equal(history.past.length, 100);
    assert.equal(undoWorkspaceHistory(createWorkspaceHistory(before)).past.length, 0);
  });

  const fixture = async () => {
    const repository = engine.createHomeProjectRepository(
      engine.createMemoryProjectRecordStore(),
      ownerProjectRegistries,
    );
    const lifecycle = engine.createHomeProjectLifecycle(repository, seed);
    const loaded = await lifecycle.load();
    const saved = await lifecycle.autosave(loaded.record, seed, undefined, bindings);
    assert.equal(saved.status, "saved");
    return { repository, lifecycle, record: saved.record };
  };
  const mount = async (record, lifecycle, strictInitialization = false, renderStatus = false) => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://fixture.invalid/",
    });
    dom.window.indexedDB = new IDBFactory();
    const names = ["window", "document", "navigator", "HTMLElement"];
    const previous = Object.fromEntries(
      names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    );
    for (const name of names)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value: dom.window[name],
      });
    const root = createRoot(dom.window.document.getElementById("root"));
    let current;
    const Harness = ({ initialRecord }) => {
      current = useEditorWorkspace({ initialRecord, lifecycle, autosaveDelayMs: 5 });
      useEffect(() => {
        if (strictInitialization) current.commit(changed(current.snapshot, "Initialized draft"));
      }, []);
      return renderStatus
        ? createElement(EditorDraftStatus, { workspace: current, homeAssistantUrl: origin })
        : null;
    };
    await act(async () =>
      root.render(
        strictInitialization
          ? createElement(StrictMode, null, createElement(Harness, { initialRecord: record }))
          : createElement(Harness, { initialRecord: record }),
      ),
    );
    return {
      get current() {
        return current;
      },
      render: async (initialRecord) =>
        act(async () => root.render(createElement(Harness, { initialRecord }))),
      dispose: async () => {
        await act(async () => root.unmount());
        dom.window.close();
        for (const name of names) {
          if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
          else delete globalThis[name];
        }
      },
    };
  };
  const changed = (snapshot, name = "Edited draft") => ({
    project: { ...snapshot.project, home: { ...snapshot.project.home, name } },
    bindings: {
      [origin]: {
        ...snapshot.bindings[origin],
        draft: { ...profile, roomAreaIds: {} },
        manualRoomIds: [roomId],
      },
    },
  });
  const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };

  test("StrictMode effect replay preserves the first editor autosave timer", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const { lifecycle, record, repository } = await fixture();
    const harness = await mount(record, lifecycle, true);
    try {
      await act(async () => {
        context.mock.timers.tick(5);
      });
      assert.equal(harness.current.saving, false);
      assert.equal((await repository.load(record.homeId)).draft.home.name, "Initialized draft");
    } finally {
      await harness.dispose();
    }
  });

  test("serializes an in-flight autosave before Publish, locks immediately, and never reverts published slices", async () => {
    const { lifecycle, record, repository } = await fixture();
    const gate = deferred();
    const calls = [];
    let first = true;
    const harness = await mount(record, {
      ...lifecycle,
      autosave: async (...args) => {
        calls.push(args[0].revision);
        if (first) {
          first = false;
          await gate.promise;
        }
        return lifecycle.autosave(...args);
      },
    });
    try {
      let saving, publishing;
      await act(async () => {
        harness.current.commit(changed(harness.current.snapshot, "First draft"));
        saving = harness.current.flush();
      });
      await act(async () => {
        harness.current.commit(changed(harness.current.snapshot, "Published draft"));
        publishing = harness.current.publish({ confirmWarnings: true });
        assert.equal(
          harness.current.commit(before),
          false,
          "lock is synchronous, before React renders",
        );
        assert.equal(harness.current.undo(), null);
      });
      assert.equal(harness.current.busy, true);
      assert.equal(calls.length, 1);
      await act(async () => {
        gate.resolve();
        await saving;
        await publishing;
      });
      assert.equal((await publishing).status, "published");
      assert.deepEqual(calls, [record.revision, record.revision + 1]);
      const published = structuredClone(harness.current.record);
      await act(async () => {
        harness.current.undo();
        await harness.current.flush();
      });
      const stored = await repository.load(record.homeId);
      assert.deepEqual(stored.published, published.published);
      assert.deepEqual(stored.bindings[origin].published, published.bindings[origin].published);
      assert.equal(stored.draft.home.name, "First draft");
      assert.equal(harness.current.busy, false);
    } finally {
      await harness.dispose();
    }
  });

  test("draft project and private mappings survive reload without changing Home", async () => {
    const { lifecycle, record, repository } = await fixture();
    let harness = await mount(record, lifecycle);
    const edited = changed(harness.current.snapshot);
    try {
      await act(async () => {
        harness.current.commit(edited);
        await harness.current.flush();
      });
      await harness.dispose();
      const loaded = await repository.load(record.homeId);
      harness = await mount(loaded, lifecycle);
      assert.deepEqual(harness.current.snapshot, {
        project: edited.project,
        bindings: loaded.bindings,
      });
      assert.deepEqual(loaded.bindings[origin].draft, edited.bindings[origin].draft);
      assert.deepEqual(loaded.published, record.published);
      assert.deepEqual(loaded.bindings[origin].published, record.bindings[origin].published);
    } finally {
      await harness.dispose();
    }
  });

  test("the debounced autosave persists both slices, and a corrected invalid draft can save", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const { lifecycle, record, repository } = await fixture();
    const harness = await mount(record, lifecycle);
    try {
      const edited = changed(harness.current.snapshot);
      await act(async () => harness.current.commit(edited));
      assert.equal(harness.current.saving, true);
      await act(async () => {
        context.mock.timers.tick(5);
      });
      const stored = await repository.load(record.homeId);
      assert.deepEqual(stored.draft, edited.project);
      assert.deepEqual(stored.bindings[origin].draft, edited.bindings[origin].draft);
      assert.equal(harness.current.saving, false);
      await act(async () => {
        harness.current.commit({ ...edited, project: { ...edited.project, schemaVersion: 99 } });
        assert.equal((await harness.current.flush()).status, "invalid-draft");
      });
      assert.ok(harness.current.error);
      await act(async () => {
        harness.current.commit(edited);
        assert.equal((await harness.current.flush()).status, "saved");
      });
      assert.equal(harness.current.error, null);
    } finally {
      await harness.dispose();
    }
  });

  test("blocked or throwing publication unlocks editing and keeps the draft", async () => {
    const { lifecycle, record } = await fixture();
    let shouldThrow = false;
    const harness = await mount(record, {
      ...lifecycle,
      publish: async () => {
        if (shouldThrow) throw new Error("Storage unavailable");
        return {
          status: "blocked",
          errors: [{ severity: "error", message: "Fixture invalid", code: "fixture", path: "$" }],
          warnings: [],
        };
      },
    });
    try {
      await act(async () => {
        harness.current.commit(changed(harness.current.snapshot));
      });
      let result;
      await act(async () => {
        result = await harness.current.publish();
      });
      assert.equal(result.status, "blocked");
      assert.equal(harness.current.busy, false);
      shouldThrow = true;
      await act(async () => {
        result = await harness.current.publish();
      });
      assert.equal(result.status, "storage-error");
      assert.equal(harness.current.busy, false);
      assert.equal(harness.current.snapshot.project.home.name, "Edited draft");
      await act(async () =>
        assert.equal(
          harness.current.commit(changed(harness.current.snapshot, "Still editable")),
          true,
        ),
      );
    } finally {
      await harness.dispose();
    }
  });

  test("stale-tab autosave preserves in-memory changes and does not retry queued writes", async () => {
    const { lifecycle, record, repository } = await fixture();
    let attempts = 0;
    const harness = await mount(record, {
      ...lifecycle,
      autosave: async (...args) => {
        attempts += 1;
        return lifecycle.autosave(...args);
      },
    });
    try {
      const competing = await lifecycle.autosave(record, {
        ...seed,
        home: { ...seed.home, name: "Other tab" },
      });
      assert.equal(competing.status, "saved");
      await act(async () => {
        harness.current.commit(changed(harness.current.snapshot));
        await harness.current.flush();
      });
      assert.match(harness.current.error.message, /another tab/);
      await act(async () => {
        harness.current.commit(changed(harness.current.snapshot, "Kept in memory"));
        await harness.current.flush();
      });
      assert.equal(attempts, 1);
      assert.equal(harness.current.snapshot.project.home.name, "Kept in memory");
      assert.equal((await repository.load(record.homeId)).draft.home.name, "Other tab");
    } finally {
      await harness.dispose();
    }
  });

  test("transient storage failure pauses autosave but explicit flush safely saves retained edits after storage recovers", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const { lifecycle, record, repository } = await fixture();
    let unavailable = true;
    let attempts = 0;
    const harness = await mount(record, {
      ...lifecycle,
      autosave: async (...args) => {
        attempts += 1;
        if (unavailable)
          return { status: "storage-error", record: args[0], error: new Error("Quota exceeded") };
        return lifecycle.autosave(...args);
      },
    });
    try {
      await act(async () => {
        harness.current.commit(changed(harness.current.snapshot));
        await harness.current.flush();
      });
      await act(async () =>
        harness.current.commit(changed(harness.current.snapshot, "Retained newer edit")),
      );
      unavailable = false;
      await act(async () => {
        context.mock.timers.tick(5);
      });
      assert.equal(attempts, 1, "autosave stays paused after a failure");
      await act(async () => assert.equal((await harness.current.flush()).status, "saved"));
      assert.equal(attempts, 2);
      assert.equal(harness.current.error, null);
      assert.equal((await repository.load(record.homeId)).draft.home.name, "Retained newer edit");
    } finally {
      await harness.dispose();
    }
  });

  test("discard and seed reset restore both slices and establish a clean history", async () => {
    const { lifecycle, record, repository } = await fixture();
    const harness = await mount(record, lifecycle);
    try {
      await act(async () => {
        harness.current.commit(changed(harness.current.snapshot));
        await harness.current.resetDraftToPublished();
      });
      assert.deepEqual(harness.current.snapshot.project, record.published);
      assert.deepEqual(
        harness.current.snapshot.bindings[origin].draft,
        record.bindings[origin].published,
      );
      assert.deepEqual(harness.current.snapshot.bindings[origin].manualRoomIds, []);
      assert.equal(harness.current.canUndo, false);
      await act(async () => {
        harness.current.commit(changed(harness.current.snapshot));
        await harness.current.resetToSeed();
      });
      assert.deepEqual(harness.current.snapshot, { project: seed, bindings: {} });
      assert.equal(harness.current.canUndo, false);
      assert.deepEqual((await repository.load(record.homeId)).bindings, {});
    } finally {
      await harness.dispose();
    }
  });

  test("adoptRecord rejects stale, foreign, dirty, pending and publishing records; initialRecord rerenders do not reset drafts", async () => {
    const { lifecycle, record } = await fixture();
    const gate = deferred();
    const harness = await mount(record, {
      ...lifecycle,
      autosave: async (...args) => {
        await gate.promise;
        return lifecycle.autosave(...args);
      },
    });
    try {
      assert.equal(
        harness.current.adoptRecord({ ...record, revision: record.revision - 1 }),
        false,
      );
      assert.equal(harness.current.adoptRecord({ ...record, homeId: "foreign" }), false);
      await act(async () => harness.current.commit(changed(harness.current.snapshot)));
      assert.equal(
        harness.current.adoptRecord({ ...record, revision: record.revision + 1 }),
        false,
      );
      await harness.render(record);
      assert.equal(harness.current.snapshot.project.home.name, "Edited draft");
      let flushing;
      await act(async () => {
        flushing = harness.current.flush();
      });
      assert.equal(
        harness.current.adoptRecord({ ...record, revision: record.revision + 1 }),
        false,
      );
      await act(async () => {
        gate.resolve();
        await flushing;
      });
      const currentRecord = harness.current.getRecord();
      await act(async () =>
        assert.equal(
          harness.current.adoptRecord({ ...currentRecord, revision: currentRecord.revision + 1 }),
          true,
        ),
      );
      assert.equal(harness.current.canUndo, false);
      let publishing;
      await act(async () => {
        publishing = harness.current.publish();
        assert.equal(harness.current.adoptRecord(harness.current.getRecord()), false);
      });
      await act(async () => {
        await publishing;
      });
    } finally {
      await harness.dispose();
    }
  });
  test("a failed editor exit cancels pending navigation so Home Assistant setup can be retried", async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    const beforeWindow = globalThis.window,
      beforeDocument = globalThis.document;
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    const root = createRoot(dom.window.document.getElementById("root"));
    let attempts = 0,
      pending;
    const saveAndExit = async () => {
      attempts += 1;
      return false;
    };
    function Harness() {
      const [requested, setRequested] = useState(false);
      pending = requested;
      useEditorExitRequest(requested, false, saveAndExit, () => setRequested(false));
      return createElement(
        "button",
        { onClick: () => setRequested(true) },
        "Set up Home Assistant",
      );
    }
    try {
      await act(async () => root.render(createElement(Harness)));
      await act(async () => dom.window.document.querySelector("button").click());
      assert.equal(pending, false, "a failed save returns control to the current editor");
      await act(async () => dom.window.document.querySelector("button").click());
      assert.equal(attempts, 2, "a later setup click must attempt to save again");
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      globalThis.window = beforeWindow;
      globalThis.document = beforeDocument;
    }
  });

  test("save conflicts explain blocked navigation and back up the current in-memory draft without overwriting the newer record", async (context) => {
    const { record, repository, lifecycle } = await fixture();
    const newerDraft = {
      ...record.draft,
      home: { ...record.draft.home, name: "Saved in another tab" },
    };
    const saved = await lifecycle.autosave(record, newerDraft);
    assert.equal(saved.status, "saved");
    const bytes = testGlb();
    const asset = { bytes, sha256: await engine.modelAssetHash(bytes), byteLength: bytes.length };
    const model = {
      id: "custom:11111111-2222-4333-8444-555555555555",
      name: "Unsaved cabinet",
      profile: "furniture",
      placement: "floor",
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
    const harness = await mount(record, lifecycle, false, true);
    // This model was imported in the conflicted draft and has never reached its record.
    await engine.stageModelAssets([asset]);
    let blob, filename;
    context.mock.method(URL, "createObjectURL", (value) => {
      blob = value;
      return "blob:synthetic-recovery";
    });
    context.mock.method(URL, "revokeObjectURL", () => {});
    context.mock.method(window.HTMLAnchorElement.prototype, "click", function () {
      filename = this.download;
    });
    try {
      await act(async () => {
        const edited = changed(harness.current.snapshot, "Retained in-memory draft");
        edited.project.customModels = [model];
        harness.current.commit(edited);
        assert.equal((await harness.current.flush()).status, "storage-error");
      });
      const alert = document.querySelector('[role="alert"]');
      assert.match(alert.textContent, /changed in another tab/);
      assert.match(alert.textContent, /Navigation is paused/);
      assert.equal(
        [...alert.querySelectorAll("button")].some(
          (button) => button.textContent === "Retry saving",
        ),
        false,
      );
      await act(async () => {
        alert.querySelector("button").click();
        await waitForAsyncCondition(() => blob && filename, {
          message: "The recovery archive download did not complete",
        });
      });
      const archive = await engine.readCabaneFile(blob);
      assert.equal(archive.assets.length, 1);
      assert.equal(filename, `${record.homeId}-draft-recovery.cabane`);
      assert.deepEqual(archive.assets[0].bytes, bytes);
      const backup = JSON.parse(archive.json);
      assert.deepEqual(backup.record.draft.customModels, [model]);
      const imported = parseWorkspaceImport(archive.json, ownerProjectRegistries);
      const freshStorage = new IDBFactory();
      await engine.createModelAssetRepository(freshStorage).restore(archive.assets);
      const restored = await engine
        .createWorkspaceRepository(freshStorage, ownerProjectRegistries)
        .create(imported.record, imported);
      assert.deepEqual(restored.record.draft.customModels, [model]);
      assert.deepEqual(
        await engine.createModelAssetRepository(freshStorage).read(asset.sha256),
        bytes,
      );
      assert.equal(backup.workspace.homeAssistantUrl, origin);
      assert.equal(backup.record.draft.home.name, "Retained in-memory draft");
      assert.deepEqual(backup.record.bindings, harness.current.snapshot.bindings);
      assert.deepEqual(backup.record.published, record.published);
      assert.equal((await repository.load(record.homeId)).draft.home.name, "Saved in another tab");
      assert.equal(harness.current.snapshot.project.home.name, "Retained in-memory draft");
    } finally {
      await harness.dispose();
    }
  });

  test("a failed recovery download reports its error, preserves the draft, and can be retried", async (context) => {
    const { record, lifecycle } = await fixture();
    const harness = await mount(
      record,
      {
        ...lifecycle,
        autosave: async (...args) => ({
          status: "storage-error",
          record: args[0],
          error: new Error("Storage blocked"),
        }),
      },
      false,
      true,
    );
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("Storage access blocked");
      },
    });
    let downloaded = false;
    context.mock.method(URL, "createObjectURL", () => {
      throw new Error("Download blocked");
    });
    context.mock.method(URL, "revokeObjectURL", () => {});
    context.mock.method(window.HTMLAnchorElement.prototype, "click", () => {
      downloaded = true;
    });
    const backupButton = () =>
      [...document.querySelectorAll("button")].find(
        (button) => button.textContent === "Download draft backup",
      );
    try {
      await act(async () => {
        harness.current.commit(changed(harness.current.snapshot, "Unsaved draft"));
        await harness.current.flush();
      });
      await act(async () => backupButton().click());
      assert.match(document.querySelector('[role="alert"]').textContent, /Download blocked/);
      assert.equal(downloaded, false);
      assert.equal(harness.current.snapshot.project.home.name, "Unsaved draft");
      context.mock.method(URL, "createObjectURL", () => "blob:synthetic-recovery");
      await act(async () => backupButton().click());
      assert.equal(downloaded, true);
      assert.doesNotMatch(document.querySelector('[role="alert"]').textContent, /Download blocked/);
    } finally {
      await harness.dispose();
    }
  });

  test("save feedback offers an explicit retry for a transient failure and clears after saving", async () => {
    const { record, lifecycle, repository } = await fixture();
    let unavailable = true;
    const harness = await mount(
      record,
      {
        ...lifecycle,
        autosave: async (...args) =>
          unavailable
            ? {
                status: "storage-error",
                record: args[0],
                error: new Error("Storage temporarily unavailable"),
              }
            : lifecycle.autosave(...args),
      },
      false,
      true,
    );
    try {
      await act(async () => {
        harness.current.commit(changed(harness.current.snapshot, "Retry draft"));
        await harness.current.flush();
      });
      assert.match(
        document.querySelector('[role="alert"]').textContent,
        /Storage temporarily unavailable/,
      );
      unavailable = false;
      await act(async () =>
        [...document.querySelectorAll("button")]
          .find((button) => button.textContent === "Retry saving")
          .click(),
      );
      assert.equal(document.querySelector('[role="alert"]'), null);
      assert.equal((await repository.load(record.homeId)).draft.home.name, "Retry draft");
    } finally {
      await harness.dispose();
    }
  });
});
