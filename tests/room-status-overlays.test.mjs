import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const {
    RoomStatusOverlayButton,
    roomStatusOverlayPosition,
    roomStatusOverlayPriority,
    shouldShowRoomStatusOverlays,
  } = await load("/packages/engine/src/room-status/RoomStatusOverlays.tsx");
  const { sceneOverlayLimitForWidth, selectSceneOverlayIds, SceneOverlayLayout, useSceneOverlay } =
    await load("/packages/engine/src/room-status/SceneOverlayLayout.tsx");
  const { loadOverlayPreferences, saveOverlayPreferences, filterOverlayStatuses } = await load(
    "/packages/engine/src/room-status/overlay-preferences.ts",
  );
  const summary = {
    roomId: "demo-room",
    temperature: { value: "21", unit: "°C" },
    humidity: { value: "48", unit: "%" },
    heating: false,
    cooling: true,
    lighting: "on",
    presence: "present",
    doorOpen: false,
  };

  test("persists overlay choices, defaults humidity on, and leaves room details intact", () => {
    const previousWindow = globalThis.window;
    const dom = new JSDOM("", { url: "https://cabane.test" });
    globalThis.window = dom.window;
    try {
      const defaults = loadOverlayPreferences();
      assert.equal(defaults.humidity, true);
      saveOverlayPreferences({ ...defaults, humidity: false, cooling: false });
      const preferences = loadOverlayPreferences();
      assert.equal(preferences.humidity, false);
      const filtered = filterOverlayStatuses({ "demo-room": summary }, preferences)["demo-room"];
      const html = renderToStaticMarkup(
        React.createElement(RoomStatusOverlayButton, {
          roomName: "Demo room",
          summary: filtered,
          onSelect: () => undefined,
        }),
      );
      assert.equal(html.includes("Humidity"), false);
      assert.equal(html.includes("Cooling"), false);
      assert.match(html, /Temperature 21/);
      assert.equal(summary.humidity.value, "48");
      dom.window.localStorage.setItem("cabane.room-overlays.preferences.v1", "broken");
      assert.equal(loadOverlayPreferences().humidity, true);
    } finally {
      globalThis.window = previousWindow;
      dom.window.close();
    }
  });

  test("anchors an overlay above the room polygon centroid", () => {
    const floor = neutralDemoManifest.floors[0];
    const position = roomStatusOverlayPosition(floor.rooms[0], floor);
    assert.deepEqual(position.slice(0, 2), [2.4, 2.9]);
    assert.ok(Math.abs(position[2] - 1.8) < 1e-9);
  });

  test("limits orbital overlays to the general overview", () => {
    assert.equal(shouldShowRoomStatusOverlays("overview"), true);
    assert.equal(shouldShowRoomStatusOverlays("room"), false);
    assert.equal(shouldShowRoomStatusOverlays("walk"), false);
  });

  test("exposes the room and compact status through one accessible button", () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomStatusOverlayButton, {
        roomName: "Demo room",
        summary,
        onSelect: () => undefined,
      }),
    );
    assert.match(html, /<button/);
    assert.match(
      html,
      /aria-label="Open Demo room\. Temperature 21 °C, Humidity 48 %, Cooling, Lights on, Presence"/,
    );
    assert.match(html, /data-visible="true"/);
    assert.match(html, /Demo room/);
    assert.equal(html.includes("Humidity"), true);
    assert.equal(html.includes("48 %"), true);
  });

  test("uses a compact cap and prioritizes useful status before center distance", () => {
    assert.equal(sceneOverlayLimitForWidth(759), 6);
    assert.equal(sceneOverlayLimitForWidth(760), 10);
    assert.equal(roomStatusOverlayPriority(summary), 3);
    assert.equal(
      roomStatusOverlayPriority({
        roomId: "humidity-only",
        humidity: { value: "48", unit: "%" },
        heating: false,
        cooling: false,
        doorOpen: false,
      }),
      1,
    );

    const candidates = Array.from({ length: 7 }, (_, index) => ({
      id: `room-${index}`,
      screenX: index * 180,
      screenY: 100,
      distanceFromCenter: index / 10,
      labelWidth: 88,
      priority: index === 6 ? 2 : 1,
      inViewport: true,
    }));
    const selected = selectSceneOverlayIds(candidates, 5);
    assert.equal(selected.size, 5);
    assert.equal(selected.has("room-6"), true);
    assert.equal(selected.has("room-4"), false);
    assert.equal(selected.has("room-5"), false);
  });

  test("declutters overlapping labels and ignores off-screen rooms", () => {
    const selected = selectSceneOverlayIds(
      [
        {
          id: "priority",
          screenX: 100,
          screenY: 100,
          distanceFromCenter: 0.2,
          labelWidth: 100,
          priority: 2,
          inViewport: true,
        },
        {
          id: "overlap",
          screenX: 112,
          screenY: 108,
          distanceFromCenter: 0.1,
          labelWidth: 100,
          priority: 1,
          inViewport: true,
        },
        {
          id: "clear",
          screenX: 300,
          screenY: 100,
          distanceFromCenter: 0.3,
          labelWidth: 100,
          priority: 1,
          inViewport: true,
        },
        {
          id: "offscreen",
          screenX: 500,
          screenY: 100,
          distanceFromCenter: 0.05,
          labelWidth: 100,
          priority: 3,
          inViewport: false,
        },
      ],
      5,
    );
    assert.deepEqual([...selected], ["priority", "clear"]);
  });

  test("room labels and reading cards share a collision budget, including tall cards", () => {
    const candidate = {
      screenX: 100,
      screenY: 100,
      distanceFromCenter: 0.1,
      labelWidth: 100,
      priority: 1,
      inViewport: true,
    };
    const room = { ...candidate, id: "room:kitchen", priority: 3 };
    const connection = {
      ...candidate,
      id: "item:fridge",
      labelWidth: 220,
      labelHeight: 100,
      screenY: 160,
    };
    const reading = {
      ...candidate,
      id: "item:meter",
      labelWidth: 220,
      labelHeight: 80,
      screenX: 350,
    };
    assert.deepEqual(
      [...selectSceneOverlayIds([room, connection, reading], 10)],
      [room.id, reading.id],
    );
    assert.equal(
      selectSceneOverlayIds([room, { ...connection, screenY: 240 }, reading], 10).size,
      3,
    );
    assert.equal(selectSceneOverlayIds([room, { ...reading, screenX: 220 }], 10).size, 1);
  });

  test("the scene layout applies shared visibility and updates after zooming or removal", async () => {
    const { create } = await import("@react-three/test-renderer");
    const visibility = {};
    const { useThree } = await import("@react-three/fiber");
    let camera;
    function Overlay({ id, x, priority = 1, height = 48 }) {
      camera = useThree((state) => state.camera);
      const overlay = useSceneOverlay({ id, labelWidth: 100, labelHeight: height, priority });
      visibility[id] = overlay.visible;
      return React.createElement("group", { ref: overlay.anchorRef, position: [x, 0, 0] });
    }
    const scene = (showRoom = true) =>
      React.createElement(
        SceneOverlayLayout,
        null,
        showRoom && React.createElement(Overlay, { id: "room:kitchen", x: 0, priority: 3 }),
        React.createElement(Overlay, { id: "item:connection", x: 0.3 }),
        React.createElement(Overlay, { id: "item:reading", x: 3 }),
      );
    const renderer = await create(scene(), {
      width: 1200,
      height: 800,
      camera: { position: [0, 0, 10] },
    });
    try {
      await act(async () => renderer.advanceFrames(1, 0.016));
      assert.deepEqual(visibility, {
        "room:kitchen": true,
        "item:connection": false,
        "item:reading": true,
      });
      camera.zoom = 10;
      camera.updateProjectionMatrix();
      await act(async () => renderer.advanceFrames(1, 0.016));
      assert.equal(visibility["item:connection"], true);
      assert.equal(visibility["item:reading"], false);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      await renderer.update(scene(false));
      await act(async () => renderer.advanceFrames(1, 0.016));
      assert.equal(visibility["item:connection"], true);
      await renderer.update(scene());
    } finally {
      await renderer.unmount();
    }
  });

  test("keeps nearby readable labels and more rooms than the previous cap", () => {
    const candidates = Array.from({ length: 20 }, (_, index) => ({
      id: `room-${index}`,
      screenX: (index % 5) * 108,
      screenY: Math.floor(index / 5) * 52,
      distanceFromCenter: index / 20,
      labelWidth: 100,
      priority: 1,
      inViewport: true,
    }));
    assert.equal(selectSceneOverlayIds(candidates, sceneOverlayLimitForWidth(1200)).size, 10);
    assert.equal(selectSceneOverlayIds(candidates, sceneOverlayLimitForWidth(390)).size, 6);
    assert.equal(selectSceneOverlayIds(candidates.slice(0, 8), 10).size, 8);
  });

  test("selects the exact room on click", async () => {
    const dom = new JSDOM("<!doctype html><div id='root'></div>", {
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
    const selected = [];
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await act(async () =>
        root.render(
          React.createElement(RoomStatusOverlayButton, {
            roomName: "Demo room",
            summary,
            onSelect: () => selected.push("demo-room"),
          }),
        ),
      );
      await act(async () => dom.window.document.querySelector("button").click());
      assert.deepEqual(selected, ["demo-room"]);

      await act(async () =>
        root.render(
          React.createElement(RoomStatusOverlayButton, {
            roomName: "Demo room",
            summary,
            visible: false,
            onSelect: () => selected.push("hidden-room"),
          }),
        ),
      );
      const hidden = dom.window.document.querySelector("button");
      assert.equal(hidden.getAttribute("aria-hidden"), "true");
      assert.equal(hidden.tabIndex, -1);
      await act(async () => hidden.click());
      assert.deepEqual(selected, ["demo-room"]);
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
