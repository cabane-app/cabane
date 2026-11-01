import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { stableDeviceRegistry: devices } = await load("/packages/catalog/src/device/index.ts");
  const { interactionFloor: floor } = await load("/tests/fixtures/interaction-floor.ts");
  const readingSlot = (id, deviceClass, domain = "sensor") => ({
    id,
    compatibleDomains: [domain],
    compatibleDeviceClasses: [deviceClass],
    required: false,
    autoMap: "manual",
    deviceRole: "secondary",
    presentation: { label: id, dashboardRole: "hidden", showInScene: "if-present" },
  });
  const powerSlot = readingSlot("power", "power");
  const temperatureSlot = readingSlot("temperature", "temperature");
  const primarySlot = {
    id: "control",
    compatibleDomains: ["switch", "sensor"],
    required: true,
    autoMap: "manual",
    deviceRole: "primary",
    presentation: { label: "Appliance", dashboardRole: "primary" },
  };
  const snapshot = (entityId, state, attributes = {}, flags = {}) => ({
    entityId,
    state,
    attributes,
    available: true,
    stale: false,
    ...flags,
  });
  const power = (value, unit = "W", flags) =>
    snapshot("sensor.power", value, { device_class: "power", unit_of_measurement: unit }, flags);
  const primary = snapshot("switch.appliance", "on");
  const element = (modelId, slots, states, definition = devices[modelId]) => {
    const item = {
      id: "appliance",
      floorId: floor.id,
      modelId,
      kind: "device",
      entitySlots: [primarySlot, ...slots],
      size: definition.defaultSize,
      placement: { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
    };
    return createElement(engine.SceneItemRenderer, {
      item,
      floor,
      deviceModels: { [modelId]: definition },
      furnishingModels: {},
      resolvedDevice: {
        slot: engine.deviceSlotForItem(item, floor),
        entities: Object.entries(states).map(([slotId, state]) => ({
          slotId,
          entityId: state.entityId,
          state,
        })),
        issues: [],
      },
      entityStatesBySlotId: states,
      reducedMotion: true,
      walkMode: false,
      liveMediaByEntityId: {},
      onInteract() {},
    });
  };

  test("models receive all attached readings, declarations and freshness without replacing primary state", async () => {
    let received;
    const definition = {
      ...devices["coffee-maker"],
      component(props) {
        received = props;
        return createElement("group");
      },
    };
    const binarySlot = readingSlot("water-low", "problem", "binary_sensor");
    const missingSlot = readingSlot("unmapped-power", "power");
    const slots = [powerSlot, temperatureSlot, binarySlot, missingSlot];
    const states = {
      control: primary,
      power: power("0"),
      temperature: snapshot("sensor.temperature", "85", {
        device_class: "temperature",
        unit_of_measurement: "°C",
      }),
      "water-low": snapshot("binary_sensor.water_low", "off"),
    };
    const renderer = await create(element("coffee-maker", slots, states, definition));
    try {
      assert.equal(received.state, primary);
      assert.equal(received.visualState, "connected-active");
      assert.deepEqual(received.readings.map((reading) => reading.slot), slots);
      assert.equal(received.readings[0].state, states.power, "a hidden zero reading still reaches the model");
      assert.equal(received.readings[1].state, states.temperature);
      assert.equal(received.readings[2].state, states["water-low"]);
      assert.equal(received.readings[3].state, undefined);
      const stale = { ...states, power: power("1200", "W", { stale: true }) };
      await renderer.update(element("coffee-maker", slots, stale, definition));
      assert.equal(received.readings[0].state, stale.power);
      assert.equal(received.readings[0].state.stale, true);
      assert.equal(received.state, primary);
      assert.equal(received.visualState, "connected-active");
    } finally {
      await renderer.unmount();
    }
  });

  test("coffee maker and kettle require usable positive attached power as well as active primary state", async () => {
    const cases = [
      ["no readings", [], {}, true],
      ["temperature only", [temperatureSlot], {}, true],
      ["positive watts", [powerSlot], { power: power("1200") }, true],
      ["positive kilowatts", [powerSlot], { power: power("0.002", "kW") }, true],
      ["zero watts", [powerSlot], { power: power("0") }, false],
      ["negative watts", [powerSlot], { power: power("-1") }, false],
      ["unknown", [powerSlot], { power: power("unknown") }, false],
      ["not finite", [powerSlot], { power: power("Infinity") }, false],
      ["not numeric", [powerSlot], { power: power("heating") }, false],
      ["stale", [powerSlot], { power: power("1200", "W", { stale: true }) }, false],
      ["unavailable", [powerSlot], { power: power("1200", "W", { available: false }) }, false],
      ["missing state or mapping", [powerSlot], {}, false],
      ["invalid unit", [powerSlot], { power: power("1200", "kWh") }, false],
      ["incompatible class", [powerSlot], { power: snapshot("sensor.power", "1200", { device_class: "energy", unit_of_measurement: "W" }) }, false],
      ["power discovered from live type", [readingSlot("other", "")], { other: power("1200") }, true],
      ["all supplied powers positive", [powerSlot, readingSlot("other", "power")], { power: power("1200"), other: power("20") }, true],
      ["one supplied power idle", [powerSlot, readingSlot("other", "power")], { power: power("1200"), other: power("0") }, false],
      ["one supplied power missing", [powerSlot, readingSlot("other", "power")], { power: power("1200") }, false],
    ];
    for (const modelId of ["coffee-maker", "electric-kettle"]) {
      const renderer = await create(element(modelId, [], { control: primary }));
      try {
        for (const [name, slots, states, active] of cases) {
          await renderer.update(element(modelId, slots, { control: primary, ...states }));
          assert.equal(renderer.scene.findAllByProps({ name: "appliance-steam" }).length, active ? 1 : 0, `${modelId}: ${name}`);
          assert.equal(renderer.scene.findByProps({ name: "scene-item-appliance" }).props.userData.visualState, "connected-active", "readings do not change the connection beacon state");
        }
        for (const state of [
          snapshot("switch.appliance", "off"),
          snapshot("switch.appliance", "on", {}, { stale: true }),
          snapshot("switch.appliance", "on", {}, { available: false }),
          undefined,
        ]) {
          await renderer.update(element(modelId, [powerSlot], { ...(state ? { control: state } : {}), power: power("1200") }));
          assert.equal(renderer.scene.findAllByProps({ name: "appliance-steam" }).length, 0, `${modelId}: primary state is still required`);
        }
        await renderer.update(element(modelId, [powerSlot], { control: snapshot("sensor.appliance", "heating"), power: power("1200") }));
        assert.equal(renderer.scene.findAllByProps({ name: "appliance-steam" }).length, 1, "native active sensor state is preserved");
      } finally {
        await renderer.unmount();
      }
    }
  });
});
