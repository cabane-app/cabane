import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { EditorModeNav } = await load("/apps/web/src/editor-chrome/EditorModeNav.tsx");
  const { EditorActionBar } = await load("/apps/web/src/editor-chrome/EditorActionBar.tsx");
  const { HomeEditorHeader } = await load("/apps/web/src/editor-workspace/HomeEditorHeader.tsx");
  const { SelectedItemActionBar } = await load(
    "/apps/web/src/editor-preview/furnish/SelectedItemActionBar.tsx",
  );
  const { ArrangeCatalog } = await load(
    "/apps/web/src/editor-preview/furnish/catalog/ArrangeCatalog.tsx",
  );
  const { FurnishingInspector } = await load(
    "/apps/web/src/editor-preview/furnish/FurnishingInspector.tsx",
  );

  async function withDom(run) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://cabane.local/" });
    const names = ["window", "document", "navigator", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
    const previous = Object.fromEntries(
      names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    );
    for (const name of names)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value: name === "IS_REACT_ACT_ENVIRONMENT" ? true : dom.window[name],
      });
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await run({ root, document: dom.window.document, window: dom.window });
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      for (const name of names) {
        if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
        else delete globalThis[name];
      }
    }
  }

  const props = (overrides = {}) => ({
    tool: "wall",
    onToolChange() {},
    ...overrides,
  });
  const headerProps = (overrides = {}) => {
    const project = {
      home: { name: "Test home" },
      floors: [{ id: "floor", name: "Ground floor" }],
    };
    return {
      mode: "furnish",
      activeFloorId: "floor",
      snapshot: { project, bindings: {} },
      workspace: {
        record: { publishedAt: 1, published: project },
        canUndo: false,
        canRedo: true,
      },
      constructEditor: { tool: "wall", setTool() {} },
      floorZoneDrawing: { active: false },
      poolDrawing: { active: false },
      connect: { view: "rooms", disconnected: false },
      runtime: { refreshing: false },
      onModeTabChange() {},
      undoProject() {},
      redoProject() {},
      ...overrides,
    };
  };

  test("mode navigation uses Arrange and enabled Connect with outline icons", async () => {
    await withDom(async ({ root, document }) => {
      let selected;
      await act(async () =>
        root.render(
          React.createElement(EditorModeNav, {
            mode: "construct",
            onModeChange: (mode) => {
              selected = mode;
            },
          }),
        ),
      );
      const buttons = [...document.querySelectorAll("button")];
      assert.deepEqual(
        buttons.map((button) => button.textContent),
        ["Construct", "Arrange", "Connect", "Shortcuts"],
      );
      assert.equal(buttons[0].getAttribute("aria-pressed"), "true");
      assert.equal(buttons[2].disabled, false);
      assert.equal(buttons[2].getAttribute("aria-pressed"), "false");
      await act(async () => buttons[2].click());
      assert.equal(selected, "connect");
      assert.equal(document.querySelectorAll('svg[aria-hidden="true"]').length, 4);
      await act(async () => buttons[1].click());
      assert.equal(selected, "furnish");
      assert.doesNotMatch(document.body.textContent, /Coming later|Furnish/);
    });
  });

  test("construction actions retain labels, ordering, pressed state, and callbacks", async () => {
    await withDom(async ({ root, document, window }) => {
      const selected = [];
      await act(async () =>
        root.render(
          React.createElement(
            EditorActionBar,
            props({
              onToolChange: (tool) => selected.push(tool),
            }),
          ),
        ),
      );
      const buttons = [...document.querySelectorAll("button")];
      assert.deepEqual(
        buttons.map((button) => button.getAttribute("aria-label")),
        ["Select", "Wall", "Openings", "Floor", "Measure", "Decorations"],
      );
      const wallGroup = document.querySelector('[aria-label="Wall"]');
      assert.equal(wallGroup.getAttribute("aria-pressed"), "true");
      await act(async () => wallGroup.click());
      const walls = document.querySelector('[aria-label="Wall tools"]');
      assert.equal(walls.parentElement, document.body);
      assert.deepEqual(
        [...walls.querySelectorAll("button")].map((b) => b.textContent),
        ["Wall", "Invisible wall", "Outdoor space"],
      );
      await act(async () => walls.querySelector('[aria-label="Invisible wall"]').click());
      assert.equal(selected.at(-1), "virtual-wall");
      assert.equal(document.querySelector('[aria-label="Wall tools"]'), null);
      await act(async () => wallGroup.click());
      await act(async () => document.querySelector('[aria-label="Outdoor space"]').click());
      assert.equal(selected.at(-1), "platform");
      const openings = document.querySelector('[aria-label="Openings"]');
      for (const [label, tool] of [
        ["Door", "door"],
        ["Passage", "passage"],
        ["Window", "window"],
      ]) {
        await act(async () => openings.click());
        const panel = document.querySelector('[aria-label="Opening tools"]');
        assert.deepEqual(
          [...panel.querySelectorAll("button")].map((b) => b.textContent),
          ["Door", "Passage", "Window"],
        );
        await act(async () => panel.querySelector(`[aria-label="${label}"]`).click());
        assert.equal(selected.at(-1), tool);
      }
      const decorations = document.querySelector('[aria-label="Decorations"]');
      await act(async () => decorations.click());
      assert.equal(decorations.getAttribute("aria-expanded"), "true");
      const menu = document.querySelector('[aria-label="Decoration tools"]');
      assert.equal(menu.parentElement, document.body, "menu escapes the scrolling toolbar");
      assert.deepEqual(
        [...menu.querySelectorAll("button")].map((button) => button.textContent),
        ["Niche", "Boundary", "Pool"],
      );
      await act(async () => menu.querySelector('[aria-label="Niche"]').click());
      assert.equal(selected.at(-1), "niche");
      assert.equal(document.querySelector('[aria-label="Decoration tools"]'), null);
      await act(async () => {
        decorations.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });
      assert.equal(document.activeElement.getAttribute("aria-label"), "Niche");
      await act(async () => {
        document.activeElement.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });
      assert.equal(document.activeElement.getAttribute("aria-label"), "Boundary");
      await act(async () => {
        document.activeElement.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      });
      assert.equal(decorations.getAttribute("aria-expanded"), "false");
      assert.equal(document.activeElement, decorations);
      assert.equal(
        document.querySelector('[aria-label="Floor"]').getAttribute("aria-keyshortcuts"),
        "F",
      );
    });
  });

  test("grouped tools reflect tutorial selections and keep Stairs after Floor", async () => {
    await withDom(async ({ root, document, window }) => {
      for (const tool of ["wall", "virtual-wall", "platform", "door", "window"]) {
        await act(async () =>
          root.render(React.createElement(EditorActionBar, props({ tool, onStairs() {} }))),
        );
        const buttons = [
          ...document
            .querySelector('[aria-label="Construction actions"]')
            .querySelectorAll("button"),
        ];
        assert.deepEqual(
          buttons.map((b) => b.getAttribute("aria-label")),
          ["Select", "Wall", "Openings", "Floor", "Stairs", "Measure", "Decorations"],
        );
        const group = ["door", "window"].includes(tool) ? "Openings" : "Wall";
        assert.equal(
          document.querySelector(`[aria-label="${group}"]`).getAttribute("aria-pressed"),
          "true",
        );
        assert.equal(
          document.querySelector('[aria-label="Floor"]').getAttribute("aria-pressed"),
          "false",
        );
      }
      const wall = document.querySelector('[aria-label="Wall"]');
      await act(async () =>
        wall.dispatchEvent(
          Object.assign(new window.Event("pointerover", { bubbles: true }), {
            pointerType: "mouse",
          }),
        ),
      );
      assert.ok(document.querySelector('[aria-label="Wall tools"]'), "hover reveals tools");
      await act(async () =>
        root.render(React.createElement(EditorActionBar, props({ inert: true, onStairs() {} }))),
      );
      assert.equal(
        document.querySelector('[aria-label="Wall tools"]'),
        null,
        "locked editor dismisses the portal",
      );
    });
  });

  test("project actions group shared history beside Reset and Save with supported shortcuts", async () => {
    await withDom(async ({ root, document }) => {
      let redone = 0;
      for (const mode of ["construct", "furnish", "connect"]) {
        await act(async () =>
          root.render(
            React.createElement(
              HomeEditorHeader,
              headerProps({ mode, redoProject: () => redone++ }),
            ),
          ),
        );
        const buttons = [
          ...document.querySelector('[aria-label="Project actions"]').querySelectorAll("button"),
        ];
        assert.deepEqual(
          buttons.map((button) => button.getAttribute("aria-label") ?? button.textContent.trim()),
          ["Undo", "Redo", "Reset changes", "Save"],
        );
        assert.equal(document.querySelectorAll('[aria-label="Undo"]').length, 1);
        assert.equal(document.querySelectorAll('[aria-label="Redo"]').length, 1);
        assert.equal(document.querySelector('[aria-label="Edit history"]'), null);
        if (mode === "furnish") assert.equal(document.querySelector(".editor-action-bar"), null);
        assert.equal(buttons[0].disabled, true);
        assert.equal(buttons[1].disabled, false);
        assert.equal(buttons[0].getAttribute("aria-keyshortcuts"), "Control+Z Meta+Z");
        assert.equal(
          buttons[1].getAttribute("aria-keyshortcuts"),
          "Control+Shift+Z Meta+Shift+Z Control+Y",
        );
        await act(async () => buttons[1].click());
      }
      assert.equal(redone, 3);
      let undone = 0;
      const drawingProps = headerProps({
        mode: "construct",
        unsettled: true,
        floorZoneDrawing: { active: true, points: [[0, 0]], future: [] },
        undoProject: () => undone++,
      });
      await act(async () => root.render(React.createElement(HomeEditorHeader, drawingProps)));
      const undo = document.querySelector('[aria-label="Undo"]');
      assert.equal(undo.disabled, false, "unfinished floor drawing retains its local undo");
      await act(async () => undo.click());
      assert.equal(undone, 1);
      await act(async () =>
        root.render(
          React.createElement(HomeEditorHeader, { ...drawingProps, referenceAdjusting: true }),
        ),
      );
      assert.equal(undo.disabled, true, "reference-plan adjustment disables history controls");
    });
  });

  test("focus and hover tooltips escape the scroll container and dismiss accessibly", async () => {
    await withDom(async ({ root, document, window }) => {
      await act(async () => root.render(React.createElement(EditorActionBar, props())));
      const button = document.querySelector('[aria-label="Select"]');
      await act(async () => button.focus());
      const tooltip = document.querySelector('[role="tooltip"]');
      assert.match(tooltip.textContent, /Select.*V/);
      assert.equal(tooltip.parentElement, document.body);
      assert.equal(button.getAttribute("aria-describedby"), tooltip.id);
      assert.equal(button.tabIndex, 0);
      await act(async () =>
        button.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
      );
      assert.equal(document.querySelector('[role="tooltip"]'), null);
      await act(async () => {
        button.blur();
        button.dispatchEvent(new window.MouseEvent("mouseover", { bubbles: true }));
      });
      assert.ok(document.querySelector('[role="tooltip"]'));
      await act(async () => window.dispatchEvent(new window.Event("resize")));
      assert.equal(document.querySelector('[role="tooltip"]'), null);
    });
  });

  test("selected-item bar keeps compact actions and allows device deletion", async () => {
    await withDom(async ({ root, document }) => {
      const calls = [];
      const actions = {
        onDuplicate: () => calls.push("duplicate"),
        onDelete: () => calls.push("delete"),
      };
      await act(async () =>
        root.render(React.createElement(SelectedItemActionBar, { ...actions, isDevice: false })),
      );
      let buttons = [...document.querySelectorAll("button")];
      assert.deepEqual(
        buttons.map((b) => b.getAttribute("aria-label")),
        ["Duplicate", "Delete"],
      );
      assert.ok(buttons.every((button) => button.textContent === ""));
      await act(async () => buttons.forEach((button) => button.click()));
      assert.deepEqual(calls, ["duplicate", "delete"]);
      await act(async () =>
        root.render(
          React.createElement(SelectedItemActionBar, {
            ...actions,
            isDevice: true,
          }),
        ),
      );
      assert.equal(document.querySelector('[aria-label="Connect device"]'), null);
      assert.equal(document.querySelector('[aria-label="Delete"]').disabled, false);
      await act(async () => document.querySelector('[aria-label="Delete"]').click());
      assert.equal(calls.at(-1), "delete");
      await act(async () =>
        root.render(
          React.createElement(SelectedItemActionBar, {
            ...actions,
            isDevice: true,
            onMap: () => calls.push("map"),
          }),
        ),
      );
      await act(async () => document.querySelector('[aria-label="Connect device"]').click());
      assert.equal(calls.at(-1), "map");
    });
  });

  test("collapsing item properties preserves catalog search", async () => {
    await withDom(async ({ root, document, window }) => {
      const definition = {
        label: "Chair",
        category: "Seating",
        defaultRoomType: "living-room",
        defaultSize: [1, 1, 1],
        resizePolicy: { kind: "fixed" },
      };
      const item = {
        id: "chair",
        kind: "furnishing",
        modelId: "chair",
        size: [1, 1, 1],
        placement: { kind: "absolute", at: [1, 2], elevationMeters: 0, rotationYRadians: 0 },
      };
      let closed = 0;
      const props = {
        items: [item],
        selectedId: item.id,
        furnishingModels: { chair: definition },
        deviceModels: {},
        onPlacementChange() {},
        onSizeChange() {},
        onClose: () => closed++,
      };
      function Harness({ detailsOpen }) {
        const [browsing, onBrowse] = React.useState({ room: "all", query: "" });
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(ArrangeCatalog, {
            furnishingModels: props.furnishingModels,
            deviceModels: {},
            browsing,
            onBrowse,
            onChoose() {},
            enabled: false,
          }),
          detailsOpen && React.createElement(FurnishingInspector, props),
        );
      }
      await act(async () => root.render(React.createElement(Harness, { detailsOpen: false })));
      assert.equal(document.querySelector('[aria-label="Selected furnishing"]'), null);
      const search = document.querySelector('input[placeholder="Search all items…"]');
      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(
          search,
          "Chair",
        );
        search.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
      await act(async () => root.render(React.createElement(Harness, { detailsOpen: true })));
      assert.ok(document.querySelector('[aria-label="Selected furnishing"]'));
      assert.equal(document.querySelector('[aria-label="Add Chair"]').closest("[hidden]"), null);
      assert.equal(document.querySelectorAll('input[inputmode="decimal"]').length, 7);
      await act(async () => document.querySelector('[aria-label="Collapse properties"]').click());
      assert.equal(closed, 1);
      await act(async () => root.render(React.createElement(Harness, { detailsOpen: false })));
      assert.equal(document.querySelector('input[placeholder="Search all items…"]'), search);
      assert.equal(document.querySelector('[aria-label="Selected furnishing"]'), null);
    });
  });
});
