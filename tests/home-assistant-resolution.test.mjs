import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";
import {
  connectedManifestFixture,
  connectedProfileFixture,
  connectedRuntimeFixture,
} from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const { resolveOpeningPositions } = await load("/packages/engine/src/opening-pose.ts");
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const resolver = await load("/packages/engine/src/home-assistant-resolver.ts");
  const { bindingEntityCandidates } = await load("/packages/engine/src/runtime-binding-profile.ts");

  test("event slots offer compatible remotes and resolve without mutation or an on state", async () => {
    const manifest = structuredClone(connectedManifestFixture(neutralDemoManifest));
    const room = manifest.floors[0].rooms.find((room) => room.id === "demo-room");
    const slot = {
      id: "remote-event",
      compatibleDomains: ["event"],
      required: false,
      autoMap: "manual",
      presentation: { label: "Remote", dashboardRole: "primary" },
    };
    room.dashboardSlots.push(slot);
    const profile = connectedProfileFixture();
    const runtime = connectedRuntimeFixture();
    const entityId = "event.synthetic_remote";
    runtime.entityStates[entityId] = {
      entityId,
      state: "2026-01-01T12:00:00.000+00:00",
      attributes: { event_type: "short_release" },
      available: true,
      stale: false,
    };
    runtime.entityRegistry.push({
      entity_id: entityId,
      unique_id: "synthetic-remote",
      platform: "synthetic",
      area_id: profile.roomAreaIds[room.id],
      device_id: null,
      disabled_by: null,
      hidden_by: null,
    });
    const candidates = bindingEntityCandidates({
      descriptor: { kind: "dashboard", slotId: slot.id, roomIds: [room.id], spec: slot },
      roomId: room.id,
      profile,
      runtime,
    });
    assert.ok(candidates.some((candidate) => candidate.entityId === entityId));
    assert.ok(candidates.every((candidate) => candidate.entityId.startsWith("event.")));
    profile.entityIdsBySlotId[slot.id] = entityId;
    const resolved = resolver
      .resolveHomeAssistantBindings(manifest, profile, runtime)
      .rooms[room.id].sections.primary.find((binding) => binding.slotId === slot.id);
    assert.equal(resolved.domain, "event");
    assert.deepEqual(resolved.issues, []);
    assert.equal(resolver.bindingCanMutate(resolved), false);
  });

  test("resolves only exact active-profile slots in generated order and honors area precedence", () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const profile = connectedProfileFixture();
    const resolved = resolver.resolveHomeAssistantBindings(
      manifest,
      profile,
      connectedRuntimeFixture(),
    );
    const room = resolved.rooms["demo-room"];
    assert.equal(room.displayName, "Demo room");
    assert.deepEqual(
      room.sections.primary.map((entity) => entity.entityId),
      ["climate.demo"],
    );
    assert.deepEqual(
      room.sections.secondary.map((entity) => entity.entityId),
      [
        "switch.demo_coffee",
        "input_boolean.demo_quiet",
        "cover.demo_shade",
        "fan.demo",
        "humidifier.demo",
        "water_heater.demo",
        "vacuum.demo",
        "lock.demo_front_door",
        "alarm_control_panel.demo",
        "valve.demo_water",
        "siren.demo",
        "select.demo_cycle",
        "number.demo_level",
        "button.demo_start",
      ],
    );
    const light = room.devices.find((device) => device.slot.id === "fixture-light-device")
      .entities[0];
    assert.equal(light.label, "Main ceiling");
    assert.equal(light.areaId, "demo_room");
    assert.equal(light.issues.length, 0, "entity area overrides a different device area");
    const deviceFallback = room.sections.secondary.find(
      (entity) => entity.entityId === "switch.demo_coffee",
    );
    assert.equal(
      deviceFallback.areaId,
      "demo_room",
      "device area is used when entity area is null",
    );
    assert.equal(resolved.openings["demo-window"].state, "open");
  });

  test("resolves current Home Assistant room names with a local room name fallback", () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const profile = connectedProfileFixture();
    const runtime = connectedRuntimeFixture();
    runtime.areas.find((area) => area.area_id === "demo_room").name = "Fixture living";
    assert.equal(
      resolver.resolveHomeAssistantBindings(manifest, profile, runtime).rooms["demo-room"]
        .displayName,
      "Fixture living",
    );
    delete profile.roomAreaIds["demo-room"];
    assert.equal(
      resolver.resolveHomeAssistantBindings(manifest, profile, runtime).rooms["demo-room"]
        .displayName,
      manifest.floors[0].rooms[0].name,
    );
  });

  test("does not fuzzy-match missing profile IDs and reports the exact slot path", () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const profile = connectedProfileFixture();
    profile.entityIdsBySlotId["demo-temperature-slot"] = "sensor.renamed_temperature";
    const resolved = resolver.resolveHomeAssistantBindings(
      manifest,
      profile,
      connectedRuntimeFixture(),
    );
    const missing = resolved.issues.find(
      (candidate) => candidate.entityId === "sensor.renamed_temperature",
    );
    assert.equal(missing.code, "binding.entity-missing");
    assert.equal(missing.path, "runtimeProfile.entityIdsBySlotId.demo-temperature-slot");
  });

  test("reports area, domain, hidden, disabled, and unavailable profile issues", () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const secondRoom = structuredClone(manifest.floors[0].rooms[0]);
    secondRoom.id = "fixture-second-room";
    secondRoom.name = "Second room";
    secondRoom.dashboardSlots = [
      {
        ...secondRoom.dashboardSlots[0],
        id: "second-room-light-slot",
        compatibleDomains: ["light"],
      },
    ];
    secondRoom.devices = [];
    manifest.floors[0].rooms.push(secondRoom);
    manifest.floors[0].rooms[0].devices[0].entitySlots[0].compatibleDomains = ["switch"];

    const profile = connectedProfileFixture();
    profile.roomAreaIds["fixture-second-room"] = "outside";
    profile.entityIdsBySlotId["second-room-light-slot"] = "light.demo_ceiling";
    const runtime = connectedRuntimeFixture();
    runtime.entityRegistry.find((entry) => entry.entity_id === "light.demo_ceiling").hidden_by =
      "user";
    const climateRegistry = runtime.entityRegistry.find(
      (entry) => entry.entity_id === "climate.demo",
    );
    climateRegistry.disabled_by = "integration";
    climateRegistry.area_id = "outside";
    runtime.entityStates["sensor.demo_temperature"] = {
      ...runtime.entityStates["sensor.demo_temperature"],
      state: "unavailable",
      available: false,
    };

    const codes = new Set(
      resolver
        .resolveHomeAssistantBindings(manifest, profile, runtime)
        .issues.map((entry) => entry.code),
    );
    for (const code of [
      "binding.area-mismatch",
      "binding.disabled",
      "binding.domain-incompatible",
      "binding.hidden",
      "binding.unavailable",
    ])
      assert.equal(codes.has(code), true, `expected ${code}`);
  });

  test("keeps an explicit cross-area binding valid only for a single-slot modeled device", () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const profile = connectedProfileFixture();
    const runtime = connectedRuntimeFixture();
    runtime.entityRegistry.find((entry) => entry.entity_id === "light.demo_ceiling").area_id =
      "outside";

    const singleSlot = resolver.resolveHomeAssistantBindings(manifest, profile, runtime);
    const lightDevice = singleSlot.rooms["demo-room"].devices.find(
      (device) => device.slot.id === "fixture-light-device",
    );
    assert.equal(lightDevice.entities[0].entityId, "light.demo_ceiling");
    assert.equal(
      lightDevice.issues.some((issue) => issue.code === "binding.area-mismatch"),
      false,
    );

    lightDevice.slot.entitySlots.push({
      id: "fixture-light-diagnostic",
      compatibleDomains: ["sensor"],
      required: false,
      autoMap: "manual",
      deviceRole: "diagnostic",
      presentation: { label: "Light diagnostic", dashboardRole: "diagnostic" },
    });
    const multiSlot = resolver.resolveHomeAssistantBindings(manifest, profile, runtime);
    assert.equal(
      multiSlot.rooms["demo-room"].devices
        .find((device) => device.slot.id === "fixture-light-device")
        .issues.some((issue) => issue.code === "binding.area-mismatch"),
      true,
    );
  });

  test("keeps a bound opening unavailable instead of assuming it is closed", () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const runtime = connectedRuntimeFixture();
    runtime.entityStates["binary_sensor.demo_window"] = {
      ...runtime.entityStates["binary_sensor.demo_window"],
      state: "unknown",
      available: false,
    };
    assert.equal(
      resolver.resolveHomeAssistantBindings(manifest, connectedProfileFixture(), runtime).openings[
        "demo-window"
      ].state,
      "unavailable",
    );
  });

  test("local proximity overrides a closed contact without changing its reported state", async () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const profile = connectedProfileFixture();
    const runtime = connectedRuntimeFixture();
    const lastKnown = new Map();
    const automatic = new Set(["demo-window"]);

    runtime.entityStates["binary_sensor.demo_window"] = {
      ...runtime.entityStates["binary_sensor.demo_window"],
      state: "off",
    };
    const closed = resolver.resolveHomeAssistantBindings(manifest, profile, runtime);
    assert.deepEqual(
      resolveOpeningPositions(automatic, closed.openings, lastKnown)["demo-window"],
      1,
    );
    assert.equal(closed.openings["demo-window"].position, 0);
    assert.equal(resolveOpeningPositions(new Set(), closed.openings, lastKnown)["demo-window"], 0);

    runtime.entityStates["binary_sensor.demo_window"] = {
      ...runtime.entityStates["binary_sensor.demo_window"],
      state: "on",
    };
    const open = resolver.resolveHomeAssistantBindings(manifest, profile, runtime);
    assert.deepEqual(
      resolveOpeningPositions(new Set(), open.openings, lastKnown)["demo-window"],
      1,
    );
  });

  test("resolves two camera screens sharing one camera without duplicate issues", () => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const room = manifest.floors[0].rooms[0];
    const makeScreen = (index) => ({
      id: `shared-camera-screen-${index}`,
      model: "camera-screen",
      entitySlots: [
        {
          id: `shared-camera-slot-${index}`,
          compatibleDomains: ["camera"],
          required: true,
          autoMap: "unique-compatible",
          deviceRole: "primary",
          presentation: { label: "Entry camera", dashboardRole: "primary" },
        },
      ],
      placement: {
        at: [index, 0.1],
        elevationMeters: 1.3,
        rotationYRadians: 0,
        support: { kind: "wall", wallId: "north-wall" },
      },
    });
    room.devices.push(makeScreen(1), makeScreen(2));
    const profile = connectedProfileFixture();
    profile.entityIdsBySlotId["shared-camera-slot-1"] = "camera.demo_entry";
    profile.entityIdsBySlotId["shared-camera-slot-2"] = "camera.demo_entry";
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
    const resolved = resolver.resolveHomeAssistantBindings(manifest, profile, runtime);
    const cameras = resolved.rooms["demo-room"].devices.filter(
      (device) => device.slot.model === "camera-screen",
    );
    assert.equal(cameras.length, 2);
    assert.equal(
      cameras.every((device) => device.entities[0]?.entityId === "camera.demo_entry"),
      true,
    );
    assert.equal(
      cameras
        .flatMap((device) => device.issues)
        .some(
          (issue) => issue.code === "binding.duplicate" || issue.code === "binding.area-mismatch",
        ),
      false,
    );
  });
});
