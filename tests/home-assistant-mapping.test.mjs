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
  functionalMappingManifestFixture,
} from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const mapping = await load("/packages/engine/src/home-assistant-mapping.ts");
  const names = await load("/packages/engine/src/home-assistant-mapping/room-display-name.ts");
  const groups = await load("/packages/engine/src/home-assistant-mapping/device-mapping-groups.ts");
  const drafts = await load("/packages/engine/src/home-assistant-mapping/profile-slice-drafts.ts");
  const areaIcons = await load(
    "/packages/engine/src/home-assistant-mapping/HomeAssistantAreaIcon.tsx",
  );
  const homePlanModule = await load(
    "/packages/engine/src/home-assistant-mapping/HomePlanMapping.tsx",
  );
  const roomsViewModule = await load(
    "/packages/engine/src/home-assistant-mapping/RoomsMappingView.tsx",
  );
  const devicesViewModule = await load(
    "/packages/engine/src/home-assistant-mapping/DevicesMappingView.tsx",
  );
  const screenModule = await load("/packages/engine/src/HomeAssistantMappingScreen.tsx");
  const scaleFixtures = await load("/tests/fixtures/agent-home.tsx");
  const manifest = connectedManifestFixture(neutralDemoManifest);
  const runtime = connectedRuntimeFixture();

  test("changing a room area clears only that room's slots", () => {
    const profile = connectedProfileFixture();
    const next = mapping.replaceRoomAreaAndClearSlots(manifest, profile, "demo-room", "outside");
    assert.equal(next.roomAreaIds["demo-room"], "outside");
    assert.equal(Object.keys(next.entityIdsBySlotId).length, 0);
  });

  test("groups modeled-device matches by Home Assistant device", () => {
    const room = manifest.floors[0].rooms[0];
    const device = room.devices.find((candidate) => candidate.id === "fixture-light-device");
    const candidates = mapping.deviceMappingCandidates({
      manifest,
      roomId: room.id,
      device,
      profile: connectedProfileFixture(),
      runtime,
    });
    assert.deepEqual(
      candidates.map((candidate) => candidate.deviceId),
      ["device-light", "device-switch"],
    );
    assert.equal(candidates[0].entityIdsBySlotId["demo-main-light-slot"], "light.demo_ceiling");
  });

  test("reports stable plan bounds", () => {
    assert.deepEqual(mapping.planBounds(manifest.floors[0]), {
      minX: 0,
      minY: 0,
      width: 4.8,
      height: 3.6,
    });
  });

  test("accepts only safe Material Design area icon references", () => {
    assert.equal(areaIcons.homeAssistantAreaIconClassName("mdi:sofa-outline"), "mdi-sofa-outline");
    assert.equal(areaIcons.homeAssistantAreaIconClassName("custom:sofa"), null);
    assert.equal(areaIcons.homeAssistantAreaIconClassName("mdi:sofa extra-class"), null);
    assert.equal(areaIcons.homeAssistantAreaIconClassName(null), null);
  });

  test("centers a selected room in the visible plan area above a mobile inspector", () => {
    assert.deepEqual(
      homePlanModule.selectedRoomFocusDelta(
        { left: 10, top: 100, width: 390, height: 700 },
        { left: 280, top: 300, width: 50, height: 100 },
        300,
      ),
      { x: -100, y: -100 },
    );
  });

  test("shows solid structures without room selection or mapping actions, including solid-only floors", () => {
    for (const onlySolids of [false, true]) {
      const source = manifest.floors[0];
      const solid = { ...source.rooms[0], id: "chimney", isSolid: true };
      const document = new JSDOM(
        renderToStaticMarkup(
          React.createElement(homePlanModule.HomePlanMapping, {
            floor: { ...source, rooms: onlySolids ? [] : source.rooms, solidRooms: [solid] },
            relationshipLabels: {},
            roomIcons: {},
            selectedRoomId: null,
            inspectorOpen: false,
            onActivateRoom: () => undefined,
          }),
        ),
      ).window.document;
      const structure = document.querySelector('[data-solid-id="chimney"]');
      assert.ok(structure);
      assert.equal(structure.getAttribute("role"), "img");
      assert.equal(structure.hasAttribute("tabindex"), false);
      assert.equal(document.querySelector('[data-room-id="chimney"]'), null);
      assert.equal(
        document.querySelector(".home-plan-mapping__solid-key").textContent,
        "Not a room",
      );
      assert.equal(
        document.querySelectorAll("[data-room-id]").length,
        onlySolids ? 0 : source.rooms.length,
      );
      assert.equal(document.querySelector(".home-plan-mapping__empty"), null);
    }
  });

  test("shows room device coverage as a visual meter without a redundant Devices label", () => {
    const floor = structuredClone(manifest.floors[0]);
    const room = floor.rooms[0];
    const category = groups.groupRoomMappingRelationships(manifest, room.id)[0];
    const renderPlan = (mapped, total, categories) =>
      new JSDOM(
        renderToStaticMarkup(
          React.createElement(homePlanModule.HomePlanMapping, {
            floor,
            relationshipLabels: { [room.id]: "Living" },
            roomDeviceSummaries: { [room.id]: { mapped, total, categories } },
            roomIcons: { [room.id]: "mdi:sofa-outline" },
            selectedRoomId: null,
            inspectorOpen: false,
            onActivateRoom: () => undefined,
            showFitControl: false,
          }),
        ),
      ).window.document;

    const partial = renderPlan(3, 8, [category]);
    assert.match(
      partial.querySelector(`[data-room-id="${room.id}"]`).getAttribute("aria-label"),
      /3 of 8 devices connected\. Device types: Lighting\./,
    );
    assert.equal(
      partial.querySelector(".home-plan-mapping__coverage-label strong").textContent,
      "3 / 8",
    );
    assert.equal(
      partial.querySelector(".home-plan-mapping__coverage-track > span").style.width,
      "37.5%",
    );
    assert.equal(
      partial.querySelector(".home-plan-mapping__room-summary").getAttribute("aria-hidden"),
      "true",
    );
    assert.doesNotMatch(partial.body.textContent, /Devices:|devices mapped/);

    const empty = renderPlan(0, 0, []);
    assert.match(empty.body.textContent, /No devices to connect/);
    assert.equal(empty.querySelector(".home-plan-mapping__coverage-track"), null);
    assert.equal(empty.querySelector(".home-plan-mapping__device-categories"), null);
  });

  test("uses current Home Assistant area names and local room names as fallback", () => {
    const floor = structuredClone(manifest.floors[0]);
    floor.rooms.push({
      ...structuredClone(floor.rooms[0]),
      id: "second-room",
      name: "Generated second room",
      polygon: [
        [5, 0],
        [9, 0],
        [9, 3],
        [5, 3],
      ],
    });
    const roomAreaIds = { "demo-room": "demo_room" };
    assert.equal(
      names.runtimeRoomDisplayName({
        floor,
        roomId: "demo-room",
        roomAreaIds,
        areas: runtime.areas,
      }),
      "Demo room",
    );
    const renamedAreas = runtime.areas.map((area) =>
      area.area_id === "demo_room" ? { ...area, name: "Living room" } : area,
    );
    assert.equal(
      names.runtimeRoomDisplayName({
        floor,
        roomId: "demo-room",
        roomAreaIds,
        areas: renamedAreas,
      }),
      "Living room",
    );
    assert.equal(
      names.runtimeRoomDisplayName({
        floor,
        roomId: "second-room",
        roomAreaIds,
        areas: renamedAreas,
      }),
      "Generated second room",
    );
    assert.equal(
      names.runtimeRoomDisplayName({
        floor,
        roomId: "demo-room",
        roomAreaIds,
        areas: renamedAreas.filter((area) => area.area_id !== "demo_room"),
      }),
      "Demo room",
    );
    assert.equal(floor.rooms[0].name, "Demo room");
  });

  test("groups mapping relationships by function with stable precedence and order", () => {
    const functionalManifest = functionalMappingManifestFixture(neutralDemoManifest);
    const result = groups.groupRoomMappingRelationships(functionalManifest, "demo-room");
    assert.deepEqual(
      result.map((group) => group.id),
      [
        "lighting",
        "climate-temperature",
        "media",
        "openings",
        "security",
        "appliances-utilities",
        "sensors",
        "other",
      ],
    );
    const climate = result.find((group) => group.id === "climate-temperature");
    assert.deepEqual(
      climate.relationships.map((relationship) => relationship.label),
      ["Thermostat", "Ceiling fan", "Temperature", "Humidity", "Humidifier", "Indoor AC"],
    );
    const modeled = climate.relationships.find(
      (relationship) => relationship.kind === "modeled-device",
    );
    assert.deepEqual(modeled.slotIds, [
      "fixture-device-secondary-light",
      "fixture-device-primary-climate",
    ]);
    const opening = result
      .find((group) => group.id === "openings")
      .relationships.find(
        (relationship) =>
          relationship.kind === "entity-slot" && relationship.slotKind === "opening-contact",
      );
    assert.equal(opening.groupId, "openings");
  });

  test("saves room and entity slices independently and rebases cleared room slots", () => {
    const saved = connectedProfileFixture();
    const entityDraft = {
      ...saved.entityIdsBySlotId,
      "demo-coffee-slot": "switch.draft_coffee",
      "unrelated-slot": "light.unrelated",
    };
    assert.deepEqual(
      drafts.changedRoomIds(saved.roomAreaIds, {
        ...saved.roomAreaIds,
        "demo-room": "outside",
      }),
      ["demo-room"],
    );
    const roomSave = drafts.saveRoomAreaDraft({
      manifest,
      savedProfile: saved,
      roomAreaIds: { ...saved.roomAreaIds, "demo-room": "outside" },
    });
    assert.equal(roomSave.profile.roomAreaIds["demo-room"], "outside");
    assert.deepEqual(roomSave.profile.entityIdsBySlotId, {});
    assert.deepEqual(roomSave.clearedSlotIds, Object.keys(saved.entityIdsBySlotId).sort());
    assert.deepEqual(
      drafts.rebaseEntityDraftAfterRoomSave({
        entityIdsBySlotId: entityDraft,
        clearedSlotIds: roomSave.clearedSlotIds,
      }),
      { "unrelated-slot": "light.unrelated" },
    );
    const deviceSave = drafts.saveEntityMappingDraft({
      savedProfile: roomSave.profile,
      entityIdsBySlotId: { "unrelated-slot": "light.unrelated" },
    });
    assert.equal(deviceSave.roomAreaIds["demo-room"], "outside");
    assert.equal(deviceSave.entityIdsBySlotId["unrelated-slot"], "light.unrelated");
  });

  test("preserves the representative 20-room and 100-binding profile", () => {
    const scaleManifest = scaleFixtures.scaleFixtureManifest;
    const scaleProfile = scaleFixtures.scaleFixtureProfile;
    const unchangedRooms = drafts.saveRoomAreaDraft({
      manifest: scaleManifest,
      savedProfile: scaleProfile,
      roomAreaIds: scaleProfile.roomAreaIds,
    });
    assert.equal(unchangedRooms.changedRoomIds.length, 0);
    assert.equal(Object.keys(unchangedRooms.profile.roomAreaIds).length, 20);
    assert.equal(Object.keys(unchangedRooms.profile.entityIdsBySlotId).length, 100);
    const unchangedEntities = drafts.saveEntityMappingDraft({
      savedProfile: unchangedRooms.profile,
      entityIdsBySlotId: scaleProfile.entityIdsBySlotId,
    });
    assert.equal(new Set(Object.values(unchangedEntities.entityIdsBySlotId)).size, 100);
  });

  test("maps Home Assistant areas from a plan-first 3D room inspector", async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://dashboard.local/",
    });
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      navigator: globalThis.navigator,
      HTMLElement: globalThis.HTMLElement,
      Event: globalThis.Event,
      actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement,
      Event: dom.window.Event,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const viewManifest = connectedManifestFixture(neutralDemoManifest);
    viewManifest.floors[0].rooms[0].name = "Generated kitchen";
    viewManifest.floors[0].rooms.push({
      ...structuredClone(viewManifest.floors[0].rooms[0]),
      id: "second-room",
      name: "Generated spare room",
      polygon: [
        [5, 0],
        [9, 0],
        [9, 3.6],
        [5, 3.6],
      ],
      dashboardSlots: [],
      devices: [],
    });
    viewManifest.floors[0].footprint = [
      [0, 0],
      [9, 0],
      [9, 3.6],
      [0, 3.6],
    ];
    const viewRuntime = connectedRuntimeFixture();
    viewRuntime.areas = [
      { area_id: "demo_room", name: "Living", icon: "mdi:sofa-outline", picture: null },
      { area_id: "outside", name: "Bedroom", icon: "custom:bed", picture: null },
    ];
    const changes = [];
    const root = createRoot(dom.window.document.getElementById("root"));
    const RoomsHarness = () => {
      const [roomAreaIds, setRoomAreaIds] = React.useState({ "demo-room": "demo_room" });
      return React.createElement(roomsViewModule.RoomsMappingView, {
        floor: viewManifest.floors[0],
        areas: viewRuntime.areas,
        roomAreaIds,
        onRoomAreaIdsChange: (next) => {
          changes.push(next);
          setRoomAreaIds(next);
        },
      });
    };
    try {
      await act(async () => root.render(React.createElement(RoomsHarness)));
      const text = dom.window.document.body.textContent;
      assert.match(text, /Living/);
      assert.match(text, /No HA area/);
      assert.match(text, /Generated kitchen/);
      assert.match(text, /Generated spare room/);
      assert.equal(/\bready\b|needs attention|!|✓|%/i.test(text), false);
      assert.equal(
        dom.window.document.querySelector(".room-mapping-inspector").getAttribute("data-state"),
        "closed",
      );
      assert.equal(
        dom.window.document.querySelector(".home-plan-mapping__instruction").textContent,
        "Select a 3D room",
      );
      assert.equal(
        dom.window.document.querySelector(
          "[data-room-id='second-room'] .home-plan-mapping__room-icon",
        ),
        null,
      );

      const plan = dom.window.document.querySelector(".home-plan-mapping");
      const svg = plan.querySelector("svg");
      plan.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
      const scroll = new dom.window.WheelEvent("wheel", {
        deltaX: 80,
        deltaY: 40,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => plan.dispatchEvent(scroll));
      assert.equal(scroll.defaultPrevented, true);
      assert.match(svg.style.transform, /translate3d\(-80px, -40px, 0\).*scale\(1\)/);
      await act(async () =>
        plan.dispatchEvent(
          new dom.window.WheelEvent("wheel", {
            deltaY: -Math.log(2) * 100,
            ctrlKey: true,
            clientX: 620,
            clientY: 460,
            bubbles: true,
          }),
        ),
      );
      assert.match(
        svg.style.transform,
        /translate3d\(-280px, -140px, 0\).*scale\(2\)/,
        "pinch preserves the plan point under the cursor",
      );
      await act(async () => plan.querySelector("[aria-label='Zoom out']").click());
      assert.match(svg.style.transform, /scale\(1.75\)/);
      await act(async () =>
        [...plan.querySelectorAll("button")]
          .find((button) => button.textContent === "Fit plan")
          .click(),
      );
      assert.match(svg.style.transform, /translate3d\(0px, 0px, 0\).*scale\(1\)/);

      await act(async () =>
        dom.window.document
          .querySelector("[data-room-id='demo-room']")
          .dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
      );
      assert.equal(
        dom.window.document.querySelector(".room-mapping-inspector").getAttribute("data-state"),
        "open",
      );
      assert.equal(
        dom.window.document.querySelector(".room-mapping-inspector h2").textContent,
        "Generated kitchen",
      );
      const kitchenSelect = dom.window.document.querySelector(
        "select[aria-label='Home Assistant area for 3D room Generated kitchen']",
      );
      assert.equal(kitchenSelect.tagName, "SELECT");
      assert.equal(kitchenSelect.querySelector("svg, .home-assistant-area-icon"), null);
      assert.equal(kitchenSelect.value, "demo_room");
      assert.equal(dom.window.document.activeElement, kitchenSelect);
      assert.equal(
        [...kitchenSelect.options].find((option) => option.value === "outside").disabled,
        false,
      );

      await act(async () =>
        dom.window.document
          .querySelector("[data-room-id='second-room']")
          .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })),
      );
      assert.equal(
        dom.window.document.querySelector(".room-mapping-inspector h2").textContent,
        "Generated spare room",
      );
      const bedroomSelect = dom.window.document.querySelector(
        "select[aria-label='Home Assistant area for 3D room Generated spare room']",
      );
      assert.equal(
        [...bedroomSelect.options].find((option) => option.value === "demo_room").disabled,
        true,
      );
      assert.match(
        [...bedroomSelect.options].find((option) => option.value === "demo_room").textContent,
        /Used by Generated kitchen/,
      );

      bedroomSelect.value = "outside";
      await act(async () =>
        bedroomSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true })),
      );
      assert.deepEqual(changes, [{ "demo-room": "demo_room", "second-room": "outside" }]);
      assert.equal(
        dom.window.document.querySelector(
          "[data-room-id='second-room'] .home-plan-mapping__room-icon",
        ),
        null,
      );
      assert.equal(
        dom.window.document.querySelector(".room-mapping-inspector").getAttribute("data-state"),
        "summary",
      );
      assert.match(
        dom.window.document.querySelector(".room-mapping-inspector__summary").textContent,
        /Generated spare room 3D→Bedroom HA/,
      );

      await act(async () =>
        dom.window.document.querySelector(".room-mapping-inspector__summary").click(),
      );
      assert.equal(
        dom.window.document.querySelector(".room-mapping-inspector").getAttribute("data-state"),
        "open",
      );
      await act(async () =>
        dom.window.document.querySelector(".room-mapping-inspector__collapse").click(),
      );
      assert.equal(
        dom.window.document.querySelector(".room-mapping-inspector").getAttribute("data-state"),
        "summary",
      );
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, {
        window: previous.window,
        document: previous.document,
        navigator: previous.navigator,
        HTMLElement: previous.HTMLElement,
        Event: previous.Event,
        IS_REACT_ACT_ENVIRONMENT: previous.actEnvironment,
      });
    }
  });

  test("maps room devices in a compact grouped list", async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://dashboard.local/",
    });
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      navigator: globalThis.navigator,
      HTMLElement: globalThis.HTMLElement,
      Event: globalThis.Event,
      actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement,
      Event: dom.window.Event,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const viewManifest = functionalMappingManifestFixture(neutralDemoManifest);
    viewManifest.floors[0].rooms[0].name = "Generated kitchen";
    viewManifest.floors[0].rooms[0].devices.push({
      id: "fixture-camera-screen",
      model: "camera-screen",
      entitySlots: [
        {
          id: "fixture-garden-camera-slot",
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
    viewManifest.floors[0].rooms[0].devices.push({
      id: "fixture-water-heater",
      model: "water-heater",
      entitySlots: [
        {
          id: "fixture-water-heater-power",
          compatibleDomains: ["switch"],
          required: true,
          autoMap: "manual",
          deviceRole: "primary",
          presentation: { label: "Water heater power", dashboardRole: "primary" },
        },
      ],
      placement: {
        at: [1.5, 0.1],
        elevationMeters: 1.3,
        rotationYRadians: 0,
        support: { kind: "wall", wallId: "north-wall" },
      },
    });
    viewManifest.floors[0].rooms[0].devices.push({
      id: "fixture-standalone-ac",
      model: "indoor-ac",
      entitySlots: [
        {
          id: "fixture-standalone-ac-climate",
          compatibleDomains: ["climate"],
          required: true,
          autoMap: "unique-compatible",
          deviceRole: "primary",
          presentation: { label: "Standalone AC", dashboardRole: "primary" },
        },
      ],
      placement: {
        at: [2, 0.1],
        elevationMeters: 1.8,
        rotationYRadians: 0,
        support: { kind: "wall", wallId: "north-wall" },
      },
    });
    viewManifest.floors[0].rooms.push({
      ...structuredClone(viewManifest.floors[0].rooms[0]),
      id: "second-room",
      name: "Generated spare room",
      polygon: [
        [5, 0],
        [9, 0],
        [9, 3.6],
        [5, 3.6],
      ],
    });
    const viewRuntime = connectedRuntimeFixture();
    viewRuntime.areas.find((area) => area.area_id === "demo_room").name = "Living";
    viewRuntime.entityRegistry.push({
      entity_id: "camera.fixture_garden",
      area_id: "outside",
      device_id: null,
      disabled_by: null,
      hidden_by: null,
      name: "Garden camera",
      original_name: "Garden camera",
    });
    viewRuntime.entityStates["camera.fixture_garden"] = {
      entityId: "camera.fixture_garden",
      state: "idle",
      attributes: { friendly_name: "Garden camera" },
      available: true,
      stale: false,
      lastUpdated: 1,
    };
    for (const [entityId, areaId, name] of [
      ["climate.fixture_standalone", "demo_room", "Bedroom AC"],
      ["climate.fixture_other_area", "outside", "Office AC"],
      ["climate.fixture_no_area", null, "Unassigned AC"],
    ]) {
      viewRuntime.entityRegistry.push({
        entity_id: entityId,
        area_id: areaId,
        device_id: null,
        platform: "generic_thermostat",
        disabled_by: null,
        hidden_by: null,
        name,
        original_name: name,
      });
      viewRuntime.entityStates[entityId] = {
        entityId,
        state: "cool",
        attributes: { friendly_name: name, temperature: 21, current_temperature: 23 },
        available: true,
        stale: false,
        lastUpdated: 1,
      };
    }
    for (const [entityId, name] of [
      ["light.fixture_display_left", "Display light left"],
      ["light.fixture_display_right", "Display light right"],
    ]) {
      viewRuntime.entityRegistry.push({
        entity_id: entityId,
        area_id: null,
        device_id: "device-climate",
        disabled_by: null,
        hidden_by: null,
        name,
        original_name: name,
      });
      viewRuntime.entityStates[entityId] = {
        entityId,
        state: "off",
        attributes: { friendly_name: name },
        available: true,
        stale: false,
        lastUpdated: 1,
      };
    }
    viewRuntime.devices.push({
      id: "device-water-heater",
      area_id: "demo_room",
      name: "Ballon d'eau chaude",
      name_by_user: null,
      model: "Fixture water heater",
    });
    for (const [entityId, name] of [
      ["switch.fixture_water_heater", "Ballon d'eau chaude"],
      ["switch.fixture_water_heater_boost", "Ballon d'eau chaude boost"],
    ]) {
      viewRuntime.entityRegistry.push({
        entity_id: entityId,
        area_id: null,
        device_id: "device-water-heater",
        disabled_by: null,
        hidden_by: null,
        name,
        original_name: name,
      });
      viewRuntime.entityStates[entityId] = {
        entityId,
        state: "off",
        attributes: { friendly_name: name },
        available: true,
        stale: false,
        lastUpdated: 1,
      };
    }
    const entityIdsBySlotId = {
      "fixture-light-slot": "sensor.demo_temperature",
      "demo-main-light-slot": "light.demo_ceiling",
    };
    const changes = [];
    const root = createRoot(dom.window.document.getElementById("root"));
    const DevicesHarness = ({ roomAreaIds, dirtyRoomIds }) => {
      const [currentEntityIdsBySlotId, setCurrentEntityIdsBySlotId] =
        React.useState(entityIdsBySlotId);
      return React.createElement(devicesViewModule.DevicesMappingView, {
        manifest: viewManifest,
        runtime: viewRuntime,
        roomAreaIds,
        entityIdsBySlotId: currentEntityIdsBySlotId,
        dirtyRoomIds,
        onEntityIdsBySlotIdChange: (next) => {
          changes.push(next);
          setCurrentEntityIdsBySlotId(next);
        },
      });
    };
    const renderView = (roomAreaIds, dirtyRoomIds = new Set()) =>
      root.render(React.createElement(DevicesHarness, { roomAreaIds, dirtyRoomIds }));
    try {
      await act(async () => renderView({ "demo-room": "demo_room" }));
      const tabs = [...dom.window.document.querySelectorAll("[role='tab']")];
      assert.deepEqual(
        tabs.map((tab) => tab.querySelector("strong").textContent),
        ["Generated kitchen", "Generated spare room"],
      );
      assert.ok(tabs[0].querySelector(".devices-mapping-view__room-icon.mdi-sofa-outline"));
      assert.equal(
        tabs[0].firstElementChild.classList.contains("devices-mapping-view__room-icon"),
        true,
      );
      assert.equal(tabs[0].firstElementChild.getAttribute("aria-hidden"), "true");
      assert.equal(tabs[1].querySelector(".devices-mapping-view__room-icon"), null);
      assert.deepEqual(
        tabs.map((tab) => tab.getAttribute("aria-label")),
        ["Generated kitchen. HA area: Living", "Generated spare room. No HA area"],
      );
      assert.equal(dom.window.document.querySelector(".devices-mapping-view__intro"), null);
      const groupHeadings = [...dom.window.document.querySelectorAll(".device-mapping-group h3")];
      assert.deepEqual(
        groupHeadings.map((heading) => heading.textContent),
        [
          "Lighting",
          "Climate & temperature",
          "Media",
          "Openings",
          "Security",
          "Appliances & utilities",
          "Sensors",
          "Other",
        ],
      );
      assert.equal(
        groupHeadings.every((heading) => heading.querySelector('[aria-hidden="true"] svg')),
        true,
      );
      const modeledRelationship = dom.window.document.querySelector(
        "[data-relationship-id='fixture-combined-device']",
      );
      assert.doesNotMatch(
        modeledRelationship.textContent,
        /3D device|Visible in 3D|Home Assistant/,
      );
      assert.ok(
        dom.window.document.querySelector("[data-relationship-id='demo-window-contact-slot']"),
      );
      const ordinaryUnmapped = dom.window.document.querySelector(
        "[data-relationship-id='fixture-climate-slot']",
      );
      assert.match(ordinaryUnmapped.textContent, /Not connected/);
      assert.equal(ordinaryUnmapped.getAttribute("data-connection-state"), "empty");
      assert.equal(
        ordinaryUnmapped
          .querySelector(".device-mapping-row__icon")
          .classList.contains("is-connected"),
        false,
      );
      assert.equal(ordinaryUnmapped.className.includes("warning"), false);
      assert.equal(ordinaryUnmapped.className.includes("attention"), false);
      assert.equal(
        dom.window.document.querySelector(".device-mapping-inspector").getAttribute("data-state"),
        "closed",
      );

      await act(async () =>
        dom.window.document
          .querySelector(
            "[data-relationship-id='fixture-camera-screen'] .device-mapping-row__trigger",
          )
          .click(),
      );
      assert.equal(
        dom.window.document.querySelector(".device-mapping-inspector").getAttribute("data-state"),
        "open",
      );
      assert.equal(
        dom.window.document.querySelector(".devices-mapping-view__content").hasAttribute("inert"),
        true,
      );
      assert.equal(
        dom.window.document
          .querySelector(".device-mapping-inspector__panel")
          .getAttribute("aria-modal"),
        "true",
      );
      assert.match(
        dom.window.document.querySelector(".device-mapping-inspector__collapse").textContent,
        /Devices/,
      );
      assert.doesNotMatch(
        dom.window.document.querySelector(".device-mapping-inspector__panel").textContent,
        /3D device|Selected room control/,
      );
      const cameraChoices = dom.window.document.querySelector(
        "fieldset[aria-label='Home Assistant camera for Garden camera']",
      );
      assert.equal(cameraChoices.querySelector("select"), null);
      assert.deepEqual(
        [...cameraChoices.querySelectorAll(".device-mapping-inspector__option")].map((option) =>
          option.textContent.trim(),
        ),
        ["Not connected", "Garden camera · Outside fixture area camera.fixture_garden"],
      );
      assert.equal(cameraChoices.querySelector("input[value='']").checked, true);
      await act(async () =>
        cameraChoices.querySelector("input[value='camera.fixture_garden']").click(),
      );
      assert.equal(changes.at(-1)["fixture-garden-camera-slot"], "camera.fixture_garden");
      assert.equal(
        dom.window.document.querySelector(".device-mapping-inspector").getAttribute("data-state"),
        "summary",
      );
      assert.equal(
        dom.window.document.querySelector(".devices-mapping-view__content").hasAttribute("inert"),
        false,
      );
      assert.match(
        dom.window.document.querySelector(".device-mapping-inspector__summary").textContent,
        /Garden camera→Garden camera/,
      );

      const invalid = dom.window.document.querySelector(
        "[data-relationship-id='fixture-light-slot']",
      );
      await act(async () => invalid.querySelector(".device-mapping-row__trigger").click());
      const details = dom.window.document.querySelector(".device-mapping-inspector__details");
      assert.equal(details.open, false);
      await act(async () => details.querySelector("summary").click());
      assert.equal(details.open, true);
      assert.match(details.textContent, /sensor\.demo_temperature/);
      assert.match(details.textContent, /Compatible: light/);

      const lightChoices = dom.window.document.querySelector(
        "fieldset[aria-label='Home Assistant match for Ambient light']",
      );
      assert.equal(lightChoices.querySelector("input[value='light.demo_ceiling']").disabled, false);
      await act(async () =>
        lightChoices.querySelector("input[value='light.demo_ceiling']").click(),
      );
      assert.equal(changes.at(-1)["fixture-light-slot"], "light.demo_ceiling");
      assert.equal(
        changes.at(-1)["demo-main-light-slot"],
        "light.demo_ceiling",
        "connecting another light preserves the existing mapping",
      );
      assert.equal(invalid.getAttribute("data-connection-state"), "connected");
      assert.equal(
        invalid.querySelector(".device-mapping-row__icon").classList.contains("is-connected"),
        true,
      );

      await act(async () =>
        dom.window.document
          .querySelector(
            "[data-relationship-id='fixture-combined-device'] .device-mapping-row__trigger",
          )
          .click(),
      );
      const modeledDeviceChoices = dom.window.document.querySelector(
        "fieldset[aria-label='Home Assistant device for Indoor AC']",
      );
      assert.ok(modeledDeviceChoices.querySelector("input[value='device-climate']"));
      await act(async () =>
        modeledDeviceChoices.querySelector("input[value='device-climate']").click(),
      );
      assert.equal(changes.at(-1)["fixture-device-primary-climate"], "climate.demo");
      await act(async () =>
        dom.window.document.querySelector(".device-mapping-inspector__summary").click(),
      );
      const optionalFunctions = dom.window.document.querySelector(
        ".device-mapping-inspector__functions",
      );
      assert.match(optionalFunctions.textContent, /Optional device functions/);
      await act(async () => optionalFunctions.querySelector("summary").click());
      const functionChoices = dom.window.document.querySelector(
        "fieldset[aria-label='Home Assistant function for Display light']",
      );
      await act(async () =>
        functionChoices.querySelector("input[value='light.fixture_display_left']").click(),
      );
      assert.equal(changes.at(-1)["fixture-device-secondary-light"], "light.fixture_display_left");
      assert.match(
        dom.window.document.querySelector(".device-mapping-inspector__summary").textContent,
        /Indoor AC→Climate/,
      );

      await act(async () =>
        dom.window.document
          .querySelector(
            "[data-relationship-id='fixture-standalone-ac'] .device-mapping-row__trigger",
          )
          .click(),
      );
      const standaloneAcChoices = dom.window.document.querySelector(
        "fieldset[aria-label='Home Assistant entity for Standalone AC']",
      );
      assert.ok(standaloneAcChoices);
      assert.equal(standaloneAcChoices.querySelector("input[value='device-climate']"), null);
      assert.deepEqual(
        [
          ...standaloneAcChoices.querySelectorAll(".device-mapping-inspector__option-group > p"),
        ].map((heading) => heading.textContent),
        ["In Generated kitchen", "Other compatible entities"],
      );
      const inRoomGroup = standaloneAcChoices.querySelector(
        "[role='group'][aria-label='In Generated kitchen']",
      );
      assert.ok(inRoomGroup.querySelector("input[value='climate.fixture_standalone']"));
      assert.equal(inRoomGroup.textContent.includes("Office AC"), false);
      const otherGroup = standaloneAcChoices.querySelector(
        "[role='group'][aria-label='Other compatible entities']",
      );
      assert.match(otherGroup.textContent, /Office AC · Outside fixture area · Available/);
      assert.match(otherGroup.textContent, /Unassigned AC · No area · Available/);
      assert.equal(standaloneAcChoices.textContent.includes("Coffee switch"), false);
      await act(async () =>
        inRoomGroup.querySelector("input[value='climate.fixture_standalone']").click(),
      );
      assert.equal(changes.at(-1)["fixture-standalone-ac-climate"], "climate.fixture_standalone");
      assert.match(
        dom.window.document.querySelector(".device-mapping-inspector__summary").textContent,
        /Standalone AC→Bedroom AC/,
      );
      assert.equal(
        dom.window.document
          .querySelector("[data-relationship-id='fixture-standalone-ac']")
          .getAttribute("data-connection-state"),
        "connected",
      );
      await act(async () =>
        dom.window.document.querySelector(".device-mapping-inspector__summary").click(),
      );
      await act(async () =>
        otherGroup.querySelector("input[value='climate.fixture_other_area']").click(),
      );
      assert.equal(changes.at(-1)["fixture-standalone-ac-climate"], "climate.fixture_other_area");
      assert.match(
        dom.window.document.querySelector(".device-mapping-inspector__summary").textContent,
        /Standalone AC→Office AC/,
      );

      await act(async () =>
        dom.window.document
          .querySelector(
            "[data-relationship-id='fixture-water-heater'] .device-mapping-row__trigger",
          )
          .click(),
      );
      const waterHeaterChoices = dom.window.document.querySelector(
        "fieldset[aria-label='Home Assistant entity for Water heater power']",
      );
      assert.ok(waterHeaterChoices);
      assert.equal(waterHeaterChoices.querySelector("input[value='device-water-heater']"), null);
      await act(async () =>
        waterHeaterChoices.querySelector("input[value='switch.fixture_water_heater']").click(),
      );
      assert.equal(changes.at(-1)["fixture-water-heater-power"], "switch.fixture_water_heater");
      assert.equal(
        dom.window.document.querySelector(".device-mapping-inspector").getAttribute("data-state"),
        "summary",
      );
      assert.match(
        dom.window.document.querySelector("[data-relationship-id='fixture-water-heater']")
          .textContent,
        /Ballon d'eau chaude/,
      );

      await act(async () => tabs[1].click());
      assert.match(
        dom.window.document.querySelector(".devices-mapping-view__panel").textContent,
        /Map this room in Rooms first/,
      );
      assert.equal(
        dom.window.document.querySelector(
          ".devices-mapping-view__panel .device-mapping-row__trigger",
        )?.disabled ?? true,
        true,
      );

      await act(async () =>
        renderView(
          { "demo-room": "demo_room", "second-room": "outside" },
          new Set(["second-room"]),
        ),
      );
      assert.equal(
        dom.window.document.querySelector("[role='tab'][aria-selected='true'] strong").textContent,
        "Generated spare room",
      );
      assert.equal(
        dom.window.document
          .querySelector("[role='tab'][aria-selected='true']")
          .getAttribute("aria-label"),
        "Generated spare room. HA area: Outside fixture area",
      );
      assert.match(
        dom.window.document.querySelector(".devices-mapping-view__panel").textContent,
        /Save the room mapping first/,
      );
      await act(async () => dom.window.document.querySelectorAll("[role='tab']")[0].click());
      assert.equal(
        dom.window.document.querySelector(
          "[data-relationship-id='fixture-light-slot'] .device-mapping-row__trigger",
        ).disabled,
        false,
      );
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, {
        window: previous.window,
        document: previous.document,
        navigator: previous.navigator,
        HTMLElement: previous.HTMLElement,
        Event: previous.Event,
        IS_REACT_ACT_ENVIRONMENT: previous.actEnvironment,
      });
    }
  });

  test("saves room and device drafts independently with reassignment confirmation", async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://dashboard.local/",
    });
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      navigator: globalThis.navigator,
      HTMLElement: globalThis.HTMLElement,
      Event: globalThis.Event,
      actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement,
      Event: dom.window.Event,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const screenManifest = connectedManifestFixture(neutralDemoManifest);
    screenManifest.floors[0].rooms[0].name = "Generated room label";
    const screenRuntime = connectedRuntimeFixture();
    screenRuntime.areas.find((area) => area.area_id === "demo_room").name = "Fixture living";
    const saves = [];
    let closes = 0;
    const manager = {
      profile: connectedProfileFixture(),
      loaded: true,
      hasStoredProfile: true,
      save: (profile) => saves.push(profile),
    };
    const root = createRoot(dom.window.document.getElementById("root"));
    const screen = () =>
      React.createElement(screenModule.HomeAssistantMappingScreen, {
        manifest: screenManifest,
        runtime: screenRuntime,
        manager,
        refreshing: false,
        refreshError: null,
        onRefresh: async () => undefined,
        onClose: () => {
          closes += 1;
        },
      });
    try {
      await act(async () => root.render(screen()));
      assert.match(dom.window.document.body.textContent, /Connect your home/);
      assert.deepEqual(
        [...dom.window.document.querySelectorAll(".home-mapping__tabs [role='tab']")].map(
          (tab) => tab.textContent,
        ),
        ["Rooms", "Devices"],
      );
      assert.equal(
        dom.window.document.querySelectorAll(".home-mapping__workspace [role='tabpanel']").length,
        1,
      );
      assert.equal(
        /\bready\b|needs attention|%/i.test(dom.window.document.body.textContent),
        false,
      );
      assert.equal(dom.window.document.body.textContent.includes("Generated room label"), true);
      assert.equal(saves.length, 0);

      await act(async () =>
        dom.window.document.querySelector(".home-mapping__tabs [role='tab']:last-child").click(),
      );
      await act(async () =>
        dom.window.document
          .querySelector("[data-relationship-id='demo-climate-slot'] .device-mapping-row__trigger")
          .click(),
      );
      const climate = dom.window.document.querySelector(
        "fieldset[aria-label='Home Assistant match for Room climate']",
      );
      await act(async () => climate.querySelector("input[value='']").click());
      assert.equal(
        dom.window.document.querySelector(".home-mapping__save").textContent,
        "Save devices",
      );
      await act(async () => dom.window.document.querySelector(".home-mapping__save").click());
      assert.equal(saves.length, 1);
      assert.equal(saves[0].roomAreaIds["demo-room"], "demo_room");
      assert.equal(saves[0].entityIdsBySlotId["demo-climate-slot"], undefined);
      assert.equal(Object.keys(saves[0].entityIdsBySlotId).length, 18);

      await act(async () =>
        dom.window.document.querySelector(".home-mapping__tabs [role='tab']:first-child").click(),
      );
      await act(async () =>
        dom.window.document
          .querySelector("[data-room-id='demo-room']")
          .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })),
      );
      const living = dom.window.document.querySelector(
        "select[aria-label='Home Assistant area for 3D room Generated room label']",
      );
      living.value = "";
      await act(async () =>
        living.dispatchEvent(new dom.window.Event("change", { bubbles: true })),
      );
      assert.equal(
        dom.window.document.querySelector(".home-mapping__save").textContent,
        "Save rooms",
      );
      await act(async () => dom.window.document.querySelector(".home-mapping__save").click());
      const clearDialog = dom.window.document.querySelector("[role='dialog']");
      assert.match(clearDialog.textContent, /clear 18 saved connections/);
      await act(async () =>
        [...clearDialog.querySelectorAll("button")]
          .find((button) => button.textContent === "Cancel")
          .click(),
      );
      assert.equal(saves.length, 1);
      await act(async () => dom.window.document.querySelector(".home-mapping__save").click());
      await act(async () =>
        [...dom.window.document.querySelectorAll("[role='dialog'] button")]
          .find((button) => button.textContent === "Clear and save rooms")
          .click(),
      );
      assert.equal(saves.length, 2);
      assert.deepEqual(saves[1].roomAreaIds, {});
      assert.deepEqual(saves[1].entityIdsBySlotId, {});

      await act(async () =>
        dom.window.document.querySelector("button[aria-label='Close Connect your home']").click(),
      );
      assert.equal(closes, 1);
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, {
        window: previous.window,
        document: previous.document,
        navigator: previous.navigator,
        HTMLElement: previous.HTMLElement,
        Event: previous.Event,
        IS_REACT_ACT_ENVIRONMENT: previous.actEnvironment,
      });
    }
  });

  test("offers stay and discard when closing a dirty mapping view", async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://dashboard.local/",
    });
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      navigator: globalThis.navigator,
      HTMLElement: globalThis.HTMLElement,
      Event: globalThis.Event,
      actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement,
      Event: dom.window.Event,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const manager = {
      profile: connectedProfileFixture(),
      loaded: true,
      hasStoredProfile: true,
      save: () => assert.fail("discard must not save"),
    };
    let closes = 0;
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await act(async () =>
        root.render(
          React.createElement(screenModule.HomeAssistantMappingScreen, {
            manifest,
            runtime,
            manager,
            refreshing: false,
            refreshError: null,
            onRefresh: async () => undefined,
            onClose: () => {
              closes += 1;
            },
          }),
        ),
      );
      await act(async () =>
        dom.window.document
          .querySelector("[data-room-id='demo-room']")
          .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })),
      );
      const area = dom.window.document.querySelector(
        "select[aria-label='Home Assistant area for 3D room Demo room']",
      );
      area.value = "";
      await act(async () => area.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
      await act(async () =>
        dom.window.document.querySelector("button[aria-label='Close Connect your home']").click(),
      );
      assert.deepEqual(
        [...dom.window.document.querySelectorAll("[role='dialog'] button")].map(
          (button) => button.textContent,
        ),
        ["Stay", "Discard changes", "Save and continue"],
      );
      await act(async () =>
        [...dom.window.document.querySelectorAll("[role='dialog'] button")]
          .find((button) => button.textContent === "Stay")
          .click(),
      );
      assert.equal(dom.window.document.querySelector("[role='dialog']"), null);
      assert.equal(closes, 0);
      await act(async () =>
        dom.window.document.querySelector("button[aria-label='Close Connect your home']").click(),
      );
      await act(async () =>
        [...dom.window.document.querySelectorAll("[role='dialog'] button")]
          .find((button) => button.textContent === "Discard changes")
          .click(),
      );
      assert.equal(closes, 1);
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, {
        window: previous.window,
        document: previous.document,
        navigator: previous.navigator,
        HTMLElement: previous.HTMLElement,
        Event: previous.Event,
        IS_REACT_ACT_ENVIRONMENT: previous.actEnvironment,
      });
    }
  });
});
