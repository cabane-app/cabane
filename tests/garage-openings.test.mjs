import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3 } from "three";
import { withModules } from "./test-server.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { SceneOpeningRenderer } = await load("/packages/engine/src/SceneOpeningRenderer.tsx");
  const { DOOR_PRESETS, DoorModel } = await load("/packages/catalog/src/architecture/index.ts");
  const { ownerHomeProject, ownerProjectManifest } = await load("/tests/fixtures/bundled-home.ts");
  const { deriveDemoSessionDefinition } = await load(
    "/packages/engine/src/onboarding/demo/demo-session-definition.ts",
  );
  const { resolveOpeningPositions, passableOpeningIds } = await load(
    "/packages/engine/src/opening-pose.ts",
  );
  const { projectFromEditorState, workspaceSnapshotFromEditorState } = await load(
    "/apps/web/src/editor-preview/project-sync.ts",
  );
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const { floorEditorReducer } = await load(
    "/packages/engine/src/home-editor/construct/editor-state.ts",
  );
  const garage = ownerProjectManifest.floors[0].openings.find(
    (opening) => opening.operation === "roll-up",
  );
  const floor = ownerProjectManifest.floors[0];
  const wall = floor.walls.find((wall) => wall.id === garage.wallId);

  test("garage interaction labels follow custom names without changing the target or slot", async () => {
    const props = {
      floor,
      wall,
      opening: garage,
      model: () => createElement("group"),
      position: 0,
      reducedMotion: true,
      onInteract() {},
    };
    const renderer = await create(createElement(SceneOpeningRenderer, props));
    try {
      for (const name of [undefined, "Driveway entrance", "Side garage", undefined]) {
        await renderer.update(
          createElement(SceneOpeningRenderer, {
            ...props,
            opening: { ...garage, name },
          }),
        );
        const targets = [];
        renderer.scene.instance.traverse((object) => {
          if (object.userData.walkDeviceInteraction)
            targets.push(object.userData.walkDeviceInteraction);
        });
        assert.deepEqual(targets, [
          { id: garage.id, slotId: garage.coverSlot.id, label: name ?? "Garage door" },
        ]);
      }
    } finally {
      await renderer.unmount();
    }
  });

  test("catalog presets round-trip at non-unit scale and placement/history use the configured dimensions", () => {
    assert.deepEqual(
      DOOR_PRESETS.map((p) => p.label),
      [
        "Panel wood",
        "Panel white",
        "Panel white · Compact lever",
        "French",
        "Full glass",
        "Sliding wood",
        "Garage door",
        "Arched steel glass",
      ],
    );
    for (const { configuration } of DOOR_PRESETS) {
      const opening = engine.doorFromConfiguration(configuration, 0.5, {
        id: "test-door",
        wallId: wall.id,
        offsetFromWallStartPlanUnits: 1,
      });
      assert.deepEqual(engine.doorConfiguration(opening, 0.5), configuration);
      const draft = engine.createFloorEditorDraft({
        ...floor,
        coordinates: { ...floor.coordinates, metersPerPlanUnit: 0.5 },
        openings: [],
      });
      const history = floorEditorReducer(engine.createFloorEditorHistory(draft), {
        type: "add-opening",
        wallId: wall.id,
        kind: "door",
        offsetPlanUnits: 1,
        doorConfiguration: configuration,
      });
      const added = history.present;
      assert.deepEqual(floorEditorReducer(history, { type: "undo" }).present, draft);
      assert.deepEqual(
        floorEditorReducer(floorEditorReducer(history, { type: "undo" }), { type: "redo" }).present,
        added,
      );
      assert.equal(added.openings[0].widthPlanUnits, configuration.widthMeters / 0.5);
      assert.equal(added.openings[0].openingHeightMeters, configuration.heightMeters);
      assert.equal(added.openings[0].operation, configuration.operation);
      assert.equal(added.openings[0].leafCount, configuration.leafCount);
    }
  });

  test("the demo owns one architectural garage with a real cover slot and a portable schema", () => {
    assert.equal(garage.id, "garage-motorized-vehicle-door");
    assert.equal(
      ownerHomeProject.sceneItems.some((item) => item.id === garage.id),
      false,
    );
    assert.equal(engine.parseHomeProjectSchema(ownerHomeProject).valid, true);
    const parsed = engine.parseHomeProject(engine.serializeHomeProject(ownerHomeProject));
    assert.deepEqual(parsed.project, ownerHomeProject);
    const slot = engine
      .collectBindingSlots(ownerProjectManifest)
      .find((slot) => slot.kind === "opening-cover");
    assert.equal(slot.openingId, garage.id);
    assert.deepEqual(slot.spec.compatibleDomains, ["cover"]);
    assert.deepEqual(slot.spec.compatibleDeviceClasses, ["garage"]);
    assert.ok(slot.roomIds.length);
    for (const changes of [
      { leafCount: 1 },
      { hingeSide: "start" },
      { slideDirection: "end" },
      { variant: "panel" },
    ]) {
      const invalid = structuredClone(ownerHomeProject);
      Object.assign(
        invalid.floors[0].openings.find((o) => o.id === garage.id),
        changes,
      );
      assert.equal(engine.parseHomeProjectSchema(invalid).valid, false);
    }
  });

  test("cover resolution prioritizes position, falls back to contact, retains only one binding identity, and feeds room controls", () => {
    const { runtime, profile } = deriveDemoSessionDefinition(ownerProjectManifest);
    const coverId = "cover.test_garage";
    const contactId = "binary_sensor.test_garage_contact";
    profile.entityIdsBySlotId[garage.coverSlot.id] = coverId;
    profile.entityIdsBySlotId[garage.contactSlot.id] = contactId;
    const cover = {
      entityId: coverId,
      state: "closed",
      available: true,
      stale: false,
      attributes: { device_class: "garage", current_position: 0 },
    };
    runtime.entityStates[coverId] = cover;
    runtime.entityStates[contactId] = {
      entityId: contactId,
      state: "off",
      available: true,
      stale: false,
      attributes: { device_class: "door" },
    };
    const areaId = profile.roomAreaIds[garage.coverSlot.roomId];
    runtime.entityRegistry.push(
      ...[coverId, contactId].map((entityId) => ({
        entity_id: entityId,
        area_id: areaId,
        device_id: null,
        disabled_by: null,
        hidden_by: null,
        name: null,
        original_name: entityId,
      })),
    );
    const retained = new Map();
    const resolve = () =>
      engine.resolveHomeAssistantBindings(ownerProjectManifest, profile, runtime);
    for (const value of [0, 50, 100]) {
      runtime.entityStates[coverId] = {
        ...cover,
        state: value ? "open" : "closed",
        attributes: { ...cover.attributes, current_position: value },
      };
      const bindings = resolve();
      assert.equal(bindings.openings[garage.id].position, value / 100);
      assert.equal(
        resolveOpeningPositions(new Set([garage.id]), bindings.openings, retained)[garage.id],
        1,
      );
      assert.ok(
        Object.values(bindings.rooms).some((room) =>
          room.sections.primary.some((binding) => binding.slotId === garage.coverSlot.id),
        ),
      );
    }
    runtime.entityStates[coverId] = {
      ...cover,
      state: "opening",
      attributes: { device_class: "garage" },
    };
    runtime.entityStates[contactId] = { ...runtime.entityStates[contactId], state: "off" };
    assert.equal(resolve().openings[garage.id].position, 0);
    runtime.entityStates[contactId].available = false;
    assert.equal(resolveOpeningPositions(new Set(), resolve().openings, retained)[garage.id], 1);
    profile.entityIdsBySlotId[garage.coverSlot.id] = "cover.replacement";
    assert.equal(resolveOpeningPositions(new Set(), resolve().openings, retained)[garage.id], 0);
    delete profile.entityIdsBySlotId[garage.coverSlot.id];
    delete profile.entityIdsBySlotId[garage.contactSlot.id];
    assert.equal(
      resolveOpeningPositions(new Set([garage.id]), resolve().openings, retained)[garage.id],
      1,
    );
  });

  test("roll-up panels clear the aperture while the frame stays fixed, on both wall faces", async () => {
    for (const side of ["left", "right"]) {
      const render = (position) =>
        createElement(DoorModel, {
          wall,
          floor,
          opening: { ...garage, openingSide: side },
          position,
          reducedMotion: true,
        });
      const renderer = await create(render(0));
      const frame = () => renderer.scene.findByProps({ name: "roll-up-door-frame" });
      const slats = () =>
        renderer.scene
          .findByProps({ name: "roll-up-door-slats" })
          .children.filter((node) => node.instance.visible);
      const bounds = new Box3().setFromObject(frame().instance);
      assert.ok(slats().length > 4);
      await renderer.update(render(0.5));
      assert.ok(slats().length > 0);
      const first = slats()[0].instance;
      assert.ok(first.position.y - first.geometry.parameters.height / 2 > 1);
      await renderer.update(render(1));
      assert.equal(slats().length, 0);
      assert.ok(new Box3().setFromObject(frame().instance).equals(bounds));
      for (const mesh of renderer.scene.findAll((node) => node.type === "Mesh"))
        assert.equal(mesh.instance.material.type, "MeshToonMaterial");
      await renderer.unmount();
    }
  });

  test("garage slats animate both ways, reverse continuously, and settle at partial positions", async () => {
    const render = (position, reducedMotion = false) =>
      createElement(DoorModel, { wall, floor, opening: garage, position, reducedMotion });
    const renderer = await create(render(0));
    try {
      const group = renderer.scene.findByProps({ name: "roll-up-door-slats" }).instance;
      const panel = group.children[0];
      const geometry = panel.geometry;
      const bottom = () => panel.position.y - (geometry.parameters.height * panel.scale.y) / 2;
      const clearHeight = engine.rollUpDoorGeometry(
        garage.widthPlanUnits,
        garage.openingHeightMeters,
        1,
      ).clearHeight;
      assert.equal(bottom(), 0);
      await renderer.update(render(1));
      assert.equal(bottom(), 0, "a new target must not jump the panels");
      await renderer.advanceFrames(1, 1 / 60);
      assert.ok(bottom() > 0 && bottom() < clearHeight / 5);
      await renderer.advanceFrames(12, 1 / 60);
      const midOpening = bottom();
      await renderer.update(render(0));
      assert.equal(bottom(), midOpening, "reversing preserves the current pose");
      await renderer.advanceFrames(1, 1 / 60);
      assert.ok(bottom() > 0 && bottom() < midOpening);
      await renderer.advanceFrames(150, 1 / 60);
      assert.equal(bottom(), 0);
      await renderer.update(render(0.5));
      await renderer.advanceFrames(150, 1 / 60);
      assert.equal(bottom(), clearHeight / 2);
      await renderer.update(render(1));
      await renderer.advanceFrames(150, 1 / 60);
      assert.ok(group.children.every((part) => !part.visible));
      await renderer.update(render(0));
      await renderer.advanceFrames(1, 5);
      assert.ok(panel.visible && bottom() > clearHeight * 0.5, "idle frames must not snap shut");
      await renderer.update(render(0.25, true));
      assert.equal(bottom(), clearHeight / 4, "reduced motion settles immediately");
      assert.equal(panel.geometry, geometry, "frames reuse the existing geometry");
    } finally {
      await renderer.unmount();
    }
  });

  test("walk clearance uses actual panel travel and jump height", () => {
    const geometry = engine.rollUpDoorGeometry(
      garage.widthPlanUnits,
      garage.openingHeightMeters,
      1,
    );
    const threshold = (1.52 + 0.18) / geometry.clearHeight;
    assert.equal(
      passableOpeningIds([floor], { [garage.id]: threshold - 0.001 }).has(garage.id),
      false,
    );
    assert.equal(
      passableOpeningIds([floor], { [garage.id]: threshold + 0.001 }).has(garage.id),
      true,
    );
    assert.equal(
      passableOpeningIds([floor], { [garage.id]: threshold + 0.001 }, 0.2).has(garage.id),
      false,
    );
  });

  test("preset replacement reconciles cover mappings atomically and undo restores them", () => {
    const slotId = garage.coverSlot.id;
    const profile = {
      schemaVersion: 1,
      homeId: ownerHomeProject.home.id,
      roomAreaIds: {},
      entityIdsBySlotId: { [slotId]: "cover.test_garage" },
    };
    const before = {
      project: ownerHomeProject,
      bindings: {
        "https://fixture.invalid": {
          draft: profile,
          published: profile,
          manualRoomIds: [],
          manualSlotIds: [slotId],
        },
      },
    };
    const conventional = engine.doorFromConfiguration(DOOR_PRESETS[0].configuration, 1, garage);
    const edited = {
      ...floor,
      openings: floor.openings.map((o) => (o.id === garage.id ? conventional : o)),
    };
    const after = workspaceSnapshotFromEditorState(
      before,
      edited,
      ownerHomeProject.sceneItems,
      ownerProjectRegistries,
    );
    assert.equal(
      after.bindings["https://fixture.invalid"].draft.entityIdsBySlotId[slotId],
      undefined,
    );
    assert.equal(after.project.openingProfiles[garage.id].coverSlot, undefined);
    const history = engine.commitWorkspaceSnapshot(engine.createWorkspaceHistory(before), after);
    assert.deepEqual(engine.undoWorkspaceHistory(history).present, before);
    assert.deepEqual(
      engine.redoWorkspaceHistory(engine.undoWorkspaceHistory(history)).present,
      after,
    );
  });

  test("changing the garage to a conventional door removes only its cover profile", () => {
    const conventional = engine.doorFromConfiguration(DOOR_PRESETS[0].configuration, 1, garage);
    const edited = {
      ...floor,
      openings: floor.openings.map((opening) =>
        opening.id === garage.id ? conventional : opening,
      ),
    };
    const project = projectFromEditorState(ownerHomeProject, edited, ownerHomeProject.sceneItems);
    assert.equal(project.openingProfiles[garage.id].coverSlot, undefined);
    assert.equal(ownerHomeProject.openingProfiles[garage.id].coverSlot.id, garage.coverSlot.id);
  });
});
