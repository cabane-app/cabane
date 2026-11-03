import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, useState } from "react";
import { create } from "@react-three/test-renderer";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const fixtures = await load("/tests/fixtures/agent-home.tsx");
  const { useDashboardDeviceInteraction } = await load(
    "/packages/engine/src/useDashboardDeviceInteraction.ts",
  );
  const { orbitLightCall } = await load("/packages/engine/src/orbit-light-control.ts");
  const { DemoHomeAssistantSession } = await load(
    "/packages/engine/src/DemoHomeAssistantSession.tsx",
  );
  const deviceId = "fixture-floor-lamp";
  const entityId = "light.fixture_floor_lamp";
  const target = { id: deviceId, label: "Floor lamp", slotId: `${deviceId}-entity` };
  const noop = () => {};

  async function withLightScene(options, run) {
    const browser = new JSDOM("<div></div>");
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLCanvasElement: globalThis.HTMLCanvasElement,
    };
    const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
    Object.assign(globalThis, {
      window: browser.window,
      document: browser.window.document,
      HTMLCanvasElement: browser.window.HTMLCanvasElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const manifest = {
      ...fixtures.equippedFixtureManifest,
      floors: fixtures.equippedFixtureManifest.floors.map((floor) => ({
        ...floor,
        rooms: floor.rooms.map((room) => ({ ...room, devices: [...room.devices] })),
      })),
    };
    const floor = manifest.floors[0];
    const device = floor.rooms
      .flatMap((room) => room.devices)
      .find((device) => device.id === deviceId);
    const item = {
      id: deviceId,
      kind: "device",
      modelId: device.model,
      floorId: floor.id,
      size: stableDeviceRegistry[device.model].defaultSize,
      placement: { kind: "absolute", ...device.placement, rotationYRadians: 0 },
      entitySlots: device.entitySlots,
    };
    if (options.outdoor) {
      item.placement.at = [-5, -5];
      manifest.sceneItems = [item];
      for (const room of floor.rooms)
        room.devices = room.devices.filter((device) => device.id !== deviceId);
    }
    const calls = [];
    const read = {};
    const runtime = {
      ...fixtures.connectedCatalogRuntime,
      canMutate: true,
      callService: async (call) => {
        calls.push(call);
        if (options.fail) throw new Error("Light command failed");
      },
      ...options.runtime,
    };
    function Harness({ profile, walkMode = false }) {
      const contextRuntime = engine.useHomeAssistantRuntime();
      const activeRuntime = options.demo ? contextRuntime : runtime;
      const bindings = engine.resolveHomeAssistantBindings(
        manifest,
        profile,
        activeRuntime,
        stableDeviceRegistry,
      );
      const [selectedDeviceId, setSelectedDeviceId] = useState(null);
      const interaction = useDashboardDeviceInteraction({
        manifest,
        floor,
        runtime: activeRuntime,
        resolvedBindings: bindings,
        deviceModels: stableDeviceRegistry,
        walkMode,
        walkthrough: options.walkthrough,
        coarsePointer: true,
        equippedToolId: null,
        walk: {},
        setDevicePanelRoomId: noop,
        setSelectedDeviceId,
        setSelectedRoomId: noop,
        setMode: noop,
        setMappingOpen: noop,
        setWalkDeviceTarget: noop,
        walkDeviceTarget: null,
        selectedDeviceId,
      });
      const resolvedDevice = Object.values(bindings.rooms)
        .flatMap((room) => room.devices)
        .find((device) => device.slot.id === deviceId);
      Object.assign(read, {
        selectedDeviceId,
        runtime: activeRuntime,
        resolvedDevice,
        interact: interaction.handleExtensionInteraction,
      });
      return createElement(engine.SceneItemRenderer, {
        item,
        floor,
        deviceModels: stableDeviceRegistry,
        furnishingModels: {},
        entityStatesBySlotId: {},
        resolvedDevice,
        reducedMotion: true,
        walkMode,
        onInteract: interaction.handleExtensionInteraction,
        liveMediaByEntityId: {},
      });
    }
    const render = (props = {}) =>
      options.demo
        ? createElement(DemoHomeAssistantSession, {
            manifest,
            night: true,
            children: ({ manager }) =>
              createElement(Harness, { profile: manager.profile, ...props }),
          })
        : createElement(Harness, { profile: fixtures.equippedFixtureProfile, ...props });
    const renderer = await create(render());
    const pointer = (extra = {}) => ({
      pointerId: 1,
      button: 0,
      nativeEvent: { clientX: 100, clientY: 100 },
      ...extra,
    });
    const fire = (name, extra) =>
      renderer.fireEvent(
        renderer.scene.findByProps({ name: `scene-item-${deviceId}` }),
        name,
        pointer(extra),
      );
    const native = (name, extra = {}) => {
      const event = new browser.window.Event(name);
      Object.assign(event, { pointerId: 1, clientX: 100, clientY: 100, ...extra });
      browser.window.dispatchEvent(event);
    };
    try {
      await run({ renderer, render, fire, native, read, calls, runtime, browser });
    } finally {
      await renderer.unmount();
      browser.window.close();
      Object.assign(globalThis, previous, { IS_REACT_ACT_ENVIRONMENT: previousAct });
    }
  }

  test("orbital clicks and taps toggle a bound light; a non-dimmable hold still toggles", async (context) => {
    await withLightScene({}, async ({ renderer, render, runtime, fire, calls, read }) => {
      context.mock.timers.enable({ apis: ["setTimeout"] });
      await fire("pointerDown");
      await fire("pointerUp");
      assert.equal(calls[0].service, "turn_off");
      assert.deepEqual(calls[0].target, { entity_id: entityId });
      runtime.entityStates = {
        ...runtime.entityStates,
        [entityId]: { ...runtime.entityStates[entityId], state: "off" },
      };
      await renderer.update(render());
      await fire("pointerDown", { pointerType: "touch" });
      await act(async () => context.mock.timers.tick(1500));
      assert.equal(calls.length, 1);
      await fire("pointerUp", { pointerType: "touch" });
      assert.equal(calls[1].service, "turn_on");
      assert.equal(read.selectedDeviceId, null);
      await fire("pointerDown", { button: 2 });
      await fire("pointerUp", { button: 2 });
      assert.equal(calls.length, 2);
    });
  });

  for (const outdoor of [false, true]) {
    test(`demo ${outdoor ? "outdoor" : "indoor"} lights toggle and dim both ways through the shared controller`, async (context) => {
      await withLightScene({ demo: true, outdoor }, async ({ fire, native, read }) => {
        context.mock.timers.enable({ apis: ["setTimeout"] });
        const state = () => read.resolvedDevice.entities[0].state;
        await fire("pointerDown");
        await fire("pointerUp");
        assert.equal(state().state, "off");
        await fire("pointerDown", { pointerType: "touch" });
        await act(async () => context.mock.timers.tick(499));
        assert.equal(state().state, "off");
        await act(async () => context.mock.timers.tick(1));
        assert.equal(state().state, "on");
        const first = state().attributes.brightness;
        for (let step = 0; step < 20; step++) await act(async () => context.mock.timers.tick(200));
        // Reaching 100% reverses automatically while the same pointer stays down.
        assert.equal(state().attributes.brightness, 242);
        await act(async () => native("pointerup"));
        assert.equal(state().state, "on", "releasing a dimmer must not toggle power");
        await act(async () => context.mock.timers.tick(1000));
        assert.equal(state().attributes.brightness, 242);
        await fire("pointerDown");
        await act(async () => context.mock.timers.tick(500));
        assert.equal(state().attributes.brightness, 255, "the next hold reverses direction");
        await fire("pointerUp");
        assert.ok(first < state().attributes.brightness);
        assert.equal(read.selectedDeviceId, null);
      });
    });
  }

  test("dragging, extra fingers, cancelled pointers, blur, Walk, and unmount stop held dimming", async (context) => {
    await withLightScene(
      { demo: true },
      async ({ renderer, render, fire, native, read, browser }) => {
        context.mock.timers.enable({ apis: ["setTimeout"] });
        const state = () => read.resolvedDevice.entities[0].state;
        const initial = state().attributes.brightness;
        for (const cancel of [
          () => native("pointermove", { clientX: 150 }),
          () => native("pointerdown", { pointerId: 2 }),
          () => native("pointercancel"),
          () => native("lostpointercapture"),
          () => native("blur"),
          () => browser.window.document.dispatchEvent(new browser.window.Event("visibilitychange")),
        ]) {
          await fire("pointerDown");
          await act(async () => cancel());
          await act(async () => context.mock.timers.tick(1000));
          await fire("pointerUp");
          assert.equal(state().attributes.brightness, initial);
          assert.equal(state().state, "on");
        }
        await fire("pointerDown");
        const contextMenu = new browser.window.MouseEvent("contextmenu", { cancelable: true });
        browser.window.dispatchEvent(contextMenu);
        assert.equal(
          contextMenu.defaultPrevented,
          true,
          "a touch hold must suppress the native menu",
        );
        await act(async () => context.mock.timers.tick(500));
        const held = state().attributes.brightness;
        await act(async () => native("pointerup", { pointerId: 99 }));
        await act(async () => context.mock.timers.tick(200));
        assert.ok(state().attributes.brightness > held, "another pointer cannot release this hold");
        await renderer.update(render({ walkMode: true }));
        const stopped = state().attributes.brightness;
        await act(async () => context.mock.timers.tick(1000));
        assert.equal(state().attributes.brightness, stopped);
        await renderer.update(render());
        await fire("pointerDown");
        await act(async () => context.mock.timers.tick(500));
        await renderer.unmount();
        await act(async () => context.mock.timers.tick(1000));
      },
    );
  });

  test("direct commands recheck authorization and reject stale, invalid, ambiguous and unsupported bindings", async () => {
    await withLightScene({}, async ({ read, calls, runtime, renderer, render }) => {
      const device = read.resolvedDevice;
      const toggle = { ...target, intent: "light-toggle" };
      const primary = device.entities[0];
      for (const invalid of [
        { ...device, issues: [{ severity: "error" }] },
        { ...device, entities: [primary, primary] },
        { ...device, entities: [{ ...primary, domain: "switch" }] },
        { ...device, entities: [{ ...primary, state: { ...primary.state, stale: true } }] },
        { ...device, entities: [{ ...primary, state: { ...primary.state, available: false } }] },
        { ...device, entities: [{ ...primary, state: { ...primary.state, state: "unknown" } }] },
      ])
        assert.equal(orbitLightCall(invalid, toggle), null);
      assert.equal(orbitLightCall(device, { ...toggle, slotId: "wrong-slot" }), null);
      assert.equal(
        orbitLightCall(device, { ...target, intent: "light-dim", brightnessPercent: 50 }),
        null,
      );
      runtime.canMutate = false;
      await renderer.update(render());
      await act(async () => read.interact(toggle));
      assert.equal(calls.length, 0);
      assert.equal(read.selectedDeviceId, null);
    });
    await withLightScene({ walkthrough: true }, async ({ read, calls }) => {
      await act(async () => read.interact({ ...target, intent: "light-toggle" }));
      assert.equal(calls.length, 0);
    });
    await withLightScene({ fail: true }, async ({ read, fire, calls }) => {
      await fire("pointerDown");
      await fire("pointerUp");
      assert.equal(calls.length, 1);
      assert.equal(read.selectedDeviceId, deviceId, "a rejected command opens the normal controls");
    });
  });
});
