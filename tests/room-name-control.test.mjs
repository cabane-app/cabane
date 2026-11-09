import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { RoomNameControl } = await load(
    "/apps/web/src/editor-preview/construct/RoomNameControl.tsx",
  );
  const { useHomeEditorShortcuts } = await load(
    "/apps/web/src/editor-workspace/useHomeEditorShortcuts.ts",
  );
  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { createEmptyHomeProject, deriveFloorTopology, createFloorEditorDraft } = await load(
    "/packages/engine/src/index.ts",
  );
  async function withDom(run) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://localhost",
      pretendToBeVisual: true,
    });
    const globals = {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      addEventListener: dom.window.addEventListener.bind(dom.window),
      removeEventListener: dom.window.removeEventListener.bind(dom.window),
      HTMLInputElement: dom.window.HTMLInputElement,
      Event: dom.window.Event,
      IS_REACT_ACT_ENVIRONMENT: true,
      requestAnimationFrame: (callback) => {
        callback();
        return 0;
      },
    };
    const previous = Object.fromEntries(Object.keys(globals).map((key) => [key, globalThis[key]]));
    Object.assign(globalThis, globals);
    // React's input polyfill may initialize before jsdom is mounted.
    dom.window.HTMLElement.prototype.attachEvent = () => {};
    dom.window.HTMLElement.prototype.detachEvent = () => {};
    const root = createRoot(document.getElementById("root"));
    try {
      await run({ dom, root });
    } finally {
      await act(async () => root.unmount());
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  }
  const click = async (element) => act(async () => element.click());
  const type = async (dom, input, value) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
        input,
        value,
      );
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      input.dispatchEvent(new dom.window.KeyboardEvent("keyup", { key: "o", bubbles: true }));
    });
  const key = async (dom, input, key) =>
    act(async () =>
      input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true })),
    );

  test("inline naming commits once, trims, ignores blank input, and cancels Escape", async () =>
    withDom(async ({ dom, root }) => {
      const committed = [];
      await act(async () =>
        root.render(
          React.createElement(RoomNameControl, {
            roomId: "room",
            name: "",
            disabled: false,
            onCommit: (name) => committed.push(name),
          }),
        ),
      );
      assert.equal(document.querySelector("button").getAttribute("aria-label"), "Name room");
      await click(document.querySelector("button"));
      let input = document.querySelector("input");
      assert.equal(document.activeElement, input);
      await type(dom, input, "  Studio  ");
      await key(dom, input, "Enter");
      assert.deepEqual(committed, ["Studio"]);
      await click(document.querySelector("button"));
      input = document.querySelector("input");
      await type(dom, input, "   ");
      await act(async () => input.blur());
      assert.deepEqual(committed, ["Studio"]);
      await click(document.querySelector("button"));
      input = document.querySelector("input");
      await type(dom, input, "Cancelled");
      await key(dom, input, "Escape");
      assert.deepEqual(committed, ["Studio"]);
    }));

  test("labels isolate pointer and keyboard shortcuts; tutorial focus and locks work", async () =>
    withDom(async ({ dom, root }) => {
      let events = 0;
      const props = { roomId: "room", name: "Studio", disabled: false, onCommit: () => {} };
      const render = (child) =>
        root.render(
          React.createElement(
            "div",
            { onKeyDown: () => events++, onPointerDown: () => events++, onClick: () => events++ },
            child,
          ),
        );
      await act(async () => render(React.createElement(RoomNameControl, props)));
      await click(document.querySelector("button"));
      const input = document.querySelector("input");
      await key(dom, input, "w");
      await act(async () =>
        input.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })),
      );
      assert.equal(events, 0);
      await key(dom, input, "Escape");
      await act(async () =>
        render(
          React.createElement(RoomNameControl, {
            ...props,
            focusRequest: { roomId: "room", serial: 1 },
          }),
        ),
      );
      assert.equal(document.activeElement, document.querySelector("input"));
      await act(async () =>
        render(React.createElement(RoomNameControl, { ...props, disabled: true })),
      );
      assert.equal(document.querySelector("input"), null);
      assert.equal(document.querySelector("button").disabled, true);
    }));

  test("capture shortcuts ignore typing at name labels and tutorial actions but allow undo after naming", async () =>
    withDom(async ({ dom, root }) => {
      const tools = [];
      let undos = 0;
      function Harness() {
        useHomeEditorShortcuts({
          mode: "construct",
          constructEditor: { setTool: (tool) => tools.push(tool) },
          constructMeasure: {},
          floorZoneDrawing: {},
          furnishingEditor: {},
          undoProject: () => undos++,
          redoProject: () => {},
          clearConstructionSelection: () => {},
          clearFurnishingSelection: () => {},
        });
        return React.createElement(
          "div",
          null,
          React.createElement(RoomNameControl, {
            roomId: "room",
            name: "Studio",
            disabled: false,
            onCommit: () => {},
          }),
          React.createElement(
            "div",
            { className: "build-tutorial" },
            React.createElement("button", null, "Name room"),
          ),
        );
      }
      await act(async () => root.render(React.createElement(Harness)));
      const label = document.querySelector(".construction-room-name button");
      await key(dom, label, "m");
      await key(dom, document.querySelector(".build-tutorial button"), "w");
      assert.deepEqual(tools, []);
      await act(async () =>
        label.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
        ),
      );
      assert.equal(undos, 1);
      await click(label);
      await key(dom, document.querySelector("input"), "d");
      assert.deepEqual(tools, []);
    }));

  test("an active elevation handle owns Escape before the workspace deselection shortcut", async () =>
    withDom(async ({ dom, root }) => {
      let cleared = 0,
        cancelled = 0;
      function Harness() {
        useHomeEditorShortcuts({
          mode: "construct",
          dragging: true,
          constructEditor: {},
          constructMeasure: {},
          floorZoneDrawing: {},
          furnishingEditor: {},
          clearConstructionSelection: () => cleared++,
          setDragging: () => {},
        });
        return React.createElement(
          "button",
          {
            className: "elevation-drag-handle",
            onKeyDown: (event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelled++;
              }
            },
          },
          "Level",
        );
      }
      await act(async () => root.render(React.createElement(Harness)));
      await key(dom, document.querySelector("button"), "Escape");
      assert.equal(cancelled, 1);
      assert.equal(cleared, 0);
    }));

  test("initial Wall selection does not override later tool choices or history", async () =>
    withDom(async ({ root }) => {
      const blank = createEmptyHomeProject("test", "Test").floors[0];
      let editor;
      function Harness() {
        editor = useConstructEditor(blank, blank, "#c97370", "wall");
        return null;
      }
      await act(async () => root.render(React.createElement(Harness)));
      assert.equal(editor.tool, "wall");
      await act(async () => editor.setTool("door"));
      await act(async () => root.render(React.createElement(Harness)));
      assert.equal(editor.tool, "door");
    }));

  test("on-canvas metadata changes use one undoable edit without requiring room selection", async () =>
    withDom(async ({ root }) => {
      const blank = createEmptyHomeProject("test", "Test").floors[0];
      const walls = [
        { id: "a", from: [0, 0], to: [4, 0] },
        { id: "b", from: [4, 0], to: [4, 3] },
        { id: "c", from: [4, 3], to: [0, 3] },
        { id: "d", from: [0, 3], to: [0, 0] },
      ];
      const floor = deriveFloorTopology({ ...createFloorEditorDraft(blank), walls }).floor;
      let editor;
      function Harness() {
        editor = useConstructEditor(floor, blank);
        return null;
      }
      await act(async () => root.render(React.createElement(Harness)));
      const roomId = editor.previewFloor.rooms[0].id;
      await act(async () => editor.updateRoom(roomId, { name: "Studio" }));
      assert.equal(editor.previewFloor.rooms[0].name, "Studio");
      await act(async () => editor.undo());
      assert.equal(editor.previewFloor.rooms[0].name, "Unnamed room 1");
      await act(async () => editor.redo());
      assert.equal(editor.previewFloor.rooms[0].name, "Studio");
    }));
});
