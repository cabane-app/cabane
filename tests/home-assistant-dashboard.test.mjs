import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import { act, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { withModules } from "./test-server.mjs";
import {
  connectedManifestFixture,
  connectedProfileFixture,
  connectedRuntimeFixture,
} from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const { useRoomModuleOrder } = await load(
    "/packages/engine/src/home-assistant-dashboard/useRoomModuleOrder.ts",
  );
  test("module order isolates homes and rooms, reconciles modules, and tolerates storage failure", async () => {
    await withDom(async ({ root, dom }) => {
      let ordering;
      function Harness({ home = "a", room = "one", ids = ["x", "y", "z"] }) {
        ordering = useRoomModuleOrder(
          home,
          room,
          ids.map((id) => ({ id })),
        );
        return null;
      }
      const render = async (props = {}) =>
        act(async () => root.render(React.createElement(Harness, props)));
      const ids = () => ordering.ordered.map((module) => module.id);
      await render();
      await act(async () => ordering.move("z", "x"));
      assert.deepEqual(ids(), ["z", "x", "y"]);
      await render({ home: "b" });
      assert.deepEqual(ids(), ["x", "y", "z"]);
      await render({ room: "two" });
      assert.deepEqual(ids(), ["x", "y", "z"]);
      await render({ ids: ["x", "z", "new"] });
      assert.deepEqual(ids(), ["z", "x", "new"]);
      await act(async () => root.render(null));
      await render();
      assert.deepEqual(ids(), ["z", "x", "y"]);
      dom.window.localStorage.setItem('cabane.room-module-order.v1:["bad","one"]', "{broken");
      await render({ home: "bad" });
      assert.deepEqual(ids(), ["x", "y", "z"]);
      dom.window.Storage.prototype.setItem = () => {
        throw new Error("Storage unavailable");
      };
      await act(async () => ordering.move("z", "x"));
      assert.deepEqual(ids(), ["z", "x", "y"]);
    });
  });
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { resolveHomeAssistantBindings, resolveHomeAssistantPictureUrl } = await load(
    "/packages/engine/src/home-assistant-resolver.ts",
  );
  const { RoomDashboardPanel } = await load("/packages/engine/src/HomeAssistantDashboards.tsx");
  const { AdvancedControls, CommandRange, CommandToggle, OptionControl, TemperatureStepper } =
    await load("/packages/engine/src/home-assistant-dashboard/control-primitives.tsx");
  const { buildRoomModules } = await load(
    "/packages/engine/src/home-assistant-dashboard/module-model.ts",
  );
  const { RoomModule } = await load("/packages/engine/src/home-assistant-dashboard/RoomModule.tsx");
  const { CameraViewer } = await load("/packages/engine/src/CameraViewer.tsx");
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const { settleRoomSheetHeight } = await load(
    "/packages/engine/src/home-assistant-dashboard/useBottomSheetDrag.ts",
  );
  const { deriveRoomStatusMap } = await load("/packages/engine/src/room-status/model.ts");
  const { roomHeroParallaxOffsets, useRoomHeroParallax } = await load(
    "/packages/engine/src/home-assistant-dashboard/useRoomHeroParallax.ts",
  );

  const { PhysicalToggle, LightFields } = await load(
    "/packages/engine/src/home-assistant-dashboard/light-fields.tsx",
  );
  const { ClimateDialFields } = await load(
    "/packages/engine/src/home-assistant-dashboard/climate-dial-fields.tsx",
  );
  const { MediaFields } = await load(
    "/packages/engine/src/home-assistant-dashboard/media-fields.tsx",
  );

  test("entity controls survive missing, available, and missing state without changing Hook order", async () => {
    await withDom(async ({ root, dom }) => {
      const runtime = connectedRuntimeFixture();
      for (const [Control, entityId] of [
        [PhysicalToggle, "light.demo_ceiling"],
        [LightFields, "light.demo_ceiling"],
        [ClimateDialFields, "climate.demo"],
        [MediaFields, "media_player.demo_speaker"],
      ]) {
        const entity = runtime.entityStates[entityId];
        assert.ok(entity, entityId);
        const render = (state) =>
          React.createElement(Control, {
            binding: { state, label: "Test control" },
            enabled: true,
            tone: "light",
            onCallService: async () => undefined,
          });
        for (const state of [undefined, entity, undefined, entity]) {
          await act(async () => root.render(render(state)));
          assert.equal(
            Boolean(dom.window.document.querySelector("#root").children.length),
            Boolean(state),
          );
        }
        await act(async () => root.render(null));
      }
    });
  });

  const serviceCall = {
    domain: "light",
    service: "turn_on",
    target: { entity_id: "light.demo_ceiling" },
  };

  const toggleCallForPressed = (pressed) => ({
    ...serviceCall,
    service: pressed ? "turn_on" : "turn_off",
  });

  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((nextResolve, nextReject) => {
      resolve = nextResolve;
      reject = nextReject;
    });
    return { promise, resolve, reject };
  };

  const modeledBlindModule = (runtime) => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const room = manifest.floors[0].rooms[0];
    const slot = {
      id: "modeled-blind-primary",
      compatibleDomains: ["cover"],
      required: true,
      autoMap: "manual",
      deviceRole: "primary",
      presentation: { label: "Motorized blind", dashboardRole: "primary" },
    };
    const changed = {
      ...manifest,
      floors: [
        {
          ...manifest.floors[0],
          rooms: [
            {
              ...room,
              dashboardSlots: room.dashboardSlots.filter((slot) => slot.id !== "demo-cover-slot"),
              devices: [
                ...room.devices,
                {
                  id: "modeled-blind",
                  model: "motorized-blind",
                  entitySlots: [slot],
                  placement: {
                    at: [2, 0.103],
                    elevationMeters: 0.82,
                    rotationYRadians: 0,
                    support: { kind: "wall", wallId: "north-wall" },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const profile = connectedProfileFixture();
    const { ["demo-cover-slot"]: _, ...bindings } = profile.entityIdsBySlotId;
    const resolved = resolveHomeAssistantBindings(
      changed,
      { ...profile, entityIdsBySlotId: { ...bindings, [slot.id]: "cover.demo_shade" } },
      runtime,
      stableDeviceRegistry,
    );
    return buildRoomModules(resolved.rooms[room.id]).find(
      (module) => module.deviceSlotId === "modeled-blind",
    );
  };

  test("a modeled blind appears in the room with capability-gated HA controls and honest status", () => {
    for (const scenario of [
      {
        state: "opening",
        position: 62,
        features: 15,
        buttons: 3,
        reading: "Opening · 62% open",
        range: true,
      },
      {
        state: "closing",
        position: null,
        features: 15,
        buttons: 3,
        reading: "Closing",
        range: false,
      },
      {
        state: "closed",
        position: null,
        features: 1,
        buttons: 1,
        reading: "0% open",
        range: false,
      },
      {
        state: "unavailable",
        position: 80,
        features: 15,
        buttons: 3,
        reading: "Unavailable",
        range: false,
      },
    ]) {
      const runtime = connectedRuntimeFixture();
      runtime.entityStates["cover.demo_shade"] = {
        ...runtime.entityStates["cover.demo_shade"],
        state: scenario.state,
        available: scenario.state !== "unavailable",
        attributes: { current_position: scenario.position, supported_features: scenario.features },
      };
      const module = modeledBlindModule(runtime);
      assert.ok(module);
      assert.equal(module.entities[0].entityId, "cover.demo_shade");
      const document = new JSDOM(
        renderToStaticMarkup(
          React.createElement(RoomModule, {
            module,
            canMutate: true,
            focused: false,
            onCallService: async () => {},
          }),
        ),
      ).window.document;
      assert.equal(document.querySelector('[data-module-kind="cover"] h2').textContent, "Shade");
      assert.equal(document.querySelector("output").textContent, scenario.reading);
      assert.equal(document.querySelectorAll("button").length, scenario.buttons);
      assert.equal(!!document.querySelector('input[type="range"]'), scenario.range);
      if (scenario.state === "unavailable") {
        assert.ok([...document.querySelectorAll("button")].every((button) => button.disabled));
      }
    }
  });

  test("blind controls send exact cover services, allow Stop during a pending Open, and disable offline", async () => {
    await withDom(async ({ dom, root }) => {
      const calls = [];
      const pendingOpen = deferred();
      const runtime = connectedRuntimeFixture();
      const render = (canMutate = true) =>
        root.render(
          React.createElement(RoomModule, {
            module: modeledBlindModule(runtime),
            focused: true,
            canMutate,
            onCallService: (call) => {
              calls.push(call);
              return call.service === "open_cover" ? pendingOpen.promise : Promise.resolve();
            },
          }),
        );
      await act(async () => render());
      const button = (action) =>
        dom.window.document.querySelector(`[aria-label="${action} Motorized blind"]`);
      await act(async () => button("Open").click());
      assert.equal(button("Open").disabled, true);
      assert.equal(button("Stop").disabled, false);
      await act(async () => button("Stop").click());
      await act(async () => button("Close").click());
      await act(async () => {
        const range = dom.window.document.querySelector('input[type="range"]');
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
          range,
          "25",
        );
        range.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      assert.deepEqual(
        calls.map(({ service, domain, target, data }) => ({ service, domain, target, data })),
        [
          ...["open_cover", "stop_cover", "close_cover"].map((service) => ({
            service,
            domain: "cover",
            target: { entity_id: "cover.demo_shade" },
            data: undefined,
          })),
          {
            service: "set_cover_position",
            domain: "cover",
            target: { entity_id: "cover.demo_shade" },
            data: { position: 25 },
          },
        ],
      );
      await act(async () => pendingOpen.reject(new Error("private upstream details")));
      assert.match(
        dom.window.document.querySelector('[role="alert"]').textContent,
        /Couldn’t update Open Motorized blind/,
      );
      assert.doesNotMatch(dom.window.document.body.textContent, /private upstream/);
      await act(async () => render(false));
      assert.ok(
        [...dom.window.document.querySelectorAll('button, input[type="range"]')].every(
          (control) => control.disabled,
        ),
      );
      await act(async () => button("Close").click());
      assert.equal(calls.length, 4);
    });
  });

  async function withDom(run) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://dashboard.local/",
    });
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      navigator: globalThis.navigator,
      HTMLElement: globalThis.HTMLElement,
      HTMLInputElement: globalThis.HTMLInputElement,
      Event: globalThis.Event,
      actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement,
      HTMLInputElement: dom.window.HTMLInputElement,
      Event: dom.window.Event,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    dom.window.HTMLElement.prototype.attachEvent = () => undefined;
    dom.window.HTMLElement.prototype.detachEvent = () => undefined;
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await run({ dom, root });
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, {
        window: previous.window,
        document: previous.document,
        navigator: previous.navigator,
        HTMLElement: previous.HTMLElement,
        HTMLInputElement: previous.HTMLInputElement,
        Event: previous.Event,
        IS_REACT_ACT_ENVIRONMENT: previous.actEnvironment,
      });
    }
  }

  const renderDashboard = (
    runtime,
    selectedDeviceId = null,
    profile = connectedProfileFixture(),
  ) => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const resolved = resolveHomeAssistantBindings(manifest, profile, runtime);
    const room = resolved.rooms["demo-room"];
    const roomStatus = deriveRoomStatusMap(manifest, profile, resolved, runtime)["demo-room"];
    return renderToStaticMarkup(
      React.createElement(RoomDashboardPanel, {
        resolved: room,
        roomStatus,
        status: runtime.status,
        canMutate: runtime.canMutate,
        selectedDeviceId,
        onSelectDevice: () => undefined,
        onCallService: async () => undefined,
        onHome: () => undefined,
        onWalk: () => undefined,
        onConnectDevices: () => undefined,
        onReconnect: () => undefined,
        onRetry: () => undefined,
      }),
    );
  };

  const renderModules = (runtime, focusedDeviceId = null) => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const room = resolveHomeAssistantBindings(manifest, connectedProfileFixture(), runtime).rooms[
      "demo-room"
    ];
    const modules = buildRoomModules(room).filter((module) =>
      focusedDeviceId ? module.deviceSlotId === focusedDeviceId : true,
    );
    return renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        ...modules.map((module) =>
          React.createElement(RoomModule, {
            key: module.id,
            module,
            canMutate: runtime.canMutate,
            focused: focusedDeviceId !== null,
            onCallService: async () => undefined,
          }),
        ),
      ),
    );
  };

  const moduleForLabel = (runtime, label) => {
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const room = resolveHomeAssistantBindings(manifest, connectedProfileFixture(), runtime).rooms[
      "demo-room"
    ];
    return buildRoomModules(room).find((module) => module.label === label);
  };

  test("event modules render read-only history and update through reconnects and repeated presses", async () => {
    await withDom(async ({ root, dom }) => {
      const event = {
        entityId: "event.synthetic_remote",
        state: "2026-01-01T12:00:00.123+00:00",
        attributes: { event_type: "short_release" },
        available: true,
        stale: false,
      };
      let calls = 0;
      const render = async (state) =>
        act(async () =>
          root.render(
            React.createElement(RoomModule, {
              module: {
                id: "remote",
                label: "Remote",
                priority: "primary",
                sourceOrder: 0,
                issues: [],
                entities: [
                  { slotId: "remote", label: "Remote", domain: "event", state, issues: [] },
                ],
              },
              canMutate: true,
              focused: true,
              onCallService: async () => {
                calls++;
              },
            }),
          ),
        );
      const reading = () => dom.window.document.querySelector("output")?.textContent;
      await render({ ...event, state: "unknown", available: false });
      assert.equal(reading(), "No event received");
      await render(event);
      assert.match(reading(), /short_release/);
      const initial = reading();
      await render({ ...event, state: "2026-01-01T12:00:05.123+00:00" });
      assert.notEqual(reading(), initial);
      await render({ ...event, stale: true });
      assert.equal(reading(), "Disconnected");
      await render({ ...event, state: "unavailable", available: false });
      assert.equal(reading(), "Unavailable");
      await render(event);
      assert.equal(reading(), initial);
      assert.equal(dom.window.document.querySelectorAll("button,input,select").length, 0);
      assert.equal(calls, 0);
      await act(async () => root.render(null));
    });
  });

  test("renders balanced light, switch, and sensor modules without technical IDs", () => {
    const html = renderModules(connectedRuntimeFixture());
    const document = new JSDOM(html).window.document;
    const moduleIcons = [...document.querySelectorAll(".room-module__icon")];
    assert.ok(html.includes("Main ceiling"));
    assert.ok(html.includes('aria-label="Turn off Main ceiling"'));
    assert.ok(html.includes('aria-label="Main ceiling brightness"'));
    assert.ok(html.includes("Coffee switch"));
    assert.ok(html.includes("Temperature"));
    assert.ok(html.includes("19.7 °C"));
    assert.equal(html.includes("light.demo_ceiling"), false);
    assert.equal(html.includes("sensor.demo_temperature"), false);
    assert.equal(html.includes("Sending…"), false);
    assert.ok(moduleIcons.length > 0);
    for (const icon of moduleIcons) {
      assert.equal(icon.firstElementChild?.tagName.toLowerCase(), "svg");
      assert.equal(icon.textContent, "");
    }
  });

  test("renders a camera room action without exposing its entity ID", async () => {
    await withDom(async ({ dom, root }) => {
      let opens = 0;
      const module = {
        id: "device:fixture-camera-screen",
        label: "Studio camera",
        priority: "secondary",
        sourceOrder: 0,
        deviceSlotId: "fixture-camera-screen",
        entities: [
          {
            entityId: "camera.fixture_camera",
            domain: "camera",
            path: "fixture",
            label: "Studio camera",
            roomId: "fixture-studio",
            slotId: "fixture-camera-entity",
            state: { state: "idle", available: true },
            issues: [],
          },
        ],
        issues: [],
      };
      await act(async () =>
        root.render(
          React.createElement(RoomModule, {
            module,
            canMutate: false,
            focused: false,
            onCallService: async () => undefined,
            onOpenLiveFeed: () => {
              opens += 1;
            },
          }),
        ),
      );
      const html = dom.window.document.getElementById("root").innerHTML;
      assert.ok(html.includes("Studio camera"));
      assert.ok(html.includes("Ready for live view"));
      assert.equal(html.includes("camera.fixture_camera"), false);
      assert.equal(dom.window.document.querySelector(".room-module")?.dataset.gridSize, "1x2");
      assert.ok(
        dom.window.document.querySelector(".room-module__icon.is-camera .room-module__glyph"),
      );
      const liveFeedButton = dom.window.document.querySelector(
        ".room-module__camera-action button",
      );
      assert.equal(liveFeedButton?.classList.contains("is-primary"), true);
      await act(async () => liveFeedButton.click());
      assert.equal(opens, 1);
    });
  });

  test("camera viewer traps the background, closes with Escape, and restores focus", async () => {
    await withDom(async ({ dom, root }) => {
      const returnButton = dom.window.document.createElement("button");
      returnButton.id = "camera-return-target";
      dom.window.document.body.prepend(returnButton);
      returnButton.focus();
      function Harness() {
        const [open, setOpen] = React.useState(true);
        return React.createElement(
          React.Fragment,
          null,
          React.createElement("section", { id: "camera-background" }, "3D home"),
          open &&
            React.createElement(CameraViewer, {
              roomName: "Studio",
              label: "Studio camera",
              media: {
                kind: "camera-stream",
                video: null,
                posterUrl: null,
                state: "connecting",
                transport: "webrtc",
                previewState: "poster",
                error: null,
              },
              onClose: () => setOpen(false),
              onReviewConnections: () => undefined,
            }),
        );
      }
      await act(async () => root.render(React.createElement(Harness)));
      const background = dom.window.document.getElementById("camera-background");
      assert.equal(background.inert, true);
      assert.equal(background.getAttribute("aria-hidden"), "true");
      assert.equal(
        dom.window.document.activeElement?.getAttribute("aria-label"),
        "Close live feed",
      );
      assert.equal(
        dom.window.document.querySelector(".camera-viewer__status")?.textContent.trim(),
        "Connecting…",
      );
      assert.equal(dom.window.document.querySelector(".camera-viewer__sound")?.disabled, true);
      await act(async () => {
        dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
        await Promise.resolve();
      });
      assert.equal(dom.window.document.querySelector(".camera-viewer"), null);
      assert.equal(background.inert, false);
      assert.equal(background.hasAttribute("aria-hidden"), false);
      assert.equal(dom.window.document.activeElement, returnButton);
    });
  });

  test("renders supported complex controls and omits unsupported alternatives", () => {
    const html = renderModules(connectedRuntimeFixture());
    assert.ok(html.includes('aria-label="Decrease Room climate target temperature"'));
    assert.ok(html.includes('aria-label="Increase Room climate target temperature"'));
    assert.ok(html.includes('aria-label="Open Window shade"'));
    assert.ok(html.includes('aria-label="Stop Window shade"'));
    assert.ok(html.includes('aria-label="Close Window shade"'));
    assert.ok(html.includes('aria-label="Window shade position"'));
    assert.ok(html.includes('aria-label="Room fan speed"'));
    assert.ok(html.includes('aria-label="Pause Speaker"'));
    assert.ok(html.includes('aria-label="Speaker volume"'));
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(html.includes("target humidity"));
    assert.ok(html.includes("target temperature"));
    assert.ok(html.includes('aria-label="Clean everywhere with Vacuum"'));
    assert.ok(html.includes('aria-label="Unlock Front lock"'));
    assert.ok(html.includes("Arm vacation"));
    assert.ok(html.includes('aria-label="Water valve position"'));
    assert.ok(html.includes("Duration (seconds)"));
    assert.ok(html.includes("Cycle current option"));
    assert.ok(html.includes("Level current value"));
    assert.ok(html.includes('aria-label="Press Start"'));
    assert.equal(html.includes("alarm_trigger"), false);
    assert.equal(html.includes("send_command"), false);
    assert.equal(html.includes("locate"), false);
    for (const entityId of [
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
    ])
      assert.equal(html.includes(entityId), false);
  });

  test("omits every unadvertised extended-domain capability", () => {
    const runtime = connectedRuntimeFixture();
    for (const entityId of [
      "humidifier.demo",
      "water_heater.demo",
      "vacuum.demo",
      "lock.demo_front_door",
      "alarm_control_panel.demo",
      "valve.demo_water",
      "siren.demo",
    ])
      runtime.entityStates[entityId].attributes.supported_features = 0;
    const document = new JSDOM(renderModules(runtime)).window.document;
    const module = (label) =>
      [...document.querySelectorAll(".room-module")].find(
        (article) => article.querySelector("h2")?.textContent === label,
      );
    assert.equal(module("Humidifier").querySelector("select"), null);
    assert.equal(module("Water heater").querySelector("button, input, select"), null);
    assert.equal(module("Vacuum").querySelector("input, select"), null);
    for (const action of ["Clean everywhere", "Pause", "Stop", "Dock"]) {
      assert.equal(module("Vacuum").querySelector(`button[aria-label^='${action} ']`), null);
    }
    assert.equal(module("Front lock").querySelector("button[aria-label='Open Front lock']"), null);
    assert.equal(module("Alarm").querySelector("button"), null);
    assert.equal(module("Water valve").querySelector("button, input"), null);
    assert.equal(module("Siren").querySelector("button, input, select"), null);
  });

  test("lock open requires a fresh five-second confirmation and keeps its code ephemeral", async () => {
    await withDom(async ({ dom, root }) => {
      const runtime = connectedRuntimeFixture();
      const calls = [];
      await act(async () =>
        root.render(
          React.createElement(RoomModule, {
            module: moduleForLabel(runtime, "Front lock"),
            canMutate: true,
            focused: true,
            onCallService: async (call) => {
              calls.push(call);
            },
          }),
        ),
      );
      const open = () => dom.window.document.querySelector("button[aria-label='Open Front lock']");
      const originalNow = Date.now;
      const base = originalNow();
      Date.now = () => base;
      try {
        await act(async () => open().click());
        assert.equal(open().textContent, "Confirm open");
        assert.equal(calls.length, 0);
        Date.now = () => base + 5_001;
        await act(async () => open().click());
        assert.equal(calls.length, 0, "an expired confirmation starts a new window");
        Date.now = () => base + 5_002;
        open().focus();
        await act(async () => open().click());
      } finally {
        Date.now = originalNow;
      }
      const dialog = dom.window.document.querySelector(".protected-code-dialog");
      assert.equal(dialog?.getAttribute("aria-modal"), "true");
      const input = dialog.querySelector("input");
      assert.equal(dom.window.document.activeElement, input);
      assert.equal(input.inputMode, "numeric");
      input.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
      );
      assert.equal(
        dom.window.document.activeElement,
        dialog.querySelector("button[type='submit']"),
      );
      dom.window.document.activeElement.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
      );
      assert.equal(dom.window.document.activeElement, input);
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
          input,
          "1234",
        );
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      await act(async () =>
        dialog
          .querySelector("form")
          .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
      );
      assert.deepEqual(calls, [
        {
          domain: "lock",
          service: "open",
          data: { code: "1234" },
          target: { entity_id: "lock.demo_front_door" },
        },
      ]);
      assert.equal(dom.window.document.querySelector(".protected-code-dialog"), null);
      assert.equal(dom.window.document.body.textContent.includes("1234"), false);
      assert.equal(dom.window.document.activeElement, open());
    });
  });

  test("alarm code rules match Home Assistant arm and disarm behavior", async () => {
    await withDom(async ({ dom, root }) => {
      const runtime = connectedRuntimeFixture();
      const calls = [];
      const render = () =>
        root.render(
          React.createElement(RoomModule, {
            module: moduleForLabel(runtime, "Alarm"),
            canMutate: true,
            focused: true,
            onCallService: async (call) => {
              calls.push(call);
            },
          }),
        );
      await act(async () => render());
      const away = () =>
        [...dom.window.document.querySelectorAll("button")].find(
          (button) => button.textContent === "Arm away",
        );
      await act(async () => away().click());
      let dialog = dom.window.document.querySelector(".protected-code-dialog");
      assert.ok(dialog);
      let input = dialog.querySelector("input");
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
          input,
          "2468",
        );
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      await act(async () =>
        dialog
          .querySelector("form")
          .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
      );
      assert.equal(calls[0].service, "alarm_arm_away");
      assert.deepEqual(calls[0].data, { code: "2468" });
      assert.equal(dom.window.document.body.textContent.includes("2468"), false);

      runtime.entityStates["alarm_control_panel.demo"].attributes.code_arm_required = false;
      await act(async () => render());
      await act(async () => away().click());
      assert.equal(dom.window.document.querySelector(".protected-code-dialog"), null);
      assert.equal(calls.at(-1).service, "alarm_arm_away");
      assert.equal(calls.at(-1).data, undefined);

      runtime.entityStates["alarm_control_panel.demo"].state = "armed_away";
      await act(async () => render());
      const disarm = [...dom.window.document.querySelectorAll("button")].find(
        (button) => button.textContent === "Disarm",
      );
      await act(async () => disarm.click());
      dialog = dom.window.document.querySelector(".protected-code-dialog");
      assert.ok(dialog, "disarm still requires the advertised code format");
    });
  });

  test("button press is stateless, single-shot while pending, and reports completion", async () => {
    await withDom(async ({ dom, root }) => {
      const pending = deferred();
      const calls = [];
      await act(async () =>
        root.render(
          React.createElement(RoomModule, {
            module: moduleForLabel(connectedRuntimeFixture(), "Start"),
            canMutate: true,
            focused: true,
            onCallService: (call) => {
              calls.push(call);
              return pending.promise;
            },
          }),
        ),
      );
      const button = dom.window.document.querySelector("button[aria-label='Press Start']");
      await act(async () => {
        button.click();
        button.click();
      });
      assert.equal(calls.length, 1);
      assert.equal(button.disabled, true);
      assert.equal(button.hasAttribute("aria-pressed"), false);
      assert.match(dom.window.document.querySelector("[role='status']").textContent, /Sending/);
      await act(async () => pending.resolve());
      assert.equal(button.disabled, false);
      assert.equal(dom.window.document.querySelector("[role='status']").textContent, "Sent");
      assert.deepEqual(calls[0], {
        domain: "button",
        service: "press",
        data: undefined,
        target: { entity_id: "button.demo_start" },
      });
    });
  });

  test("renders VTherm target, room, and regulated AC temperatures in the reference composition", () => {
    const html = renderModules(connectedRuntimeFixture());
    const document = new JSDOM(html).window.document;
    const vtherm = [...document.querySelectorAll(".room-module")].find(
      (article) => article.querySelector("h2")?.textContent === "Room climate",
    );

    assert.equal(vtherm?.dataset.moduleKind, "vtherm");
    assert.equal(vtherm?.dataset.gridSize, "2x2");
    assert.ok(vtherm?.querySelector(".room-module__icon.is-climate .room-module__glyph"));
    assert.equal(vtherm?.querySelector(".room-module__icon")?.textContent, "");
    assert.equal(
      vtherm?.querySelector("output[aria-label='Room climate target temperature']")?.textContent,
      "20.5",
    );
    assert.equal(
      vtherm?.querySelector("output[aria-label='Room climate current temperature']")?.textContent,
      "19.7 °C",
    );
    assert.equal(
      vtherm?.querySelector("output[aria-label='Room climate AC target temperature']")?.textContent,
      "22.5 °C",
    );
    assert.equal(
      vtherm?.querySelector("button[aria-label='Set Room climate preset to eco']")?.textContent,
      "Eco",
    );
    assert.equal(
      vtherm
        ?.querySelector("button[aria-label='Set Room climate mode to heat']")
        ?.getAttribute("aria-pressed"),
      "true",
    );
    const valueArc = vtherm?.querySelector(".vtherm-dial__value");
    const [arcLength] = valueArc?.getAttribute("stroke-dasharray")?.split(" ").map(Number) ?? [];
    assert.ok(arcLength > 0 && arcLength < 75);
    assert.ok(Number.isFinite(Number(valueArc?.getAttribute("stroke-dashoffset"))));
    assert.equal(vtherm?.querySelectorAll(".vtherm-dial__marker").length, 2);
    assert.equal(vtherm?.querySelector("[aria-label='No activity']"), null);
    assert.equal(vtherm?.querySelector("[aria-label='Window closed']"), null);
    assert.equal(vtherm?.querySelector("[aria-label='Safety normal']"), null);
    assert.equal(vtherm?.querySelector("[aria-label='Power normal']"), null);
  });

  test("moves the VTherm dial immediately when its target temperature changes", async () => {
    await withDom(async ({ dom, root }) => {
      const runtime = connectedRuntimeFixture();
      const manifest = connectedManifestFixture(neutralDemoManifest);
      const room = resolveHomeAssistantBindings(manifest, connectedProfileFixture(), runtime).rooms[
        "demo-room"
      ];
      const module = buildRoomModules(room).find(({ id }) => id === "slot:demo-climate-slot");

      await act(async () =>
        root.render(
          React.createElement(RoomModule, {
            module,
            canMutate: true,
            focused: false,
            onCallService: async () => undefined,
          }),
        ),
      );

      const arc = dom.window.document.querySelector(".vtherm-dial__value");
      const currentMarker = dom.window.document.querySelector(".vtherm-dial__marker--current");
      const targetMarker = dom.window.document.querySelector(".vtherm-dial__marker--target");
      const before = {
        dash: arc.getAttribute("stroke-dasharray"),
        currentX: currentMarker.getAttribute("cx"),
        currentY: currentMarker.getAttribute("cy"),
        x: targetMarker.getAttribute("cx"),
        y: targetMarker.getAttribute("cy"),
      };

      await act(async () => {
        dom.window.document
          .querySelector("button[aria-label='Increase Room climate target temperature']")
          .click();
        await Promise.resolve();
      });

      assert.equal(
        dom.window.document.querySelector("output[aria-label='Room climate target temperature']")
          .value,
        "21",
      );
      assert.deepEqual(
        {
          x: currentMarker.getAttribute("cx"),
          y: currentMarker.getAttribute("cy"),
        },
        {
          x: before.currentX,
          y: before.currentY,
        },
      );
      assert.notDeepEqual(
        {
          dash: arc.getAttribute("stroke-dasharray"),
          x: targetMarker.getAttribute("cx"),
          y: targetMarker.getAttribute("cy"),
        },
        before,
      );
    });
  });

  test("assigns content-aware mosaic footprints to every room module kind", () => {
    const runtime = connectedRuntimeFixture();
    const document = new JSDOM(renderModules(runtime)).window.document;
    const gridSizeFor = (label) =>
      [...document.querySelectorAll(".room-module")].find(
        (article) => article.querySelector("h2")?.textContent === label,
      )?.dataset.gridSize;

    assert.deepEqual(
      {
        light: gridSizeFor("Ceiling light"),
        vtherm: gridSizeFor("Room climate"),
        speaker: gridSizeFor("Speaker"),
        switch: gridSizeFor("Coffee switch"),
        inputBoolean: gridSizeFor("Quiet mode"),
        cover: gridSizeFor("Window shade"),
        fan: gridSizeFor("Room fan"),
        sensor: gridSizeFor("Temperature"),
        humidifier: gridSizeFor("Humidifier"),
        waterHeater: gridSizeFor("Water heater"),
        vacuum: gridSizeFor("Vacuum"),
        lock: gridSizeFor("Front lock"),
        alarm: gridSizeFor("Alarm"),
        valve: gridSizeFor("Water valve"),
        siren: gridSizeFor("Siren"),
        select: gridSizeFor("Cycle"),
        number: gridSizeFor("Level"),
        button: gridSizeFor("Start"),
      },
      {
        light: "2x1",
        vtherm: "2x2",
        speaker: "1x2",
        switch: "2x1",
        inputBoolean: "2x1",
        cover: "1x2",
        fan: "2x1",
        sensor: "1x1",
        humidifier: "2x2",
        waterHeater: "2x2",
        vacuum: "1x2",
        lock: "2x1",
        alarm: "1x2",
        valve: "1x2",
        siren: "2x1",
        select: "1x2",
        number: "1x2",
        button: "2x1",
      },
    );

    const binarySensor = renderToStaticMarkup(
      React.createElement(RoomModule, {
        module: {
          id: "slot:fixture-presence",
          label: "Presence",
          priority: "diagnostic",
          sourceOrder: 0,
          entities: [
            {
              entityId: "binary_sensor.fixture_presence",
              domain: "binary_sensor",
              path: "fixture",
              label: "Presence",
              roomId: "fixture-room",
              slotId: "fixture-presence",
              areaId: "fixture-room",
              deviceId: null,
              state: {
                entityId: "binary_sensor.fixture_presence",
                state: "off",
                attributes: { device_class: "motion" },
                available: true,
                stale: false,
              },
              issues: [],
            },
          ],
          issues: [],
        },
        canMutate: false,
        focused: false,
        onCallService: async () => undefined,
      }),
    );
    assert.equal(
      new JSDOM(binarySensor).window.document.querySelector(".room-module")?.dataset.gridSize,
      "1x1",
    );
    assert.ok(
      new JSDOM(binarySensor).window.document.querySelector(
        ".room-module__icon.is-binary_sensor .room-module__glyph",
      ),
    );

    runtime.entityRegistry.find((entry) => entry.entity_id === "climate.demo").platform =
      "generic_thermostat";
    const genericDocument = new JSDOM(renderModules(runtime)).window.document;
    const genericClimate = [...genericDocument.querySelectorAll(".room-module")].find(
      (article) => article.querySelector("h2")?.textContent === "Room climate",
    );
    assert.equal(genericClimate?.dataset.moduleKind, "climate");
    assert.equal(genericClimate?.dataset.gridSize, "2x2");
    assert.ok(genericClimate?.querySelector(".vtherm-dial__value"));
    assert.equal(
      genericClimate?.querySelector("button[aria-label='Set Room climate swing mode to vertical']")
        ?.textContent,
      "Vertical",
    );
  });

  test("vacuum module exposes map rooms as direct cleaning actions", async () => {
    await withDom(async ({ dom, root }) => {
      const runtime = connectedRuntimeFixture();
      const room = resolveHomeAssistantBindings(
        connectedManifestFixture(neutralDemoManifest),
        connectedProfileFixture(),
        runtime,
        stableDeviceRegistry,
      ).rooms["demo-room"];
      const module = buildRoomModules(room).find(({ label }) => label === "Vacuum");
      const calls = [];

      await act(async () =>
        root.render(
          React.createElement(RoomModule, {
            module,
            canMutate: true,
            focused: true,
            onCallService: async (call) => calls.push(call),
          }),
        ),
      );

      assert.equal(dom.window.document.querySelector(".vacuum-status")?.textContent, "Docked86%");
      assert.deepEqual(
        [...dom.window.document.querySelectorAll(".vacuum-room-action button")].map((button) =>
          button.getAttribute("aria-label"),
        ),
        ["Clean Kitchen", "Clean Room 6"],
      );
      await act(async () => {
        dom.window.document.querySelector("button[aria-label='Clean Kitchen']").click();
        await Promise.resolve();
      });
      assert.deepEqual(calls, [
        {
          domain: "dreame_vacuum",
          service: "vacuum_clean_segment",
          data: { segments: [8] },
          target: { entity_id: "vacuum.demo" },
        },
      ]);
    });
  });

  test("VTherm preset buttons issue the established climate preset service call", async () => {
    await withDom(async ({ dom, root }) => {
      const runtime = connectedRuntimeFixture();
      const manifest = connectedManifestFixture(neutralDemoManifest);
      const room = resolveHomeAssistantBindings(manifest, connectedProfileFixture(), runtime).rooms[
        "demo-room"
      ];
      const module = buildRoomModules(room).find(({ id }) => id === "slot:demo-climate-slot");
      const calls = [];
      await act(async () =>
        root.render(
          React.createElement(RoomModule, {
            module,
            canMutate: true,
            focused: false,
            onCallService: async (call) => {
              calls.push(call);
            },
          }),
        ),
      );

      const eco = dom.window.document.querySelector(
        "button[aria-label='Set Room climate preset to eco']",
      );
      assert.equal(eco?.tagName, "BUTTON");
      await act(async () => {
        eco.click();
        await Promise.resolve();
      });
      assert.deepEqual(calls, [
        {
          domain: "climate",
          service: "set_preset_mode",
          data: { preset_mode: "eco" },
          target: { entity_id: "climate.demo" },
        },
      ]);
      assert.equal(eco.getAttribute("aria-pressed"), "true");
    });
  });

  test("VTherm selectors keep one menu open and scroll its options into view", async () => {
    await withDom(async ({ dom, root }) => {
      const runtime = connectedRuntimeFixture();
      const manifest = connectedManifestFixture(neutralDemoManifest);
      const room = resolveHomeAssistantBindings(manifest, connectedProfileFixture(), runtime).rooms[
        "demo-room"
      ];
      const module = buildRoomModules(room).find(({ id }) => id === "slot:demo-climate-slot");
      const scrolled = [];
      dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) {
        scrolled.push({ element: this, options });
      };

      await act(async () =>
        root.render(
          React.createElement(RoomModule, {
            module,
            canMutate: true,
            focused: false,
            onCallService: async () => undefined,
          }),
        ),
      );

      const summaries = [...dom.window.document.querySelectorAll(".vtherm-picker summary")];
      await act(async () => {
        summaries[0].click();
        await Promise.resolve();
      });
      assert.equal(summaries[0].closest("details").open, true);

      await act(async () => {
        summaries[1].click();
        await Promise.resolve();
      });
      assert.equal(summaries[0].closest("details").open, false);
      assert.equal(summaries[1].closest("details").open, true);
      assert.equal(scrolled.at(-1)?.element.classList.contains("vtherm-picker__menu"), true);
      assert.deepEqual(scrolled.at(-1)?.options, { block: "nearest", inline: "nearest" });
    });
  });

  for (const [current, modes, expected] of [
    [25, ["off", "heat", "cool"], "cool"],
    [18, ["off", "heat", "cool"], "heat"],
    [20, ["off", "heat", "cool"], "heat"],
    [undefined, ["off", "heat", "cool"], "heat"],
    [25, ["off", "heat"], "heat"],
    [18, ["off", "cool"], "cool"],
  ]) {
    test(`VTherm power toggles on to ${expected} at ${current} with ${modes}`, async () => {
      await withDom(async ({ dom, root }) => {
        const runtime = connectedRuntimeFixture();
        const entity = runtime.entityStates["climate.demo"];
        entity.state = "off";
        entity.attributes = {
          ...entity.attributes,
          temperature: 20,
          current_temperature: current,
          hvac_modes: modes,
        };
        const room = resolveHomeAssistantBindings(
          connectedManifestFixture(neutralDemoManifest),
          connectedProfileFixture(),
          runtime,
        ).rooms["demo-room"];
        const module = buildRoomModules(room).find(({ id }) => id === "slot:demo-climate-slot");
        const calls = [];
        await act(async () =>
          root.render(
            React.createElement(RoomModule, {
              module,
              canMutate: true,
              focused: false,
              onCallService: async (call) => {
                calls.push(call);
              },
            }),
          ),
        );
        const power = dom.window.document.querySelector(".vtherm-off");
        assert.equal(power.disabled, false);
        assert.equal(power.getAttribute("aria-label"), "Turn on Room climate");
        await act(async () => power.click());
        assert.equal(calls[0].service, "set_hvac_mode");
        assert.deepEqual(calls[0].data, { hvac_mode: expected });
        assert.equal(power.getAttribute("aria-label"), "Turn off Room climate");
        await act(async () => power.click());
        assert.deepEqual(calls[1].data, { hvac_mode: "off" });
      });
    });
  }

  test("an off VTherm leaves every active HVAC mode unselected", () => {
    const runtime = connectedRuntimeFixture();
    runtime.entityStates["climate.demo"] = {
      ...runtime.entityStates["climate.demo"],
      state: "off",
    };
    const document = new JSDOM(renderModules(runtime)).window.document;
    const vtherm = document.querySelector(".room-module[data-module-kind='vtherm']");

    assert.equal(
      vtherm
        ?.querySelector("button[aria-label='Set Room climate mode to heat']")
        ?.getAttribute("aria-pressed"),
      "false",
    );
    assert.equal(
      vtherm
        ?.querySelector("button[aria-label='Set Room climate mode to cool']")
        ?.getAttribute("aria-pressed"),
      "false",
    );
  });

  test("a climate temperature step uses the established coalesced service call", async () => {
    await withDom(async ({ dom, root }) => {
      const runtime = connectedRuntimeFixture();
      const manifest = connectedManifestFixture(neutralDemoManifest);
      const room = resolveHomeAssistantBindings(manifest, connectedProfileFixture(), runtime).rooms[
        "demo-room"
      ];
      const module = buildRoomModules(room).find(({ id }) => id === "slot:demo-climate-slot");
      const calls = [];
      await act(async () =>
        root.render(
          React.createElement(RoomModule, {
            module,
            canMutate: true,
            focused: false,
            onCallService: async (call) => {
              calls.push(call);
            },
          }),
        ),
      );

      const increase = dom.window.document.querySelector(
        "button[aria-label='Increase Room climate target temperature']",
      );
      assert.equal(increase.tagName, "BUTTON");
      await act(async () => {
        increase.click();
        await Promise.resolve();
      });
      assert.deepEqual(calls, [
        {
          domain: "climate",
          service: "set_temperature",
          data: { temperature: 21 },
          target: { entity_id: "climate.demo" },
          delivery: { mode: "coalesced-value", channel: "temperature" },
        },
      ]);
    });
  });

  test("renders one direct module grid without old navigation or technical wording", () => {
    const html = renderDashboard(connectedRuntimeFixture());
    const document = new JSDOM(html).window.document;
    assert.ok(html.includes("Demo room"));
    assert.ok(html.includes("room-control-sheet__grid"));
    assert.equal(
      document.querySelector(".room-control-sheet__hero img")?.getAttribute("src"),
      "http://fixture-ha.local:8123/api/image/serve/demo-room/original",
    );
    assert.ok(html.indexOf("Main ceiling") < html.indexOf("Room climate"));
    assert.equal(html.includes("light.unmodeled_path"), false);
    assert.ok(html.includes('type="range"'));
    assert.ok(html.includes("Walk inside"));
    const navigation = document.querySelector(".room-control-sheet__nav");
    assert.equal(navigation.firstElementChild.className, "room-control-sheet__actions");
    assert.equal(navigation.lastElementChild.getAttribute("aria-label"), "Close room controls");
    for (const removed of [
      "Connected",
      "mapped entity",
      "Primary controls",
      "More controls",
      "Status &amp; diagnostics",
      "Room controls",
    ])
      assert.equal(html.includes(removed), false);
  });

  test("uses the resolved Home Assistant area name in room controls", () => {
    const runtime = connectedRuntimeFixture();
    runtime.areas.find((area) => area.area_id === "demo_room").name = "Fixture living";
    const html = renderDashboard(runtime);
    const document = new JSDOM(html).window.document;
    assert.equal(
      document.querySelector(".room-control-sheet")?.getAttribute("aria-label"),
      "Fixture living controls",
    );
    assert.equal(
      document.querySelector(".room-control-sheet__title h1")?.textContent,
      "Fixture living",
    );
    assert.equal(
      document.querySelector(".room-control-sheet__title")?.textContent.includes("Demo room"),
      false,
    );
  });

  test("resolves relative and absolute Home Assistant room pictures without credentials", () => {
    assert.equal(
      resolveHomeAssistantPictureUrl(
        "/api/image/serve/demo-room/original",
        "http://fixture-ha.local:8123",
      ),
      "http://fixture-ha.local:8123/api/image/serve/demo-room/original",
    );
    assert.equal(
      resolveHomeAssistantPictureUrl(
        "https://images.example/room.jpg",
        "http://fixture-ha.local:8123",
      ),
      "https://images.example/room.jpg",
    );
    assert.equal(resolveHomeAssistantPictureUrl(null, "http://fixture-ha.local:8123"), null);
  });

  test("keeps an empty room calm with an explicit device connection action", () => {
    const emptyProfile = { ...connectedProfileFixture(), entityIdsBySlotId: {} };
    const document = new JSDOM(renderDashboard(connectedRuntimeFixture(), null, emptyProfile))
      .window.document;
    const empty = document.querySelector(".room-control-sheet__empty");
    assert.equal(empty?.querySelector("h2")?.textContent, "No controls connected");
    assert.equal(empty?.querySelector("button")?.textContent, "Connect devices");
    assert.equal(document.querySelector(".room-control-sheet__attention"), null);
    assert.equal(document.body.textContent.includes("need attention"), false);
  });

  test("focused device view reuses the same module component", () => {
    const html = renderDashboard(connectedRuntimeFixture(), "fixture-light-device");
    assert.ok(html.includes("room-module is-focused"));
    assert.ok(html.includes("Main ceiling"));
    assert.equal(html.includes("Room climate"), false);
    assert.equal(html.includes("mapped entity"), false);
    assert.equal(html.includes("light.demo_ceiling"), false);
  });

  test("renders the parent room status in room and focused-device heroes", () => {
    const roomHtml = renderDashboard(connectedRuntimeFixture());
    const deviceHtml = renderDashboard(connectedRuntimeFixture(), "fixture-light-device");
    for (const html of [roomHtml, deviceHtml]) {
      assert.match(html, /aria-label="Temperature 19.7 °C"/);
      assert.match(html, /aria-label="Humidity 48 %"/);
      assert.match(html, /aria-label="Heating"/);
      assert.match(html, /aria-label="Lights on"/);
    }
  });

  test("calculates subtle bounded parallax and coordinated fade values", () => {
    assert.deepEqual(roomHeroParallaxOffsets(0, 320), {
      photoPercent: -4,
      foregroundPixels: 0,
      visualOpacity: 1,
      foregroundOpacity: 1,
    });
    assert.deepEqual(roomHeroParallaxOffsets(160, 320), {
      photoPercent: 0,
      foregroundPixels: 4,
      visualOpacity: 0.8,
      foregroundOpacity: 0.41666666666666663,
    });
    assert.deepEqual(roomHeroParallaxOffsets(999, 320), {
      photoPercent: 4,
      foregroundPixels: 8,
      visualOpacity: 0.6,
      foregroundOpacity: 0,
    });
  });

  test("coalesces hero scroll work and disables offsets when requested or reduced motion", async () => {
    await withDom(async ({ dom, root }) => {
      const frames = [];
      const mediaListeners = new Set();
      const reducedMotion = {
        matches: false,
        addEventListener: (_type, listener) => mediaListeners.add(listener),
        removeEventListener: (_type, listener) => mediaListeners.delete(listener),
      };
      dom.window.matchMedia = () => reducedMotion;
      dom.window.requestAnimationFrame = (callback) => {
        frames.push(callback);
        return frames.length;
      };
      dom.window.cancelAnimationFrame = () => undefined;

      function Harness({ enabled, resetKey }) {
        const scrollRef = React.useRef(null);
        const heroRef = React.useRef(null);
        useRoomHeroParallax({ scrollRef, heroRef, enabled, resetKey });
        return React.createElement(
          "div",
          { ref: scrollRef, "data-scroll": "" },
          React.createElement("header", { ref: heroRef, "data-hero": "" }),
        );
      }

      await act(async () =>
        root.render(
          React.createElement(Harness, {
            enabled: true,
            resetKey: "room-a",
          }),
        ),
      );
      const scroll = dom.window.document.querySelector("[data-scroll]");
      const hero = dom.window.document.querySelector("[data-hero]");
      Object.defineProperty(hero, "offsetHeight", { value: 200 });
      scroll.scrollTop = 90;
      scroll.dispatchEvent(new dom.window.Event("scroll"));
      scroll.dispatchEvent(new dom.window.Event("scroll"));
      assert.equal(frames.length, 1, "two scroll events share one animation frame");
      let timestamp = 0;
      while (frames.length > 0 && timestamp < 2000) {
        const callback = frames.shift();
        timestamp += 16;
        await act(async () => callback(timestamp));
      }
      assert.ok(timestamp > 16, "scroll motion is eased over multiple frames");
      assert.equal(hero.style.getPropertyValue("--room-photo-parallax-y"), "-0.3999999999999999%");
      assert.equal(hero.style.getPropertyValue("--room-foreground-parallax-y"), "3.6px");
      assert.equal(hero.style.getPropertyValue("--room-hero-visual-opacity"), "0.82");
      assert.equal(hero.style.getPropertyValue("--room-foreground-opacity"), "0.48611111111111105");

      await act(async () =>
        root.render(
          React.createElement(Harness, {
            enabled: false,
            resetKey: "fallback",
          }),
        ),
      );
      assert.equal(hero.style.getPropertyValue("--room-photo-parallax-y"), "0%");
      assert.equal(hero.style.getPropertyValue("--room-foreground-parallax-y"), "0px");
      assert.equal(hero.style.getPropertyValue("--room-hero-visual-opacity"), "1");
      assert.equal(hero.style.getPropertyValue("--room-foreground-opacity"), "1");

      reducedMotion.matches = true;
      await act(async () =>
        root.render(
          React.createElement(Harness, {
            enabled: true,
            resetKey: "room-b",
          }),
        ),
      );
      assert.equal(hero.style.getPropertyValue("--room-photo-parallax-y"), "0%");
      assert.equal(hero.style.getPropertyValue("--room-foreground-parallax-y"), "0px");
      assert.equal(hero.style.getPropertyValue("--room-hero-visual-opacity"), "1");
      assert.equal(hero.style.getPropertyValue("--room-foreground-opacity"), "1");
    });
  });

  test("hides healthy status and exposes only actionable unhealthy status", () => {
    assert.equal(renderDashboard(connectedRuntimeFixture()).includes("connection-problem"), false);
    const reconnecting = renderDashboard(
      connectedRuntimeFixture({ status: "reconnecting", canMutate: false }),
    );
    assert.ok(reconnecting.includes('aria-label="Home Assistant is reconnecting"'));
    assert.match(reconnecting, /<details class="connection-problem[^"]*" aria-live="polite">/);
    assert.equal(reconnecting.includes("Connected"), false);
    const failed = renderDashboard(connectedRuntimeFixture({ status: "error", canMutate: false }));
    assert.ok(failed.includes("Retry connection"));
  });

  test("keeps unavailable and incompatible modules visible with safe wording", () => {
    const runtime = connectedRuntimeFixture({ status: "reconnecting", canMutate: false });
    runtime.entityStates = Object.fromEntries(
      Object.entries(runtime.entityStates).map(([id, state]) => [id, { ...state, stale: true }]),
    );
    runtime.entityStates["sensor.demo_temperature"] = {
      ...runtime.entityStates["sensor.demo_temperature"],
      state: "unavailable",
      available: false,
    };
    runtime.entityRegistry.find((entry) => entry.entity_id === "climate.demo").area_id = "outside";
    const html = renderDashboard(runtime);
    assert.ok(html.includes("reconnecting"));
    assert.ok(html.includes("currently unavailable"));
    assert.ok(html.includes("assigned to a different Home Assistant area"));
    assert.ok(html.includes('disabled=""'));
    assert.equal(html.includes("sensor.demo_temperature"), false);
  });

  test("focused Back and Escape restore room hierarchy and scroll position", async () => {
    await withDom(async ({ dom, root }) => {
      const runtime = connectedRuntimeFixture();
      const manifest = connectedManifestFixture(neutralDemoManifest);
      const profile = connectedProfileFixture();
      const resolved = resolveHomeAssistantBindings(manifest, profile, runtime);
      const room = resolved.rooms["demo-room"];
      const roomStatus = deriveRoomStatusMap(manifest, profile, resolved, runtime)["demo-room"];
      let homeCalls = 0;
      const Harness = () => {
        const [selectedDeviceId, setSelectedDeviceId] = React.useState(null);
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "button",
            {
              type: "button",
              id: "focus-light",
              onClick: () => setSelectedDeviceId("fixture-light-device"),
            },
            "Focus light",
          ),
          React.createElement(RoomDashboardPanel, {
            resolved: room,
            roomStatus,
            status: runtime.status,
            canMutate: runtime.canMutate,
            selectedDeviceId,
            onSelectDevice: setSelectedDeviceId,
            onCallService: async () => undefined,
            onHome: () => {
              homeCalls += 1;
            },
            onWalk: () => undefined,
            onConnectDevices: () => undefined,
            onReconnect: () => undefined,
            onRetry: () => undefined,
          }),
        );
      };
      await act(async () => root.render(React.createElement(Harness)));
      const focus = dom.window.document.getElementById("focus-light");
      const scroll = dom.window.document.querySelector(".room-control-sheet__scroll");
      scroll.scrollTop = 120;
      scroll.dispatchEvent(new dom.window.Event("scroll", { bubbles: true }));

      await act(async () => focus.click());
      assert.ok(dom.window.document.querySelector(".room-module.is-focused"));
      await act(async () =>
        dom.window.document.querySelector("button[aria-label='Back to room']").click(),
      );
      assert.equal(dom.window.document.querySelector(".room-control-sheet__scroll").scrollTop, 120);

      await act(async () => focus.click());
      await act(async () => {
        dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
      });
      assert.equal(dom.window.document.querySelector(".room-module.is-focused"), null);
      await act(async () => {
        dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
      });
      assert.equal(homeCalls, 1);
      await act(async () =>
        dom.window.document.querySelector("button[aria-label='Close room controls']").click(),
      );
      assert.equal(homeCalls, 2);
    });
  });

  test("a scene-opened device presents a close action without room navigation", () => {
    const runtime = connectedRuntimeFixture();
    const manifest = connectedManifestFixture(neutralDemoManifest);
    const profile = connectedProfileFixture();
    const resolved = resolveHomeAssistantBindings(manifest, profile, runtime);
    const room = resolved.rooms["demo-room"];
    const roomStatus = deriveRoomStatusMap(manifest, profile, resolved, runtime)["demo-room"];
    const html = renderToStaticMarkup(
      React.createElement(RoomDashboardPanel, {
        resolved: room,
        roomStatus,
        status: runtime.status,
        canMutate: runtime.canMutate,
        selectedDeviceId: "fixture-light-device",
        onSelectDevice: () => undefined,
        onCallService: async () => undefined,
        onHome: () => undefined,
        onWalk: () => undefined,
        onConnectDevices: () => undefined,
        onReconnect: () => undefined,
        onRetry: () => undefined,
        deviceOverlay: true,
      }),
    );

    assert.match(html, /aria-label="Close device controls"/);
    assert.match(html, /class="device-control-overlay__backdrop"/);
    assert.match(html, /data-device-overlay="true"/);
    assert.match(html, /role="dialog"/);
    assert.doesNotMatch(html, /aria-label="Back to room"/);
    assert.doesNotMatch(html, />Walk inside</);
  });

  test("a scene-opened device routes Escape through its overlay dismissal", async () => {
    await withDom(async ({ dom, root }) => {
      const runtime = connectedRuntimeFixture();
      const manifest = connectedManifestFixture(neutralDemoManifest);
      const profile = connectedProfileFixture();
      const resolved = resolveHomeAssistantBindings(manifest, profile, runtime);
      const room = resolved.rooms["demo-room"];
      const roomStatus = deriveRoomStatusMap(manifest, profile, resolved, runtime)["demo-room"];
      let escapeCalls = 0;
      let selectCalls = 0;

      await act(async () =>
        root.render(
          React.createElement(RoomDashboardPanel, {
            resolved: room,
            roomStatus,
            status: runtime.status,
            canMutate: runtime.canMutate,
            selectedDeviceId: "fixture-light-device",
            onSelectDevice: () => {
              selectCalls += 1;
            },
            onCallService: async () => undefined,
            onHome: () => undefined,
            onWalk: () => undefined,
            onConnectDevices: () => undefined,
            onReconnect: () => undefined,
            onRetry: () => undefined,
            deviceOverlay: true,
            onEscape: () => {
              escapeCalls += 1;
            },
          }),
        ),
      );

      const escapeEvent = new dom.window.KeyboardEvent("keydown", {
        key: "Escape",
        cancelable: true,
      });
      await act(async () => {
        dom.window.dispatchEvent(escapeEvent);
      });

      assert.equal(escapeCalls, 1);
      assert.equal(selectCalls, 0);
      assert.equal(escapeEvent.defaultPrevented, true);
    });
  });

  test("settles the mobile sheet at approved snaps or dismisses below the first snap", () => {
    assert.equal(settleRoomSheetHeight(67.9), "dismiss");
    assert.equal(settleRoomSheetHeight(70), 68);
    assert.equal(settleRoomSheetHeight(83), 94);
    assert.equal(settleRoomSheetHeight(99), 94);
  });

  test("the mobile sheet handle toggles between collapsed and expanded snaps", async () => {
    await withDom(async ({ dom, root }) => {
      const runtime = connectedRuntimeFixture();
      const manifest = connectedManifestFixture(neutralDemoManifest);
      const profile = connectedProfileFixture();
      const resolved = resolveHomeAssistantBindings(manifest, profile, runtime);
      const room = resolved.rooms["demo-room"];
      const roomStatus = deriveRoomStatusMap(manifest, profile, resolved, runtime)["demo-room"];
      await act(async () =>
        root.render(
          React.createElement(RoomDashboardPanel, {
            resolved: room,
            roomStatus,
            status: runtime.status,
            canMutate: runtime.canMutate,
            selectedDeviceId: null,
            onSelectDevice: () => undefined,
            onCallService: async () => undefined,
            onHome: () => undefined,
            onWalk: () => undefined,
            onConnectDevices: () => undefined,
            onReconnect: () => undefined,
            onRetry: () => undefined,
          }),
        ),
      );
      const sheet = dom.window.document.querySelector(".room-control-sheet");
      let handle = dom.window.document.querySelector("button[aria-label='Expand room controls']");
      assert.equal(sheet.style.getPropertyValue("--room-sheet-mobile-height"), "68dvh");

      await act(async () => handle.click());
      assert.equal(sheet.style.getPropertyValue("--room-sheet-mobile-height"), "94dvh");
      assert.equal(sheet.dataset.expanded, "true");
      handle = dom.window.document.querySelector("button[aria-label='Collapse room controls']");
      await act(async () => handle.click());
      assert.equal(sheet.style.getPropertyValue("--room-sheet-mobile-height"), "68dvh");
      assert.equal(sheet.dataset.expanded, "false");

      handle.setPointerCapture = () => undefined;
      const pointerEvent = (type, clientY) => {
        const event = new dom.window.Event(type, { bubbles: true });
        Object.defineProperties(event, {
          clientY: { value: clientY },
          pointerId: { value: 1 },
        });
        return event;
      };
      await act(async () => {
        handle.dispatchEvent(pointerEvent("pointerdown", 200));
        handle.dispatchEvent(pointerEvent("pointermove", 170));
        handle.dispatchEvent(pointerEvent("pointercancel", 170));
        handle.click();
      });
      assert.equal(sheet.style.getPropertyValue("--room-sheet-mobile-height"), "94dvh");
      assert.equal(sheet.dataset.expanded, "true");
    });
  });

  test("CommandToggle is optimistic and reports a safe failure", async () => {
    await withDom(async ({ dom, root }) => {
      const request = deferred();
      const calls = [];
      await act(async () =>
        root.render(
          React.createElement(
            React.StrictMode,
            null,
            React.createElement(CommandToggle, {
              label: "Ceiling lights",
              pressed: true,
              disabled: false,
              confirmedKey: "light:on",
              callForPressed: toggleCallForPressed,
              onCallService: (call) => {
                calls.push(call);
                return request.promise;
              },
            }),
          ),
        ),
      );
      const button = dom.window.document.querySelector("button");
      assert.equal(button.getAttribute("aria-pressed"), "true");
      assert.equal(button.getAttribute("aria-label"), "Turn off Ceiling lights");

      await act(async () => {
        button.click();
        await Promise.resolve();
      });
      assert.deepEqual(calls, [toggleCallForPressed(false)]);
      assert.equal(button.getAttribute("aria-pressed"), "false");
      assert.equal(button.getAttribute("aria-label"), "Turn on Ceiling lights");
      assert.equal(button.dataset.pending, "true");
      assert.equal(button.disabled, true);

      await act(async () => {
        request.reject(new Error("light.demo_ceiling fixture secret"));
        await Promise.resolve();
      });
      assert.equal(button.getAttribute("aria-pressed"), "true");
      assert.equal(
        dom.window.document.querySelector("[role=alert]").textContent,
        "Couldn’t update Ceiling lights. Try again.",
      );
      assert.doesNotMatch(
        dom.window.document.body.textContent,
        /fixture secret|light\.demo_ceiling/,
      );
    });
  });

  test("a confirmation change invalidates an unsettled CommandToggle request", async () => {
    await withDom(async ({ dom, root }) => {
      const request = deferred();
      const render = (confirmedKey, pressed) =>
        root.render(
          React.createElement(CommandToggle, {
            label: "Ceiling lights",
            pressed,
            disabled: false,
            confirmedKey,
            callForPressed: toggleCallForPressed,
            onCallService: () => request.promise,
          }),
        );
      await act(async () => render("light:on:1", true));
      const button = dom.window.document.querySelector("button");
      await act(async () => {
        button.click();
        await Promise.resolve();
      });
      assert.equal(button.getAttribute("aria-pressed"), "false");
      assert.equal(button.dataset.pending, "true");

      await act(async () => render("light:on:2", true));
      assert.equal(button.getAttribute("aria-pressed"), "true");
      assert.equal(button.dataset.pending, "false");
      assert.equal(button.disabled, false);
      assert.equal(dom.window.document.querySelector("[role=alert]"), null);

      await act(async () => {
        request.reject(new Error("old service response must stay private"));
        await Promise.resolve();
      });
      assert.equal(button.getAttribute("aria-pressed"), "true");
      assert.equal(button.dataset.pending, "false");
      assert.equal(button.disabled, false);
      assert.equal(dom.window.document.querySelector("[role=alert]"), null);
    });
  });

  test("CommandToggle builds each call from the current optimistic direction", async () => {
    await withDom(async ({ dom, root }) => {
      const first = deferred();
      const second = deferred();
      const requests = [first, second];
      const calls = [];
      await act(async () =>
        root.render(
          React.createElement(CommandToggle, {
            label: "Ceiling lights",
            pressed: true,
            disabled: false,
            confirmedKey: "light:on",
            callForPressed: toggleCallForPressed,
            onCallService: (call) => {
              calls.push(call);
              return requests[calls.length - 1].promise;
            },
          }),
        ),
      );
      const button = dom.window.document.querySelector("button");

      await act(async () => {
        button.click();
        await Promise.resolve();
      });
      assert.equal(button.getAttribute("aria-pressed"), "false");
      await act(async () => {
        first.resolve();
        await Promise.resolve();
      });
      assert.equal(button.disabled, false);

      await act(async () => {
        button.click();
        await Promise.resolve();
      });
      assert.equal(button.getAttribute("aria-pressed"), "true");
      assert.deepEqual(calls, [toggleCallForPressed(false), toggleCallForPressed(true)]);
      await act(async () => {
        second.resolve();
        await Promise.resolve();
      });
    });
  });

  test("an abandoned concurrent confirmation render cannot invalidate a live command", async () => {
    await withDom(async ({ dom, root }) => {
      const request = deferred();
      const never = new Promise(() => undefined);
      const Suspender = () => {
        throw never;
      };
      const render = (confirmedKey, pressed, suspend = false) =>
        root.render(
          React.createElement(
            React.Suspense,
            { fallback: null },
            React.createElement(CommandToggle, {
              label: "Ceiling lights",
              pressed,
              disabled: false,
              confirmedKey,
              callForPressed: toggleCallForPressed,
              onCallService: () => request.promise,
            }),
            suspend ? React.createElement(Suspender) : null,
          ),
        );

      await act(async () => render("light:on", true));
      const button = dom.window.document.querySelector("button");
      await act(async () => {
        button.click();
        await Promise.resolve();
      });
      assert.equal(button.getAttribute("aria-pressed"), "false");
      assert.equal(button.dataset.pending, "true");

      await act(async () => {
        startTransition(() => render("light:abandoned", false, true));
        await Promise.resolve();
      });
      assert.equal(button.dataset.pending, "true");

      await act(async () => {
        request.reject(new Error("do not disclose interrupted state"));
        await Promise.resolve();
      });
      assert.equal(button.getAttribute("aria-pressed"), "true");
      assert.equal(button.dataset.pending, "false");
      assert.equal(
        dom.window.document.querySelector("[role=alert]").textContent,
        "Couldn’t update Ceiling lights. Try again.",
      );
    });
  });

  test("CommandRange uses requested values, rolls back failures, and ignores stale confirmations", async () => {
    await withDom(async ({ dom, root }) => {
      const failed = deferred();
      const earlier = deferred();
      const latest = deferred();
      const requests = [failed, earlier, latest];
      const calls = [];
      const setRangeValue = (range, value) => {
        const setter = Object.getOwnPropertyDescriptor(
          dom.window.HTMLInputElement.prototype,
          "value",
        ).set;
        setter.call(range, value);
        range.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      };
      const render = (confirmedKey, confirmedValue) =>
        root.render(
          React.createElement(CommandRange, {
            label: "Brightness",
            min: 1,
            max: 100,
            step: 1,
            confirmedValue,
            confirmedKey,
            disabled: false,
            callForValue: (value) => ({
              ...serviceCall,
              data: { brightness_pct: value },
            }),
            onCallService: (call) => {
              calls.push(call.data.brightness_pct);
              return requests[calls.length - 1].promise;
            },
          }),
        );
      await act(async () => render("brightness:40", 40));
      const range = dom.window.document.querySelector("input[type=range]");
      assert.equal(range.getAttribute("aria-label"), "Brightness");

      await act(async () => {
        setRangeValue(range, "55");
        await Promise.resolve();
      });
      assert.equal(range.value, "55");
      assert.deepEqual(calls, [55]);

      await act(async () => {
        failed.reject(new Error("never display this sensitive error"));
        await Promise.resolve();
      });
      assert.equal(range.value, "40");
      assert.equal(
        dom.window.document.querySelector("[role=alert]").textContent,
        "Couldn’t update Brightness. Try again.",
      );

      await act(async () => render("brightness:45", 45));
      assert.equal(range.value, "45");
      assert.equal(dom.window.document.querySelector("[role=alert]"), null);

      await act(async () => {
        setRangeValue(range, "60");
        setRangeValue(range, "70");
        await Promise.resolve();
      });
      assert.deepEqual(calls, [55, 60, 70]);
      await act(async () => {
        latest.resolve();
        await Promise.resolve();
      });
      assert.equal(range.value, "70");
      await act(async () => {
        earlier.reject(new Error("older response"));
        await Promise.resolve();
      });
      assert.equal(range.value, "70");
      assert.equal(dom.window.document.querySelector("[role=alert]"), null);

      await act(async () => render("brightness:75", 75));
      assert.equal(range.value, "75");
      assert.equal(dom.window.document.querySelector("[role=alert]"), null);
    });
  });

  test("TemperatureStepper uses bounded advertised increments", async () => {
    await withDom(async ({ dom, root }) => {
      const values = [];
      await act(async () =>
        root.render(
          React.createElement(TemperatureStepper, {
            label: "Target temperature",
            min: 18,
            max: 22,
            step: 0.5,
            confirmedValue: 21.5,
            confirmedKey: "climate:21.5",
            disabled: false,
            callForValue: (value) => ({ ...serviceCall, data: { temperature: value } }),
            onCallService: async (call) => {
              values.push(call.data.temperature);
            },
          }),
        ),
      );
      const decrease = dom.window.document.querySelector(
        "button[aria-label='Decrease Target temperature']",
      );
      const increase = dom.window.document.querySelector(
        "button[aria-label='Increase Target temperature']",
      );
      assert.equal(decrease.tagName, "BUTTON");
      assert.equal(increase.tagName, "BUTTON");
      await act(async () => {
        increase.click();
        await Promise.resolve();
      });
      assert.deepEqual(values, [22]);
      const output = dom.window.document.querySelector("output");
      assert.equal(output.value, "22");
      assert.equal(output.getAttribute("aria-label"), "Target temperature");
      assert.equal(increase.disabled, true);
    });
  });

  test("TemperatureStepper accepts rapid steps and ignores an older rejection", async () => {
    await withDom(async ({ dom, root }) => {
      const first = deferred();
      const latest = deferred();
      const requests = [first, latest];
      const values = [];
      await act(async () =>
        root.render(
          React.createElement(TemperatureStepper, {
            label: "Target temperature",
            min: 18,
            max: 22,
            step: 0.5,
            confirmedValue: 20,
            confirmedKey: "climate:20",
            disabled: false,
            callForValue: (value) => ({ ...serviceCall, data: { temperature: value } }),
            onCallService: (call) => {
              values.push(call.data.temperature);
              return requests[values.length - 1].promise;
            },
          }),
        ),
      );
      const stepper = dom.window.document.querySelector(".temperature-stepper");
      const increase = dom.window.document.querySelector(
        "button[aria-label='Increase Target temperature']",
      );

      await act(async () => {
        increase.click();
        await Promise.resolve();
      });
      assert.equal(stepper.dataset.pending, "true");
      assert.equal(increase.disabled, false);
      await act(async () => {
        increase.click();
        await Promise.resolve();
      });
      assert.deepEqual(values, [20.5, 21]);
      assert.equal(dom.window.document.querySelector("output").value, "21");

      await act(async () => {
        first.reject(new Error("stale rejection"));
        await Promise.resolve();
      });
      assert.equal(dom.window.document.querySelector("output").value, "21");
      assert.equal(stepper.dataset.pending, "true");
      assert.equal(dom.window.document.querySelector("[role=alert]"), null);

      await act(async () => {
        latest.resolve();
        await Promise.resolve();
      });
      assert.equal(stepper.dataset.pending, "false");
    });
  });

  test("TemperatureStepper clamps upper and lower overshoots before creating calls", async () => {
    await withDom(async ({ dom, root }) => {
      const values = [];
      const render = (confirmedKey, confirmedValue) =>
        root.render(
          React.createElement(TemperatureStepper, {
            label: "Target temperature",
            min: 18,
            max: 22,
            step: 0.5,
            confirmedValue,
            confirmedKey,
            disabled: false,
            callForValue: (value) => {
              values.push(value);
              return { ...serviceCall, data: { temperature: value } };
            },
            onCallService: async () => undefined,
          }),
        );
      await act(async () => render("climate:21.8", 21.8));
      await act(async () => {
        dom.window.document
          .querySelector("button[aria-label='Increase Target temperature']")
          .click();
        await Promise.resolve();
      });

      await act(async () => render("climate:18.2", 18.2));
      await act(async () => {
        dom.window.document
          .querySelector("button[aria-label='Decrease Target temperature']")
          .click();
        await Promise.resolve();
      });
      assert.deepEqual(values, [22, 18]);
    });
  });

  test("OptionControl uses a safe current option and omits empty choices", async () => {
    assert.equal(
      renderToStaticMarkup(
        React.createElement(OptionControl, {
          label: "Mode",
          value: "heat",
          options: [],
          disabled: false,
          onChange: () => undefined,
        }),
      ),
      "",
    );

    await withDom(async ({ dom, root }) => {
      const changes = [];
      await act(async () =>
        root.render(
          React.createElement(OptionControl, {
            label: "Mode",
            value: "missing",
            options: ["heat", "cool"],
            disabled: false,
            onChange: (value) => changes.push(value),
          }),
        ),
      );
      const select = dom.window.document.querySelector("select");
      assert.equal(select.value, "heat");
      assert.equal(dom.window.document.querySelector("label").textContent, "Modeheatcool");
      await act(async () => {
        select.value = "cool";
        select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      assert.deepEqual(changes, ["cool"]);
    });
  });

  test("AdvancedControls exposes an expandable identified region", async () => {
    await withDom(async ({ dom, root }) => {
      await act(async () =>
        root.render(
          React.createElement(
            AdvancedControls,
            { label: "More controls", defaultExpanded: false },
            React.createElement("p", null, "Secondary controls"),
          ),
        ),
      );
      const button = dom.window.document.querySelector("button");
      assert.equal(button.getAttribute("aria-expanded"), "false");
      const regionId = button.getAttribute("aria-controls");
      const region = dom.window.document.getElementById(regionId);
      assert.equal(region.getAttribute("role"), "region");
      assert.equal(region.hidden, true);
      await act(async () => button.click());
      assert.equal(button.getAttribute("aria-expanded"), "true");
      assert.equal(region.hidden, false);
      assert.match(region.textContent, /Secondary controls/);
    });
  });
});
