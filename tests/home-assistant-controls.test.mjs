import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";
import { toSnapshots } from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const controls = await load("/packages/engine/src/home-assistant-controls.ts");
  const states = toSnapshots();
  const { bindingCanMutate } = await load("/packages/engine/src/home-assistant-resolver.ts");
  const { deviceVisualStateForSnapshot } = await load("/packages/engine/src/devices.ts");

  test("events display their last type and event timestamp and never offer a command", async () => {
    const event = {
      entityId: "event.synthetic_remote",
      state: "2026-01-01T12:00:00.123+00:00",
      attributes: { event_type: "short_release", event_types: ["short_release", "long_release"] },
      available: true,
      stale: false,
      lastUpdated: "2026-01-02T12:00:00.000+00:00",
    };
    assert.equal(deviceVisualStateForSnapshot(event), "connected-inactive");
    assert.equal(deviceVisualStateForSnapshot({ ...event, stale: true }), "disconnected");
    assert.equal(deviceVisualStateForSnapshot({ ...event, available: false }), "unavailable");
    const reading = controls.entityDisplayValue(event);
    assert.equal(reading, `short_release · ${new Date(event.state).toLocaleString()}`);
    assert.equal(bindingCanMutate({ domain: "event", state: event, issues: [] }), false);
    assert.throws(() => controls.toggleEntityCall(event), /read-only/);
    assert.throws(() => controls.buttonPressCall(event), /read-only/);
    assert.equal(
      controls.entityDisplayValue({ ...event, state: "unknown", available: false }),
      "No event received",
    );
    assert.equal(
      controls.entityDisplayValue({ ...event, state: "unavailable", available: false }),
      "Unavailable",
    );
    assert.equal(controls.entityDisplayValue({ ...event, stale: true }), "Disconnected");
    assert.equal(
      controls.entityDisplayValue({ ...event, state: "bad timestamp" }),
      "Event time unavailable",
    );
    assert.match(controls.entityDisplayValue({ ...event, attributes: {} }), /^Unknown event/);
  });

  test("builds exact supported service calls", () => {
    assert.deepEqual(controls.toggleEntityCall(states["light.demo_ceiling"]), {
      domain: "light",
      service: "turn_off",
      data: undefined,
      target: { entity_id: "light.demo_ceiling" },
    });
    assert.deepEqual(controls.lightBrightnessCall(states["light.demo_ceiling"], 52.6), {
      domain: "light",
      service: "turn_on",
      data: { brightness_pct: 53 },
      target: { entity_id: "light.demo_ceiling" },
      delivery: { mode: "coalesced-value", channel: "brightness" },
    });
    const expectedCalls = [
      [
        controls.toggleEntityCall(states["switch.demo_coffee"]),
        {
          domain: "switch",
          service: "turn_on",
          data: undefined,
          target: { entity_id: "switch.demo_coffee" },
        },
      ],
      [
        controls.toggleEntityCall(states["input_boolean.demo_quiet"]),
        {
          domain: "input_boolean",
          service: "turn_off",
          data: undefined,
          target: { entity_id: "input_boolean.demo_quiet" },
        },
      ],
      [
        controls.climatePowerCall(states["climate.demo"], true),
        {
          domain: "climate",
          service: "turn_on",
          data: undefined,
          target: { entity_id: "climate.demo" },
        },
      ],
      [
        controls.climatePowerCall(states["climate.demo"], false),
        {
          domain: "climate",
          service: "turn_off",
          data: undefined,
          target: { entity_id: "climate.demo" },
        },
      ],
      [
        controls.climateTemperatureCall(states["climate.demo"], 99),
        {
          domain: "climate",
          service: "set_temperature",
          data: { temperature: 30 },
          target: { entity_id: "climate.demo" },
          delivery: { mode: "coalesced-value", channel: "temperature" },
        },
      ],
      [
        controls.climateModeCall(states["climate.demo"], "cool"),
        {
          domain: "climate",
          service: "set_hvac_mode",
          data: { hvac_mode: "cool" },
          target: { entity_id: "climate.demo" },
        },
      ],
      [
        controls.climatePresetCall(states["climate.demo"], "eco"),
        {
          domain: "climate",
          service: "set_preset_mode",
          data: { preset_mode: "eco" },
          target: { entity_id: "climate.demo" },
        },
      ],
      [
        controls.climateFanModeCall(states["climate.demo"], "low"),
        {
          domain: "climate",
          service: "set_fan_mode",
          data: { fan_mode: "low" },
          target: { entity_id: "climate.demo" },
        },
      ],
      [
        controls.climateSwingModeCall(states["climate.demo"], "vertical"),
        {
          domain: "climate",
          service: "set_swing_mode",
          data: { swing_mode: "vertical" },
          target: { entity_id: "climate.demo" },
        },
      ],
      ...["open_cover", "stop_cover", "close_cover"].map((service) => [
        controls.coverActionCall(states["cover.demo_shade"], service),
        { domain: "cover", service, data: undefined, target: { entity_id: "cover.demo_shade" } },
      ]),
      [
        controls.coverPositionCall(states["cover.demo_shade"], -10),
        {
          domain: "cover",
          service: "set_cover_position",
          data: { position: 0 },
          target: { entity_id: "cover.demo_shade" },
          delivery: { mode: "coalesced-value", channel: "position" },
        },
      ],
      [
        controls.fanPowerCall(states["fan.demo"], false),
        {
          domain: "fan",
          service: "turn_off",
          data: undefined,
          target: { entity_id: "fan.demo" },
        },
      ],
      [
        controls.fanPercentageCall(states["fan.demo"], 44.8),
        {
          domain: "fan",
          service: "set_percentage",
          data: { percentage: 45 },
          target: { entity_id: "fan.demo" },
          delivery: { mode: "coalesced-value", channel: "percentage" },
        },
      ],
      [
        controls.fanPresetCall(states["fan.demo"], "breeze"),
        {
          domain: "fan",
          service: "set_preset_mode",
          data: { preset_mode: "breeze" },
          target: { entity_id: "fan.demo" },
        },
      ],
      [
        controls.mediaPlaybackCall(states["media_player.demo_speaker"]),
        {
          domain: "media_player",
          service: "media_pause",
          data: undefined,
          target: { entity_id: "media_player.demo_speaker" },
        },
      ],
      [
        controls.mediaPlaybackCall({ ...states["media_player.demo_speaker"], state: "paused" }),
        {
          domain: "media_player",
          service: "media_play",
          data: undefined,
          target: { entity_id: "media_player.demo_speaker" },
        },
      ],
      [
        controls.mediaVolumeCall(states["media_player.demo_speaker"], 2),
        {
          domain: "media_player",
          service: "volume_set",
          data: { volume_level: 1 },
          target: { entity_id: "media_player.demo_speaker" },
          delivery: { mode: "coalesced-value", channel: "volume" },
        },
      ],
      [
        controls.humidifierPowerCall(states["humidifier.demo"], false),
        {
          domain: "humidifier",
          service: "turn_off",
          data: undefined,
          target: { entity_id: "humidifier.demo" },
        },
      ],
      [
        controls.humidifierHumidityCall(states["humidifier.demo"], 68),
        {
          domain: "humidifier",
          service: "set_humidity",
          data: { humidity: 70 },
          target: { entity_id: "humidifier.demo" },
          delivery: { mode: "coalesced-value", channel: "humidity" },
        },
      ],
      [
        controls.humidifierModeCall(states["humidifier.demo"], "eco"),
        {
          domain: "humidifier",
          service: "set_mode",
          data: { mode: "eco" },
          target: { entity_id: "humidifier.demo" },
        },
      ],
      [
        controls.waterHeaterPowerCall(states["water_heater.demo"], true),
        {
          domain: "water_heater",
          service: "turn_on",
          data: undefined,
          target: { entity_id: "water_heater.demo" },
        },
      ],
      [
        controls.waterHeaterTemperatureCall(states["water_heater.demo"], 73),
        {
          domain: "water_heater",
          service: "set_temperature",
          data: { temperature: 75 },
          target: { entity_id: "water_heater.demo" },
          delivery: { mode: "coalesced-value", channel: "temperature" },
        },
      ],
      [
        controls.waterHeaterOperationModeCall(states["water_heater.demo"], "performance"),
        {
          domain: "water_heater",
          service: "set_operation_mode",
          data: { operation_mode: "performance" },
          target: { entity_id: "water_heater.demo" },
        },
      ],
      [
        controls.waterHeaterAwayModeCall(states["water_heater.demo"], true),
        {
          domain: "water_heater",
          service: "set_away_mode",
          data: { away_mode: true },
          target: { entity_id: "water_heater.demo" },
        },
      ],
      ...["start", "pause", "stop", "return_to_base"].map((service) => [
        controls.vacuumActionCall(states["vacuum.demo"], service),
        { domain: "vacuum", service, data: undefined, target: { entity_id: "vacuum.demo" } },
      ]),
      [
        controls.vacuumFanSpeedCall(states["vacuum.demo"], "turbo"),
        {
          domain: "vacuum",
          service: "set_fan_speed",
          data: { fan_speed: "turbo" },
          target: { entity_id: "vacuum.demo" },
        },
      ],
      [
        controls.vacuumRoomCleanCall(states["vacuum.demo"], [8, 6]),
        {
          domain: "dreame_vacuum",
          service: "vacuum_clean_segment",
          data: { segments: [8, 6] },
          target: { entity_id: "vacuum.demo" },
        },
      ],
      [
        controls.lockActionCall(states["lock.demo_front_door"], "unlock", "1234"),
        {
          domain: "lock",
          service: "unlock",
          data: { code: "1234" },
          target: { entity_id: "lock.demo_front_door" },
        },
      ],
      [
        controls.alarmActionCall(states["alarm_control_panel.demo"], "alarm_arm_away", "1234"),
        {
          domain: "alarm_control_panel",
          service: "alarm_arm_away",
          data: { code: "1234" },
          target: { entity_id: "alarm_control_panel.demo" },
        },
      ],
      [
        controls.valveActionCall(states["valve.demo_water"], "close_valve"),
        {
          domain: "valve",
          service: "close_valve",
          data: undefined,
          target: { entity_id: "valve.demo_water" },
        },
      ],
      [
        controls.valvePositionCall(states["valve.demo_water"], 111),
        {
          domain: "valve",
          service: "set_valve_position",
          data: { position: 100 },
          target: { entity_id: "valve.demo_water" },
          delivery: { mode: "coalesced-value", channel: "position" },
        },
      ],
      [
        controls.sirenPowerCall(states["siren.demo"], true, {
          tone: "alarm",
          duration: 9,
          volumeLevel: 1.4,
        }),
        {
          domain: "siren",
          service: "turn_on",
          data: { tone: "alarm", duration: 9, volume_level: 1 },
          target: { entity_id: "siren.demo" },
        },
      ],
      [
        controls.selectOptionCall(states["select.demo_cycle"], "intensive"),
        {
          domain: "select",
          service: "select_option",
          data: { option: "intensive" },
          target: { entity_id: "select.demo_cycle" },
        },
      ],
      [
        controls.numberValueCall(states["number.demo_level"], 43),
        {
          domain: "number",
          service: "set_value",
          data: { value: 45 },
          target: { entity_id: "number.demo_level" },
          delivery: { mode: "coalesced-value", channel: "value" },
        },
      ],
      [
        controls.buttonPressCall(states["button.demo_start"]),
        {
          domain: "button",
          service: "press",
          data: undefined,
          target: { entity_id: "button.demo_start" },
        },
      ],
    ];
    for (const [actual, expected] of expectedCalls) assert.deepEqual(actual, expected);
  });

  test("reads rooms only from the selected vacuum map", () => {
    assert.deepEqual(controls.vacuumRooms(states["vacuum.demo"]), [
      { id: 8, name: "Kitchen" },
      { id: 6, name: "Room 6" },
    ]);
    assert.deepEqual(
      controls.vacuumRooms({
        ...states["vacuum.demo"],
        attributes: {
          rooms: {
            Upstairs: [{ id: 2, name: "Office" }],
            Downstairs: [{ id: 3, name: "Kitchen" }],
          },
        },
      }),
      [],
    );
  });

  test("discovers all visible available lights for one deterministic all-off call", () => {
    const unavailable = {
      ...states,
      "light.unavailable": {
        entityId: "light.unavailable",
        state: "unavailable",
        attributes: {},
        available: false,
        stale: false,
      },
      "light.stale": {
        entityId: "light.stale",
        state: "on",
        attributes: {},
        available: true,
        stale: true,
      },
    };
    assert.deepEqual(controls.allLightsOffCall(unavailable), {
      domain: "light",
      service: "turn_off",
      target: { entity_id: ["light.demo_ceiling", "light.unmodeled_path"] },
    });
  });

  test("derives scene light output from live HA power and brightness", () => {
    const light = states["light.demo_ceiling"];
    assert.ok(Math.abs(controls.lightBrightnessRatio(light) - 128 / 255) < 1e-12);
    assert.equal(controls.lightBrightnessRatio({ ...light, state: "off" }), 0);
    assert.equal(controls.lightBrightnessRatio({ ...light, stale: true }), 0);
    assert.equal(controls.lightBrightnessRatio({ ...light, available: false }), 0);
    assert.equal(controls.lightBrightnessRatio({ ...light, attributes: {} }), 1);
    assert.equal(
      controls.lightBrightnessRatio({
        ...light,
        attributes: { brightness: 999 },
      }),
      1,
    );
    assert.equal(controls.lightBrightnessRatio(undefined), 0);
    assert.equal(
      controls.lightColorForSnapshot(
        {
          ...light,
          attributes: { rgb_color: [260, 64, -5] },
        },
        "#ffffff",
      ),
      "rgb(255, 64, 0)",
    );
    assert.match(
      controls.lightColorForSnapshot(
        {
          ...light,
          attributes: { color_temp_kelvin: 2_700 },
        },
        "#ffffff",
      ),
      /^rgb\(255, \d+, \d+\)$/,
    );
    assert.equal(controls.lightColorForSnapshot(light, "#abcdef"), "#abcdef");
  });

  test("omits brightness for on-off-only lights and exposes read-only display values", () => {
    assert.equal(controls.supportsLightBrightness(states["light.unmodeled_path"]), false);
    assert.equal(controls.entityDisplayValue(states["sensor.demo_temperature"]), "19.7 °C");
    assert.equal(
      controls.entityDisplayValue({ ...states["sensor.demo_temperature"], stale: true }),
      "19.7 °C · stale",
    );
  });
});
