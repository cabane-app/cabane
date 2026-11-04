import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";
import { connectedManifestFixture } from "./fixtures/home-assistant.mjs";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { applyDemoServiceToStates } = await load(
    "/packages/engine/src/onboarding/demo/demo-device-state.ts",
  );
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { applyDemoServiceCall, deriveDemoSessionDefinition } = await load(
    "/packages/engine/src/DemoHomeAssistantSession.tsx",
  );

  const { homeManifest } = await load("/tests/fixtures/bundled-home.ts");
  const { collectBindingSlots } = await load("/packages/engine/src/binding-slot-descriptors.ts");
  const { demoLightVisualManifest } = await load(
    "/packages/engine/src/onboarding/demo/demo-light-visuals.ts",
  );
  const { sceneLightState } = await load("/packages/engine/src/scene-light-state.ts");
  const { deviceVisualStateForSnapshot } = await load("/packages/engine/src/devices.ts");
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");

  const { demoHomeProject, homeExtensions } = await load("/home/src/index.ts");
  const { composeHomeManifest, validateHomeProject } = await load("/packages/engine/src/index.ts");
  const { stableFurnishingRegistry } = await load("/packages/catalog/src/furnishing/index.ts");
  const { validateRuntimeBindingProfile } = await load(
    "/packages/engine/src/runtime-binding-profile.ts",
  );
  const { resolveHomeAssistantBindings } = await load(
    "/packages/engine/src/home-assistant-resolver.ts",
  );
  const { resolveOpeningPositions } = await load("/packages/engine/src/opening-pose.ts");
  const { createDemoDeviceState } = await load(
    "/packages/engine/src/onboarding/demo/demo-device-state.ts",
  );
  const controls = await load("/packages/engine/src/home-assistant-controls.ts");

  test("bundled fan and sprinkler animate from demo state and stop through normal controls", async () => {
    const definition = deriveDemoSessionDefinition(homeManifest);
    for (const [modelId, domain, stop, start, rotorName, axis] of [
      ["ceiling-fan", "fan", "turn_off", "turn_on", "fan-rotor", "z"],
      ["rotating-sprinkler", "valve", "close_valve", "open_valve", "sprinkler-rotor", "y"],
    ]) {
      const item = homeManifest.sceneItems.find((item) => item.modelId === modelId);
      assert.ok(item, `${modelId} belongs to the bundled home`);
      const entityId = definition.profile.entityIdsBySlotId[item.entitySlots[0].id];
      assert.ok(entityId.startsWith(`${domain}.`));
      let state = definition.runtime.entityStates[entityId];
      const props = () => ({
        state,
        visualState: deviceVisualStateForSnapshot(state),
        reducedMotion: false,
      });
      const component = stableDeviceRegistry[modelId].component;
      const renderer = await create(createElement(component, props()));
      try {
        const rotor = renderer.scene.findByProps({ name: rotorName }).instance;
        const original = rotor.rotation[axis];
        await renderer.advanceFrames(2, 0.02);
        assert.notEqual(rotor.rotation[axis], original);
        if (domain === "valve")
          assert.equal(renderer.scene.findAllByProps({ name: "sprinkler-water" }).length, 1);
        state = applyDemoServiceCall(state, {
          domain,
          service: stop,
          target: { entity_id: entityId },
        });
        await renderer.update(createElement(component, props()));
        const stopped = rotor.rotation[axis];
        await renderer.advanceFrames(2, 0.02);
        assert.equal(rotor.rotation[axis], stopped);
        if (domain === "valve")
          assert.equal(renderer.scene.findAllByProps({ name: "sprinkler-water" }).length, 0);
        state = applyDemoServiceCall(state, {
          domain,
          service: start,
          target: { entity_id: entityId },
        });
        await renderer.update(createElement(component, props()));
        await renderer.advanceFrames(2, 0.02);
        assert.notEqual(rotor.rotation[axis], stopped);
        await renderer.update(createElement(component, { ...props(), reducedMotion: true }));
        const reduced = rotor.rotation[axis];
        await renderer.advanceFrames(2, 0.02);
        assert.equal(rotor.rotation[axis], reduced);
      } finally {
        await renderer.unmount();
      }
    }
  });

  test("demo fan speed and valve position follow their normal controls", () => {
    const definition = deriveDemoSessionDefinition(homeManifest);
    for (const [domain, attribute, service] of [
      ["fan", "percentage", "set_percentage"],
      ["valve", "current_position", "set_valve_position"],
    ]) {
      const initial = Object.values(definition.runtime.entityStates).find((state) =>
        state.entityId.startsWith(`${domain}.`),
      );
      const call = (value) => ({
        domain,
        service,
        target: { entity_id: initial.entityId },
        data: { [domain === "fan" ? "percentage" : "position"]: value },
      });
      assert.equal(applyDemoServiceCall(initial, call(25)).attributes[attribute], 25);
      const stopped = applyDemoServiceCall(initial, call(0));
      assert.equal(stopped.state, domain === "fan" ? "off" : "closed");
      const resumed = applyDemoServiceCall(stopped, {
        domain,
        service: domain === "fan" ? "turn_on" : "open_valve",
        target: { entity_id: initial.entityId },
      });
      assert.ok(resumed.attributes[attribute] > 0);
      assert.throws(() => applyDemoServiceCall(initial, call(NaN)), /demo/i);
      assert.equal(initial.attributes[attribute], domain === "fan" ? 50 : 100);
    }
  });
  test("demo lights start on at night and remain individually controllable", () => {
    const night = deriveDemoSessionDefinition(homeManifest, true);
    const day = deriveDemoSessionDefinition(homeManifest, false);
    const lights = Object.keys(night.runtime.entityStates).filter((id) => id.startsWith("light."));
    assert.ok(lights.length > 0);
    for (const id of lights) {
      assert.equal(night.runtime.entityStates[id].state, "on");
      assert.equal(day.runtime.entityStates[id].state, "off");
      const switchedOff = applyDemoServiceCall(night.runtime.entityStates[id], {
        domain: "light",
        service: "turn_off",
        target: { entity_id: id },
      });
      assert.equal(switchedOff.state, "off");
    }
  });
  test("demo light controls determine fixture visuals even for night-only home lights", () => {
    const definition = deriveDemoSessionDefinition(homeManifest);
    const fixture = homeManifest.sceneItems.find(
      (item) => item.kind === "device" && item.lightState === "night-only",
    );
    assert.ok(fixture);
    const entityId =
      definition.profile.entityIdsBySlotId[
        fixture.entitySlots.find((slot) => slot.deviceRole === "primary").id
      ];
    const demoFixture = demoLightVisualManifest(homeManifest).sceneItems.find(
      (item) => item.id === fixture.id,
    );
    assert.equal(fixture.lightState, "night-only");
    assert.equal(demoFixture.lightState, "connected");
    const off = definition.runtime.entityStates[entityId];
    const on = applyDemoServiceCall(off, {
      domain: "light",
      service: "turn_on",
      target: { entity_id: entityId },
    });
    assert.equal(sceneLightState(demoFixture.lightState, off, true).state, "off");
    assert.equal(sceneLightState(demoFixture.lightState, on, false).state, "on");
  });
  test("bundled demo supplies available device/window states and leaves doors available for walking", () => {
    const definition = deriveDemoSessionDefinition(homeManifest);
    const doorIds = new Set(
      homeManifest.floors
        .flatMap((floor) => floor.openings)
        .filter((opening) => opening.kind === "door")
        .map((opening) => opening.id),
    );
    for (const slot of collectBindingSlots(homeManifest)) {
      if (slot.spec.compatibleDomains.includes("camera")) continue;
      const entityId = definition.profile.entityIdsBySlotId[slot.slotId];
      if (slot.kind === "opening-contact" && doorIds.has(slot.openingId)) {
        assert.equal(entityId, undefined, `${slot.slotId} must not override proximity opening`);
        continue;
      }
      assert.ok(definition.runtime.entityStates[entityId]?.available, slot.spec.presentation.label);
      assert.notEqual(definition.runtime.entityStates[entityId].state, "unknown");
    }
  });

  test("Solstice demo maps every device, keeps all rooms interactive and controls its garage", async () => {
    const manifest = composeHomeManifest(demoHomeProject, homeExtensions);
    assert.equal(demoHomeProject.floors.length, 3);
    assert.deepEqual(
      validateHomeProject(demoHomeProject, {
        furnishingModels: stableFurnishingRegistry,
        deviceModels: stableDeviceRegistry,
      }).issues,
      [],
    );
    const definition = deriveDemoSessionDefinition(manifest);
    assert.equal(
      validateRuntimeBindingProfile(definition.profile, manifest, definition.runtime).valid,
      true,
    );
    const slots = collectBindingSlots(manifest);
    const states = definition.runtime.entityStates;
    for (const slot of slots) {
      if (
        slot.kind === "opening-contact" &&
        manifest.floors.some((f) =>
          f.openings.some((o) => o.id === slot.openingId && o.kind === "door"),
        )
      )
        continue;
      const state = states[definition.profile.entityIdsBySlotId[slot.slotId]];
      assert.ok(state?.available, slot.spec.presentation.label);
      assert.notEqual(state.state, "unknown");
    }
    for (const room of manifest.floors.flatMap((f) => f.rooms)) {
      assert.ok(
        slots.some(
          (s) =>
            s.roomIds.includes(room.id) &&
            /^(light|switch|fan|climate|media_player|vacuum)\./.test(
              definition.profile.entityIdsBySlotId[s.slotId] ?? "",
            ),
        ),
        room.name,
      );
    }
    const garage = manifest.floors
      .flatMap((f) => f.openings)
      .find((o) => o.operation === "roll-up");
    const entityId = definition.profile.entityIdsBySlotId[garage.coverSlot.id];
    assert.ok(entityId.startsWith("cover."));
    const closed = applyDemoServiceToStates(states, {
      domain: "cover",
      service: "close_cover",
      target: { entity_id: entityId },
    });
    const bindings = resolveHomeAssistantBindings(manifest, definition.profile, {
      ...definition.runtime,
      entityStates: closed,
    });
    assert.equal(resolveOpeningPositions(new Set(), bindings.openings, new Map())[garage.id], 0);
    const opened = applyDemoServiceToStates(closed, {
      domain: "cover",
      service: "open_cover",
      target: { entity_id: entityId },
    });
    const openBindings = resolveHomeAssistantBindings(manifest, definition.profile, {
      ...definition.runtime,
      entityStates: opened,
    });
    assert.equal(
      resolveOpeningPositions(new Set(), openBindings.openings, new Map())[garage.id],
      1,
    );
  });

  test("new demo controls accept normal HA calls, validate values and keep batch updates atomic", async () => {
    const spec = { presentation: { label: "Demo device" } };
    const make = (domain) => createDemoDeviceState(`${domain}.test`, domain, spec);
    let humidifier = make("humidifier"),
      heater = make("water_heater"),
      button = make("button");
    const humidity = controls.humidifierHumidityCall(humidifier, 55);
    humidifier = applyDemoServiceCall(humidifier, humidity);
    assert.equal(humidifier.attributes.humidity, 55);
    assert.equal(humidifier.attributes.current_humidity, 42);
    humidifier = applyDemoServiceCall(humidifier, controls.humidifierModeCall(humidifier, "sleep"));
    assert.equal(humidifier.attributes.mode, "sleep");
    humidifier = applyDemoServiceCall(humidifier, controls.humidifierPowerCall(humidifier, false));
    assert.equal(humidifier.state, "off");
    assert.equal(
      applyDemoServiceCall(humidifier, controls.humidifierPowerCall(humidifier, true)).state,
      "on",
    );
    heater = applyDemoServiceCall(heater, controls.waterHeaterTemperatureCall(heater, 60));
    assert.equal(heater.attributes.temperature, 60);
    heater = applyDemoServiceCall(
      heater,
      controls.waterHeaterOperationModeCall(heater, "electric"),
    );
    assert.equal(heater.state, "electric");
    assert.equal(heater.attributes.operation_mode, "electric");
    heater = applyDemoServiceCall(heater, controls.waterHeaterAwayModeCall(heater, true));
    assert.equal(heater.attributes.away_mode, "on");
    heater = applyDemoServiceCall(heater, controls.waterHeaterPowerCall(heater, false));
    assert.equal(heater.state, "off");
    assert.equal(
      applyDemoServiceCall(heater, controls.waterHeaterPowerCall(heater, true)).state,
      "eco",
    );
    const pressed = applyDemoServiceCall(button, controls.buttonPressCall(button));
    const pressedAgain = applyDemoServiceCall(pressed, controls.buttonPressCall(pressed));
    assert.ok(Date.parse(pressedAgain.state) > Date.parse(pressed.state));
    for (const [state, domain, service, data] of [
      [humidifier, "humidifier", "set_mode", { mode: "invalid" }],
      [humidifier, "humidifier", "set_humidity", { humidity: NaN }],
      [heater, "water_heater", "set_operation_mode", { operation_mode: "invalid" }],
      [heater, "water_heater", "set_away_mode", { away_mode: "on" }],
      [button, "button", "press", { extra: true }],
    ])
      assert.throws(
        () =>
          applyDemoServiceCall(state, {
            domain,
            service,
            data,
            target: { entity_id: state.entityId },
          }),
        /demo/i,
      );
    const before = { [humidifier.entityId]: humidifier };
    assert.throws(
      () =>
        applyDemoServiceToStates(before, {
          ...humidity,
          target: { entity_id: [humidifier.entityId, "humidifier.missing"] },
        }),
      /demo/i,
    );
    assert.equal(before[humidifier.entityId], humidifier);
  });

  test("demo security controls update in memory and reject unsupported actions", () => {
    const definition = deriveDemoSessionDefinition(homeManifest);
    for (const [slot, domain, actions] of [
      [
        "foyer-smart-lock-entity",
        "lock",
        [
          ["unlock", "unlocked"],
          ["lock", "locked"],
        ],
      ],
      [
        "foyer-alarm-keypad-entity",
        "alarm_control_panel",
        [
          ["alarm_arm_home", "armed_home"],
          ["alarm_arm_away", "armed_away"],
          ["alarm_disarm", "disarmed"],
        ],
      ],
    ]) {
      const entityId = definition.profile.entityIdsBySlotId[slot];
      let state = definition.runtime.entityStates[entityId];
      for (const [service, expected] of actions) {
        state = applyDemoServiceCall(state, { domain, service, target: { entity_id: entityId } });
        assert.equal(state.state, expected);
      }
      assert.throws(
        () =>
          applyDemoServiceCall(state, {
            domain,
            service: "unsupported",
            target: { entity_id: entityId },
          }),
        /demo/i,
      );
    }
  });

  test("prefers a light for the suggestion and maps every supported slot in memory", () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const definition = deriveDemoSessionDefinition(manifest);
    assert.equal(definition.sampleSlotId, "demo-main-light-slot");
    assert.match(definition.sampleEntityId, /^light\.cabane_demo_/);
    assert.deepEqual(Object.keys(definition.profile.roomAreaIds), ["demo-room"]);
    assert.ok(definition.profile.entityIdsBySlotId["demo-climate-slot"]);
    assert.ok(definition.profile.entityIdsBySlotId["demo-cover-slot"]);
    assert.ok(definition.profile.entityIdsBySlotId["demo-temperature-slot"]);
    assert.ok(definition.profile.entityIdsBySlotId["demo-window-contact-slot"]);
    assert.match(
      definition.profile.entityIdsBySlotId["demo-speaker-slot"],
      /^media_player\.cabane_demo_/,
    );
    assert.equal(definition.runtime.origin, null);
    assert.ok(definition.runtime.entityRegistry.length > 5);
    assert.equal(
      Object.keys(definition.runtime.entityStates).length,
      definition.runtime.entityRegistry.length,
    );
  });

  test("falls back to one switch and renders safely without a compatible slot", () => {
    const switchManifest = connectedManifestFixture(neutralDemoManifest);
    switchManifest.floors[0].rooms[0].devices = [];
    const switchDefinition = deriveDemoSessionDefinition(switchManifest);
    assert.equal(switchDefinition.sampleSlotId, "demo-coffee-slot");
    assert.match(switchDefinition.sampleEntityId, /^switch\.cabane_demo_/);

    const emptyManifest = structuredClone(neutralDemoManifest);
    emptyManifest.floors[0].rooms[0].dashboardSlots = [];
    emptyManifest.floors[0].rooms[0].devices = [];
    const emptyDefinition = deriveDemoSessionDefinition(emptyManifest);
    assert.equal(emptyDefinition.sampleEntityId, null);
    assert.equal(emptyDefinition.runtime.canMutate, false);
    assert.deepEqual(emptyDefinition.profile.entityIdsBySlotId, {});
  });

  test("applies only direct in-memory on/off calls for the sample entity", () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const definition = deriveDemoSessionDefinition(manifest);
    const entityId = definition.sampleEntityId;
    const initial = definition.runtime.entityStates[entityId];
    const on = applyDemoServiceCall(initial, {
      domain: "light",
      service: "turn_on",
      target: { entity_id: entityId },
    });
    assert.equal(initial.state, "off");
    assert.equal(on.state, "on");
    assert.throws(
      () =>
        applyDemoServiceCall(on, {
          domain: "light",
          service: "toggle",
          target: { entity_id: entityId },
        }),
      /demo/i,
    );
    assert.throws(
      () =>
        applyDemoServiceCall(on, {
          domain: "light",
          service: "turn_off",
          target: { entity_id: "light.somewhere_else" },
        }),
      /demo/i,
    );
    assert.throws(
      () =>
        applyDemoServiceCall(on, {
          domain: "switch",
          service: "turn_off",
          target: { entity_id: entityId },
        }),
      /demo/i,
    );
  });

  test("simulated media player starts playing and accepts playback and volume controls", () => {
    const definition = deriveDemoSessionDefinition(connectedManifestFixture(neutralDemoManifest));
    const entityId = definition.profile.entityIdsBySlotId["demo-speaker-slot"];
    const playing = definition.runtime.entityStates[entityId];
    assert.equal(playing.state, "playing");
    assert.equal(playing.attributes.volume_level, 0.45);
    const paused = applyDemoServiceCall(playing, {
      domain: "media_player",
      service: "media_pause",
      target: { entity_id: entityId },
    });
    assert.equal(paused.state, "paused");
    const quieter = applyDemoServiceCall(paused, {
      domain: "media_player",
      service: "volume_set",
      data: { volume_level: 0.2 },
      target: { entity_id: entityId },
    });
    assert.equal(quieter.attributes.volume_level, 0.2);
    assert.equal(quieter.state, "paused");
    assert.equal(
      applyDemoServiceCall(quieter, {
        domain: "media_player",
        service: "media_play",
        target: { entity_id: entityId },
      }).state,
      "playing",
    );
    assert.equal(
      applyDemoServiceCall(playing, {
        domain: "media_player",
        service: "volume_set",
        data: { volume_level: 2 },
        target: { entity_id: entityId },
      }).attributes.volume_level,
      1,
    );
  });

  test("stable unique IDs survive reordered rooms and punctuation in slot IDs", () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const room = manifest.floors[0].rooms[0];
    const second = structuredClone(room);
    second.id = "second-room";
    second.dashboardSlots = [];
    second.devices = [structuredClone(room.devices[0])];
    second.devices[0].id = "second-light";
    second.devices[0].entitySlots[0].id = "a.b";
    room.devices[0].entitySlots[0].id = "a-b";
    manifest.floors[0].rooms.push(second);
    const first = deriveDemoSessionDefinition(manifest);
    manifest.floors[0].rooms.reverse();
    const reordered = deriveDemoSessionDefinition(manifest);
    assert.deepEqual(first.profile.entityIdsBySlotId, reordered.profile.entityIdsBySlotId);
    assert.notEqual(first.profile.entityIdsBySlotId["a.b"], first.profile.entityIdsBySlotId["a-b"]);
    assert.equal(Object.keys(first.profile.roomAreaIds).length, 2);
  });

  test("normal HA controls change brightness, covers, and climate without mutating the input", () => {
    const definition = deriveDemoSessionDefinition(connectedManifestFixture(neutralDemoManifest));
    const bindings = definition.profile.entityIdsBySlotId;
    const initial = definition.runtime.entityStates;
    const apply = (states, slot, domain, service, data) =>
      applyDemoServiceToStates(states, {
        domain,
        service,
        data,
        target: { entity_id: bindings[slot] },
      });
    const light = apply(initial, "demo-main-light-slot", "light", "turn_on", {
      brightness_pct: 50,
    });
    assert.equal(light[bindings["demo-main-light-slot"]].attributes.brightness, 128);
    assert.equal(initial[bindings["demo-main-light-slot"]].state, "off");
    const dark = apply(light, "demo-main-light-slot", "light", "turn_on", { brightness_pct: 0 });
    assert.equal(dark[bindings["demo-main-light-slot"]].state, "off");
    const restored = apply(dark, "demo-main-light-slot", "light", "turn_on");
    assert.equal(restored[bindings["demo-main-light-slot"]].state, "on");
    const cover = apply(light, "demo-cover-slot", "cover", "set_cover_position", { position: 35 });
    assert.equal(cover[bindings["demo-cover-slot"]].attributes.current_position, 35);
    const closed = apply(cover, "demo-cover-slot", "cover", "close_cover");
    assert.equal(closed[bindings["demo-cover-slot"]].state, "closed");
    const climate = apply(closed, "demo-climate-slot", "climate", "set_temperature", {
      temperature: 23.5,
    });
    assert.equal(climate[bindings["demo-climate-slot"]].attributes.temperature, 23.5);
    const cool = apply(climate, "demo-climate-slot", "climate", "set_hvac_mode", {
      hvac_mode: "cool",
    });
    assert.equal(cool[bindings["demo-climate-slot"]].state, "cool");
    assert.equal(
      cool[bindings["demo-temperature-slot"]],
      initial[bindings["demo-temperature-slot"]],
    );
  });

  test("rejects invalid calls atomically and never guesses unsupported values", () => {
    const definition = deriveDemoSessionDefinition(connectedManifestFixture(neutralDemoManifest));
    const initial = definition.runtime.entityStates;
    const id = definition.sampleEntityId;
    const before = JSON.stringify(initial);
    for (const call of [
      { domain: "light", service: "turn_on", target: { entity_id: [id, "light.unknown"] } },
      {
        domain: "light",
        service: "turn_on",
        data: { brightness_pct: NaN },
        target: { entity_id: id },
      },
      {
        domain: "light",
        service: "turn_on",
        data: { effect: "unsupported" },
        target: { entity_id: id },
      },
      { domain: "light", service: "turn_on", target: { entity_id: [] } },
      {
        domain: "sensor",
        service: "turn_on",
        target: { entity_id: definition.profile.entityIdsBySlotId["demo-temperature-slot"] },
      },
      {
        domain: "climate",
        service: "set_hvac_mode",
        data: { hvac_mode: "invalid" },
        target: { entity_id: definition.profile.entityIdsBySlotId["demo-climate-slot"] },
      },
    ])
      assert.throws(() => applyDemoServiceToStates(initial, call), /demo/i);
    assert.equal(JSON.stringify(initial), before);
  });
});
