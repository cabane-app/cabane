import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { readCssSource } from "./css-source.mjs";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const dashboard = await load("/packages/engine/src/CabaneDashboard.tsx");
  const { CustomizeActionBarMenuItem } = await load(
    "/packages/engine/src/CustomizeActionBarMenuItem.tsx",
  );
  const { defaultActionBarItems, resolveActionBarItems } = await load(
    "/packages/engine/src/action-bar/action-bar-config.ts",
  );
  const { resolvePublishedActionBarItems } = await load(
    "/packages/engine/src/action-bar/action-bar-config.ts",
  );
  const { clampActionTrayLeft } = await load("/packages/engine/src/SceneActionBar.tsx");
  test("installed tools opt into defaults without replacing a customized bar", () => {
    const tools = [{ id: "example.tool", defaultShortcut: true }, { id: "example.optional" }];
    const defaults = resolveActionBarItems(undefined, tools);
    assert.deepEqual(defaults.at(-1), {
      id: "default-tool-example.tool",
      target: { kind: "walk-tool", toolId: "example.tool" },
    });
    assert.equal(defaults.length, defaultActionBarItems.length + 1);
    assert.deepEqual(resolvePublishedActionBarItems(undefined, tools), defaults);
    assert.deepEqual(resolveActionBarItems({ items: [] }, tools), []);
    assert.deepEqual(resolvePublishedActionBarItems({ items: [] }, tools), []);
  });

  test("Home menu customization action closes its menu and opens the editor", async () => {
    const dom = new JSDOM('<details open><div id="root"></div></details>');
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLElement: globalThis.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    let opened = 0;
    try {
      await act(async () =>
        root.render(React.createElement(CustomizeActionBarMenuItem, { onClick: () => opened++ })),
      );
      await act(async () => document.querySelector("button").click());
      assert.equal(opened, 1);
      assert.equal(document.querySelector("details").open, false);
    } finally {
      await act(async () => root.unmount());
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  });

  test("configured bar renders exact order and honors explicit empty layout", () => {
    const items = [
      { id: "study", target: { kind: "room", roomId: "study" } },
      { id: "night", target: { kind: "built-in", action: "night" } },
    ];
    const props = {
      mode: "overview",
      lighting: "day",
      wallFade: false,
      allLightsEnabled: false,
      allLightsBusy: false,
      targets: { study: { label: "Study", available: true } },
      onAction() {},
      onChildAction() {},
    };
    const html = renderToStaticMarkup(
      React.createElement(dashboard.SceneActionBar, { ...props, items }),
    );
    assert.ok(html.indexOf("Study") < html.indexOf("Night"));
    assert.doesNotMatch(html, /aria-label="Build"/);
    assert.doesNotMatch(
      renderToStaticMarkup(React.createElement(dashboard.SceneActionBar, { ...props, items: [] })),
      /scene-action-dock/,
    );
    const defaults = renderToStaticMarkup(
      React.createElement(dashboard.SceneActionBar, { ...props, items: defaultActionBarItems }),
    );
    for (const label of ["Build", "Walk", "Night", "View"])
      assert.match(defaults, new RegExp(`>${label}`));
    assert.doesNotMatch(defaults, /Turn off all available Home Assistant lights/);
  });

  test("room photos and injected device previews share the published slot face", () => {
    const html = renderToStaticMarkup(
      React.createElement(dashboard.SceneActionBar, {
        items: [
          { id: "room", target: { kind: "room", roomId: "study" } },
          { id: "device", target: { kind: "device", deviceId: "lamp" } },
        ],
        targets: {
          room: {
            label: "Study",
            pictureUrl: "https://example.invalid/study.png",
            available: true,
          },
          device: { label: "Lamp", modelId: "lamp-model", available: true },
        },
        renderDeviceIcon: (modelId) => React.createElement("span", { "data-model": modelId }),
        mode: "overview",
        lighting: "day",
        wallFade: false,
        allLightsEnabled: false,
        allLightsBusy: false,
        onAction() {},
      }),
    );
    assert.match(html, /scene-action-room-photo/);
    assert.match(html, /data-model="lamp-model"/);
    assert.equal((html.match(/scene-action-slot__icon/g) ?? []).length, 2);
  });

  test("malformed published action bar data renders unavailable controls without crashing", () => {
    for (const config of [{ items: "broken" }, { items: [{ id: "broken" }] }]) {
      const items = resolvePublishedActionBarItems(config);
      const html = renderToStaticMarkup(
        React.createElement(dashboard.SceneActionBar, {
          items,
          mode: "overview",
          lighting: "day",
          wallFade: false,
          allLightsEnabled: false,
          allLightsBusy: false,
          onAction() {},
        }),
      );
      assert.match(html, /Unavailable room/);
      assert.match(html, /disabled=""/);
    }
  });

  test("unavailable configured target cannot dispatch", async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLElement: globalThis.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    let calls = 0;
    try {
      await act(async () =>
        root.render(
          React.createElement(dashboard.SceneActionBar, {
            items: [{ id: "lost", target: { kind: "room", roomId: "deleted" } }],
            targets: { lost: { label: "Unavailable room", available: false } },
            mode: "overview",
            lighting: "day",
            wallFade: false,
            allLightsEnabled: false,
            allLightsBusy: false,
            onAction() {
              calls++;
            },
            onChildAction() {},
          }),
        ),
      );
      const button = document.querySelector('button[aria-label="Unavailable room"]');
      assert.ok(button);
      assert.equal(button.disabled, true);
      await act(async () => button.click());
      assert.equal(calls, 0);
    } finally {
      await act(async () => root.unmount());
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  });

  test("room and device slots dispatch their exact configured targets", async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLElement: globalThis.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    const items = [
      { id: "study", target: { kind: "room", roomId: "study" } },
      { id: "lamp", target: { kind: "device", deviceId: "desk-lamp" } },
    ];
    const dispatched = [];
    try {
      await act(async () =>
        root.render(
          React.createElement(dashboard.SceneActionBar, {
            items,
            targets: {
              study: { label: "Study", available: true },
              lamp: { label: "Desk lamp", available: true },
            },
            mode: "walk",
            lighting: "day",
            wallFade: false,
            allLightsEnabled: false,
            allLightsBusy: false,
            onAction: (item) => dispatched.push(item),
          }),
        ),
      );
      await act(async () => document.querySelector('[aria-label="Study"]').click());
      await act(async () => document.querySelector('[aria-label="Desk lamp"]').click());
      assert.deepEqual(dispatched, items);
    } finally {
      await act(async () => root.unmount());
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  });

  test("overflow preserves item order and exposes every hidden action to keyboard focus", async () => {
    const dom = new JSDOM('<main id="shell"><div id="root"></div></main>');
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLElement: globalThis.HTMLElement,
      ResizeObserver: globalThis.ResizeObserver,
      IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
      ResizeObserver: class {
        observe() {}
        disconnect() {}
      },
    });
    const rect = dom.window.HTMLElement.prototype.getBoundingClientRect;
    dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 240, height: 600 });
    const root = createRoot(document.getElementById("root"));
    const items = ["build", "walk", "night", "view", "all-lights"].map((action) => ({
      id: action,
      target: { kind: "built-in", action },
    }));
    try {
      await act(async () =>
        root.render(
          React.createElement(dashboard.SceneActionBar, {
            items,
            mode: "overview",
            lighting: "day",
            wallFade: false,
            allLightsEnabled: true,
            allLightsBusy: false,
            onAction() {},
          }),
        ),
      );
      const more = document.querySelector('[aria-label="More actions"]');
      assert.ok(more);
      const overflow = document.querySelector('[aria-label="More actions list"]');
      assert.equal(overflow.hidden, true);
      assert.ok(document.querySelector('[aria-label="Build"]'));
      assert.ok(document.querySelector('[aria-label="Walk mode"]'));
      await act(async () => more.click());
      assert.equal(overflow.hidden, false);
      const labels = [
        ...overflow.querySelectorAll(
          ":scope > button[aria-label], :scope > .scene-action-group > button[aria-label]",
        ),
      ].map((button) => button.getAttribute("aria-label"));
      assert.deepEqual(labels, [
        "Use night lighting",
        "View",
        "Turn off all available Home Assistant lights",
      ]);
      assert.equal(overflow.querySelectorAll("button:disabled").length, 1); // Roof control has no handler in this test.
    } finally {
      await act(async () => root.unmount());
      dom.window.HTMLElement.prototype.getBoundingClientRect = rect;
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  });

  test("Build and View trays anchor inside the dock after reordering", () => {
    assert.equal(clampActionTrayLeft(16, 64, 216, 0, 320), 8);
    assert.equal(clampActionTrayLeft(128, 64, 216, 0, 320), 52);
    assert.equal(clampActionTrayLeft(240, 64, 216, 0, 320), 96);
  });

  test("mobile room controls remain above the full-screen sheet with scroll clearance", () => {
    const css = readCssSource(new URL("../packages/engine/src/styles.css", import.meta.url));
    const rule = (selector) =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, header]) =>
        header.split(",").some((part) => part.trim() === selector),
      )?.[2] ?? "";
    const layer = (selector) => Number(rule(selector).match(/z-index:\s*(\d+)/)?.[1] ?? 0);
    assert.ok(layer(".mode-room .scene-hud") > 14);
    assert.ok(layer(".mode-room .scene-action-dock") > 14);
    assert.doesNotMatch(rule(".mode-room .scene-hud"), /opacity:\s*0/);
    assert.match(rule(".mode-room .scene-menu"), /pointer-events:\s*auto/);
    assert.match(rule(".mode-room .room-control-sheet__content"), /--scene-action-size/);
  });

  test("renders custom-style action illustrations with clear captions and editor keybindings", () => {
    assert.equal(typeof dashboard.SceneActionBar, "function");

    const shortcuts = [
      { id: "room", action: "room-details", context: "room", order: 0 },
      { id: "construct", action: "construct-mode", context: "overview", order: 1 },
      { id: "arrange", action: "arrange-mode", context: "overview", order: 2 },
      { id: "connect", action: "connect-mode", context: "overview", order: 3 },
      { id: "walk", action: "walk-mode", context: "both", order: 4 },
      { id: "lighting", action: "lighting-mode", context: "both", order: 5 },
      { id: "walls", action: "wall-fade", context: "both", order: 6 },
      { id: "lights", action: "all-lights", context: "both", order: 7 },
    ];
    const html = renderToStaticMarkup(
      React.createElement(dashboard.SceneActionBar, {
        shortcuts,
        mode: "overview",
        lighting: "day",
        wallFade: false,
        allLightsEnabled: true,
        allLightsBusy: false,
        onAction: () => undefined,
      }),
    );

    assert.match(
      html,
      /aria-label="Build" aria-expanded="false" aria-controls="scene-group-Build"/,
    );
    assert.match(html, /aria-label="View" aria-expanded="false" aria-controls="scene-group-View"/);
    assert.match(html, /aria-label="Build actions" hidden=""/);
    assert.match(html, /aria-label="View actions" hidden=""/);
    for (const key of ["B", "V", "R"]) assert.ok(html.includes(`aria-keyshortcuts="${key}"`));
    assert.equal((html.match(/<img /g) ?? []).length, 16);
    assert.equal((html.match(/src="data:image\/svg\+xml,/g) ?? []).length, 16);
    for (const label of ["Construct", "Arrange", "Connect", "Walk", "Night", "Fade walls"]) {
      assert.match(html, new RegExp(`scene-action-slot__label[^>]*>${label}<`));
    }
    assert.doesNotMatch(html, /aria-label="Room view"/);
    assert.match(html, /aria-label="Use night lighting"/);
    assert.match(html, /aria-keyshortcuts="C"/);
    assert.match(html, /aria-keyshortcuts="A"/);
    assert.match(html, /aria-keyshortcuts="Shift\+C"/);
    assert.match(html, /aria-keyshortcuts="W"/);
    assert.match(html, /aria-keyshortcuts="N"/);
    assert.match(html, /aria-keyshortcuts="S"/);
    const withLights = renderToStaticMarkup(
      React.createElement(dashboard.SceneActionBar, {
        mode: "overview",
        lighting: "day",
        wallFade: false,
        allLightsEnabled: true,
        allLightsBusy: false,
        onAction() {},
        items: [{ id: "lights", target: { kind: "built-in", action: "all-lights" } }],
      }),
    );
    assert.match(withLights, /src="data:image\/svg\+xml,/);
    assert.match(withLights, /aria-keyshortcuts="L"/);
    assert.match(withLights, /Lights off/);
    assert.match(html, />⇧C<\/kbd>/);

    const toggledHtml = renderToStaticMarkup(
      React.createElement(dashboard.SceneActionBar, {
        shortcuts,
        mode: "walk",
        lighting: "night",
        wallFade: true,
        allLightsEnabled: true,
        allLightsBusy: false,
        onAction: () => undefined,
      }),
    );
    for (const label of ["Exit walk", "Daylight", "Solid walls"]) {
      assert.match(toggledHtml, new RegExp(`scene-action-slot__label[^>]*>${label}<`));
    }
    const day = new JSDOM(html);
    const night = new JSDOM(toggledHtml);
    assert.notEqual(
      day.window.document.querySelector('[aria-label="Use night lighting"] img').src,
      night.window.document.querySelector('[aria-label="Use daylight"] img').src,
    );
    day.window.close();
    night.window.close();
  });

  test("keeps the same product actions for legacy, empty, and customized homes in every scene mode", () => {
    for (const shortcuts of [
      [],
      [
        { id: "legacy-room", action: "room-details", context: "both", order: 0 },
        { id: "legacy-light", action: "lighting-mode", context: "both", order: 1 },
      ],
      [{ id: "custom", action: "home-view", context: "overview", order: 0 }],
    ]) {
      for (const mode of ["overview", "room", "walk"]) {
        const html = renderToStaticMarkup(
          React.createElement(dashboard.SceneActionBar, {
            shortcuts,
            mode,
            lighting: "day",
            wallFade: true,
            allLightsEnabled: false,
            allLightsBusy: false,
            onAction: () => undefined,
          }),
        );
        const labels = [...html.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map(
          (match) => match[1],
        );
        assert.deepEqual(labels, [
          "Hide action bar",
          "Build",
          "Open Construct",
          "Open Arrange",
          "Open Connect",
          mode === "walk" ? "Exit walk mode" : "Walk mode",
          "Use night lighting",
          "Weather",
          "Live",
          "Sunny",
          "Cloudy",
          "Rain",
          "Thunderstorm",
          "Snowy",
          "View",
          "Keep walls solid",
          "Show roof",
        ]);
      }
    }
  });

  test("View tray toggles roof visibility and reflects its pressed state", async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const keys = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
    const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    let toggles = 0;
    const props = {
      mode: "overview",
      lighting: "day",
      wallFade: true,
      allLightsEnabled: false,
      onAction() {},
      onToggleRoof() {
        toggles++;
      },
    };
    try {
      await act(async () =>
        root.render(
          React.createElement(dashboard.SceneActionBar, { ...props, roofVisible: false }),
        ),
      );
      await act(async () => document.querySelector('[aria-label="View"]').click());
      const tray = document.querySelector('[aria-label="View actions"]');
      assert.equal(tray.hidden, false);
      const show = tray.querySelector('[aria-label="Show roof"]');
      assert.equal(show.getAttribute("aria-pressed"), "false");
      await act(async () => show.click());
      assert.equal(toggles, 1);
      await act(async () =>
        root.render(React.createElement(dashboard.SceneActionBar, { ...props, roofVisible: true })),
      );
      const hide = document.querySelector('[aria-label="Hide roof"]');
      assert.equal(hide.getAttribute("aria-pressed"), "true");
      await act(async () => hide.click());
      assert.equal(toggles, 2);
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, previous);
    }
  });

  test("collapses and restores the action bar in orbital and walk modes", async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const keys = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
    const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    const props = {
      lighting: "day",
      wallFade: false,
      allLightsEnabled: false,
      allLightsBusy: false,
      onAction() {},
    };
    try {
      await act(async () =>
        root.render(React.createElement(dashboard.SceneActionBar, { ...props, mode: "overview" })),
      );
      await act(async () => document.querySelector('[aria-label="Hide action bar"]').click());
      assert.equal(document.getElementById("scene-action-bar").hidden, true);
      assert.equal(
        document.querySelector('[aria-label="Show action bar"]').getAttribute("aria-expanded"),
        "false",
      );
      await act(async () =>
        root.render(React.createElement(dashboard.SceneActionBar, { ...props, mode: "walk" })),
      );
      assert.equal(document.getElementById("scene-action-bar").hidden, true);
      await act(async () => document.querySelector('[aria-label="Show action bar"]').click());
      assert.equal(document.getElementById("scene-action-bar").hidden, false);
      assert.equal(
        document.querySelector('[aria-label="Hide action bar"]').getAttribute("aria-expanded"),
        "true",
      );
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, previous);
    }
  });

  test("maps orbital editor keybindings without making the shared initial ambiguous", () => {
    assert.equal(dashboard.orbitalEditorActionFromKey("c"), "construct-mode");
    assert.equal(dashboard.orbitalEditorActionFromKey("A"), "arrange-mode");
    assert.equal(dashboard.orbitalEditorActionFromKey("c", true), "connect-mode");
    assert.equal(dashboard.orbitalEditorActionFromKey("w"), "walk-mode");
    assert.equal(dashboard.orbitalEditorActionFromKey("N"), "lighting-mode");
    assert.equal(dashboard.orbitalEditorActionFromKey("s"), "wall-fade");
    assert.equal(dashboard.orbitalEditorActionFromKey("L"), "all-lights");
    assert.equal(dashboard.orbitalEditorActionFromKey("w", true), null);
    assert.equal(dashboard.orbitalEditorActionFromKey("x"), null);
  });

  test("shows compact status only under the current first-person room name", () => {
    const summary = {
      roomId: "demo-room",
      temperature: { value: "21", unit: "°C" },
      humidity: { value: "48", unit: "%" },
      heating: true,
      cooling: false,
      lighting: "on",
      presence: "present",
      doorOpen: false,
    };
    const walk = renderToStaticMarkup(
      React.createElement(dashboard.SceneRoomContext, {
        mode: "walk",
        displayName: "Demo room",
        roomStatus: summary,
      }),
    );
    const overview = renderToStaticMarkup(
      React.createElement(dashboard.SceneRoomContext, {
        mode: "overview",
        displayName: "Demo floor",
        roomStatus: summary,
      }),
    );
    const unresolvedWalk = renderToStaticMarkup(
      React.createElement(dashboard.SceneRoomContext, {
        mode: "walk",
        displayName: "Between rooms",
      }),
    );

    assert.match(walk, /Walking in/);
    assert.match(walk, /Demo room/);
    assert.match(walk, /data-variant="compact"/);
    assert.match(walk, /21 °C/);
    assert.equal(overview.includes("room-status-badges"), false);
    assert.equal(unresolvedWalk.includes("room-status-badges"), false);
  });

  test("shows household presence only in the overview context", () => {
    const homePresence = {
      state: "present",
      people: [
        { entityId: "person.alex", name: "Alex" },
        { entityId: "person.sam", name: "Sam" },
      ],
    };
    const render = (mode) =>
      renderToStaticMarkup(
        React.createElement(dashboard.SceneRoomContext, {
          mode,
          displayName: mode === "overview" ? "Ground floor" : "Living room",
          homePresence,
        }),
      );

    const overview = render("overview");
    assert.match(overview, /home-presence-status/);
    assert.match(overview, /At home/);
    assert.match(overview, /Alex, Sam/);
    assert.match(overview, /data-presence-state="present"/);
    assert.equal((overview.match(/<svg/g) ?? []).length, 1);

    assert.equal(render("room").includes("home-presence-status"), false);
    assert.equal(render("walk").includes("home-presence-status"), false);
  });
});
