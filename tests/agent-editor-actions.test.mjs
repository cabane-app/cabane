import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { makeThreeFloorProject, makeStairProject } = await load(
    "/tests/fixtures/multiple-floors.ts",
  );
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const { catalogEntries } = await load("/apps/web/src/editor-preview/furnish/catalog/catalog.ts");
  const { catalogStartPlacement } = await load(
    "/apps/web/src/editor-preview/furnish/placement/catalog-start-placement.ts",
  );
  const { useHomeEditorController } = await load(
    "/apps/web/src/editor-workspace/useHomeEditorController.ts",
  );
  const { executeAgentRequest } = await load("/apps/web/src/agent-pilot/agent-command-executor.ts");

  async function withEditor(
    project,
    run,
    { initialDraft, initialBindings, homeAssistantUrl = null, mode = "furnish" } = {},
  ) {
    return withStorageDom(async ({ document, indexedDB, until }) => {
      const repository = engine.createHomeProjectRepository(
        engine.createIndexedDbProjectRecordStore(indexedDB),
        ownerProjectRegistries,
      );
      const lifecycle = engine.createHomeProjectLifecycle(repository, project);
      const loaded = await lifecycle.load();
      assert.equal(loaded.status, "ready");
      let initialRecord = loaded.record;
      if (initialBindings) {
        initialRecord = await repository.replace(
          { ...initialRecord, bindings: initialBindings },
          initialRecord.revision,
        );
      }
      if (initialDraft) initialRecord = { ...initialRecord, draft: initialDraft };
      const container = document.body.appendChild(document.createElement("div"));
      const root = createRoot(container);
      const controllerRef = { current: null };
      function Harness() {
        controllerRef.current = useHomeEditorController({
          initialRecord,
          lifecycle,
          initialRequest: { mode },
          homeAssistantUrl,
          autosaveDelayMs: 60_000,
          onClose() {},
        });
        return null;
      }
      const request = async (method, params = {}) => {
        let pending;
        await act(async () => {
          pending = executeAgentRequest(project.home.id, controllerRef, {
            requestId: "test",
            method,
            params,
          });
          // Invalid wire input rejects before rendering is needed. Keep that rejection
          // handled while React flushes the initial dispatch and project-sync effect.
          pending.catch(() => {});
        });
        let result;
        await act(async () => {
          result = await pending;
        });
        return result;
      };
      const command = async (action, params = {}) => {
        await until(() => !controllerRef.current.editingLocked && !controllerRef.current.unsettled);
        return request("execute_action", { ...params, action });
      };
      try {
        await act(async () => root.render(createElement(Harness)));
        await until(() => !controllerRef.current.unsettled);
        // The scene normally supplies this camera visibility callback. This DOM
        // harness exercises editor behavior without mounting a WebGL canvas.
        controllerRef.current.handleCameraTargetChange([2, 2], () => true);
        await run({
          get controller() {
            return controllerRef.current;
          },
          request,
          command,
          until,
          read: () => repository.load(project.home.id),
          async ui(edit) {
            await act(async () => edit(controllerRef.current));
            await until(() => !controllerRef.current.unsettled);
          },
        });
      } finally {
        await act(async () => root.unmount());
      }
    });
  }

  test("agent catalog placement keeps the UI's fitted size and persists through shared undo/redo", async () => {
    await withEditor(makeThreeFloorProject(), async (h) => {
      const entry = catalogEntries(h.controller.furnishingModels, h.controller.deviceModels).find(
        (entry) => entry.modelId === "motorized-blind",
      );
      assert.ok(entry);
      const at = [2, 2];
      const fitted = catalogStartPlacement(entry, h.controller.placementFloor, at);
      assert.ok(fitted.placement, fitted.error);
      assert.ok(fitted.size);
      await h.ui((controller) => {
        const added = controller.addCatalogItem(entry, { at });
        assert.ok(added.itemId, added.error);
      });
      const uiItem = structuredClone(h.controller.editorProject.sceneItems[0]);
      assert.deepEqual(uiItem.size, fitted.size);
      await h.command({ type: "undo" });
      assert.equal(h.controller.editorProject.sceneItems.length, 0);
      const result = await h.command({ type: "add-item", modelId: entry.modelId, at });
      assert.equal(result.changed, true);
      assert.equal(result.persisted, true);
      const item = h.controller.editorProject.sceneItems[0];
      assert.deepEqual(item.placement, uiItem.placement);
      assert.deepEqual(item.size, uiItem.size);
      const stored = await h.read();
      assert.deepEqual(stored.draft.sceneItems, h.controller.editorProject.sceneItems);
      assert.deepEqual(stored.published.sceneItems, []);
      const diff = await h.request("get_draft_diff");
      assert.ok(diff.changedProjectSections.includes("sceneItems"));
      await h.command({ type: "undo" });
      assert.deepEqual((await h.read()).draft.sceneItems, []);
      await h.command({ type: "redo" });
      assert.deepEqual((await h.read()).draft.sceneItems, [item]);
    });
  });

  test("invalid compound item edits leave both the draft and history unchanged", async () => {
    await withEditor(makeThreeFloorProject(), async (h) => {
      await h.command({ type: "add-item", modelId: "white-shell-dining-chair", at: [2, 2] });
      const item = h.controller.editorProject.sceneItems[0];
      const before = structuredClone(h.controller.editorProject);
      const revision = (await h.request("inspect_workspace")).draftRevision;
      await assert.rejects(
        h.command({
          type: "update-item",
          itemId: item.id,
          patch: { placement: { ...item.placement, at: [2.5, 2] }, size: [1, -1, 1] },
        }),
        /size|positive|greater|minimum/i,
      );
      assert.deepEqual(h.controller.editorProject, before);
      assert.equal((await h.request("inspect_workspace")).draftRevision, revision);
      assert.deepEqual((await h.read()).draft, before);
      await h.command({ type: "undo" });
      assert.deepEqual(
        h.controller.editorProject.sceneItems,
        [],
        "no partial patch added an undo entry",
      );
    });
  });

  test("group commands use explicit item IDs and preserve one-step group deletion history", async () => {
    await withEditor(makeThreeFloorProject(), async (h) => {
      for (const at of [
        [1.5, 1.5],
        [3, 1.5],
      ])
        await h.command({ type: "add-item", modelId: "white-shell-dining-chair", at });
      const ids = h.controller.editorProject.sceneItems.map((item) => item.id);
      const beforeMove = structuredClone(h.controller.editorProject.sceneItems);
      const placements = Object.fromEntries(
        beforeMove.map((item) => [
          item.id,
          {
            ...item.placement,
            at: [item.placement.at[0] + 0.2, item.placement.at[1] + 0.2],
          },
        ]),
      );
      await h.command({ type: "update-item-placements", placements });
      assert.deepEqual(
        h.controller.editorProject.sceneItems.map((item) => item.placement),
        ids.map((id) => placements[id]),
      );
      const moved = structuredClone(h.controller.editorProject.sceneItems);
      const movedRevision = (await h.request("inspect_workspace")).draftRevision;
      await assert.rejects(
        h.command({
          type: "update-item-placements",
          placements: {
            [ids[0]]: { ...placements[ids[0]], at: [2, 2] },
            [ids[1]]: { ...placements[ids[1]], at: [1] },
          },
        }),
        /two-number plan point/,
      );
      assert.deepEqual(h.controller.editorProject.sceneItems, moved);
      assert.equal((await h.request("inspect_workspace")).draftRevision, movedRevision);
      await h.command({ type: "undo" });
      assert.deepEqual(h.controller.editorProject.sceneItems, beforeMove);
      await h.ui((controller) => controller.furnishingEditor.select(null));
      await h.command({ type: "group-items", itemIds: ids });
      const grouped = structuredClone(h.controller.editorProject.sceneItems);
      const groupId = grouped[0].group.id;
      assert.ok(groupId);
      assert.ok(grouped.every((item) => item.group.id === groupId));
      await h.command({ type: "duplicate-items", itemIds: [ids[0]] });
      const copies = h.controller.editorProject.sceneItems.filter((item) => !ids.includes(item.id));
      assert.equal(copies.length, 2, "duplicating one group member duplicates the whole group");
      assert.equal(copies[0].group.id, copies[1].group.id);
      assert.notEqual(copies[0].group.id, groupId);
      assert.equal(new Set(h.controller.editorProject.sceneItems.map((item) => item.id)).size, 4);
      await h.command({ type: "undo" });
      assert.deepEqual(h.controller.editorProject.sceneItems, grouped);
      await h.command({ type: "rename-group", groupId, name: "Dining chairs" });
      assert.ok(
        h.controller.editorProject.sceneItems.every((item) => item.group.name === "Dining chairs"),
      );
      await h.command({ type: "delete-items", itemIds: [ids[0]] });
      assert.deepEqual((await h.read()).draft.sceneItems, []);
      await h.command({ type: "undo" });
      assert.equal(h.controller.editorProject.sceneItems.length, 2);
      assert.ok(
        h.controller.editorProject.sceneItems.every((item) => item.group.name === "Dining chairs"),
      );
      await h.command({ type: "ungroup-items", itemIds: ids });
      assert.ok(h.controller.editorProject.sceneItems.every((item) => !item.group));
    });
  });

  test("project commands share floor, stair and home settings history and save the complete draft", async () => {
    await withEditor(makeStairProject(), async (h) => {
      await h.command({ type: "rename-floor", floorId: "first", name: "Upstairs" });
      assert.equal(h.controller.editorProject.floors[1].name, "Upstairs");
      await h.command({ type: "set-floor-height", floorId: "ground", heightMeters: 2.8 });
      assert.equal(h.controller.editorProject.floors[0].floorToFloorHeightMeters, 2.8);
      const stair = h.controller.editorProject.stairs[0];
      await h.command({ type: "update-stair", stair: { ...stair, widthMeters: 1.1 } });
      assert.equal(h.controller.editorProject.stairs[0].widthMeters, 1.1);
      await h.command({ type: "delete-stair", stairId: stair.id });
      assert.deepEqual(h.controller.editorProject.stairs, []);
      await h.command({ type: "add-stair", stair: { ...stair, widthMeters: 1.1 } });
      assert.equal(h.controller.editorProject.stairs[0].widthMeters, 1.1);
      await h.command({ type: "undo" });
      assert.deepEqual(h.controller.editorProject.stairs, []);
      await h.command({ type: "redo" });
      assert.equal(h.controller.editorProject.stairs[0].widthMeters, 1.1);
      await h.command({ type: "update-home-settings", changes: { northAngleDegrees: 45 } });
      assert.equal(h.controller.editorProject.home.northAngleDegrees, 45);
      await h.command({ type: "add-floor-above", id: "loft" });
      assert.equal(h.controller.activeFloorId, "loft");
      assert.equal(h.controller.constructEditor.draft.floorId, "loft");
      assert.equal(h.controller.editorProject.floors.length, 4);
      assert.deepEqual((await h.read()).draft, h.controller.editorProject);
      await h.command({ type: "undo" });
      assert.equal(h.controller.editorProject.floors.length, 3);
      assert.equal(h.controller.editorProject.home.northAngleDegrees, 45);
    });
  });

  test("stale command revisions reject unsaved UI edits and inspection exposes full geometry", async () => {
    await withEditor(makeThreeFloorProject(), async (h) => {
      const before = await h.request("inspect_workspace");
      assert.deepEqual(before.floors, h.controller.editorProject.floors);
      assert.deepEqual(before.project.coordinates, h.controller.editorProject.coordinates);
      assert.ok(before.floors[0].walls.length);
      await h.ui((controller) =>
        controller.executeProjectAction({
          type: "rename-floor",
          floorId: "ground",
          name: "Unsaved UI name",
        }),
      );
      assert.equal((await h.read()).draft.floors[0].name, "Ground floor");
      await assert.rejects(
        h.command(
          {
            type: "rename-floor",
            floorId: "ground",
            name: "Stale agent name",
          },
          { expectedRevision: before.draftRevision },
        ),
        /revision changed/,
      );
      assert.equal(h.controller.editorProject.floors[0].name, "Unsaved UI name");
      assert.ok((await h.request("inspect_workspace")).draftRevision > before.draftRevision);
    });
  });

  test("draft validation keeps room issues hidden by the active wall tool", async () => {
    const project = makeThreeFloorProject();
    const invalid = structuredClone(project);
    invalid.floors[0].rooms[0].name = "";
    await withEditor(
      project,
      async (h) => {
        await h.ui((controller) => controller.constructEditor.setTool("wall"));
        const validation = await h.request("validate_draft");
        const roomIssues = validation.issues.filter((issue) => /room[.-]name/.test(issue.code));
        assert.ok(roomIssues.length, JSON.stringify(validation.issues));
        assert.ok(
          roomIssues.some(
            (issue) =>
              !h.controller.displayedContextualIssues.some(
                (displayed) => displayed.code === issue.code && displayed.path === issue.path,
              ),
          ),
        );
        assert.ok(validation.errorCount + validation.warningCount === validation.issues.length);
      },
      { initialDraft: invalid, mode: "construct" },
    );
  });

  test("draft diff retains unpublished connection changes after autosave and clears them after reset", async () => {
    const project = makeThreeFloorProject();
    const roomId = project.floors[0].rooms[0].id;
    const origin = "https://fixture.invalid";
    const profile = {
      schemaVersion: 1,
      homeId: project.home.id,
      roomAreaIds: { [roomId]: "synthetic-area" },
      entityIdsBySlotId: {},
    };
    await withEditor(
      project,
      async (h) => {
        assert.equal((await h.request("get_draft_diff")).bindingsChanged, false);
        const result = await h.command({ type: "apply-room-mapping", roomId, areaId: null });
        assert.equal(result.persisted, true);
        const stored = await h.read();
        assert.deepEqual(stored.bindings[origin].draft.roomAreaIds, {});
        assert.deepEqual(stored.bindings[origin].published.roomAreaIds, profile.roomAreaIds);
        assert.equal((await h.request("get_draft_diff")).bindingsChanged, true);
        await h.command({ type: "discard-draft" });
        assert.equal((await h.request("get_draft_diff")).bindingsChanged, false);
      },
      {
        homeAssistantUrl: origin,
        initialBindings: {
          [origin]: {
            draft: profile,
            published: profile,
            manualRoomIds: [roomId],
            manualSlotIds: [],
          },
        },
      },
    );
  });
});
