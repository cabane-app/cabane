import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { withModules } from "./test-server.mjs";
import {
  connectedManifestFixture,
  connectedProfileFixture,
  connectedRuntimeFixture,
} from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const profileModule = await load("/packages/engine/src/runtime-binding-profile.ts");
  const setupModule = await load("/packages/engine/src/RuntimeBindingSetup.tsx");

  const manifestFixture = () => connectedManifestFixture(neutralDemoManifest);

  test("explicitly shares a light across modeled devices while automatic mapping stays conservative", async () => {
    const manifest = manifestFixture();
    const room = manifest.floors[0].rooms[0];
    const second = structuredClone(
      room.devices.find((device) => device.id === "fixture-light-device"),
    );
    second.id = "second-light-device";
    second.entitySlots[0].id = "second-light-slot";
    room.devices.push(second);
    const runtime = connectedRuntimeFixture();
    const profile = connectedProfileFixture();
    const descriptor = profileModule
      .collectBindingSlots(manifest)
      .find((slot) => slot.slotId === "second-light-slot");
    const candidate = profileModule
      .bindingEntityCandidates({ descriptor, roomId: room.id, profile, runtime })
      .find((entry) => entry.entityId === "light.demo_ceiling");
    assert.equal(candidate.selectable, true);
    const automatic = profileModule.automaticallyMapRuntimeBindings(manifest, profile, runtime);
    assert.equal(automatic.profile.entityIdsBySlotId["second-light-slot"], undefined);
    const shared = profileModule.replaceEntitySlotMapping(
      profile,
      "second-light-slot",
      "light.demo_ceiling",
    );
    assert.equal(
      profileModule.validateRuntimeBindingProfile(shared, manifest, runtime).valid,
      true,
    );
    assert.equal(
      profileModule.importRuntimeBindingProfile(JSON.stringify(shared), manifest, runtime).valid,
      true,
    );
    const resolver = await load("/packages/engine/src/home-assistant-resolver.ts");
    const resolved = resolver.resolveHomeAssistantBindings(manifest, shared, runtime);
    const lights = resolved.rooms[room.id].devices.filter((device) =>
      ["fixture-light-device", "second-light-device"].includes(device.slot.id),
    );
    assert.equal(lights.length, 2);
    for (const light of lights) {
      assert.equal(light.entities[0].entityId, "light.demo_ceiling");
      assert.deepEqual(light.entities[0].issues, []);
      assert.equal(light.entities[0].state, runtime.entityStates["light.demo_ceiling"]);
    }
    const unbound = profileModule.replaceEntitySlotMapping(shared, "second-light-slot", null);
    assert.equal(unbound.entityIdsBySlotId["demo-main-light-slot"], "light.demo_ceiling");
  });

  test("outside-room devices map across HA areas without a room mapping and resolve live state", async () => {
    const manifest = manifestFixture();
    const device = manifest.floors[0].rooms[0].devices.find(
      (item) => item.id === "fixture-light-device",
    );
    manifest.sceneItems = [
      {
        id: "garden-light",
        kind: "device",
        floorId: manifest.floors[0].id,
        modelId: device.model,
        placement: { kind: "absolute", at: [100, 100], elevationMeters: 0, rotationYRadians: 0 },
        entitySlots: [{ ...device.entitySlots[0], id: "garden-light-slot" }],
      },
    ];
    const profile = profileModule.createEmptyRuntimeBindingProfile(manifest.home.id);
    const runtime = connectedRuntimeFixture();
    const descriptor = profileModule
      .collectBindingSlots(manifest)
      .find((slot) => slot.slotId === "garden-light-slot");
    assert.deepEqual(descriptor.roomIds, []);
    const outsideId = `outside-rooms:${manifest.floors[0].id}`;
    const groups = await load(
      "/packages/engine/src/home-assistant-mapping/device-mapping-groups.ts",
    );
    assert.equal(
      groups.groupRoomMappingRelationships(manifest, outsideId)[0].relationships[0].id,
      "garden-light",
    );
    for (const withArea of [true, false]) {
      if (!withArea) {
        runtime.entityRegistry.forEach((entry) => {
          entry.area_id = null;
        });
        runtime.devices.forEach((entry) => {
          entry.area_id = null;
        });
      }
      const candidates = profileModule.bindingEntityCandidates({
        descriptor,
        roomId: outsideId,
        profile,
        runtime,
      });
      assert.ok(candidates.some((candidate) => candidate.entityId === "light.demo_ceiling"));
      const mapped = profileModule.replaceEntitySlotMapping(
        profile,
        descriptor.slotId,
        "light.demo_ceiling",
      );
      assert.equal(
        profileModule.validateRuntimeBindingProfile(mapped, manifest, runtime).valid,
        true,
      );
      assert.equal(
        profileModule.importRuntimeBindingProfile(JSON.stringify(mapped), manifest, runtime).valid,
        true,
      );
      const resolver = await load("/packages/engine/src/home-assistant-resolver.ts");
      const resolved = resolver.resolveHomeAssistantBindings(manifest, mapped, runtime);
      assert.equal(
        resolved.rooms[outsideId].devices[0].entities[0].state,
        runtime.entityStates["light.demo_ceiling"],
      );
      assert.deepEqual(resolved.rooms[outsideId].issues, []);
    }
  });

  test("light slots offer switches last for manual binding, persist and call the switch domain", async () => {
    const manifest = manifestFixture();
    const runtime = connectedRuntimeFixture();
    const profile = connectedProfileFixture();
    const descriptor = profileModule
      .collectBindingSlots(manifest)
      .find((slot) => slot.slotId === "demo-main-light-slot");
    const candidates = profileModule.bindingEntityCandidates({
      descriptor,
      roomId: "demo-room",
      profile,
      runtime,
      scope: "all-areas",
    });
    const plug = candidates.find((candidate) => candidate.entityId === "switch.demo_coffee");
    assert.equal(plug.matchRank, 1);
    assert.ok(
      candidates.indexOf(plug) >
        candidates.findIndex((candidate) => candidate.entityId === "light.demo_ceiling"),
    );
    const { DeviceMappingInspector } = await load(
      "/packages/engine/src/home-assistant-mapping/DeviceMappingInspector.tsx",
    );
    const { groupRoomMappingRelationships } = await load(
      "/packages/engine/src/home-assistant-mapping/device-mapping-groups.ts",
    );
    const relationship = groupRoomMappingRelationships(manifest, "demo-room")
      .flatMap((group) => group.relationships)
      .find((entry) => entry.id === "fixture-light-device");
    const markup = renderToStaticMarkup(
      React.createElement(DeviceMappingInspector, {
        manifest,
        room: manifest.floors[0].rooms[0],
        relationship,
        profile,
        runtime,
        disabled: false,
        state: "open",
        onEntityIdsBySlotIdChange() {},
        onSelectionMade() {},
        onCollapse() {},
        onReopen() {},
      }),
    );
    assert.match(markup, /Other switches · on\/off only/);
    const picker = new JSDOM(markup);
    const switchGroup = [...picker.window.document.querySelectorAll("details")].find((element) =>
      element.querySelector(":scope > summary")?.textContent.includes("Other switches"),
    );
    assert.equal(switchGroup.open, false);
    assert.ok(switchGroup.querySelector("details > summary"));
    assert.ok([...switchGroup.querySelectorAll("details")].every((element) => !element.open));
    picker.window.close();
    assert.ok(
      markup.indexOf('value="light.demo_ceiling"') < markup.indexOf('value="switch.demo_coffee"'),
    );
    const mapped = profileModule.replaceEntitySlotMapping(
      profile,
      descriptor.slotId,
      plug.entityId,
    );
    assert.equal(
      profileModule.validateRuntimeBindingProfile(mapped, manifest, runtime).valid,
      true,
    );
    assert.equal(
      profileModule.importRuntimeBindingProfile(JSON.stringify(mapped), manifest, runtime).valid,
      true,
    );
    const resolver = await load("/packages/engine/src/home-assistant-resolver.ts");
    const resolved = resolver.resolveHomeAssistantBindings(manifest, mapped, runtime);
    const light = resolved.rooms["demo-room"].devices.find(
      (device) => device.slot.id === "fixture-light-device",
    ).entities[0];
    assert.equal(light.domain, "switch");
    assert.deepEqual(light.issues, []);
    const controls = await load("/packages/engine/src/home-assistant-controls.ts");
    assert.equal(controls.toggleEntityCall(light.state).domain, "switch");
    assert.equal(controls.supportsLightBrightness(light.state), false);
    runtime.entityRegistry = runtime.entityRegistry.filter(
      (entry) => !entry.entity_id.startsWith("light."),
    );
    const automatic = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      runtime,
    );
    assert.equal(automatic.profile.entityIdsBySlotId[descriptor.slotId], undefined);
  });

  test("automatically maps exact canonical room names and one-to-one compatible slots", () => {
    const manifest = manifestFixture();
    const runtime = connectedRuntimeFixture();
    const result = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      runtime,
    );
    assert.equal(result.profile.roomAreaIds["demo-room"], "demo_room");
    assert.equal(result.profile.entityIdsBySlotId["demo-main-light-slot"], "light.demo_ceiling");
    assert.equal(
      result.profile.entityIdsBySlotId["demo-speaker-slot"],
      "media_player.demo_speaker",
    );
    assert.equal(
      result.profile.entityIdsBySlotId["demo-window-contact-slot"],
      "binary_sensor.demo_window",
    );
    for (const [slotId, entityId] of [
      ["demo-humidifier-slot", "humidifier.demo"],
      ["demo-water-heater-slot", "water_heater.demo"],
      ["demo-vacuum-slot", "vacuum.demo"],
      ["demo-lock-slot", "lock.demo_front_door"],
      ["demo-alarm-slot", "alarm_control_panel.demo"],
      ["demo-valve-slot", "valve.demo_water"],
      ["demo-siren-slot", "siren.demo"],
      ["demo-select-slot", "select.demo_cycle"],
      ["demo-number-slot", "number.demo_level"],
      ["demo-button-slot", "button.demo_start"],
    ])
      assert.equal(result.profile.entityIdsBySlotId[slotId], entityId);
    assert.equal(
      new Set(Object.values(result.profile.entityIdsBySlotId)).size,
      Object.keys(result.profile.entityIdsBySlotId).length,
    );
    assert.equal(result.ambiguous.length, 0);
  });

  test("leaves every new controllable domain manual when compatible entities are ambiguous", () => {
    const cases = [
      ["demo-humidifier-slot", "humidifier.demo"],
      ["demo-water-heater-slot", "water_heater.demo"],
      ["demo-vacuum-slot", "vacuum.demo"],
      ["demo-lock-slot", "lock.demo_front_door"],
      ["demo-alarm-slot", "alarm_control_panel.demo"],
      ["demo-valve-slot", "valve.demo_water"],
      ["demo-siren-slot", "siren.demo"],
      ["demo-select-slot", "select.demo_cycle"],
      ["demo-number-slot", "number.demo_level"],
      ["demo-button-slot", "button.demo_start"],
    ];
    for (const [slotId, entityId] of cases) {
      const manifest = manifestFixture();
      const runtime = connectedRuntimeFixture();
      const duplicateId = `${entityId}_duplicate`;
      const sourceRegistry = runtime.entityRegistry.find((entry) => entry.entity_id === entityId);
      runtime.entityRegistry.push({
        ...sourceRegistry,
        entity_id: duplicateId,
        device_id: null,
        area_id: "demo_room",
        original_name: `${sourceRegistry.original_name} duplicate`,
      });
      runtime.entityStates[duplicateId] = {
        ...runtime.entityStates[entityId],
        entityId: duplicateId,
      };
      const result = profileModule.automaticallyMapRuntimeBindings(
        manifest,
        profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
        runtime,
      );
      assert.equal(result.profile.entityIdsBySlotId[slotId], undefined);
      assert.deepEqual(
        result.ambiguous.find((entry) => entry.destinationId === slotId)?.candidateIds,
        [entityId, duplicateId].sort(),
      );
    }
  });

  test("does not use aliases or fuzzy room-name matching", () => {
    const manifest = manifestFixture();
    const runtime = connectedRuntimeFixture();
    runtime.areas.find((area) => area.area_id === "demo_room").name = "Demo-room";
    runtime.areas.push({ area_id: "spare_room", name: "Spare room" });
    const result = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      runtime,
    );
    assert.equal(result.profile.roomAreaIds["demo-room"], undefined);
    assert.equal(Object.keys(result.profile.entityIdsBySlotId).length, 0);
  });

  test("uses entity-area precedence over device area and excludes an explicit wrong entity area", () => {
    const manifest = manifestFixture();
    const runtime = connectedRuntimeFixture();
    const lightDevice = runtime.devices.find((device) => device.id === "device-light");
    assert.equal(lightDevice.area_id, "outside");
    const mapped = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      runtime,
    );
    assert.equal(mapped.profile.entityIdsBySlotId["demo-main-light-slot"], "light.demo_ceiling");

    const wrongArea = connectedRuntimeFixture();
    wrongArea.entityRegistry.find((entry) => entry.entity_id === "light.demo_ceiling").area_id =
      "outside";
    const excluded = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      wrongArea,
    );
    assert.equal(excluded.profile.entityIdsBySlotId["demo-main-light-slot"], undefined);
  });

  test("maps one modeled AC to one climate entity", () => {
    const manifest = manifestFixture();
    const room = manifest.floors[0].rooms[0];
    const climateSlot = room.dashboardSlots.find((slot) => slot.id === "demo-climate-slot");
    room.dashboardSlots = room.dashboardSlots.filter((slot) => slot.id !== climateSlot.id);
    room.devices.push({
      id: "demo-ac-device",
      model: "indoor-ac",
      entitySlots: [
        { ...climateSlot, id: "demo-ac-climate-slot", required: true, deviceRole: "primary" },
      ],
      placement: {
        at: [1, 1],
        elevationMeters: 1.8,
        rotationYRadians: 0,
        support: { kind: "wall", wallId: "north-wall" },
      },
    });
    const result = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      connectedRuntimeFixture(),
    );
    assert.equal(result.profile.entityIdsBySlotId["demo-ac-climate-slot"], "climate.demo");
  });

  test("scopes automatic candidates to the room while allowing every compatible manual function across areas", () => {
    const manifest = manifestFixture();
    const room = manifest.floors[0].rooms[0];
    const climateSlot = room.dashboardSlots.find((slot) => slot.id === "demo-climate-slot");
    room.dashboardSlots = room.dashboardSlots.filter((slot) => slot.id !== climateSlot.id);
    const ac = {
      id: "demo-standalone-ac",
      model: "indoor-ac",
      entitySlots: [
        { ...climateSlot, id: "demo-standalone-ac-slot", required: true, deviceRole: "primary" },
      ],
      placement: {
        at: [1, 1],
        elevationMeters: 1.8,
        rotationYRadians: 0,
        support: { kind: "wall", wallId: "north-wall" },
      },
    };
    room.devices.push(ac);
    const runtime = connectedRuntimeFixture();
    for (const [entityId, areaId, name] of [
      ["climate.outside", "outside", "Outside climate"],
      ["climate.unassigned", null, "Unassigned climate"],
    ]) {
      runtime.entityRegistry.push({
        entity_id: entityId,
        area_id: areaId,
        device_id: null,
        platform: "generic_thermostat",
        disabled_by: null,
        hidden_by: null,
        name,
        original_name: name,
      });
      runtime.entityStates[entityId] = {
        entityId,
        state: "cool",
        attributes: { friendly_name: name },
        available: true,
        stale: false,
        lastUpdated: 1,
      };
    }
    const profile = profileModule.createEmptyRuntimeBindingProfile(manifest.home.id);
    profile.roomAreaIds[room.id] = "demo_room";
    const descriptor = profileModule
      .collectBindingSlots(manifest)
      .find((candidate) => candidate.slotId === "demo-standalone-ac-slot");

    assert.deepEqual(
      profileModule
        .bindingEntityCandidates({
          descriptor,
          roomId: room.id,
          profile,
          runtime,
        })
        .map((candidate) => candidate.entityId),
      ["climate.demo"],
    );
    assert.deepEqual(
      profileModule
        .bindingEntityCandidates({
          descriptor,
          roomId: room.id,
          profile,
          runtime,
          scope: "all-areas",
        })
        .map((candidate) => candidate.entityId)
        .sort(),
      ["climate.demo", "climate.outside", "climate.unassigned"],
    );

    profile.entityIdsBySlotId[descriptor.slotId] = "climate.outside";
    assert.equal(
      profileModule.validateRuntimeBindingProfile(profile, manifest, runtime).valid,
      true,
    );
    assert.equal(
      profileModule.importRuntimeBindingProfile(
        profileModule.exportRuntimeBindingProfile(profile),
        manifest,
        runtime,
      ).valid,
      true,
    );
    profile.entityIdsBySlotId[descriptor.slotId] = "climate.unassigned";
    assert.equal(
      profileModule.validateRuntimeBindingProfile(profile, manifest, runtime).valid,
      true,
    );

    ac.entitySlots.push({
      id: "demo-standalone-ac-secondary",
      compatibleDomains: ["sensor"],
      required: false,
      autoMap: "manual",
      deviceRole: "diagnostic",
      presentation: { label: "AC diagnostic", dashboardRole: "diagnostic" },
    });
    assert.equal(
      profileModule.validateRuntimeBindingProfile(profile, manifest, runtime).valid,
      true,
    );
    const withoutArea = { ...profile, roomAreaIds: {} };
    assert.equal(
      profileModule.validateRuntimeBindingProfile(withoutArea, manifest, runtime).valid,
      true,
    );

    const strictManifest = manifestFixture();
    const strictRuntime = connectedRuntimeFixture();
    strictRuntime.entityRegistry.find((entry) => entry.entity_id === "climate.demo").area_id =
      "outside";
    strictRuntime.entityRegistry.find(
      (entry) => entry.entity_id === "binary_sensor.demo_window",
    ).area_id = "outside";
    const strictValidation = profileModule.validateRuntimeBindingProfile(
      connectedProfileFixture(),
      strictManifest,
      strictRuntime,
    );
    assert.equal(strictValidation.valid, true);
    assert.deepEqual(
      strictValidation.issues
        .filter((issue) => issue.code === "profile.area")
        .map((issue) => issue.path)
        .sort(),
      [],
    );

    const wrongAreaRuntime = connectedRuntimeFixture();
    wrongAreaRuntime.entityRegistry.find((entry) => entry.entity_id === "climate.demo").area_id =
      "outside";
    ac.entitySlots.pop();
    const automatic = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      wrongAreaRuntime,
    );
    assert.equal(automatic.profile.entityIdsBySlotId[descriptor.slotId], undefined);
  });

  test("leaves multiple generic opening sensors competing for door and window slots ambiguous", () => {
    const manifest = manifestFixture();
    manifest.floors[0].openings[0].contactSlot = {
      id: "demo-door-contact-slot",
      compatibleDeviceClasses: ["opening"],
      openState: "on",
      autoMap: "unique-compatible",
    };
    manifest.floors[0].openings[1].contactSlot.compatibleDeviceClasses = ["opening"];
    const runtime = connectedRuntimeFixture();
    runtime.entityStates["binary_sensor.demo_window"].attributes.device_class = "opening";
    runtime.entityRegistry.push({
      entity_id: "binary_sensor.demo_door",
      area_id: "demo_room",
      device_id: null,
      disabled_by: null,
      hidden_by: null,
      name: "Generic opening two",
      original_name: "Generic opening two",
    });
    runtime.entityStates["binary_sensor.demo_door"] = {
      ...runtime.entityStates["binary_sensor.demo_window"],
      entityId: "binary_sensor.demo_door",
      attributes: { friendly_name: "Generic opening two", device_class: "opening" },
    };
    const result = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      runtime,
    );
    assert.equal(result.profile.entityIdsBySlotId["demo-door-contact-slot"], undefined);
    assert.equal(result.profile.entityIdsBySlotId["demo-window-contact-slot"], undefined);
    assert.equal(
      result.ambiguous.filter(
        (entry) => entry.kind === "entity" && entry.destinationId.includes("contact-slot"),
      ).length,
      2,
    );
  });

  test("excludes disabled, hidden, and unavailable candidates from automatic mapping", () => {
    const manifest = manifestFixture();
    const runtime = connectedRuntimeFixture();
    runtime.entityRegistry.find((entry) => entry.entity_id === "climate.demo").disabled_by =
      "integration";
    runtime.entityRegistry.find(
      (entry) => entry.entity_id === "media_player.demo_speaker",
    ).hidden_by = "user";
    runtime.entityStates["binary_sensor.demo_window"] = {
      ...runtime.entityStates["binary_sensor.demo_window"],
      state: "unavailable",
      available: false,
    };
    const result = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      runtime,
    );
    assert.equal(result.profile.entityIdsBySlotId["demo-climate-slot"], undefined);
    assert.equal(result.profile.entityIdsBySlotId["demo-speaker-slot"], undefined);
    assert.equal(result.profile.entityIdsBySlotId["demo-window-contact-slot"], undefined);
  });

  test("never overwrites persisted mappings or silently remaps after registry updates", () => {
    const manifest = manifestFixture();
    const current = connectedProfileFixture();
    current.entityIdsBySlotId["demo-main-light-slot"] = "light.persisted_choice";
    const first = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      current,
      connectedRuntimeFixture(),
    );
    assert.equal(first.profile.entityIdsBySlotId["demo-main-light-slot"], "light.persisted_choice");
    const updatedRuntime = connectedRuntimeFixture();
    updatedRuntime.entityRegistry.find(
      (entry) => entry.entity_id === "light.demo_ceiling",
    ).entity_id = "light.registry_update";
    updatedRuntime.entityStates["light.registry_update"] = {
      ...updatedRuntime.entityStates["light.demo_ceiling"],
      entityId: "light.registry_update",
    };
    const explicitRescan = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      first.profile,
      updatedRuntime,
    );
    assert.equal(
      explicitRescan.profile.entityIdsBySlotId["demo-main-light-slot"],
      "light.persisted_choice",
    );
  });

  test("persists by normalized origin and exports only exact relationships", () => {
    const manifest = manifestFixture();
    const profile = connectedProfileFixture();
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    profileModule.saveRuntimeBindingProfile(storage, "HTTP://FIXTURE-HA.LOCAL:8123/", profile);
    const loaded = profileModule.loadRuntimeBindingProfile(
      storage,
      "http://fixture-ha.local:8123",
      manifest,
    );
    assert.deepEqual(loaded, profile);
    const exported = profileModule.exportRuntimeBindingProfile(profile);
    assert.equal(exported.includes("token"), false);
    assert.equal(exported.includes("state"), false);
    assert.equal(exported.includes("fixture-refresh"), false);
    assert.deepEqual(Object.keys(JSON.parse(exported)).sort(), [
      "entityIdsBySlotId",
      "homeId",
      "roomAreaIds",
      "schemaVersion",
    ]);
  });

  test("migrates a validated legacy runtime binding profile and retains the source record", () => {
    const manifest = manifestFixture();
    const profile = connectedProfileFixture();
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const origin = "http://fixture-ha.local:8123";
    const suffix = `${encodeURIComponent(origin)}:${encodeURIComponent(manifest.home.id)}`;
    const legacyKey = `smart-home-3d.runtime-bindings.v1:${suffix}`;
    values.set(legacyKey, profileModule.exportRuntimeBindingProfile(profile));

    assert.deepEqual(profileModule.loadRuntimeBindingProfile(storage, origin, manifest), profile);
    assert.equal(
      values.get(profileModule.runtimeBindingProfileStorageKey(origin, manifest.home.id)),
      profileModule.exportRuntimeBindingProfile(profile),
    );
    assert.equal(values.has(legacyKey), true);
  });

  test("rejects incompatible schema, home, slot, domain, device class, and current registry IDs", () => {
    const manifest = manifestFixture();
    const runtime = connectedRuntimeFixture();
    const cases = [
      { ...connectedProfileFixture(), schemaVersion: 2 },
      { ...connectedProfileFixture(), homeId: "other-home" },
      { ...connectedProfileFixture(), entityIdsBySlotId: { unknown: "light.demo_ceiling" } },
      {
        ...connectedProfileFixture(),
        entityIdsBySlotId: { "demo-climate-slot": "light.demo_ceiling" },
      },
      {
        ...connectedProfileFixture(),
        entityIdsBySlotId: { "demo-temperature-slot": "sensor.demo_temperature" },
      },
      {
        ...connectedProfileFixture(),
        entityIdsBySlotId: { "demo-climate-slot": "climate.missing" },
      },
      {
        ...connectedProfileFixture(),
        entityIdsBySlotId: {
          "demo-climate-slot": "climate.demo",
          "demo-speaker-slot": "climate.demo",
        },
      },
    ];
    runtime.entityStates["sensor.demo_temperature"].attributes.device_class = "humidity";
    for (const candidate of cases) {
      const result = profileModule.importRuntimeBindingProfile(
        JSON.stringify(candidate),
        manifest,
        runtime,
      );
      assert.equal(result.valid, false);
      assert.ok(result.issues.length > 0);
    }
  });

  test("maps live camera displays from the whole home and exposes their Home Assistant area", () => {
    const manifest = manifestFixture();
    const room = manifest.floors[0].rooms[0];
    room.devices.push({
      id: "demo-garden-camera-screen",
      model: "camera-screen",
      entitySlots: [
        {
          id: "demo-garden-camera-slot",
          compatibleDomains: ["camera"],
          required: true,
          autoMap: "unique-compatible",
          deviceRole: "primary",
          presentation: { label: "Garden camera", dashboardRole: "primary" },
        },
      ],
      placement: {
        at: [1, 0.1],
        elevationMeters: 1.3,
        rotationYRadians: 0,
        support: { kind: "wall", wallId: "north-wall" },
      },
    });
    const runtime = connectedRuntimeFixture();
    runtime.entityRegistry.push({
      entity_id: "camera.demo_garden",
      area_id: "outside",
      device_id: null,
      disabled_by: null,
      hidden_by: null,
      name: "Garden camera",
      original_name: "Garden camera",
    });
    runtime.entityStates["camera.demo_garden"] = {
      entityId: "camera.demo_garden",
      state: "idle",
      attributes: { friendly_name: "Garden camera" },
      available: true,
      stale: false,
      lastUpdated: 1,
    };

    const mapped = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      runtime,
    );
    assert.equal(mapped.profile.roomAreaIds[room.id], "demo_room");
    assert.equal(mapped.profile.entityIdsBySlotId["demo-garden-camera-slot"], "camera.demo_garden");
    assert.equal(
      profileModule.validateRuntimeBindingProfile(mapped.profile, manifest, runtime).valid,
      true,
    );

    const descriptor = profileModule
      .collectBindingSlots(manifest)
      .find((candidate) => candidate.slotId === "demo-garden-camera-slot");
    for (const deviceModel of ["camera-screen", "connected-frame-oak", "connected-frame-black"]) {
      assert.equal(profileModule.isShareableCameraDescriptor({ ...descriptor, deviceModel }), true);
    }
    const candidates = profileModule.bindingEntityCandidates({
      descriptor,
      roomId: room.id,
      profile: mapped.profile,
      runtime,
    });
    assert.deepEqual(
      candidates.map(({ entityId, areaId, areaLabel }) => ({ entityId, areaId, areaLabel })),
      [
        {
          entityId: "camera.demo_garden",
          areaId: "outside",
          areaLabel: "Outside fixture area",
        },
      ],
    );
    assert.deepEqual(
      profileModule.bindingEntityCandidates({
        descriptor: { ...descriptor, deviceModel: "custom-camera-device" },
        roomId: room.id,
        profile: mapped.profile,
        runtime,
      }),
      [],
      "only live camera displays receive home-wide candidates",
    );

    runtime.entityRegistry.push({
      entity_id: "camera.demo_unassigned",
      area_id: null,
      device_id: null,
      disabled_by: null,
      hidden_by: null,
      name: "Unassigned camera",
      original_name: "Unassigned camera",
    });
    runtime.entityStates["camera.demo_unassigned"] = {
      ...runtime.entityStates["camera.demo_garden"],
      entityId: "camera.demo_unassigned",
      attributes: { friendly_name: "Unassigned camera" },
    };
    assert.deepEqual(
      profileModule
        .bindingEntityCandidates({
          descriptor,
          roomId: room.id,
          profile: mapped.profile,
          runtime,
        })
        .map(({ entityId, areaLabel }) => ({ entityId, areaLabel })),
      [
        { entityId: "camera.demo_garden", areaLabel: "Outside fixture area" },
        { entityId: "camera.demo_unassigned", areaLabel: "No area" },
      ],
    );
    const ambiguous = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      runtime,
    );
    assert.equal(ambiguous.profile.entityIdsBySlotId["demo-garden-camera-slot"], undefined);
    assert.deepEqual(
      ambiguous.ambiguous.find((entry) => entry.destinationId === "demo-garden-camera-slot")
        ?.candidateIds,
      ["camera.demo_garden", "camera.demo_unassigned"],
    );
  });

  test("allows multiple camera screens to share one camera", () => {
    const manifest = manifestFixture();
    const room = manifest.floors[0].rooms[0];
    const cameraSlot = (id) => ({
      id,
      compatibleDomains: ["camera"],
      required: true,
      autoMap: "unique-compatible",
      deviceRole: "primary",
      presentation: { label: "Live camera", dashboardRole: "primary" },
    });
    room.devices.push(
      {
        id: "demo-camera-screen-one",
        model: "camera-screen",
        entitySlots: [cameraSlot("demo-camera-one-slot")],
        placement: {
          at: [1, 0.1],
          elevationMeters: 1.3,
          rotationYRadians: 0,
          support: { kind: "wall", wallId: "north-wall" },
        },
      },
      {
        id: "demo-camera-screen-two",
        model: "camera-screen",
        entitySlots: [cameraSlot("demo-camera-two-slot")],
        placement: {
          at: [2, 0.1],
          elevationMeters: 1.3,
          rotationYRadians: 0,
          support: { kind: "wall", wallId: "north-wall" },
        },
      },
    );
    const runtime = connectedRuntimeFixture();
    runtime.entityRegistry.push({
      entity_id: "camera.demo_entry",
      area_id: "outside",
      device_id: null,
      disabled_by: null,
      hidden_by: null,
      name: "Entry camera",
      original_name: "Entry camera",
    });
    runtime.entityStates["camera.demo_entry"] = {
      entityId: "camera.demo_entry",
      state: "idle",
      attributes: { friendly_name: "Entry camera" },
      available: true,
      stale: false,
      lastUpdated: 1,
    };

    const mapped = profileModule.automaticallyMapRuntimeBindings(
      manifest,
      profileModule.createEmptyRuntimeBindingProfile(manifest.home.id),
      runtime,
    );
    assert.equal(mapped.profile.entityIdsBySlotId["demo-camera-one-slot"], undefined);
    assert.equal(mapped.profile.entityIdsBySlotId["demo-camera-two-slot"], undefined);
    assert.equal(
      mapped.ambiguous.filter(
        (entry) =>
          entry.destinationId === "demo-camera-one-slot" ||
          entry.destinationId === "demo-camera-two-slot",
      ).length,
      2,
    );

    const first = profileModule.replaceEntitySlotMapping(
      mapped.profile,
      "demo-camera-one-slot",
      "camera.demo_entry",
    );
    const shared = profileModule.replaceEntitySlotMapping(
      first,
      "demo-camera-two-slot",
      "camera.demo_entry",
    );
    assert.equal(shared.entityIdsBySlotId["demo-camera-one-slot"], "camera.demo_entry");
    assert.equal(shared.entityIdsBySlotId["demo-camera-two-slot"], "camera.demo_entry");
    assert.equal(
      profileModule.validateRuntimeBindingProfile(shared, manifest, runtime).valid,
      true,
    );

    const ordinaryDuplicate = profileModule.replaceEntitySlotMapping(
      connectedProfileFixture(),
      "demo-speaker-slot",
      "light.demo_ceiling",
    );
    assert.equal(ordinaryDuplicate.entityIdsBySlotId["demo-main-light-slot"], "light.demo_ceiling");
    assert.equal(
      profileModule.validateRuntimeBindingProfile(ordinaryDuplicate, manifest, runtime).valid,
      false,
      "sharing still requires compatible domains",
    );
  });

  test("loads one active profile and changes it only through explicit save", async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://dashboard.local/",
    });
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      navigator: globalThis.navigator,
      HTMLElement: globalThis.HTMLElement,
      Event: globalThis.Event,
      actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement,
      Event: dom.window.Event,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const manifest = manifestFixture();
    const initial = connectedProfileFixture();
    profileModule.saveRuntimeBindingProfile(
      dom.window.localStorage,
      "http://fixture-ha.local:8123",
      initial,
    );
    let latest;
    const runtime = connectedRuntimeFixture();
    function Probe({ snapshot }) {
      latest = setupModule.useRuntimeBindingProfile(manifest, snapshot);
      return React.createElement("div", {
        id: "profile",
        "data-loaded": String(latest.loaded),
        "data-light": latest.profile.entityIdsBySlotId["demo-main-light-slot"] ?? "",
      });
    }
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await act(async () => {
        root.render(React.createElement(Probe, { snapshot: runtime }));
        await Promise.resolve();
      });
      assert.equal(latest.loaded, true);
      assert.equal(latest.hasStoredProfile, true);
      assert.equal(latest.profile.entityIdsBySlotId["demo-main-light-slot"], "light.demo_ceiling");
      const changed = profileModule.replaceEntitySlotMapping(initial, "demo-main-light-slot", null);
      assert.equal(latest.profile.entityIdsBySlotId["demo-main-light-slot"], "light.demo_ceiling");
      await act(async () => latest.save(changed));
      assert.equal(latest.profile.entityIdsBySlotId["demo-main-light-slot"], undefined);
      const persisted = profileModule.loadRuntimeBindingProfile(
        dom.window.localStorage,
        runtime.origin,
        manifest,
      );
      assert.equal(persisted.entityIdsBySlotId["demo-main-light-slot"], undefined);
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, {
        window: previous.window,
        document: previous.document,
        localStorage: previous.localStorage,
        navigator: previous.navigator,
        HTMLElement: previous.HTMLElement,
        Event: previous.Event,
        IS_REACT_ACT_ENVIRONMENT: previous.actEnvironment,
      });
    }
  });
});
