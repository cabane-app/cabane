import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { useConnectEditor } = await load("/apps/web/src/editor-connect/useConnectEditor.ts");
  const { ConnectInspector } = await load("/apps/web/src/editor-connect/ConnectInspector.tsx");
  const { ConnectSidebar } = await load("/apps/web/src/editor-connect/ConnectSidebar.tsx");
  const {
    equippedFixtureManifest: manifest,
    connectedCatalogRuntime: snapshot,
    equippedFixtureProfile: initialProfile,
  } = await load("/tests/fixtures/agent-home.tsx");
  const origin = snapshot.origin;
  const runtime = {
    ...snapshot,
    connect() {},
    retry() {},
    disconnect: async () => {},
    refreshing: false,
    refreshError: null,
    refresh: async () => {},
    callService: async () => {
      throw new Error("No services");
    },
    cameraClient: null,
  };
  const allRooms = manifest.floors[0].rooms.map((room) => room.id);
  const allSlots = engine.collectBindingSlots(manifest).map((slot) => slot.slotId);
  const protectedBindings = (profile = initialProfile) => ({
    [origin]: {
      draft: structuredClone(profile),
      published: structuredClone(profile),
      manualRoomIds: allRooms,
      manualSlotIds: allSlots,
    },
  });
  async function mount(
    initialBindings = protectedBindings(),
    showInspector = false,
    initialRequest,
  ) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://connect-test.invalid/",
      pretendToBeVisual: true,
    });
    const names = [
      "window",
      "document",
      "navigator",
      "HTMLElement",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ];
    const previous = Object.fromEntries(
      names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    );
    for (const name of names)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value: name.includes("AnimationFrame")
          ? dom.window[name].bind(dom.window)
          : dom.window[name],
      });
    const root = createRoot(dom.window.document.getElementById("root"));
    let current, setBindings, bindings;
    function Harness({
      actualManifest = manifest,
      actualRuntime = runtime,
      actualOrigin = origin,
      active = true,
      onAddReading,
    }) {
      [bindings, setBindings] = useState(initialBindings);
      current = useConnectEditor({
        manifest: actualManifest,
        runtime: actualRuntime,
        origin: actualOrigin,
        bindings,
        onChange: setBindings,
        onAddReading,
        active,
        initialRequest,
      });
      return showInspector
        ? createElement(
            "div",
            null,
            createElement(ConnectSidebar, {
              editor: current,
              runtime: actualRuntime,
              homeAssistantUrl: actualOrigin,
            }),
            createElement(ConnectInspector, { editor: current, manifest: actualManifest }),
          )
        : null;
    }
    const render = async (props = {}) =>
      act(async () => root.render(createElement(Harness, props)));
    await render();
    return {
      dom,
      render,
      get editor() {
        return current;
      },
      get bindings() {
        return bindings;
      },
      setBindings: async (next) => act(async () => setBindings(next)),
      async close() {
        await act(async () => root.unmount());
        dom.window.close();
        for (const name of names) {
          if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
          else delete globalThis[name];
        }
      },
    };
  }

  test("outside devices are selectable in Connect without adding architectural rooms", async () => {
    const device = manifest.floors[0].rooms.flatMap((room) => room.devices)[0];
    const actualManifest = {
      ...manifest,
      sceneItems: [
        ...manifest.sceneItems,
        {
          id: "garden-device",
          kind: "device",
          floorId: manifest.floors[0].id,
          modelId: device.model,
          placement: {
            kind: "absolute",
            at: [1000, 1000],
            elevationMeters: 0,
            rotationYRadians: 0,
          },
          entitySlots: device.entitySlots.map((slot, i) => ({ ...slot, id: `garden-slot-${i}` })),
        },
      ],
    };
    const harness = await mount(protectedBindings(), true);
    const added = [];
    const onAddReading = (itemId, entityId) => added.push({ itemId, entityId });
    try {
      await harness.render({ actualManifest, onAddReading });
      await act(async () => harness.editor.setView("devices"));
      assert.match(harness.dom.window.document.body.textContent, /Outside rooms/);
      await act(async () => assert.equal(harness.editor.selectDevice("garden-device"), true));
      assert.equal(harness.editor.relationship.id, "garden-device");
      assert.equal(harness.editor.room.name, "Outside rooms");
      assert.equal(harness.editor.rooms.length, manifest.floors[0].rooms.length);
      assert.ok(harness.dom.window.document.querySelector(".connection-add"));
      const entityId = runtime.entityRegistry.find((entry) =>
        entry.entity_id.startsWith("sensor."),
      ).entity_id;
      await act(async () => harness.editor.addReading(entityId));
      assert.deepEqual(added, [{ itemId: "garden-device", entityId }]);
      await harness.render({
        actualManifest,
        onAddReading,
        actualRuntime: { ...runtime, status: "disconnected" },
      });
      await act(async () => harness.editor.addReading(entityId));
      assert.equal(added.length, 1, "disconnected sessions cannot add readings");
      await act(async () => harness.editor.setView("rooms"));
      assert.equal(harness.editor.room, null);
    } finally {
      await harness.close();
    }
  });

  test("optional unbound openings remain in Devices without reducing room connection progress", async () => {
    const harness = await mount();
    try {
      for (const room of manifest.floors[0].rooms) {
        await act(async () => harness.editor.selectRoom(room.id));
        const openingRelationships = harness.editor.groups
          .flatMap((group) => group.relationships)
          .filter(
            (relationship) =>
              relationship.kind === "entity-slot" && relationship.slotKind === "opening-contact",
          );
        const unbound = openingRelationships.filter(
          (relationship) =>
            !relationship.slotIds.some((id) => harness.editor.profile.entityIdsBySlotId[id]),
        );
        const total = harness.editor.groups.flatMap((group) => group.relationships).length;
        assert.equal(harness.editor.roomDeviceSummaries[room.id].total, total - unbound.length);
      }
    } finally {
      await harness.close();
    }
  });

  test("Connect defaults to devices only with all rooms mapped and preserves explicit entry views", async () => {
    const mapped = {
      ...initialProfile,
      roomAreaIds: Object.fromEntries(allRooms.map((id, index) => [id, `synthetic-area-${index}`])),
    };
    for (const [profile, request, expected] of [
      [mapped, { mode: "connect" }, "devices"],
      [{ ...mapped, roomAreaIds: {} }, { mode: "connect" }, "rooms"],
      [
        { ...mapped, roomAreaIds: { ...mapped.roomAreaIds, [allRooms[0]]: "" } },
        { mode: "connect" },
        "rooms",
      ],
      [mapped, { mode: "connect", view: "rooms" }, "rooms"],
      [{ ...mapped, roomAreaIds: {} }, { mode: "connect", view: "devices" }, "devices"],
    ]) {
      const harness = await mount(protectedBindings(profile), false, request);
      try {
        assert.equal(harness.editor.view, expected);
        await act(async () => harness.editor.setView("rooms"));
        assert.equal(harness.editor.view, "rooms");
        await harness.render({ actualRuntime: { ...runtime, status: "disconnected", areas: [] } });
        assert.equal(
          harness.editor.defaultView,
          Object.values(profile.roomAreaIds).filter(Boolean).length === allRooms.length
            ? "devices"
            : "rooms",
        );
      } finally {
        await harness.close();
      }
    }
  });

  test("room area change confirms dependent draft clearing, cancel is a no-op, published mappings are unchanged", async () => {
    const harness = await mount();
    try {
      const roomId = Object.keys(initialProfile.roomAreaIds).find((id) =>
        engine
          .collectBindingSlots(manifest)
          .some(
            (slot) => slot.roomIds.includes(id) && initialProfile.entityIdsBySlotId[slot.slotId],
          ),
      );
      await act(async () => harness.editor.selectRoom(roomId));
      const before = structuredClone(harness.bindings);
      await act(async () => harness.editor.assignArea(""));
      assert.ok(harness.editor.pendingAreaChange.clearedSlotIds.length);
      assert.deepEqual(harness.bindings, before);
      await act(async () => harness.editor.cancelAreaChange());
      assert.deepEqual(harness.bindings, before);
      await act(async () => harness.editor.assignArea(""));
      const cleared = harness.editor.pendingAreaChange.clearedSlotIds;
      await act(async () => harness.editor.confirmAreaChange());
      assert.equal(harness.editor.profile.roomAreaIds[roomId], undefined);
      for (const slot of cleared)
        assert.equal(harness.editor.profile.entityIdsBySlotId[slot], undefined);
      assert.deepEqual(harness.bindings[origin].published, before[origin].published);
    } finally {
      await harness.close();
    }
  });

  test("shared room assignment requires explicit dependent-slot confirmation without selecting a room", async () => {
    const harness = await mount();
    try {
      const roomId = Object.keys(initialProfile.roomAreaIds).find((id) =>
        engine
          .collectBindingSlots(manifest)
          .some(
            (slot) => slot.roomIds.includes(id) && initialProfile.entityIdsBySlotId[slot.slotId],
          ),
      );
      const before = structuredClone(harness.bindings);
      let result;
      await act(async () => {
        result = harness.editor.assignRoomArea(roomId, null);
      });
      assert.equal(result.status, "confirmation-required");
      assert.ok(result.clearedSlotIds.length);
      const clearedSlotIds = result.clearedSlotIds;
      assert.deepEqual(harness.bindings, before);
      await act(async () => {
        result = harness.editor.assignRoomArea(roomId, null, true);
      });
      assert.equal(result.status, "applied");
      assert.equal(harness.editor.profile.roomAreaIds[roomId], undefined);
      for (const slotId of clearedSlotIds)
        assert.equal(harness.editor.profile.entityIdsBySlotId[slotId], undefined);
      assert.equal(harness.editor.pendingAreaChange, null);
      assert.deepEqual(harness.bindings[origin].published, before[origin].published);
    } finally {
      await harness.close();
    }
  });

  test("shared entity assignment clears only its slot and rejects incompatible maps atomically", async () => {
    const harness = await mount();
    try {
      const [slotId, entityId] = Object.entries(initialProfile.entityIdsBySlotId)[0];
      const before = structuredClone(harness.bindings);
      let result;
      await act(async () => {
        result = harness.editor.assignEntity(slotId, null);
      });
      assert.equal(result.status, "applied");
      assert.equal(harness.editor.profile.entityIdsBySlotId[slotId], undefined);
      const retained = { ...before[origin].draft.entityIdsBySlotId };
      delete retained[slotId];
      assert.deepEqual(harness.editor.profile.entityIdsBySlotId, retained);
      assert.ok(harness.bindings[origin].manualSlotIds.includes(slotId));
      assert.deepEqual(harness.bindings[origin].published, before[origin].published);
      const cleared = structuredClone(harness.bindings);
      await act(async () => {
        result = harness.editor.assignEntities({
          ...retained,
          [slotId]: entityId,
          "unknown-slot": entityId,
        });
      });
      assert.equal(result.status, "rejected");
      assert.deepEqual(harness.bindings, cleared);
      const descriptor = engine
        .collectBindingSlots(manifest)
        .find((slot) => slot.slotId === slotId);
      const incompatible = runtime.entityRegistry.find(
        (entry) => !engine.entityMatchesBindingSlot(descriptor, entry.entity_id, runtime),
      );
      assert.ok(incompatible);
      await act(async () => {
        result = harness.editor.assignEntity(slotId, incompatible.entity_id);
      });
      assert.equal(result.status, "rejected");
      assert.deepEqual(harness.bindings, cleared);
    } finally {
      await harness.close();
    }
  });

  test("shared entity assignment permits offline clearing and blocks offline additions", async () => {
    const harness = await mount();
    try {
      const [slotId, entityId] = Object.entries(initialProfile.entityIdsBySlotId)[0];
      await harness.render({
        actualRuntime: { ...runtime, status: "disconnected", entityRegistry: [] },
      });
      let result;
      await act(async () => {
        result = harness.editor.assignEntity(slotId, null);
      });
      assert.equal(result.status, "applied");
      assert.equal(harness.editor.profile.entityIdsBySlotId[slotId], undefined);
      const cleared = structuredClone(harness.bindings);
      await act(async () => {
        result = harness.editor.assignEntity(slotId, entityId);
      });
      assert.equal(result.status, "rejected");
      assert.deepEqual(harness.bindings, cleared);
    } finally {
      await harness.close();
    }
  });

  test("pending room clearing cannot overwrite a changed draft or another connection origin", async () => {
    const harness = await mount();
    try {
      const roomId = Object.keys(initialProfile.roomAreaIds)[0];
      await act(async () => harness.editor.assignRoomArea(roomId, null));
      assert.ok(harness.editor.pendingAreaChange);
      const changed = structuredClone(harness.bindings);
      changed[origin].draft = { ...changed[origin].draft, weatherSource: "off" };
      await harness.setBindings(changed);
      await act(async () => harness.editor.confirmAreaChange());
      assert.deepEqual(harness.bindings, changed);
      await act(async () => harness.editor.assignRoomArea(roomId, null));
      await harness.render({ actualOrigin: "https://other.invalid" });
      await act(async () => harness.editor.confirmAreaChange());
      assert.deepEqual(harness.bindings, changed);
      assert.equal(harness.bindings["https://other.invalid"], undefined);
    } finally {
      await harness.close();
    }
  });

  test("exact-device entry resolves its current room and retains selection through connection loss", async () => {
    const room = manifest.floors[0].rooms.find((room) => room.devices.length);
    const device = room.devices[0];
    const harness = await mount(protectedBindings(), true, {
      mode: "connect",
      roomId: "stale-room",
      relationshipId: device.id,
    });
    try {
      assert.equal(harness.editor.roomId, room.id);
      assert.equal(harness.editor.view, "devices");
      assert.equal(harness.editor.relationshipId, device.id);
      assert.ok(harness.dom.window.document.querySelector(".is-selected-preview"));
      await harness.render({
        actualRuntime: { ...runtime, status: "disconnected", areas: [], entityRegistry: [] },
      });
      assert.equal(harness.editor.relationshipId, device.id);
      const sources = [...harness.dom.window.document.querySelectorAll(".connection-source")];
      assert.ok(sources.every((button) => button.disabled));
      const disconnect = [...harness.dom.window.document.querySelectorAll("button")].find(
        (button) => button.textContent === "Disconnect",
      );
      if (disconnect) assert.equal(disconnect.disabled, false);
      await act(async () => harness.editor.showPlan());
      assert.equal(harness.editor.room, null);
      await act(async () => harness.editor.selectDevice(device.id));
      assert.equal(harness.editor.relationshipId, device.id);
      const deleted = {
        ...manifest,
        floors: [
          {
            ...manifest.floors[0],
            rooms: manifest.floors[0].rooms.map((item) =>
              item.id === room.id
                ? {
                    ...item,
                    devices: room.devices.filter((candidate) => candidate.id !== device.id),
                  }
                : item,
            ),
          },
        ],
      };
      await harness.render({ actualManifest: deleted });
      assert.equal(harness.editor.relationship, null);
      assert.match(harness.editor.message, /no longer in the draft/);
    } finally {
      await harness.close();
    }
  });

  test("the room workbench keeps every device visible and returns to the house plan", async () => {
    const harness = await mount(protectedBindings(), true);
    try {
      const room = manifest.floors[0].rooms.find((room) => room.devices.length);
      await act(async () => harness.editor.selectRoom(room.id));
      const document = harness.dom.window.document;
      assert.equal(
        document.querySelectorAll(".connect-device-nav").length,
        harness.editor.groups.flatMap((group) => group.relationships).length,
      );
      assert.equal(document.querySelector(".connection-workbench"), null);
      assert.equal(document.querySelector('[aria-label="Search all compatible sources"]'), null);
      assert.equal(document.querySelector('select[aria-label="Show devices in"]'), null);
      assert.doesNotMatch(document.body.textContent, /Home Assistant area:/);
      assert.equal(
        document.querySelectorAll(".connect-room-nav__room").length,
        harness.editor.deviceRooms.length,
      );
      const roomButton = [...document.querySelectorAll(".connect-room-nav__room")].find(
        (button) => button.querySelector("strong").textContent === room.name,
      );
      assert.equal(roomButton.getAttribute("aria-pressed"), "true");
      const summary = harness.editor.roomDeviceSummaries[room.id];
      assert.equal(
        roomButton.querySelector("small").textContent,
        `${summary.mapped}/${summary.total} connected`,
      );
      assert.equal(document.querySelector(".connect-plan-back"), null);
      const otherRoomButton = [...document.querySelectorAll(".connect-room-nav__room")].find(
        (button) => button !== roomButton,
      );
      assert.ok(otherRoomButton);
      await act(async () => otherRoomButton.click());
      assert.equal(otherRoomButton.getAttribute("aria-pressed"), "true");
      await act(async () => roomButton.click());
      const row = [...document.querySelectorAll(".connect-device-nav")][1];
      await act(async () => row.click());
      assert.equal(row.getAttribute("aria-pressed"), "true");
      assert.ok(document.querySelector(".connection-workbench"));
      assert.equal(document.querySelector('[aria-label="Search all compatible sources"]'), null);
      const inspector = document.querySelector(".connect-room-view");
      assert.equal(inspector.dataset.deviceOpen, "true");
      await act(async () => document.querySelector(".connection-slot").click());
      assert.ok(harness.editor.slotId);
      assert.ok(document.querySelector('[aria-label="Search all compatible sources"]'));
      const backToDevices = [...document.querySelectorAll("button")].find(
        (button) => button.textContent.trim() === "Devices",
      );
      await act(async () => backToDevices.click());
      assert.equal(inspector.dataset.deviceOpen, "false");
      const otherRow = [...document.querySelectorAll(".connect-device-nav")][0];
      await act(async () => otherRow.click());
      assert.equal(otherRow.getAttribute("aria-pressed"), "true");
      assert.equal(harness.editor.slotId, null);
      assert.equal(inspector.dataset.deviceOpen, "true");
      assert.equal(document.querySelector('[aria-label="Search all compatible sources"]'), null);
      await act(async () => document.querySelector(".connect-show-plan").click());
      assert.equal(harness.editor.room, null);
      assert.equal(document.querySelector(".connection-workbench"), null);
      assert.equal(
        document.querySelector(".connect-show-plan").getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        document.querySelectorAll(".connect-room-nav__room").length,
        harness.editor.deviceRooms.length,
      );
    } finally {
      await harness.close();
    }
  });

  test("automatic resolver respects explicit empty rooms/slots and undo does not immediately refill", async () => {
    const empty = engine.createEmptyRuntimeBindingProfile(manifest.home.id);
    const harness = await mount(protectedBindings(empty));
    try {
      assert.deepEqual(harness.editor.profile, empty);
      const unprotected = {
        [origin]: { draft: empty, published: empty, manualRoomIds: [], manualSlotIds: [] },
      };
      await harness.setBindings(unprotected);
      await harness.render({
        actualRuntime: {
          ...runtime,
          areas: [...runtime.areas, { area_id: "unused", name: "Unused" }],
        },
      });
      assert.ok(Object.keys(harness.editor.profile.roomAreaIds).length);
      await harness.setBindings(unprotected);
      assert.deepEqual(harness.editor.profile, empty);
      await harness.render({
        active: false,
        actualRuntime: {
          ...runtime,
          areas: [...runtime.areas, { area_id: "unused", name: "Unused" }],
        },
      });
      await harness.render({
        active: true,
        actualRuntime: {
          ...runtime,
          areas: [...runtime.areas, { area_id: "unused", name: "Unused" }],
        },
      });
      assert.deepEqual(harness.editor.profile, empty);
    } finally {
      await harness.close();
    }
  });

  test("disconnect retains same-origin display snapshot, allows clearing, and never reuses another origin", async () => {
    const harness = await mount();
    try {
      await act(async () => harness.editor.selectRoom(Object.keys(initialProfile.roomAreaIds)[0]));
      await harness.render({
        actualRuntime: { ...runtime, status: "disconnected", areas: [], entityRegistry: [] },
      });
      assert.equal(harness.editor.disconnected, true);
      assert.deepEqual(harness.editor.displayRuntime.areas, runtime.areas);
      const before = structuredClone(harness.bindings);
      await act(async () => harness.editor.assignArea("fake-new-area"));
      assert.deepEqual(harness.bindings, before);
      await act(async () => harness.editor.assignArea(""));
      assert.ok(harness.editor.pendingAreaChange);
      await harness.render({
        actualOrigin: "https://other.invalid",
        actualRuntime: {
          ...runtime,
          origin: "https://other.invalid",
          status: "disconnected",
          areas: [],
          entityRegistry: [],
        },
      });
      assert.deepEqual(harness.editor.profile.roomAreaIds, {});
      assert.deepEqual(harness.editor.displayRuntime.areas, []);
    } finally {
      await harness.close();
    }
  });

  test("current draft targets appear immediately in the room workbench without a dialog", async () => {
    const harness = await mount(protectedBindings(), true);
    try {
      const room = manifest.floors[0].rooms[0];
      const first = engine
        .collectBindingSlots(manifest)
        .find((slot) => slot.roomIds.includes(room.id));
      const newSlot = {
        ...first.spec,
        id: "synthetic-new-draft-slot",
        presentation: { ...first.spec.presentation, label: "New draft target" },
      };
      const next = {
        ...manifest,
        floors: [
          {
            ...manifest.floors[0],
            rooms: manifest.floors[0].rooms.map((candidate) =>
              candidate.id === room.id
                ? { ...candidate, dashboardSlots: [...candidate.dashboardSlots, newSlot] }
                : candidate,
            ),
          },
        ],
      };
      await harness.render({ actualManifest: next });
      await act(async () => {
        harness.editor.selectRoom(room.id);
        harness.editor.setView("devices");
      });
      assert.ok(
        harness.editor.groups
          .flatMap((group) => group.relationships)
          .some((relationship) => relationship.id === newSlot.id),
      );
      const row = [...harness.dom.window.document.querySelectorAll("button")].find((button) =>
        button.textContent.includes("New draft target"),
      );
      assert.ok(row);
      await act(async () => row.click());
      assert.ok(harness.dom.window.document.querySelector(".connection-workbench"));
      assert.equal(harness.dom.window.document.querySelector('[role="dialog"]'), null);
      assert.equal(
        harness.dom.window.document.querySelector('[aria-label="Search all compatible sources"]'),
        null,
      );
      await act(async () => harness.dom.window.document.querySelector(".connection-slot").click());
      assert.ok(
        harness.dom.window.document.querySelector('[aria-label="Search all compatible sources"]'),
      );
      assert.doesNotMatch(harness.dom.window.document.body.textContent, /Save rooms|Save devices/);
      await act(async () =>
        harness.dom.window.document.querySelector(".connect-show-plan").click(),
      );
      assert.equal(harness.editor.room, null);
    } finally {
      await harness.close();
    }
  });
});
