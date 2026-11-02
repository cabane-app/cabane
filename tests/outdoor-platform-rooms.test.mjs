import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { act, createElement, useState } from "react";
import { create } from "@react-three/test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { withModules } from "./test-server.mjs";
import { connectedRuntimeFixture } from "./fixtures/home-assistant.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const e = await load("/packages/engine/src/index.ts");
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const { projectFromEditorState, workspaceSnapshotFromEditorState, layoutFloorFromEditorFloor } =
    await load("/apps/web/src/editor-preview/project-sync.ts");
  const { useConnectEditor } = await load("/apps/web/src/editor-connect/useConnectEditor.ts");
  const { RoomNavigation } = await load("/packages/engine/src/room-navigation/RoomNavigation.tsx");
  const { roomCameraFraming } = await load(
    "/packages/engine/src/room-navigation/room-camera-framing.ts",
  );
  const { deriveRoomStatusMap } = await load("/packages/engine/src/room-status/model.ts");
  const { deriveRoofRegions } = await load("/packages/engine/src/roof/roof-coverage.ts");
  const { CeilingSurfaces } = await load(
    "/packages/engine/src/architecture-scene/CeilingSurfaces.tsx",
  );
  const registries = {
    furnishingModels: {},
    deviceModels: stableDeviceRegistry,
    openingModels: {},
  };
  const polygon = [
    [4, 0],
    [6, 0],
    [6, 4],
    [4, 4],
  ];
  const fixture = (enabled = true) => {
    const project = e.createEmptyHomeProject("outdoor-fixture", "Outdoor fixture");
    const square = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ];
    const floor = e.deriveFloorTopology({
      floorId: "ground-floor",
      floorName: "Ground floor",
      coordinates: project.coordinates,
      rooms: [],
      openings: [],
      walls: square.map((from, i) => ({ id: `wall-${i}`, from, to: square[(i + 1) % 4] })),
    }).floor;
    floor.rooms[0].name = "Inside";
    floor.outdoorPlatforms = [
      {
        id: "balcony",
        polygon,
        finish: { kind: "solid", color: "#c8b79b" },
        defaultEdge: { kind: "railing", heightMeters: 1 },
        edges: polygon.map((_, i) => ({ id: `balcony:edge-${i}` })),
        ...(enabled ? { useAsRoom: true, roomName: "Balcony" } : {}),
      },
    ];
    project.floors = [layoutFloorFromEditorFloor(floor)];
    project.sceneItems = [
      {
        id: "balcony-light",
        kind: "device",
        floorId: floor.id,
        modelId: "ceiling-light",
        size: [0.3, 0.1, 0.3],
        placement: { kind: "absolute", at: [5, 2], elevationMeters: 0, rotationYRadians: 0 },
        entitySlots: [
          {
            id: "balcony-light-slot",
            compatibleDomains: ["light"],
            deviceRole: "primary",
            autoMap: "unique-compatible",
            presentation: { label: "Light", dashboardRole: "primary" },
            required: true,
          },
        ],
      },
    ];
    return project;
  };
  const manifestFor = (project) => e.composeHomeManifest(project, registries);
  const runtimeFor = () => {
    const runtime = connectedRuntimeFixture();
    runtime.areas.find((area) => area.area_id === "outside").name = "Balcony";
    return runtime;
  };
  const bindingState = (manifest) => {
    const profile = e.automaticallyMapRuntimeBindings(
      manifest,
      e.createEmptyRuntimeBindingProfile(manifest.home.id),
      runtimeFor(),
    ).profile;
    return { draft: profile, published: profile, manualRoomIds: [], manualSlotIds: [] };
  };

  test("platform room opt-in changes membership and auto-matching without changing the platform default", () => {
    const project = fixture(false);
    let manifest = manifestFor(project);
    assert.equal(manifest.floors[0].rooms.length, 1);
    assert.equal(e.roomIdForItem(project.sceneItems[0], manifest.floors[0]), null);
    assert.equal(e.resolvedRoomIdForItem(project.sceneItems[0], project), null);
    assert.equal(
      e.automaticallyMapRuntimeBindings(
        manifest,
        e.createEmptyRuntimeBindingProfile(project.home.id),
        runtimeFor(),
      ).profile.entityIdsBySlotId["balcony-light-slot"],
      undefined,
    );
    Object.assign(project.floors[0].outdoorPlatforms[0], { useAsRoom: true, roomName: "Balcony" });
    manifest = manifestFor(project);
    const room = manifest.floors[0].rooms.find((room) => room.id === "balcony:room");
    assert.equal(room.name, "Balcony");
    assert.deepEqual(
      room.devices.map((device) => device.id),
      ["balcony-light"],
    );
    assert.equal(e.roomIdForItem(project.sceneItems[0], manifest.floors[0]), room.id);
    assert.equal(e.resolvedRoomIdForItem(project.sceneItems[0], project), room.id);
    const state = bindingState(manifest);
    assert.equal(state.draft.roomAreaIds[room.id], "outside");
    assert.equal(state.draft.entityIdsBySlotId["balcony-light-slot"], "light.unmodeled_path");
    assert.equal(e.validateHomeProject(project, registries).valid, true);
    const validation = e.validateHomeManifest(manifest, { deviceModels: stableDeviceRegistry });
    assert.equal(validation.canRender, true, JSON.stringify(validation.issues));
    const wallItem = {
      ...project.sceneItems[0],
      placement: {
        kind: "wall",
        wallId: "wall-1",
        face: "left",
        offsetFromWallStartPlanUnits: 2,
        elevationMeters: 1,
        depthOffsetMeters: 0.02,
        rotationOffsetRadians: 0,
      },
    };
    assert.equal(e.resolvedRoomIdForItem(wallItem, project), room.id);
  });

  test("Connect exposes the outdoor room and its device, and dashboard navigation, focus and status consume it", async () => {
    const project = fixture();
    const manifest = manifestFor(project);
    const state = bindingState(manifest);
    const runtime = runtimeFor();
    const origin = runtime.origin;
    let editor;
    const renderer = await create(
      createElement(() => {
        const [bindings, onChange] = useState({ [origin]: state });
        editor = useConnectEditor({ manifest, bindings, runtime, origin, active: false, onChange });
        return null;
      }),
    );
    try {
      assert.ok(editor.rooms.some((room) => room.id === "balcony:room"));
      act(() => editor.selectRoom("balcony:room"));
      assert.equal(editor.room.name, "Balcony");
      assert.equal(editor.roomDeviceSummaries["balcony:room"].mapped, 1);
      assert.equal(editor.roomDeviceSummaries["balcony:room"].total, 1);
      act(() => editor.assignArea(""));
      act(() => editor.confirmAreaChange());
      assert.equal(editor.profile.roomAreaIds["balcony:room"], undefined);
    } finally {
      await renderer.unmount();
    }
    const floor = manifest.floors[0];
    const room = floor.rooms.find((room) => room.id === "balcony:room");
    const markup = renderToStaticMarkup(
      createElement(RoomNavigation, {
        floor,
        floors: manifest.floors,
        summary: "Ground",
        rooms: floor.rooms,
        names: {},
        selectedId: room.id,
        onSelect() {},
        onOverview() {},
        onSelectFloor() {},
        reducedMotion: true,
      }),
    );
    assert.match(markup, /Balcony/);
    assert.match(markup, /aria-pressed="true"/);
    const pose = roomCameraFraming(
      floor,
      room,
      0,
      { width: 1000, height: 800 },
      { left: 0, top: 0, width: 1000, height: 800 },
    );
    assert.ok(pose.target.x > 4 && pose.target.x < 6);
    assert.ok(Number.isFinite(pose.zoom) && pose.zoom > 0);
    const resolved = e.resolveHomeAssistantBindings(manifest, state.draft, runtime);
    const status = deriveRoomStatusMap(manifest, state.draft, resolved, runtime)[room.id];
    assert.equal(status.connected, true);
    assert.ok(["on", "off"].includes(status.lighting));
  });

  test("outdoor rooms persist through IndexedDB publication, reopening, and portable project JSON", async () => {
    const project = fixture();
    project.roomProfiles["balcony:room"] = { dashboardSlots: [] };
    const factory = new IDBFactory();
    const repository = e.createHomeProjectRepository(
      e.createIndexedDbProjectRecordStore(factory),
      registries,
    );
    const loaded = await repository.loadOrCreate(project);
    const state = bindingState(manifestFor(project));
    const bindings = { [runtimeFor().origin]: state };
    const saved = await e.autosaveHomeProjectDraft(
      repository,
      loaded.record,
      project,
      Date.now(),
      bindings,
    );
    assert.equal(saved.status, "saved", JSON.stringify(saved));
    const applied = await e.publishHomeProject(repository, saved.record);
    assert.equal(applied.status, "published", JSON.stringify(applied));
    const reopened = await e
      .createHomeProjectRepository(e.createIndexedDbProjectRecordStore(factory), registries)
      .load(project.home.id);
    assert.deepEqual(
      reopened.published.floors[0].outdoorPlatforms,
      project.floors[0].outdoorPlatforms,
    );
    assert.equal(reopened.published.floors[0].rooms.length, 1);
    assert.equal(
      reopened.bindings[runtimeFor().origin].published.roomAreaIds["balcony:room"],
      "outside",
    );
    const portable = e.parseHomeProject(e.serializeHomeProject(reopened.published));
    assert.equal(portable.valid, true);
    assert.equal(manifestFor(portable.project).floors[0].rooms[1].id, "balcony:room");
    assert.equal(e.createFloorEditorDraft(manifestFor(portable.project).floors[0]).rooms.length, 1);
    assert.equal(
      layoutFloorFromEditorFloor(manifestFor(portable.project).floors[0]).rooms.length,
      1,
    );
  });

  test("rename, disable, delete and undo reconcile room state while retaining outdoor geometry and device mappings", () => {
    const project = fixture();
    const floor = project.floors[0];
    project.roomProfiles["balcony:room"] = { dashboardSlots: [] };
    const origin = runtimeFor().origin;
    const bindings = { [origin]: bindingState(manifestFor(project)) };
    let history = e.createFloorEditorHistory(e.createFloorEditorDraft(floor));
    history = e.floorEditorReducer(history, {
      type: "update-outdoor-platform",
      id: "balcony",
      changes: { roomName: "Terrace" },
    });
    const renamed = e.deriveFloorTopology(history.present).floor;
    const renamedProject = projectFromEditorState(project, renamed, project.sceneItems);
    assert.equal(manifestFor(renamedProject).floors[0].rooms[1].id, "balcony:room");
    assert.equal(manifestFor(renamedProject).floors[0].rooms[1].name, "Terrace");
    history = e.floorEditorReducer(history, {
      type: "update-outdoor-platform",
      id: "balcony",
      changes: { useAsRoom: false },
    });
    const disabled = e.deriveFloorTopology(history.present).floor;
    const next = workspaceSnapshotFromEditorState(
      { project: renamedProject, bindings },
      disabled,
      project.sceneItems,
      registries,
    );
    assert.equal(manifestFor(next.project).floors[0].rooms.length, 1);
    assert.equal(next.project.roomProfiles["balcony:room"], undefined);
    assert.equal(next.bindings[origin].draft.roomAreaIds["balcony:room"], undefined);
    assert.equal(
      next.bindings[origin].draft.entityIdsBySlotId["balcony-light-slot"],
      "light.unmodeled_path",
    );
    assert.equal(e.resolvedRoomIdForItem(project.sceneItems[0], next.project), null);
    assert.equal(disabled.outdoorPlatforms[0].roomName, "Terrace");
    history = e.floorEditorReducer(history, { type: "undo" });
    assert.equal(history.present.outdoorPlatforms[0].useAsRoom, true);
    history = e.floorEditorReducer(history, {
      type: "select",
      selection: { kind: "outdoor-platform", id: "balcony" },
    });
    history = e.floorEditorReducer(history, { type: "delete-selection" });
    const deleted = workspaceSnapshotFromEditorState(
      { project, bindings },
      e.deriveFloorTopology(history.present).floor,
      project.sceneItems,
      registries,
    );
    assert.equal(deleted.project.roomProfiles["balcony:room"], undefined);
    assert.equal(deleted.bindings[origin].draft.roomAreaIds["balcony:room"], undefined);
  });

  test("room opt-in does not add floor slabs, ceilings or roofs, including platform-only floors", async () => {
    const project = fixture();
    const source = project.floors[0];
    const floor = manifestFor(project).floors[0];
    assert.deepEqual(deriveRoofRegions([floor]), deriveRoofRegions([source]));
    assert.deepEqual(e.floorSlabPolygons(floor), e.floorSlabPolygons(source));
    const before = await create(createElement(CeilingSurfaces, { floor: source }));
    const after = await create(createElement(CeilingSurfaces, { floor }));
    try {
      assert.equal(
        after.scene.findAllByType("mesh").length,
        before.scene.findAllByType("mesh").length,
      );
    } finally {
      await before.unmount();
      await after.unmount();
    }
    const platformOnly = e.deriveFloorTopology({
      ...e.createFloorEditorDraft(source),
      walls: [],
      rooms: [],
    }).floor;
    project.floors = [layoutFloorFromEditorFloor(platformOnly)];
    const runtime = manifestFor(project).floors[0];
    assert.equal(runtime.rooms.length, 1);
    assert.deepEqual(e.floorSlabPolygons(runtime), []);
    assert.deepEqual(deriveRoofRegions([runtime]), []);
    const renderer = await create(createElement(CeilingSurfaces, { floor: runtime }));
    try {
      assert.equal(renderer.scene.findAllByType("mesh").length, 0);
    } finally {
      await renderer.unmount();
    }
  });

  test("the platform surface selects its room once and ordinary platforms keep their original surface", async () => {
    for (const enabled of [false, true]) {
      const project = fixture(enabled);
      const floor = manifestFor(project).floors[0];
      const selected = [];
      const renderer = await create(
        createElement(e.FloorFinishSurfaces, {
          floor,
          variant: "scene",
          reducedMotion: true,
          selectedRoomId: enabled ? "balcony:room" : null,
          onSelectRoom: (id) => selected.push(id),
        }),
      );
      try {
        assert.equal(renderer.scene.findAllByProps({ name: "room-balcony:room" }).length, 0);
        assert.equal(
          renderer.scene.findAllByProps({ name: "platform-finish-balcony-interaction" }).length,
          enabled ? 1 : 0,
        );
        const surface = renderer.scene.findByProps({ name: "platform-finish-balcony" });
        if (enabled) {
          const pointer = {
            pointerId: 1,
            nativeEvent: { clientX: 10, clientY: 10 },
            stopPropagation() {},
          };
          await renderer.fireEvent(surface, "pointerDown", pointer);
          await renderer.fireEvent(surface, "pointerUp", pointer);
          assert.deepEqual(selected, ["balcony:room"]);
        } else assert.equal(surface.props.onPointerDown, undefined);
      } finally {
        await renderer.unmount();
      }
    }
  });

  test("removing an upper floor removes its platform room profile and private area mapping", () => {
    const project = fixture();
    const ground = project.floors[0];
    const upper = {
      ...ground,
      id: "upper",
      name: "Upper",
      rooms: [],
      walls: [],
      wallJunctions: [],
      ceilings: [],
      openings: [],
    };
    project.floors = [{ ...ground, outdoorPlatforms: [] }, upper];
    project.sceneItems = project.sceneItems.map((item) => ({ ...item, floorId: "upper" }));
    project.roomProfiles["balcony:room"] = { dashboardSlots: [] };
    const origin = runtimeFor().origin;
    const bindings = { [origin]: bindingState(manifestFor(project)) };
    const removed = e.removeFloor({ project, bindings }, "upper");
    assert.equal(removed.project.roomProfiles["balcony:room"], undefined);
    assert.equal(removed.bindings[origin].draft.roomAreaIds["balcony:room"], undefined);
  });

  test("platform fields reject malformed imports, empty names and generated identity collisions", () => {
    const project = fixture();
    const platform = project.floors[0].outdoorPlatforms[0];
    platform.useAsRoom = "yes";
    assert.equal(e.parseHomeProjectSchema(project).valid, false);
    platform.useAsRoom = true;
    platform.roomName = " ";
    assert.equal(e.validateHomeProject(project, registries).valid, false);
    platform.roomName = "Balcony";
    project.sceneItems[0].id = "balcony:room";
    assert.ok(
      e
        .validateHomeProject(project, registries)
        .issues.some((issue) => issue.code === "project.item-id-duplicate"),
    );
    const legacy = fixture(false);
    const { coordinates, floors, stairs, ...rest } = legacy;
    const migrated = e.parseHomeProjectSchema({ ...rest, schemaVersion: 1, floor: floors[0] });
    assert.equal(migrated.valid, true);
    assert.equal(manifestFor(migrated.project).floors[0].rooms.length, 1);
  });
});
