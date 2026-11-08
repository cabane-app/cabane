import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";
import {
  connectedManifestFixture,
  connectedProfileFixture,
  connectedRuntimeFixture,
} from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { resolveHomeAssistantBindings } = await load(
    "/packages/engine/src/home-assistant-resolver.ts",
  );
  const { deriveRoomStatusMap } = await load("/packages/engine/src/room-status/model.ts");

  const derive = (prepare = () => undefined) => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const profile = connectedProfileFixture();
    const runtime = connectedRuntimeFixture();
    prepare({ manifest, profile, runtime });
    const resolved = resolveHomeAssistantBindings(manifest, profile, runtime);
    return deriveRoomStatusMap(manifest, profile, resolved, runtime)["demo-room"];
  };

  const areaReadings = [
    { key: "aqi", deviceClass: "aqi", value: "42", unit: null },
    { key: "co2", deviceClass: "carbon_dioxide", value: "820", unit: "ppm" },
    { key: "noise", deviceClass: "sound_pressure", value: "41.5", unit: "dBA" },
  ];

  const addAreaSensor = (runtime, reading, entityId, registry = {}, state = {}) => {
    runtime.entityRegistry.push({
      entity_id: entityId,
      area_id: "demo_room",
      device_id: null,
      disabled_by: null,
      hidden_by: null,
      ...registry,
    });
    runtime.entityStates[entityId] = {
      entityId,
      state: reading.value,
      attributes: {
        device_class: reading.deviceClass,
        ...(reading.unit === null ? {} : { unit_of_measurement: reading.unit }),
      },
      available: true,
      stale: false,
      ...state,
    };
  };

  test("uses only the exact temperature and humidity references configured on the mapped area", () => {
    const summary = derive(({ profile, runtime }) => {
      delete profile.entityIdsBySlotId["demo-temperature-slot"];
      runtime.entityStates["sensor.unrelated_temperature"] = {
        ...runtime.entityStates["sensor.demo_temperature"],
        entityId: "sensor.unrelated_temperature",
        state: "99",
      };
    });

    assert.deepEqual(summary.temperature, { value: "19.7", unit: "°C" });
    assert.deepEqual(summary.humidity, { value: "48", unit: "%" });
  });

  test("falls back for missing area readings and hides unknown, unavailable, and stale sensors", () => {
    const missing = derive(({ runtime }) => {
      runtime.areas[0].temperature_entity_id = "sensor.missing";
    });
    const unknown = derive(({ runtime }) => {
      runtime.entityStates["sensor.demo_temperature"] = {
        ...runtime.entityStates["sensor.demo_temperature"],
        state: "unknown",
      };
    });
    const unavailable = derive(({ runtime }) => {
      runtime.entityStates["sensor.demo_humidity"] = {
        ...runtime.entityStates["sensor.demo_humidity"],
        available: false,
      };
    });
    const stale = derive(({ runtime }) => {
      runtime.entityStates["sensor.demo_humidity"] = {
        ...runtime.entityStates["sensor.demo_humidity"],
        stale: true,
      };
    });

    assert.deepEqual(missing.temperature, { value: "19.7", unit: "°C" });
    assert.equal(unknown.temperature, undefined);
    assert.equal(unavailable.humidity, undefined);
    assert.equal(stale.humidity, undefined);
  });

  test("falls back to mapped room sensors when area readings are not configured", () => {
    const summary = derive(({ manifest, profile, runtime }) => {
      delete runtime.areas[0].temperature_entity_id;
      delete runtime.areas[0].humidity_entity_id;
      manifest.floors[0].rooms[0].dashboardSlots.push({
        id: "humidity-slot",
        compatibleDomains: ["sensor"],
        compatibleDeviceClasses: ["humidity"],
        required: false,
        autoMap: "unique-compatible",
        presentation: { label: "Humidity", dashboardRole: "diagnostic" },
      });
      profile.entityIdsBySlotId["humidity-slot"] = "sensor.demo_humidity";
    });
    assert.deepEqual(summary.temperature, { value: "19.7", unit: "°C" });
    assert.deepEqual(summary.humidity, { value: "48", unit: "%" });
    const unbound = derive(({ profile, runtime }) => {
      delete runtime.areas[0].temperature_entity_id;
      delete profile.entityIdsBySlotId["demo-temperature-slot"];
    });
    assert.equal(unbound.temperature, undefined);
  });

  test("prefers the configured area sensor over a mapped sensor", () => {
    const summary = derive(({ runtime }) => {
      runtime.entityStates["sensor.preferred"] = {
        ...runtime.entityStates["sensor.demo_temperature"],
        entityId: "sensor.preferred",
        state: "23",
      };
      runtime.areas[0].temperature_entity_id = "sensor.preferred";
    });
    assert.equal(summary.temperature.value, "23");
  });

  test("finds one visible, enabled sensor per class in the mapped area and keeps their units", () => {
    const summary = derive(({ runtime }) => {
      for (const reading of areaReadings) {
        addAreaSensor(runtime, reading, `sensor.demo_${reading.key}`, {
          area_id: null,
          device_id: "device-switch",
        });
        addAreaSensor(runtime, reading, `sensor.outdoor_${reading.key}`, {
          area_id: "outside",
          device_id: "device-switch",
        });
        addAreaSensor(runtime, reading, `sensor.hidden_${reading.key}`, { hidden_by: "user" });
        addAreaSensor(runtime, reading, `sensor.disabled_${reading.key}`, { disabled_by: "user" });
      }
      addAreaSensor(
        runtime,
        { deviceClass: "pm25", value: "12", unit: "µg/m³" },
        "sensor.demo_pm25",
      );
      addAreaSensor(
        runtime,
        { deviceClass: "signal_strength", value: "-42", unit: "dB" },
        "sensor.demo_signal",
      );
    });
    for (const { key, value, unit } of areaReadings) {
      assert.deepEqual(summary[key], { value, unit }, key);
    }
  });

  test("keeps a class ambiguous when a second sensor is unavailable and shows the other classes", () => {
    for (const ambiguous of areaReadings) {
      const summary = derive(({ runtime }) => {
        for (const reading of areaReadings) {
          addAreaSensor(runtime, reading, `sensor.demo_${reading.key}`);
        }
        addAreaSensor(
          runtime,
          ambiguous,
          `sensor.second_${ambiguous.key}`,
          {},
          {
            state: "unavailable",
            available: false,
          },
        );
      });
      for (const { key, value, unit } of areaReadings) {
        assert.deepEqual(summary[key], key === ambiguous.key ? undefined : { value, unit }, key);
      }
    }
  });

  test("omits unique area readings that are unknown, unavailable, stale, or unlinked", () => {
    for (const state of [
      { state: "unknown" },
      { state: "unavailable", available: false },
      { stale: true },
    ]) {
      const summary = derive(({ runtime }) => {
        for (const reading of areaReadings) {
          addAreaSensor(runtime, reading, `sensor.demo_${reading.key}`, {}, state);
        }
      });
      for (const { key } of areaReadings) assert.equal(summary[key], undefined, key);
    }
    const unlinked = derive(({ profile, runtime }) => {
      delete profile.roomAreaIds["demo-room"];
      for (const reading of areaReadings) {
        addAreaSensor(runtime, reading, `sensor.demo_${reading.key}`);
      }
    });
    for (const { key } of areaReadings) assert.equal(unlinked[key], undefined, key);
  });

  test("aggregates only exact reliable climate, light, presence, and adjacent door bindings", () => {
    const summary = derive(({ manifest, profile, runtime }) => {
      const room = manifest.floors[0].rooms[0];
      room.dashboardSlots.push({
        id: "demo-presence-slot",
        compatibleDomains: ["binary_sensor"],
        compatibleDeviceClasses: ["motion", "occupancy", "presence"],
        required: false,
        autoMap: "unique-compatible",
        presentation: { label: "Presence", dashboardRole: "diagnostic" },
      });
      profile.entityIdsBySlotId["demo-presence-slot"] = "binary_sensor.demo_presence";
      runtime.entityRegistry.push({
        entity_id: "binary_sensor.demo_presence",
        area_id: "demo_room",
        device_id: null,
        platform: "fixture_integration",
        disabled_by: null,
        hidden_by: null,
        name: null,
        original_name: "Presence",
      });
      runtime.entityStates["binary_sensor.demo_presence"] = {
        entityId: "binary_sensor.demo_presence",
        state: "off",
        attributes: { device_class: "presence" },
        available: true,
        stale: false,
      };

      const door = manifest.floors[0].openings.find(({ kind }) => kind === "door");
      door.contactSlot = {
        id: "demo-door-contact-slot",
        compatibleDeviceClasses: ["door", "opening"],
        openState: "on",
        autoMap: "unique-compatible",
      };
      profile.entityIdsBySlotId["demo-door-contact-slot"] = "binary_sensor.demo_door";
      runtime.entityRegistry.push({
        entity_id: "binary_sensor.demo_door",
        area_id: "demo_room",
        device_id: null,
        platform: "fixture_integration",
        disabled_by: null,
        hidden_by: null,
        name: null,
        original_name: "Door",
      });
      runtime.entityStates["binary_sensor.demo_door"] = {
        entityId: "binary_sensor.demo_door",
        state: "on",
        attributes: { device_class: "door" },
        available: true,
        stale: false,
      };

      runtime.entityStates["light.demo_ceiling"] = {
        ...runtime.entityStates["light.demo_ceiling"],
        state: "off",
      };
      runtime.entityStates["light.unmodeled_path"] = {
        ...runtime.entityStates["light.demo_ceiling"],
        entityId: "light.unmodeled_path",
        state: "on",
      };
      runtime.entityStates["climate.demo"] = {
        ...runtime.entityStates["climate.demo"],
        state: "cool",
        attributes: {
          ...runtime.entityStates["climate.demo"].attributes,
          hvac_action: "idle",
        },
      };
    });

    assert.equal(summary.heating, false);
    assert.equal(summary.cooling, true, "selected cool mode remains visible while idle");
    assert.equal(summary.lighting, "off", "unbound area lights do not affect the room badge");
    assert.equal(summary.presence, "absent");
    assert.equal(summary.doorOpen, true);
  });
});
