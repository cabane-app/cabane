import assert from "node:assert/strict";
import test from "node:test";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";
import { connectedRuntimeFixture, rawEntity, toSnapshots } from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { stableDeviceRegistry: devices } = await load("/packages/catalog/src/device/index.ts");
  const { stableFurnishingRegistry: furnishings } = await load(
    "/packages/catalog/src/furnishing/index.ts",
  );
  const { interactionFloor } = await load("/tests/fixtures/interaction-floor.ts");
  const { itemEntityReadings } = await load("/packages/engine/src/ItemEntityReadings.tsx");
  const { statesBySlotIdForRoom } = await load(
    "/packages/engine/src/architecture-scene/RoomFurnishings.tsx",
  );
  const { deriveRoomStatusMap } = await load("/packages/engine/src/room-status/model.ts");
  const { ItemEntitySlots } = await load(
    "/apps/web/src/editor-preview/furnish/ItemEntitySlots.tsx",
  );
  const { DeviceMappingInspector } = await load(
    "/packages/engine/src/home-assistant-mapping/DeviceMappingInspector.tsx",
  );
  const { DeviceConnectionWorkbench } = await load(
    "/packages/engine/src/home-assistant-mapping/DeviceConnectionWorkbench.tsx",
  );
  const { addReadingToSnapshot } = await load("/apps/web/src/editor-connect/add-reading.ts");
  const { furnishingEditorReducer, createFurnishingEditorState } = await load(
    "/apps/web/src/editor-preview/furnish/editor-state.ts",
  );
  const { duplicateSceneItem } = await load(
    "/apps/web/src/editor-preview/furnish/duplicate-item.ts",
  );
  const { workspaceSnapshotFromEditorState } = await load(
    "/apps/web/src/editor-preview/project-sync.ts",
  );
  const registries = { furnishingModels: furnishings, deviceModels: devices, openingModels: {} };
  const slot = (id, deviceClass = "temperature") => ({
    id,
    compatibleDomains: ["sensor"],
    compatibleDeviceClasses: [deviceClass],
    required: false,
    autoMap: "manual",
    deviceRole: "secondary",
    presentation: { label: id, dashboardRole: "secondary", showInScene: true },
  });
  const projectFixture = () => {
    const project = engine.createEmptyHomeProject("attachments", "Synthetic attachments");
    const floor = structuredClone(interactionFloor);
    floor.rooms = floor.rooms.map((room) => ({ ...room, devices: [], dashboardSlots: [] }));
    project.floors = [floor];
    const placement = { kind: "absolute", at: [3, 3], elevationMeters: 0, rotationYRadians: 0 };
    const modelId = Object.keys(furnishings)[0];
    project.sceneItems = [
      {
        id: "fridge",
        kind: "device",
        floorId: floor.id,
        modelId: "refrigerator",
        size: devices.refrigerator.defaultSize,
        placement,
        entitySlots: [
          {
            id: "fridge-control",
            compatibleDomains: ["sensor"],
            compatibleDeviceClasses: ["temperature"],
            required: true,
            deviceRole: "primary",
            autoMap: "manual",
            presentation: { label: "Fridge", dashboardRole: "primary" },
          },
          slot("fridge-temperature"),
          slot("freezer-temperature"),
          slot("fridge-power", "power"),
        ],
      },
      {
        id: "furniture",
        kind: "furnishing",
        floorId: floor.id,
        modelId,
        size: furnishings[modelId].defaultSize,
        placement,
        entitySlots: [slot("furniture-reading")],
      },
    ];
    return project;
  };
  const connectionFixture = () => {
    const project = projectFixture();
    const manifest = engine.composeHomeManifest(project, registries);
    const runtime = connectedRuntimeFixture();
    runtime.entityRegistry = [
      ["switch.fridge", "plug"],
      ["sensor.fridge", "thermometer"],
      ["sensor.freezer", "freezer-thermometer"],
      ["sensor.power", "plug"],
      ["sensor.furniture", null],
    ].map(([entity_id, device_id]) => ({
      entity_id,
      device_id,
      area_id: "outside",
      name: entity_id,
      original_name: null,
      disabled_by: null,
      hidden_by: null,
    }));
    runtime.devices = runtime.entityRegistry
      .filter((entry) => entry.device_id)
      .map((entry) => ({
        id: entry.device_id,
        area_id: "outside",
        name: entry.device_id,
        name_by_user: null,
        model: "Synthetic",
      }));
    runtime.entityStates = toSnapshots(
      Object.fromEntries(
        [
          rawEntity("switch.fridge", "on"),
          rawEntity("sensor.fridge", "4", {
            device_class: "temperature",
            unit_of_measurement: "°C",
          }),
          rawEntity("sensor.freezer", "-18", {
            device_class: "temperature",
            unit_of_measurement: "°C",
          }),
          rawEntity("sensor.power", "85", { device_class: "power", unit_of_measurement: "W" }),
          rawEntity("sensor.furniture", "20", {
            device_class: "temperature",
            unit_of_measurement: "°C",
          }),
        ].map((entity) => [entity.entity_id, entity]),
      ),
    );
    const profile = {
      ...engine.createEmptyRuntimeBindingProfile(project.home.id),
      roomAreaIds: { [manifest.floors[0].rooms[0].id]: "demo_room" },
      entityIdsBySlotId: {
        "fridge-control": "sensor.fridge",
        "fridge-temperature": "sensor.fridge",
        "freezer-temperature": "sensor.freezer",
        "fridge-power": "sensor.power",
        "furniture-reading": "sensor.furniture",
      },
    };
    return { project, manifest, runtime, profile };
  };
  test("sensor attachments validate and round-trip on furniture and devices without broadening primary controls", () => {
    const project = projectFixture();
    const result = engine.validateHomeProject(project, registries);
    assert.equal(result.valid, true, JSON.stringify(result.issues));
    const parsed = engine.parseHomeProject(engine.serializeHomeProject(project));
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
    assert.deepEqual(parsed.project.sceneItems, project.sceneItems);
    const manifest = engine.composeHomeManifest(project, registries);
    assert.equal(
      engine.collectBindingSlots(manifest).filter((entry) => entry.slotId === "furniture-reading")
        .length,
      1,
    );
    assert.equal(engine.validateHomeManifest(manifest, { deviceModels: devices }).canRender, true);
    for (const invalidSlot of [
      { ...slot("bad"), compatibleDomains: ["switch"] },
      { ...slot("bad"), deviceRole: "primary" },
      { ...slot("bad"), required: true },
    ]) {
      const invalid = structuredClone(project);
      invalid.sceneItems[1].entitySlots = [invalidSlot];
      assert.equal(engine.validateHomeProject(invalid, registries).valid, false);
    }
    const invalid = structuredClone(project);
    invalid.sceneItems[0].entitySlots[0].compatibleDomains = ["lock"];
    assert.equal(engine.validateHomeProject(invalid, registries).valid, false);
    invalid.sceneItems[0].entitySlots[0].compatibleDomains = ["sensor"];
    invalid.sceneItems[1].entitySlots[0].presentation.showInScene = "yes";
    assert.equal(engine.parseHomeProject(engine.serializeHomeProject(invalid)).valid, false);
  });
  test("independent cross-device readings resolve without becoming ambient room temperature or primary state", () => {
    const { manifest, profile, runtime } = connectionFixture();
    assert.equal(engine.validateRuntimeBindingProfile(profile, manifest, runtime).valid, true);
    const resolved = engine.resolveHomeAssistantBindings(manifest, profile, runtime, devices);
    assert.deepEqual(resolved.issues, []);
    const room = manifest.floors[0].rooms[0];
    assert.equal(
      resolved.rooms[room.id].devices[0].entities.find((entry) => entry.slotId === "fridge-control")
        .state.state,
      "4",
    );
    const summary = deriveRoomStatusMap(manifest, profile, resolved, runtime)[room.id];
    assert.deepEqual(
      summary.temperature,
      { value: "4", unit: "°C" },
      "the existing primary temperature stays unchanged",
    );
    runtime.entityStates["sensor.fridge"].available = false;
    const refreshed = engine.resolveHomeAssistantBindings(manifest, profile, runtime, devices);
    assert.equal(
      deriveRoomStatusMap(manifest, profile, refreshed, runtime)[room.id].temperature,
      undefined,
      "freezer and furniture attachments do not replace ambient readings",
    );
    runtime.entityStates["sensor.fridge"].available = true;
    const descriptor = engine
      .collectBindingSlots(manifest)
      .find((entry) => entry.slotId === "freezer-temperature");
    assert.ok(
      engine
        .bindingEntityCandidates({
          descriptor,
          roomId: room.id,
          profile,
          runtime,
          scope: "all-areas",
        })
        .some((candidate) => candidate.entityId === "sensor.freezer"),
    );
    const cleared = engine.applyDeviceMapping(profile, room.devices[0], null);
    assert.equal(cleared.entityIdsBySlotId["fridge-control"], undefined);
    assert.equal(cleared.entityIdsBySlotId["freezer-temperature"], "sensor.freezer");
    assert.equal(
      engine.mappedHomeAssistantDeviceId(profile, room.devices[0], runtime),
      "thermometer",
    );
  });
  test("furniture readings outside rooms remain connectable without an architectural or area mapping", () => {
    const { project, runtime, profile } = connectionFixture();
    project.sceneItems = [
      {
        ...project.sceneItems[1],
        placement: { kind: "absolute", at: [-2, -2], elevationMeters: 0, rotationYRadians: 0 },
      },
    ];
    const manifest = engine.composeHomeManifest(project, registries);
    const outside = engine
      .deviceMappingRooms(manifest)
      .find((room) => room.id.startsWith("outside-rooms:"));
    assert.ok(outside);
    assert.equal(
      manifest.floors[0].rooms.some((room) => room.id === outside.id),
      false,
    );
    const descriptor = engine
      .collectBindingSlots(manifest)
      .find((entry) => entry.slotId === "furniture-reading");
    const outsideProfile = {
      ...profile,
      roomAreaIds: {},
      entityIdsBySlotId: { "furniture-reading": "sensor.furniture" },
    };
    assert.equal(
      engine.validateRuntimeBindingProfile(outsideProfile, manifest, runtime).valid,
      true,
    );
    assert.ok(
      engine
        .bindingEntityCandidates({
          descriptor,
          roomId: outside.id,
          profile: outsideProfile,
          runtime,
        })
        .some((candidate) => candidate.entityId === "sensor.furniture"),
    );
    const resolved = engine.resolveHomeAssistantBindings(
      manifest,
      outsideProfile,
      runtime,
      devices,
    );
    assert.deepEqual(resolved.rooms[outside.id].issues, []);
    assert.equal(statesBySlotIdForRoom(outside.id, resolved)["furniture-reading"].state, "20");
  });
  test("map visibility is independent of dashboard visibility and does not reveal stale values", () => {
    const { project, runtime, profile } = connectionFixture();
    project.sceneItems[1].entitySlots[0].presentation.dashboardRole = "hidden";
    const manifest = engine.composeHomeManifest(project, registries);
    const resolved = engine.resolveHomeAssistantBindings(manifest, profile, runtime, devices);
    const states = statesBySlotIdForRoom(manifest.floors[0].rooms[0].id, resolved);
    assert.deepEqual(itemEntityReadings(project.sceneItems[1].entitySlots, states), [
      { id: "furniture-reading", label: "furniture-reading", value: "20 °C" },
    ]);
    const readings = project.sceneItems[0].entitySlots;
    assert.deepEqual(
      itemEntityReadings(readings, states).map((reading) => reading.value),
      ["4 °C", "-18 °C", "85 W"],
    );
    readings[1].presentation.showInScene = false;
    assert.equal(itemEntityReadings(readings, states).length, 2);
    const stale = {
      ...states,
      "freezer-temperature": { ...states["freezer-temperature"], stale: true },
      "fridge-power": { ...states["fridge-power"], available: false },
    };
    assert.deepEqual(
      itemEntityReadings(readings, stale).map((reading) => reading.value),
      ["Stale", "Unavailable"],
    );
  });
  test("conditional state badges persist and show only meaningful, usable states", () => {
    const project = projectFixture();
    const reading = project.sceneItems[1].entitySlots[0];
    reading.presentation.showInScene = "if-present";
    assert.equal(engine.validateHomeProject(project, registries).valid, true);
    const parsed = engine.parseHomeProject(engine.serializeHomeProject(project));
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
    assert.equal(
      parsed.project.sceneItems[1].entitySlots[0].presentation.showInScene,
      "if-present",
    );
    assert.equal(
      engine.validateHomeManifest(engine.composeHomeManifest(project, registries), {
        deviceModels: devices,
      }).canRender,
      true,
    );
    const state = {
      entityId: "sensor.fixture",
      state: "1",
      attributes: {},
      available: true,
      stale: false,
    };
    for (const value of ["true", "on", "1", "0.1", "42", "open", "home", "playing"]) {
      assert.equal(
        itemEntityReadings([reading], { [reading.id]: { ...state, state: value } }).length,
        1,
        value,
      );
    }
    for (const value of [
      "false",
      "off",
      "0",
      "-2",
      "0.0",
      "closed",
      "not_home",
      "idle",
      "unknown",
      "unavailable",
      "",
      "  ",
      "Infinity",
    ]) {
      assert.equal(
        itemEntityReadings([reading], { [reading.id]: { ...state, state: value } }).length,
        0,
        value,
      );
    }
    for (const invalid of [undefined, { ...state, stale: true }, { ...state, available: false }]) {
      assert.equal(
        itemEntityReadings([reading], invalid ? { [reading.id]: invalid } : {}).length,
        0,
      );
    }
    const { project: connectedProject, profile, runtime } = connectionFixture();
    const control = connectedProject.sceneItems[0].entitySlots[0];
    control.presentation.showInScene = "if-present";
    const manifest = engine.composeHomeManifest(connectedProject, registries);
    for (const value of ["0", "4"]) {
      const entityId = profile.entityIdsBySlotId[control.id];
      const resolved = engine.resolveHomeAssistantBindings(
        manifest,
        profile,
        {
          ...runtime,
          entityStates: {
            ...runtime.entityStates,
            [entityId]: { ...runtime.entityStates[entityId], state: value },
          },
        },
        devices,
      );
      assert.equal(
        resolved.rooms[manifest.floors[0].rooms[0].id].sceneEntities.some(
          (binding) => binding.slotId === control.id,
        ),
        value === "4",
      );
    }
  });
  test("TV switch alternatives preserve existing slots, dispatch switch commands, and do not override unrelated domains", () => {
    for (const modelId of ["television", "wall-television", "compact-wall-television"]) {
      const { project, profile, runtime } = connectionFixture();
      project.sceneItems = [
        {
          ...project.sceneItems[0],
          modelId,
          size: devices[modelId].defaultSize,
          entitySlots: [
            {
              ...project.sceneItems[0].entitySlots[0],
              compatibleDomains: ["media_player"],
              compatibleDeviceClasses: [],
            },
          ],
        },
      ];
      const manifest = engine.composeHomeManifest(project, registries);
      const descriptor = engine
        .collectBindingSlots(manifest)
        .find((entry) => entry.slotId === "fridge-control");
      assert.ok(
        engine
          .bindingEntityCandidates({
            descriptor,
            roomId: manifest.floors[0].rooms[0].id,
            profile: { ...profile, entityIdsBySlotId: {} },
            runtime,
            scope: "all-areas",
          })
          .some((candidate) => candidate.entityId === "switch.fridge"),
      );
      const tvProfile = { ...profile, entityIdsBySlotId: { "fridge-control": "switch.fridge" } };
      assert.equal(engine.validateRuntimeBindingProfile(tvProfile, manifest, runtime).valid, true);
      const resolved = engine.resolveHomeAssistantBindings(manifest, tvProfile, runtime, devices);
      assert.deepEqual(resolved.issues, []);
      const state = resolved.rooms[manifest.floors[0].rooms[0].id].devices[0].entities[0].state;
      assert.deepEqual(engine.toggleEntityCall(state), {
        domain: "switch",
        service: "turn_off",
        data: undefined,
        target: { entity_id: "switch.fridge" },
      });
      project.sceneItems[0].entitySlots[0].compatibleDomains = ["switch"];
      project.sceneItems[0].entitySlots[0].compatibleDeviceClasses = [];
      assert.equal(engine.validateHomeProject(project, registries).valid, true);
      assert.equal(
        engine.validateHomeManifest(engine.composeHomeManifest(project, registries), {
          deviceModels: devices,
        }).canRender,
        true,
      );
    }
    const { project, profile, runtime } = connectionFixture();
    project.sceneItems[0].modelId = "speaker";
    project.sceneItems[0].entitySlots = [
      {
        ...project.sceneItems[0].entitySlots[0],
        compatibleDomains: ["media_player"],
        compatibleDeviceClasses: [],
      },
    ];
    const manifest = engine.composeHomeManifest(project, registries);
    assert.equal(
      engine.validateRuntimeBindingProfile(
        { ...profile, entityIdsBySlotId: { "fridge-control": "switch.fridge" } },
        manifest,
        runtime,
      ).valid,
      false,
    );
  });
  test("removing a lit item in an unfinished floor draft autosaves and reopens with atomic undo and draft-only cleanup", () =>
    withStorageDom(async (dom) => {
      const { project, profile } = connectionFixture();
      const light = { position: [0, 0.5, 0], color: "#ffffff", maxIntensity: 2, distance: 5 };
      const lit = engine.editModelLighting(
        { project, bindings: {} },
        project.sceneItems[1].modelId,
        light,
        registries,
      );
      const target = lit.project.sceneItems[1];
      const lightId = engine.lightingEntitySlotId(target.lightSlotId);
      const mapped = {
        ...profile,
        entityIdsBySlotId: { ...profile.entityIdsBySlotId, [lightId]: "light.fixture" },
      };
      lit.bindings = Object.fromEntries(
        ["https://one.invalid", "https://two.invalid"].map((origin) => [
          origin,
          {
            draft: structuredClone(mapped),
            published: structuredClone(mapped),
            manualRoomIds: Object.keys(mapped.roomAreaIds),
            manualSlotIds: Object.keys(mapped.entityIdsBySlotId),
          },
        ]),
      );
      assert.equal(engine.validateHomeProject(lit.project, registries).valid, true);
      const records = engine.createHomeProjectRepository(
        engine.createIndexedDbProjectRecordStore(dom.indexedDB),
        registries,
      );
      const seed = engine.createSeedProjectRecord(lit.project);
      seed.bindings = lit.bindings;
      const record = await records.replace(seed);
      const lifecycle = engine.createHomeProjectLifecycle(records, lit.project);
      const before = engine.addTopFloor(lit, "unfinished");
      assert.equal(engine.parseHomeProjectSchema(before.project).valid, true);
      assert.equal(engine.validateHomeProject(before.project, registries).valid, false);
      const next = workspaceSnapshotFromEditorState(
        before,
        before.project.floors[0],
        before.project.sceneItems.filter((item) => item.id !== target.id),
        registries,
      );
      const history = engine.commitWorkspaceSnapshot(engine.createWorkspaceHistory(before), next);
      assert.equal(history.past.length, 1);
      assert.deepEqual(engine.undoWorkspaceHistory(history).present, before);
      assert.deepEqual(
        engine.redoWorkspaceHistory(engine.undoWorkspaceHistory(history)).present,
        next,
      );
      const saved = await lifecycle.autosave(record, next.project, undefined, next.bindings);
      assert.equal(saved.status, "saved", saved.error?.message ?? JSON.stringify(saved.issues));
      const reopened = await records.load(record.homeId);
      assert.deepEqual(reopened.draft, next.project);
      assert.deepEqual(reopened.published, lit.project);
      for (const [origin, state] of Object.entries(reopened.bindings)) {
        assert.equal(state.draft.entityIdsBySlotId[lightId], undefined);
        assert.equal(state.draft.entityIdsBySlotId["furniture-reading"], undefined);
        assert.equal(state.manualSlotIds.includes(lightId), false);
        assert.equal(state.manualSlotIds.includes("furniture-reading"), false);
        assert.equal(state.draft.entityIdsBySlotId["fridge-control"], "sensor.fridge");
        assert.deepEqual(state.published, lit.bindings[origin].published);
      }
    }));
  test("attachment edits participate in undo, duplication identity, and mapping cleanup while published mappings remain intact", () => {
    const { project, profile, runtime } = connectionFixture();
    const original = project.sceneItems[1];
    const duplicate = duplicateSceneItem(
      original,
      project.sceneItems,
      project.floors[0],
      engine.collectProjectIds(project),
    );
    assert.notEqual(duplicate.entitySlots[0].id, original.entitySlots[0].id);
    let state = createFurnishingEditorState(project.sceneItems);
    state = furnishingEditorReducer(state, {
      type: "update-entity-slots",
      id: original.id,
      entitySlots: [],
    });
    assert.equal(state.items[1].entitySlots.length, 0);
    assert.equal(furnishingEditorReducer(state, { type: "undo" }).items[1].entitySlots.length, 1);
    const bindings = {
      [runtime.origin]: {
        draft: profile,
        published: profile,
        manualSlotIds: Object.keys(profile.entityIdsBySlotId),
        manualRoomIds: Object.keys(profile.roomAreaIds),
      },
    };
    const next = workspaceSnapshotFromEditorState(
      { project, bindings },
      project.floors[0],
      state.items,
      registries,
    );
    assert.equal(
      next.bindings[runtime.origin].draft.entityIdsBySlotId["furniture-reading"],
      undefined,
    );
    assert.equal(
      next.bindings[runtime.origin].published.entityIdsBySlotId["furniture-reading"],
      "sensor.furniture",
    );
    assert.equal(
      next.bindings[runtime.origin].draft.entityIdsBySlotId["freezer-temperature"],
      "sensor.freezer",
    );
    const record = engine.createSeedProjectRecord(project);
    record.bindings = bindings;
    const parsed = engine.parseHomeProjectRecord(
      engine.serializeHomeProjectRecord(record),
      registries,
    );
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
    assert.deepEqual(parsed.record.bindings, bindings);
  });

  async function withDom(callback) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://attachment.invalid/",
      pretendToBeVisual: true,
    });
    const keys = ["window", "document", "navigator", "HTMLElement"];
    const previous = Object.fromEntries(
      keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
    );
    for (const key of keys)
      Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
    const priorAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await callback({ root, dom, document: dom.window.document });
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      for (const key of keys) {
        if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
        else delete globalThis[key];
      }
      globalThis.IS_REACT_ACT_ENVIRONMENT = priorAct;
    }
  }
  test("Properties separates connection, visibility and contextual reading actions without a permanent add form", async () => {
    const { project, runtime, profile } = connectionFixture();
    await withDom(async ({ root, document }) => {
      let current,
        added = 0,
        selected = null;
      function Harness() {
        const [item, setItem] = useState(project.sceneItems[0]);
        current = item;
        return React.createElement(ItemEntitySlots, {
          item,
          label: "Fridge",
          onChange: (entitySlots) => setItem({ ...item, entitySlots }),
          connections: {
            profile,
            runtime,
            onConnect: (id) => {
              selected = id;
            },
            onDisconnect() {},
            onAddReading: () => {
              added++;
            },
          },
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      assert.match(document.body.textContent, /Connections/);
      assert.match(document.body.textContent, /Connected/);
      assert.equal(document.querySelectorAll("select").length, 4);
      await act(async () =>
        [...document.querySelectorAll("button")]
          .find((button) => button.textContent.includes("Add reading"))
          .click(),
      );
      assert.equal(added, 1);
      assert.equal(document.querySelectorAll("select").length, 4);
      await act(async () => document.querySelector(".item-connection-link").click());
      assert.equal(selected, "fridge-control");
      const visibilitySelect = document.querySelector(
        '[aria-label="Show fridge-temperature on model"]',
      );
      assert.deepEqual(
        [...visibilitySelect.options].map((option) => option.textContent),
        ["Always", "Never", "Only if present"],
      );
      await act(async () => {
        visibilitySelect.value = "if-present";
        visibilitySelect.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
      });
      assert.equal(
        current.entitySlots.find((slot) => slot.id === "fridge-temperature").presentation
          .showInScene,
        "if-present",
      );
      await act(async () => {
        visibilitySelect.value = "never";
        visibilitySelect.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
      });
      assert.equal(
        current.entitySlots.find((slot) => slot.id === "fridge-temperature").presentation
          .showInScene,
        false,
      );
      assert.equal(profile.entityIdsBySlotId["fridge-temperature"], "sensor.fridge");
      await act(async () =>
        document.querySelector('[aria-label="Options for fridge-temperature"]').click(),
      );
      await act(async () => document.querySelector(".item-connection-remove").click());
      assert.equal(
        current.entitySlots.some((slot) => slot.id === "fridge-temperature"),
        false,
      );
      assert.equal(current.entitySlots[0].deviceRole, "primary");
    });
  });

  test("the workbench searches sensor and parent device names, filters eligible types and adds a named reading", async () => {
    const { project, manifest, runtime, profile: initialProfile } = connectionFixture();
    const item = project.sceneItems[0];
    const room = engine
      .deviceMappingRooms(manifest)
      .find((room) =>
        engine
          .groupRoomMappingRelationships(manifest, room.id)
          .some((group) => group.relationships.some((relationship) => relationship.id === item.id)),
      );
    const relationship = engine
      .groupRoomMappingRelationships(manifest, room.id)
      .flatMap((group) => group.relationships)
      .find((relationship) => relationship.id === item.id);
    let profile = initialProfile,
      added;
    await withDom(async ({ root, document, dom }) => {
      function Harness() {
        const [current, setCurrent] = useState(initialProfile);
        const [slotId, setSlotId] = useState("fridge-temperature");
        profile = current;
        return React.createElement(DeviceConnectionWorkbench, {
          room,
          relationship,
          profile: current,
          runtime,
          disabled: false,
          slotId,
          onSlotChange: setSlotId,
          onEntityIdsBySlotIdChange: (ids) => setCurrent({ ...current, entityIdsBySlotId: ids }),
          onAddReading: (entityId, presentation) => {
            added = { entityId, presentation };
          },
          onBack() {},
        });
      }
      const input = async (value) => {
        const search = document.querySelector('[aria-label="Search all compatible sources"]');
        await act(async () => {
          Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
            search,
            value,
          );
          search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        });
      };
      await act(async () => root.render(React.createElement(Harness)));
      assert.equal(document.querySelector("details"), null);
      await input("freezer-thermometer");
      assert.equal(document.querySelectorAll(".connection-source").length, 1);
      assert.match(document.querySelector(".connection-source").textContent, /sensor.freezer/);
      await act(async () => document.querySelector(".connection-source").click());
      assert.equal(profile.entityIdsBySlotId["fridge-temperature"], "sensor.freezer");
      assert.equal(profile.entityIdsBySlotId["fridge-control"], "sensor.fridge");
      assert.equal(profile.entityIdsBySlotId["freezer-temperature"], "sensor.freezer");
      await input("sensor.fridge");
      assert.equal(document.querySelectorAll(".connection-source").length, 1);
      assert.doesNotMatch(document.querySelector(".connection-type-filters").textContent, /Power/);
      await act(async () => document.querySelector(".connection-add").click());
      const powerFilter = [...document.querySelectorAll(".connection-type-filters button")].find(
        (button) => button.textContent === "Power",
      );
      await act(async () => powerFilter.click());
      assert.equal(document.querySelectorAll(".connection-source").length, 1);
      assert.equal(
        document.querySelector(".connection-source").disabled,
        true,
        "already attached sources are marked Added",
      );
      await act(async () =>
        [...document.querySelectorAll(".connection-type-filters button")]
          .find((button) => button.textContent === "Temperature")
          .click(),
      );
      await act(async () =>
        document.querySelector('.connection-source[aria-label^="sensor.furniture"]').click(),
      );
      assert.ok(document.querySelector(".reading-connection-confirm"));
      await act(async () => {
        const select = document.querySelector(".reading-connection-confirm select");
        select.value = "if-present";
        select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await act(async () =>
        document
          .querySelector(".reading-connection-confirm")
          .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
      );
      assert.deepEqual(added, {
        entityId: "sensor.furniture",
        presentation: { label: "sensor.furniture", showInScene: "if-present" },
      });
    });
    const unmapped = { ...initialProfile, roomAreaIds: {} };
    assert.ok(
      engine.bindingEntityCandidates({
        descriptor: relationship.descriptors.find((entry) => entry.slotId === "fridge-temperature"),
        roomId: room.id,
        profile: unmapped,
        runtime,
        scope: "all-areas",
      }).length,
    );
    assert.equal(
      engine
        .validateRuntimeBindingProfile(unmapped, manifest, runtime)
        .issues.some((issue) => issue.code === "profile.room-unmapped"),
      false,
    );
    const source = globalThis.crypto;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues: source.getRandomValues.bind(source) },
    });
    try {
      const snapshot = addReadingToSnapshot(
        {
          project,
          bindings: {
            [runtime.origin]: {
              draft: initialProfile,
              published: initialProfile,
              manualRoomIds: [],
              manualSlotIds: [],
            },
          },
        },
        "furniture",
        "sensor.power",
        runtime,
        { label: "Power use", showInScene: false },
      );
      assert.equal(
        snapshot.project.sceneItems[1].entitySlots.at(-1).presentation.label,
        "Power use",
      );
      assert.equal(
        snapshot.project.sceneItems[1].entitySlots.at(-1).presentation.showInScene,
        false,
      );
    } finally {
      Object.defineProperty(globalThis, "crypto", descriptor);
    }
  });
  test("Connect finds an HA device's sensors before any readings are declared", async () => {
    const project = projectFixture();
    const item = {
      ...project.sceneItems[0],
      id: "sprinkler",
      modelId: "pop-up-sprinkler",
      size: devices["pop-up-sprinkler"].defaultSize,
      placement: { kind: "absolute", at: [-2, -2], elevationMeters: 0, rotationYRadians: 0 },
      entitySlots: [
        {
          id: "sprinkler-control",
          compatibleDomains: ["valve", "switch"],
          required: true,
          autoMap: "manual",
          deviceRole: "primary",
          presentation: { label: "Pop-up sprinkler", dashboardRole: "primary" },
        },
      ],
    };
    project.sceneItems = [item];
    const manifest = engine.composeHomeManifest(project, registries);
    const room = engine
      .deviceMappingRooms(manifest)
      .find((entry) => entry.id.startsWith("outside-rooms:"));
    const relationship = engine
      .groupRoomMappingRelationships(manifest, room.id)
      .flatMap((group) => group.relationships)[0];
    const runtime = connectedRuntimeFixture();
    runtime.devices = [
      { id: "synthetic-hydro", area_id: "outside", name: "Hydro", name_by_user: null },
    ];
    runtime.entityRegistry = [
      ["switch.synthetic_control", "Hydro switch"],
      ["sensor.synthetic_water_total", "Water consumption"],
      ["sensor.synthetic_watering_volume", "Watering volume"],
    ].map(([entity_id, name]) => ({
      entity_id,
      name,
      device_id: "synthetic-hydro",
      area_id: null,
      disabled_by: null,
      hidden_by: null,
    }));
    runtime.entityStates = toSnapshots(
      Object.fromEntries(
        [
          rawEntity("switch.synthetic_control", "on"),
          rawEntity("sensor.synthetic_water_total", "0.00", {
            device_class: "water",
            unit_of_measurement: "L",
          }),
          rawEntity("sensor.synthetic_watering_volume", "0.00", {
            device_class: "water",
            unit_of_measurement: "L",
          }),
        ].map((entity) => [entity.entity_id, entity]),
      ),
    );
    const profile = engine.createEmptyRuntimeBindingProfile(project.home.id);
    profile.entityIdsBySlotId["sprinkler-control"] = "switch.synthetic_control";
    const initialSnapshot = {
      project,
      bindings: {
        [runtime.origin]: {
          draft: profile,
          published: profile,
          manualRoomIds: [],
          manualSlotIds: ["sprinkler-control"],
        },
      },
    };
    let history = engine.createWorkspaceHistory(initialSnapshot);
    let added;
    await withDom(async ({ root, document, dom }) => {
      await act(async () =>
        root.render(
          React.createElement(DeviceMappingInspector, {
            manifest,
            room,
            relationship,
            profile,
            runtime,
            disabled: false,
            state: "open",
            inline: true,
            onAddReading: (entityId) => {
              added = entityId;
              history = engine.commitWorkspaceSnapshot(
                history,
                addReadingToSnapshot(history.present, item.id, entityId, runtime),
              );
            },
            onEntityIdsBySlotIdChange() {},
            onSelectionMade() {},
            onCollapse() {},
            onReopen() {},
          }),
        ),
      );
      const search = document.querySelector('input[type="search"]');
      dom.window.HTMLElement.prototype.attachEvent = () => {};
      dom.window.HTMLElement.prototype.detachEvent = () => {};
      await act(async () => search.focus());
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
          search,
          "hydro",
        );
        search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        search.dispatchEvent(new dom.window.KeyboardEvent("keyup", { bubbles: true }));
      });
      const add = document.querySelector('button[aria-label="Add Water consumption as reading"]');
      assert.ok(add, "searching the HA device name must offer its sensors as new readings");
      assert.ok(document.querySelector('button[aria-label="Add Watering volume as reading"]'));
      await act(async () => add.click());
      assert.equal(added, "sensor.synthetic_water_total");
      assert.equal(profile.entityIdsBySlotId["sprinkler-control"], "switch.synthetic_control");
      const next = history.present;
      const reading = next.project.sceneItems[0].entitySlots[1];
      assert.equal(engine.isAuxiliaryEntitySlot(reading), true);
      assert.equal(next.bindings[runtime.origin].draft.entityIdsBySlotId[reading.id], added);
      assert.deepEqual(next.bindings[runtime.origin].published, profile);
      assert.equal(
        addReadingToSnapshot(next, item.id, added, runtime),
        null,
        "duplicate clicks do not add duplicate readings",
      );
      const record = engine.createSeedProjectRecord(project);
      record.draft = next.project;
      record.bindings = next.bindings;
      const parsed = engine.parseHomeProjectRecord(
        engine.serializeHomeProjectRecord(record),
        registries,
      );
      assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
      assert.equal(
        parsed.record.bindings[runtime.origin].draft.entityIdsBySlotId[reading.id],
        added,
      );
      assert.deepEqual(engine.undoWorkspaceHistory(history).present, initialSnapshot);
    });
  });
  test("Connect search filters an outside sprinkler's readings by name and entity ID", async () => {
    const project = projectFixture();
    const runtime = connectedRuntimeFixture();
    const waterId = "sensor.synthetic_water_consumption";
    for (let index = 0; index < 250; index++) {
      const entityId = `sensor.synthetic_${index}`;
      runtime.entityRegistry.push({
        entity_id: entityId,
        device_id: null,
        area_id: null,
        name: `Auxiliary sensor ${index}`,
        disabled_by: null,
        hidden_by: null,
      });
      Object.assign(runtime.entityStates, toSnapshots({ [entityId]: rawEntity(entityId, "10") }));
    }
    runtime.entityRegistry.push({
      entity_id: waterId,
      device_id: null,
      area_id: null,
      name: "Water consumption",
      disabled_by: null,
      hidden_by: null,
    });
    Object.assign(
      runtime.entityStates,
      toSnapshots({
        [waterId]: rawEntity(waterId, "325", {
          device_class: "water",
          state_class: "total_increasing",
          unit_of_measurement: "L",
        }),
      }),
    );
    const reading = slot("sprinkler-water");
    delete reading.compatibleDeviceClasses;
    project.sceneItems = [
      {
        ...project.sceneItems[0],
        id: "sprinkler",
        modelId: "rotating-sprinkler",
        size: devices["rotating-sprinkler"].defaultSize,
        placement: { kind: "absolute", at: [-2, -2], elevationMeters: 0, rotationYRadians: 0 },
        entitySlots: [
          {
            id: "sprinkler-control",
            compatibleDomains: ["valve", "switch"],
            required: false,
            autoMap: "manual",
            deviceRole: "primary",
            presentation: { label: "Sprinkler", dashboardRole: "primary" },
          },
          reading,
        ],
      },
    ];
    const manifest = engine.composeHomeManifest(project, registries);
    const room = engine
      .deviceMappingRooms(manifest)
      .find((entry) => entry.id.startsWith("outside-rooms:"));
    const relationship = engine
      .groupRoomMappingRelationships(manifest, room.id)
      .flatMap((group) => group.relationships)
      .find((entry) => entry.id === "sprinkler");
    const profile = engine.createEmptyRuntimeBindingProfile(manifest.home.id);
    profile.entityIdsBySlotId["sprinkler-control"] = "valve.demo_water";
    await withDom(async ({ root, document, dom }) => {
      await act(async () =>
        root.render(
          React.createElement(DeviceMappingInspector, {
            manifest,
            room,
            relationship,
            profile,
            runtime,
            disabled: false,
            state: "open",
            inline: true,
            onEntityIdsBySlotIdChange() {},
            onSelectionMade() {},
            onCollapse() {},
            onReopen() {},
          }),
        ),
      );
      const readingGroup = () =>
        document.querySelector('[aria-label="Home Assistant entity for sprinkler-water"]');
      assert.equal(readingGroup().querySelector("details").open, false);
      const values = () =>
        [...readingGroup().querySelectorAll('input[type="radio"]')].map((input) => input.value);
      assert.equal(values().length, 9, "long candidate lists render one page at a time");
      assert.equal(values().includes(waterId), false, "search must reach beyond the first page");
      assert.equal(values().includes("valve.demo_water"), false);
      await act(async () => readingGroup().querySelector("summary").click());
      assert.equal(readingGroup().querySelector("details").open, true);
      await act(async () => readingGroup().querySelector("button").click());
      assert.equal(values().length, 17);
      const search = document.querySelector('input[type="search"]');
      dom.window.HTMLElement.prototype.attachEvent = () => {};
      dom.window.HTMLElement.prototype.detachEvent = () => {};
      await act(async () => search.focus());
      const setSearch = async (value) =>
        act(async () => {
          Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
            search,
            value,
          );
          search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
          search.dispatchEvent(new dom.window.KeyboardEvent("keyup", { bubbles: true }));
        });
      await setSearch("  SYNTHETIC_WATER  ");
      assert.deepEqual(values(), ["", waterId]);
      assert.equal(readingGroup().querySelector("details").open, true);
      assert.ok(document.querySelector('input[value="valve.demo_water"]')?.checked);
      await setSearch("Water consumption");
      assert.deepEqual(values(), ["", waterId]);
      await setSearch("no such entity");
      assert.deepEqual(values(), [""]);
      assert.match(readingGroup().textContent, /Clear search/);
      await setSearch("");
      assert.equal(values().length, 9);
    });
  });
  test("Connect offers separate auxiliary entities across HA devices and retains the inspector after mapping", async () => {
    const { manifest, profile, runtime } = connectionFixture();
    const room = manifest.floors[0].rooms[0];
    const relationship = engine
      .groupRoomMappingRelationships(manifest, room.id)
      .flatMap((group) => group.relationships)
      .find((entry) => entry.id === "fridge");
    let next,
      closed = false;
    await withDom(async ({ root, document }) => {
      await act(async () =>
        root.render(
          React.createElement(DeviceMappingInspector, {
            manifest,
            room,
            relationship,
            profile,
            runtime,
            disabled: false,
            state: "open",
            inline: true,
            onEntityIdsBySlotIdChange: (value) => {
              next = value;
            },
            onSelectionMade: () => {
              closed = true;
            },
            onCollapse() {},
            onReopen() {},
          }),
        ),
      );
      const group = document.querySelector(
        '[aria-label="Home Assistant entity for freezer-temperature"]',
      );
      assert.ok(group, document.body.textContent);
      const freezer = [...group.querySelectorAll('input[type="radio"]')].find(
        (input) => input.value === "sensor.freezer",
      );
      assert.ok(freezer);
      const fridge = [...group.querySelectorAll('input[type="radio"]')].find(
        (input) => input.value === "sensor.fridge",
      );
      assert.match(
        fridge.closest("label").textContent,
        /already used/,
        "shared bindings retain the existing usage indication",
      );
      await act(async () =>
        [...group.querySelectorAll('input[type="radio"]')]
          .find((input) => input.value === "")
          .click(),
      );
      assert.equal(next["freezer-temperature"], undefined);
      assert.equal(next["fridge-control"], "sensor.fridge");
      assert.equal(next["fridge-power"], "sensor.power");
      assert.equal(closed, false);
    });
  });
});
