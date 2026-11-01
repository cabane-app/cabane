import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { create } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";
import { connectedRuntimeFixture } from "./fixtures/home-assistant.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { powerReadingWatts, powerActivityForDevice } = await load(
    "/packages/engine/src/power-activity.ts",
  );
  const { stableDeviceRegistry: devices } = await load("/packages/catalog/src/device/index.ts");
  const { interactionFloor } = await load("/tests/fixtures/interaction-floor.ts");
  const { editSceneItem } = await load("/apps/web/src/editor-preview/furnish/item-edits.ts");
  const { createFurnishingEditorState, furnishingEditorReducer: reduce } = await load(
    "/apps/web/src/editor-preview/furnish/editor-state.ts",
  );
  const { duplicateSceneItem } = await load(
    "/apps/web/src/editor-preview/furnish/duplicate-item.ts",
  );
  const { workspaceSnapshotFromEditorState } = await load(
    "/apps/web/src/editor-preview/project-sync.ts",
  );
  const { ItemPowerActivity } = await load(
    "/apps/web/src/editor-preview/furnish/ItemPowerActivity.tsx",
  );
  const { ItemEntitySlots } = await load(
    "/apps/web/src/editor-preview/furnish/ItemEntitySlots.tsx",
  );
  const { addReadingToSnapshot } = await load("/apps/web/src/editor-connect/add-reading.ts");
  const registries = { deviceModels: devices, furnishingModels: {}, openingModels: {} };
  const snapshot = (entityId, state, attributes = {}) => ({
    entityId,
    state,
    attributes,
    available: true,
    stale: false,
  });
  const power = (state = "0", attributes = {}) =>
    snapshot("sensor.synthetic_power", state, {
      device_class: "power",
      unit_of_measurement: "W",
      ...attributes,
    });
  const fixture = () => {
    const project = engine.createEmptyHomeProject("power-activity", "Synthetic coffee maker");
    const floor = structuredClone(interactionFloor);
    floor.rooms = floor.rooms.map((room) => ({ ...room, devices: [], dashboardSlots: [] }));
    project.floors = [floor];
    const slot = (id, domain, primary = false) => ({
      id,
      compatibleDomains: [domain],
      deviceRole: primary ? "primary" : "secondary",
      required: primary,
      autoMap: "manual",
      presentation: { label: id, dashboardRole: primary ? "primary" : "secondary" },
    });
    const item = {
      id: "coffee",
      kind: "device",
      modelId: "coffee-maker",
      floorId: floor.id,
      placement: { kind: "absolute", at: [3, 3], elevationMeters: 0, rotationYRadians: 0 },
      size: devices["coffee-maker"].defaultSize,
      entitySlots: [slot("coffee-control", "switch", true), slot("coffee-power", "sensor")],
      powerActivity: { slotId: "coffee-power", thresholdWatts: 5 },
    };
    project.sceneItems = [item];
    const runtime = connectedRuntimeFixture();
    runtime.entityStates = {
      "switch.synthetic_coffee": snapshot("switch.synthetic_coffee", "on"),
      "sensor.synthetic_power": power(),
    };
    runtime.entityRegistry = Object.keys(runtime.entityStates).map((entity_id) => ({
      entity_id,
      device_id: null,
      area_id: null,
      name: entity_id,
      original_name: null,
      disabled_by: null,
      hidden_by: null,
    }));
    const profile = {
      ...engine.createEmptyRuntimeBindingProfile(project.home.id),
      entityIdsBySlotId: {
        "coffee-control": "switch.synthetic_coffee",
        "coffee-power": "sensor.synthetic_power",
      },
    };
    const bindings = {
      [runtime.origin]: {
        draft: profile,
        published: structuredClone(profile),
        manualRoomIds: [],
        manualSlotIds: Object.keys(profile.entityIdsBySlotId),
      },
    };
    const resolved = () => {
      const manifest = engine.composeHomeManifest(project, registries);
      const resolved = engine.resolveHomeAssistantBindings(manifest, profile, runtime, devices);
      return Object.values(resolved.rooms)
        .flatMap((room) => room.devices)
        .find((device) => device.slot.id === item.id);
    };
    return { project, item, runtime, profile, bindings, resolved };
  };

  test("only usable instantaneous W and kW readings yield watts", () => {
    assert.equal(powerReadingWatts(power("0")), 0);
    assert.equal(powerReadingWatts(power("1.25", { unit_of_measurement: "kW" })), 1250);
    for (const state of ["", "  ", "unknown", "unavailable", "NaN", "Infinity", "-1"])
      assert.equal(powerReadingWatts(power(state)), null, state);
    for (const reading of [
      undefined,
      { ...power("1200"), stale: true },
      { ...power("1200"), available: false },
      power("1", { device_class: "energy", unit_of_measurement: "kWh" }),
      power("1", { device_class: "temperature" }),
      power("1", { unit_of_measurement: "Wh" }),
      power("1", { device_class: undefined }),
      { ...power("1"), entityId: "binary_sensor.synthetic_power" },
    ])
      assert.equal(powerReadingWatts(reading), null);
  });

  test("power activity uses a strict threshold while switch state and service targets stay truthful", () => {
    const { item, runtime, resolved } = fixture();
    for (const [state, unit, expected] of [
      ["0", "W", false],
      ["5", "W", false],
      ["5.1", "W", true],
      ["0.006", "kW", true],
    ]) {
      runtime.entityStates["sensor.synthetic_power"] = power(state, { unit_of_measurement: unit });
      const device = resolved();
      assert.equal(powerActivityForDevice(item, device), expected);
      const primary = device.entities.find((entry) => entry.slotId === "coffee-control").state;
      assert.equal(engine.deviceVisualStateForSnapshot(primary), "connected-active");
      assert.equal(primary.state, "on");
      assert.deepEqual(engine.toggleEntityCall(primary), {
        domain: "switch",
        service: "turn_off",
        data: undefined,
        target: { entity_id: "switch.synthetic_coffee" },
      });
    }
    runtime.entityStates["sensor.synthetic_power"] = power("1200");
    for (const primary of [
      snapshot("switch.synthetic_coffee", "off"),
      snapshot("switch.synthetic_coffee", "unknown"),
      { ...snapshot("switch.synthetic_coffee", "on"), available: false },
      { ...snapshot("switch.synthetic_coffee", "on"), stale: true },
    ]) {
      runtime.entityStates["switch.synthetic_coffee"] = primary;
      assert.equal(powerActivityForDevice(item, resolved()), false);
    }
    runtime.entityStates["switch.synthetic_coffee"] = snapshot("switch.synthetic_coffee", "on");
    for (const reading of [
      { ...power("1200"), stale: true },
      { ...power("1200"), available: false },
      power("1200", { device_class: "energy", unit_of_measurement: "kWh" }),
    ]) {
      runtime.entityStates["sensor.synthetic_power"] = reading;
      assert.equal(powerActivityForDevice(item, resolved()), false);
    }
    delete runtime.entityStates["sensor.synthetic_power"];
    assert.equal(powerActivityForDevice(item, resolved()), false);
    const unconfigured = { ...item };
    delete unconfigured.powerActivity;
    assert.equal(powerActivityForDevice(unconfigured, resolved()), undefined);
    const native = resolved();
    native.entities[0] = {
      ...native.entities[0],
      domain: "sensor",
      state: snapshot("sensor.native", "running"),
    };
    assert.equal(
      powerActivityForDevice(item, native),
      undefined,
      "native running states remain authoritative",
    );
  });

  test("the mounted coffee maker stops idle steam while retaining its connected beacon", async () => {
    const { item, project, runtime, resolved } = fixture();
    const props = {
      item,
      floor: project.floors[0],
      furnishingModels: {},
      deviceModels: devices,
      resolvedDevice: resolved(),
      entityStatesBySlotId: {},
      liveMediaByEntityId: {},
      reducedMotion: true,
      walkMode: false,
      onInteract() {},
    };
    const renderer = await create(React.createElement(engine.SceneItemRenderer, props));
    try {
      assert.equal(renderer.scene.findAllByProps({ name: "appliance-steam" }).length, 0);
      assert.equal(
        renderer.scene.findAllByProps({ name: "device-state-connected-active" }).length,
        1,
      );
      runtime.entityStates["sensor.synthetic_power"] = power("1200");
      await renderer.update(
        React.createElement(engine.SceneItemRenderer, { ...props, resolvedDevice: resolved() }),
      );
      assert.equal(renderer.scene.findAllByProps({ name: "appliance-steam" }).length, 1);
      assert.equal(
        renderer.scene.findAllByProps({ name: "device-state-connected-active" }).length,
        1,
      );
      const unconfigured = { ...item };
      delete unconfigured.powerActivity;
      runtime.entityStates["sensor.synthetic_power"] = power("0");
      await renderer.update(
        React.createElement(engine.SceneItemRenderer, {
          ...props,
          item: unconfigured,
          resolvedDevice: resolved(),
        }),
      );
      assert.equal(
        renderer.scene.findAllByProps({ name: "appliance-steam" }).length,
        1,
        "omitting the setting preserves switch-driven steam",
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("saved power settings reject invalid thresholds, foreign slots, unsupported models and private fields", () => {
    const { project, item } = fixture();
    assert.equal(engine.validateHomeProject(project, registries).valid, true);
    assert.deepEqual(
      engine.parseHomeProject(engine.serializeHomeProject(project)).project,
      project,
    );
    for (const settings of [
      { slotId: "coffee-power", thresholdWatts: -1 },
      { slotId: "coffee-power", thresholdWatts: NaN },
      { slotId: "coffee-power", thresholdWatts: Infinity },
      { slotId: "coffee-control", thresholdWatts: 5 },
      { slotId: "another-object-reading", thresholdWatts: 5 },
    ]) {
      const invalid = { ...project, sceneItems: [{ ...item, powerActivity: settings }] };
      assert.equal(engine.validateHomeProject(invalid, registries).valid, false);
    }
    const invalid = structuredClone(project);
    invalid.sceneItems[0].modelId = "washing-machine";
    assert.equal(engine.validateHomeProject(invalid, registries).valid, false);
    invalid.sceneItems[0] = {
      ...item,
      powerActivity: { ...item.powerActivity, entityId: "sensor.private" },
    };
    assert.equal(engine.parseHomeProject(engine.serializeHomeProject(invalid)).valid, false);
    const unconfigured = structuredClone(project);
    delete unconfigured.sceneItems[0].powerActivity;
    assert.deepEqual(
      engine.parseHomeProject(engine.serializeHomeProject(unconfigured)).project,
      unconfigured,
    );
  });

  test("shared item edits and duplication preserve local references; reading removal clears activity and mapping in one undo step", () => {
    const { item, project, bindings, runtime } = fixture();
    const definition = devices[item.modelId];
    assert.equal(
      editSceneItem(
        item,
        { powerActivity: { slotId: "coffee-power", thresholdWatts: -1 } },
        definition,
      ),
      item,
    );
    const reset = editSceneItem(item, { powerActivity: null }, definition);
    assert.equal(reset.powerActivity, undefined);
    assert.deepEqual(reset.entitySlots, item.entitySlots);
    const copy = duplicateSceneItem(item, [item], project.floors[0]);
    assert.notEqual(copy.powerActivity.slotId, item.powerActivity.slotId);
    assert.equal(copy.powerActivity.slotId, copy.entitySlots[1].id);
    assert.equal(
      bindings[runtime.origin].draft.entityIdsBySlotId[copy.powerActivity.slotId],
      undefined,
    );
    assert.equal(
      engine.validateHomeProject({ ...project, sceneItems: [item, copy] }, registries).valid,
      true,
    );
    const initial = createFurnishingEditorState([item]);
    const changed = reduce(initial, {
      type: "update-entity-slots",
      id: item.id,
      entitySlots: [item.entitySlots[0]],
    });
    assert.equal(changed.items[0].powerActivity, undefined);
    assert.deepEqual(reduce(changed, { type: "undo" }).items, [item]);
    const before = { project, bindings };
    const after = workspaceSnapshotFromEditorState(
      before,
      project.floors[0],
      changed.items,
      registries,
    );
    assert.equal(after.bindings[runtime.origin].draft.entityIdsBySlotId["coffee-power"], undefined);
    assert.equal(
      after.bindings[runtime.origin].published.entityIdsBySlotId["coffee-power"],
      "sensor.synthetic_power",
    );
    const history = engine.commitWorkspaceSnapshot(engine.createWorkspaceHistory(before), after);
    assert.deepEqual(engine.undoWorkspaceHistory(history).present, before);
    assert.deepEqual(
      engine.redoWorkspaceHistory(engine.undoWorkspaceHistory(history)).present,
      after,
    );
    const binary = editSceneItem(
      item,
      {
        entitySlots: [
          item.entitySlots[0],
          { ...item.entitySlots[1], compatibleDomains: ["binary_sensor"] },
        ],
      },
      definition,
    );
    assert.equal(binary.powerActivity, undefined);
  });

  test("Add reading, autosave, publication and portable import retain the setting without private mappings", () =>
    withStorageDom(async ({ indexedDB }) => {
      const { project, item, runtime } = fixture();
      const seed = { ...project, sceneItems: [{ ...item, entitySlots: [item.entitySlots[0]] }] };
      delete seed.sceneItems[0].powerActivity;
      const added = addReadingToSnapshot(
        { project: seed, bindings: {} },
        item.id,
        "sensor.synthetic_power",
        runtime,
        { label: "Power", showInScene: true },
      );
      const addedItem = added.project.sceneItems[0];
      const slotId = addedItem.entitySlots[1].id;
      const settings = { slotId, thresholdWatts: 8 };
      added.project.sceneItems = [
        editSceneItem(addedItem, { powerActivity: settings }, devices[item.modelId]),
      ];
      const records = engine.createHomeProjectRepository(
        engine.createIndexedDbProjectRecordStore(indexedDB),
        registries,
      );
      const lifecycle = engine.createHomeProjectLifecycle(records, seed);
      const loaded = await lifecycle.load();
      const saved = await lifecycle.autosave(
        loaded.record,
        added.project,
        undefined,
        added.bindings,
      );
      assert.equal(saved.status, "saved", JSON.stringify(saved.issues));
      const published = await lifecycle.publish(saved.record, { confirmWarnings: true });
      assert.equal(published.status, "published", JSON.stringify(published.errors));
      const reopened = await records.load(project.home.id);
      assert.deepEqual(reopened.draft.sceneItems[0].powerActivity, settings);
      assert.deepEqual(reopened.published.sceneItems[0].powerActivity, settings);
      const portable = lifecycle.exportRecord(reopened);
      assert.equal(portable.includes("sensor.synthetic_power"), false);
      const imported = engine.parseHomeProjectRecord(portable, registries);
      assert.equal(imported.valid, true, JSON.stringify(imported.issues));
      assert.deepEqual(imported.record.draft.sceneItems[0].powerActivity, settings);
      assert.deepEqual(imported.record.bindings, {});
    }));

  test("Properties offers attached power readings, commits valid thresholds and makes Activity reset explicit", () =>
    withStorageDom(async ({ document, window }) => {
      const { item, runtime, profile } = fixture();
      const root = createRoot(document.body.appendChild(document.createElement("div")));
      let current = { ...item };
      delete current.powerActivity;
      const connections = {
        runtime,
        profile,
        onConnect() {},
        onDisconnect() {},
        onAddReading() {},
      };
      const render = () =>
        root.render(
          React.createElement(
            React.Fragment,
            null,
            React.createElement(ItemPowerActivity, {
              item: current,
              connections,
              onChange: (powerActivity) => {
                current = editSceneItem(current, { powerActivity }, devices[item.modelId]);
                render();
              },
            }),
            React.createElement(ItemEntitySlots, {
              item: current,
              label: "Coffee maker",
              connections,
              onChange() {},
            }),
          ),
        );
      try {
        await act(async () => render());
        const select = document.querySelector("select");
        assert.deepEqual(
          [...select.options].map((option) => option.textContent),
          ["Connected state", "coffee-power"],
        );
        await act(async () => {
          select.value = "coffee-power";
          select.dispatchEvent(new window.Event("change", { bubbles: true }));
        });
        assert.deepEqual(current.powerActivity, item.powerActivity);
        const input = document.querySelector('input[inputmode="decimal"]');
        await act(async () => {
          input.value = "-1";
          input.dispatchEvent(new window.Event("input", { bubbles: true }));
        });
        await act(async () =>
          input.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true })),
        );
        assert.equal(current.powerActivity.thresholdWatts, 5);
        assert.match(document.querySelector('[role="alert"]').textContent, /at least 0 W/);
        await act(async () => {
          input.value = "7,5";
          input.dispatchEvent(new window.Event("input", { bubbles: true }));
        });
        await act(async () =>
          input.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true })),
        );
        assert.equal(current.powerActivity.thresholdWatts, 7.5);
        const actions = document.querySelector('button[aria-label="Options for coffee-power"]');
        await act(async () => actions.click());
        assert.match(document.body.textContent, /Remove reading and reset Activity/);
        profile.entityIdsBySlotId["coffee-power"] = "sensor.unrelated";
        runtime.entityStates["sensor.unrelated"] = snapshot("sensor.unrelated", "100", {
          device_class: "temperature",
          unit_of_measurement: "°C",
        });
        await act(async () => render());
        assert.match(document.body.textContent, /Power reading unavailable. Animation stays idle./);
        profile.entityIdsBySlotId["coffee-control"] = "sensor.native_status";
        await act(async () => render());
        assert.equal(
          select.disabled,
          false,
          "a saved setting can still be removed after switching to native state",
        );
        await act(async () => {
          select.value = "";
          select.dispatchEvent(new window.Event("change", { bubbles: true }));
        });
        assert.equal(current.powerActivity, undefined);
        assert.equal(select.disabled, true, "power activity is offered for switch connections");
      } finally {
        await act(async () => root.unmount());
      }
    }));
});
