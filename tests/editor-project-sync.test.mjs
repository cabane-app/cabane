import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const {
    layoutFloorFromEditorFloor,
    projectCommandForEditorChange,
    projectEditorRestoration,
    projectFromEditorState,
    workspaceSnapshotFromEditorState,
  } = await load("/apps/web/src/editor-preview/project-sync.ts");
  const { ownerProjectManifest } = await load("/tests/fixtures/bundled-home.ts");
  const { ownerProjectRegistries, composeOwnerProjectManifest } = await load(
    "/apps/web/src/project-runtime.ts",
  );
  const { ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  const { collectBindingSlots, validateHomeProject } = await load("/packages/engine/src/index.ts");
  const { createFurnishingEditorState, furnishingEditorReducer: reduce } = await load(
    "/apps/web/src/editor-preview/furnish/editor-state.ts",
  );

  const project = {
    schemaVersion: 2,
    coordinates: ownerProjectManifest.coordinates,
    stairs: [],
    seedRevision: "test",
    home: ownerProjectManifest.home,
    floors: [layoutFloorFromEditorFloor(ownerProjectManifest.floors[0])],
    sceneItems: ownerProjectManifest.sceneItems,
    roomProfiles: Object.fromEntries(
      ownerProjectManifest.floors[0].rooms.map((room) => [
        room.id,
        { dashboardSlots: room.dashboardSlots },
      ]),
    ),
    openingProfiles: Object.fromEntries(
      ownerProjectManifest.floors[0].openings.map((opening) => [
        opening.id,
        opening.contactSlot ? { contactSlot: opening.contactSlot } : {},
      ]),
    ),
    shortcuts: ownerProjectManifest.shortcuts,
    assumptions: ownerProjectManifest.assumptions,
  };

  test("strips runtime-owned floor profiles from an editor floor", () => {
    const floor = layoutFloorFromEditorFloor(ownerProjectManifest.floors[0]);
    assert.ok(
      floor.rooms.every((room) => room.dashboardSlots.length === 0 && room.devices.length === 0),
    );
    assert.ok(floor.openings.every((opening) => !("contactSlot" in opening)));
  });

  test("pool-only edits preserve accepted architecture, furnishings, profiles and bindings", () => {
    const floor = ownerProjectManifest.floors[0];
    const pool = {
      id: "test-pool",
      polygon: [
        [2, -3],
        [5, -3],
        [5, -1],
        [2, -1],
      ],
    };
    const device = ownerHomeProject.sceneItems.find((item) => item.kind === "device");
    const slot = collectBindingSlots(composeOwnerProjectManifest(ownerHomeProject)).find(
      (slot) => slot.deviceSlotId === device.id,
    );
    const profile = {
      schemaVersion: 1,
      homeId: project.home.id,
      roomAreaIds: {},
      entityIdsBySlotId: { [slot.slotId]: "light.fixture" },
    };
    const bindings = {
      "https://fixture.invalid": {
        draft: profile,
        published: profile,
        manualRoomIds: [],
        manualSlotIds: [slot.slotId],
      },
    };
    const next = workspaceSnapshotFromEditorState(
      { project, bindings },
      { ...floor, pools: [pool] },
      project.sceneItems,
      ownerProjectRegistries,
    );
    assert.deepEqual(next.project.floors[0].pools, [pool]);
    assert.deepEqual(
      { ...next.project, floors: [{ ...next.project.floors[0], pools: undefined }] },
      { ...project, floors: [{ ...project.floors[0], pools: undefined }] },
    );
    assert.deepEqual(next.bindings, bindings);
  });

  test("reconciles profiles when construction changes room and opening identities", () => {
    const floor = {
      ...ownerProjectManifest.floors[0],
      rooms: ownerProjectManifest.floors[0].rooms.slice(0, 1),
      openings: ownerProjectManifest.floors[0].openings.slice(0, 1),
    };
    const next = projectFromEditorState(project, floor, project.sceneItems);
    assert.deepEqual(Object.keys(next.roomProfiles), [floor.rooms[0].id]);
    assert.deepEqual(Object.keys(next.openingProfiles), [floor.openings[0].id]);
  });

  test("creates one reversible command for a semantic editor change", () => {
    const after = { ...project, sceneItems: project.sceneItems.slice(1) };
    const command = projectCommandForEditorChange({
      before: project,
      after,
      domain: "furnish",
      id: "change-1",
      label: "Remove furnishing",
    });
    assert.ok(command);
    assert.deepEqual(
      command.before.map(({ path }) => path),
      [["sceneItems"]],
    );
    assert.deepEqual(command.after[0].value, after.sceneItems);
  });

  test("deleted device slots are cleaned even when unrelated validation errors remain", () => {
    const project = ownerHomeProject;
    const manifest = composeOwnerProjectManifest(project);
    const device = project.sceneItems.find((item) => item.kind === "device");
    const slot = collectBindingSlots(manifest).find((slot) => slot.deviceSlotId === device.id);
    assert.ok(slot);
    const profile = {
      schemaVersion: 1,
      homeId: project.home.id,
      roomAreaIds: {},
      entityIdsBySlotId: { [slot.slotId]: "light.fixture" },
    };
    const bindings = {
      "https://fixture.invalid": {
        draft: profile,
        published: profile,
        manualRoomIds: [],
        manualSlotIds: [slot.slotId],
      },
    };
    const items = project.sceneItems.filter((item) => item.id !== device.id);
    const floor = {
      ...manifest.floors[0],
      rooms: manifest.floors[0].rooms.map((room, index) =>
        index === 0 ? { ...room, name: "Unnamed room" } : room,
      ),
    };
    const contextualIssues = [
      {
        code: "construct.unnamed-room",
        path: "floor.rooms.0.name",
        message: "Give this room a name.",
        severity: "warning",
      },
    ];
    const next = workspaceSnapshotFromEditorState(
      { project, bindings },
      floor,
      items,
      ownerProjectRegistries,
      contextualIssues,
    );
    const validation = validateHomeProject(next.project, ownerProjectRegistries);
    assert.ok(
      validation.issues.every((issue) => issue.severity !== "error"),
      JSON.stringify(validation.issues),
    );
    assert.deepEqual(next.bindings["https://fixture.invalid"].draft.entityIdsBySlotId, {});
    assert.deepEqual(next.bindings["https://fixture.invalid"].manualSlotIds, []);
    assert.deepEqual(next.bindings["https://fixture.invalid"].published, profile);
    const invalidItems = [...items, { ...items[0], id: items[1].id }];
    const invalid = workspaceSnapshotFromEditorState(
      { project, bindings },
      floor,
      invalidItems,
      ownerProjectRegistries,
    );
    assert.ok(
      validateHomeProject(invalid.project, ownerProjectRegistries).issues.some(
        (issue) => issue.severity === "error",
      ),
    );
    assert.deepEqual(invalid.bindings["https://fixture.invalid"].draft.entityIdsBySlotId, {});
    assert.deepEqual(invalid.bindings["https://fixture.invalid"].manualSlotIds, []);
    assert.deepEqual(invalid.bindings["https://fixture.invalid"].published, profile);
    const failedTopology = workspaceSnapshotFromEditorState(
      { project, bindings },
      floor,
      items,
      ownerProjectRegistries,
      [{ ...contextualIssues[0], severity: "error" }],
    );
    assert.deepEqual(
      failedTopology.bindings["https://fixture.invalid"].draft.entityIdsBySlotId,
      {},
    );
    assert.deepEqual(failedTopology.bindings["https://fixture.invalid"].manualSlotIds, []);
    assert.deepEqual(failedTopology.bindings["https://fixture.invalid"].published, profile);
  });

  test("grouping preserves bindings, duplication leaves new slots unbound, and group deletion cleans only draft mappings", () => {
    const project = ownerHomeProject;
    const manifest = composeOwnerProjectManifest(project);
    const device = project.sceneItems.find((item) => item.kind === "device");
    const furniture = project.sceneItems.find(
      (item) => item.kind === "furnishing" && item.floorId === device.floorId,
    );
    const floor = manifest.floors.find((floor) => floor.id === device.floorId);
    const slot = collectBindingSlots(manifest).find((slot) => slot.deviceSlotId === device.id);
    const profile = {
      schemaVersion: 1,
      homeId: project.home.id,
      roomAreaIds: {},
      entityIdsBySlotId: { [slot.slotId]: "light.fixture" },
    };
    const origin = "https://fixture.invalid";
    const bindings = {
      [origin]: {
        draft: profile,
        published: profile,
        manualRoomIds: [],
        manualSlotIds: [slot.slotId],
      },
    };
    const grouped = reduce(
      createFurnishingEditorState(
        project.sceneItems.filter((item) => item.floorId === device.floorId),
      ),
      { type: "group-items", ids: [device.id, furniture.id], reservedIds: [] },
    );
    const saved = workspaceSnapshotFromEditorState(
      { project, bindings },
      floor,
      grouped.items,
      ownerProjectRegistries,
    );
    assert.deepEqual(saved.bindings, bindings);
    const duplicated = reduce(grouped, {
      type: "duplicate-items",
      ids: [device.id],
      floor,
      reservedIds: [],
    });
    const copied = workspaceSnapshotFromEditorState(
      saved,
      floor,
      duplicated.items,
      ownerProjectRegistries,
    );
    assert.deepEqual(copied.bindings[origin].draft.entityIdsBySlotId, profile.entityIdsBySlotId);
    const copies = duplicated.items.slice(grouped.items.length);
    assert.equal(copies.length, 2);
    for (const copy of copies)
      for (const slot of copy.entitySlots ?? [])
        assert.equal(copied.bindings[origin].draft.entityIdsBySlotId[slot.id], undefined);
    const deleted = reduce(duplicated, { type: "delete-items", ids: [furniture.id] });
    const removed = workspaceSnapshotFromEditorState(
      copied,
      floor,
      deleted.items,
      ownerProjectRegistries,
    );
    assert.deepEqual(removed.bindings[origin].draft.entityIdsBySlotId, {});
    assert.deepEqual(removed.bindings[origin].published, profile);
    assert.ok(
      copies.every((copy) => removed.project.sceneItems.some((item) => item.id === copy.id)),
    );
  });

  test("item history restores selection without rebuilding shared ceilings or architecture", () => {
    const withoutItem = { ...project, sceneItems: project.sceneItems.slice(1) };
    const restoration = projectEditorRestoration(withoutItem, project, null);
    assert.deepEqual(restoration, {
      floorChanged: false,
      selectedItemId: project.sceneItems[0].id,
    });
    assert.equal(
      projectEditorRestoration(project, withoutItem, project.sceneItems[0].id).selectedItemId,
      null,
    );
    const renamedFloor = { ...project, floors: [{ ...project.floors[0], name: "Renamed floor" }] };
    assert.equal(projectEditorRestoration(project, renamedFloor, null).floorChanged, true);
  });
});
