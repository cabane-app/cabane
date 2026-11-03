import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const edits = await load("/apps/web/src/editor-action-bar/action-bar-edits.ts");
  const { ActionBarEditor } = await load("/apps/web/src/editor-action-bar/ActionBarEditor.tsx");
  const { createEmptyHomeProject } = await load(
    "/packages/engine/src/home-project/empty-project.ts",
  );
  const editorProps = {
    deviceModels: {},
    roomPictures: {},
    canUndo: false,
    canRedo: false,
    onUndo() {},
    onRedo() {},
  };

  const projectWithTargets = () => {
    const project = createEmptyHomeProject("test-home", "Test home");
    project.floors[0].rooms = [
      {
        id: "study",
        name: "Study",
        polygon: [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
        accent: "#ffffff",
        dashboardSlots: [],
        devices: [],
      },
    ];
    project.sceneItems = [
      {
        id: "study-lamp",
        kind: "device",
        floorId: "ground-floor",
        modelId: "table-lamp",
        placement: { kind: "absolute", at: [1, 1], elevationMeters: 0, rotationYRadians: 0 },
        size: [0.2, 0.3, 0.2],
        entitySlots: [],
      },
      {
        id: "garden-lamp",
        kind: "device",
        floorId: "ground-floor",
        modelId: "table-lamp",
        placement: { kind: "absolute", at: [20, 20], elevationMeters: 0, rotationYRadians: 0 },
        size: [0.2, 0.3, 0.2],
        entitySlots: [],
      },
    ];
    return project;
  };

  test("slot edits replace, move, and remove without mutating the prior list", () => {
    const before = [
      { id: "a", target: { kind: "built-in", action: "build" } },
      { id: "b", target: { kind: "room", roomId: "study" } },
    ];
    const added = edits.replaceActionBarItem(
      before,
      null,
      { kind: "device", deviceId: "study-lamp" },
      () => "c",
    );
    assert.deepEqual(
      added.map((item) => item.id),
      ["a", "b", "c"],
    );
    assert.deepEqual(
      edits.moveActionBarItem(added, "c", -1).map((item) => item.id),
      ["a", "c", "b"],
    );
    assert.deepEqual(edits.moveActionBarItem(added, "a", -1), added);
    assert.deepEqual(
      edits.removeActionBarItem(added, "b").map((item) => item.id),
      ["a", "c"],
    );
    assert.deepEqual(
      before.map((item) => item.id),
      ["a", "b"],
    );
  });

  test("empty slot opens searchable choices and selects a room from the draft", async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const previous = Object.fromEntries(
      ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
        key,
        globalThis[key],
      ]),
    );
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    const changes = [];
    try {
      await act(async () =>
        root.render(
          React.createElement(ActionBarEditor, {
            ...editorProps,
            project: projectWithTargets(),
            disabled: false,
            onChange: (items) => changes.push(items),
          }),
        ),
      );
      await act(async () => document.querySelector('button[aria-label="Add shortcut"]').click());
      await act(async () =>
        [...document.querySelectorAll("button")]
          .find((button) => button.textContent === "Add room")
          .click(),
      );
      assert.ok(document.querySelector('button[aria-label="Study"]'));
      assert.ok(document.querySelector('input[type="search"]'));
      await act(async () => document.querySelector('button[aria-label="Study"]').click());
      assert.deepEqual(changes.at(-1).at(-1).target, { kind: "room", roomId: "study" });
    } finally {
      await act(async () => root.unmount());
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  });

  test("device choices include outside rooms, use HA names, and retain chosen targets", async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const previous = Object.fromEntries(
      ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
        key,
        globalThis[key],
      ]),
    );
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    const project = projectWithTargets();
    const props = {
      ...editorProps,
      project,
      disabled: false,
      roomNames: { study: "Salon" },
      deviceNames: { "study-lamp": "Climatisation du salon", "garden-lamp": "Garden light" },
      onChange: (items) => {
        project.actionBar = { items };
      },
    };
    try {
      await act(async () => root.render(React.createElement(ActionBarEditor, props)));
      await act(async () => document.querySelector('button[aria-label="Add shortcut"]').click());
      await act(async () =>
        [...document.querySelectorAll("button")]
          .find((button) => button.textContent === "Add device")
          .click(),
      );
      const group = document.querySelector('section[aria-label="Salon"]');
      assert.equal(group.querySelector("h3").textContent, "Salon");
      assert.ok(group.querySelector('button[aria-label="Climatisation du salon · Salon"]'));
      assert.equal(group.querySelectorAll("button").length, 1);
      const outside = document.querySelector('section[aria-label="Outside rooms"]');
      assert.ok(outside.querySelector('button[aria-label="Garden light · Outside rooms"]'));
      await act(async () => outside.querySelector("button").click());
      assert.deepEqual(project.actionBar.items.at(-1).target, {
        kind: "device",
        deviceId: "garden-lamp",
      });
      await act(async () => root.render(React.createElement(ActionBarEditor, props)));
      assert.ok(document.querySelector('button[aria-label="Edit Garden light shortcut"]'));
      assert.equal(document.querySelector('[role="alert"]'), null);
      project.actionBar = {
        items: [{ id: "ac", target: { kind: "device", deviceId: "study-lamp" } }],
      };
      await act(async () => root.render(React.createElement(ActionBarEditor, props)));
      assert.ok(
        document.querySelector('button[aria-label="Edit Climatisation du salon shortcut"]'),
      );
    } finally {
      await act(async () => root.unmount());
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  });

  test("filled slot offers replace, move, remove, and restore defaults", async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const previous = Object.fromEntries(
      ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
        key,
        globalThis[key],
      ]),
    );
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    const changes = [];
    const project = projectWithTargets();
    project.actionBar = {
      items: [
        { id: "build", target: { kind: "built-in", action: "build" } },
        { id: "study-link", target: { kind: "room", roomId: "study" } },
      ],
    };
    try {
      await act(async () =>
        root.render(
          React.createElement(ActionBarEditor, {
            ...editorProps,
            project,
            disabled: false,
            onChange: (items) => changes.push(items),
          }),
        ),
      );
      await act(async () =>
        document.querySelector('button[aria-label="Edit Study shortcut"]').click(),
      );
      const selectedSlot = document.querySelector('button[aria-label="Edit Study shortcut"]');
      const otherSlot = document.querySelector('button[aria-label="Edit Build shortcut"]');
      const addSlot = document.querySelector('button[aria-label="Add shortcut"]');
      const assertSelected = () => {
        assert.equal(selectedSlot.getAttribute("aria-pressed"), "true");
        assert.equal(
          document.querySelectorAll('.scene-action-slot[aria-pressed="true"]').length,
          1,
        );
        assert.ok(document.querySelector('[role="group"][aria-label="Edit Study"]'));
      };
      assertSelected();
      for (const slot of [otherSlot, addSlot]) {
        await act(async () =>
          slot.dispatchEvent(new dom.window.MouseEvent("pointerover", { bubbles: true })),
        );
        assertSelected();
        await act(async () => slot.focus());
        assertSelected();
      }
      await act(async () =>
        selectedSlot.dispatchEvent(
          new dom.window.MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body }),
        ),
      );
      assertSelected();
      for (const label of ["Move left", "Move right", "Remove shortcut"]) {
        assert.ok(document.querySelector(`button[aria-label="${label}"]`), label);
      }
      assert.ok(
        [...document.querySelectorAll("button")].some(
          (button) => button.textContent === "Replace with room",
        ),
      );
      await act(async () => document.querySelector('button[aria-label="Move left"]').click());
      assert.deepEqual(
        changes.at(-1).map((item) => item.id),
        ["study-link", "build"],
      );
      await act(async () =>
        document.querySelector('button[aria-label="Restore defaults"]').click(),
      );
      assert.deepEqual(
        changes.at(-1).map((item) => item.target.action),
        ["build", "walk", "night", "weather", "view"],
      );
    } finally {
      await act(async () => root.unmount());
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  });

  test("missing room shortcut explains how to repair the draft", async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const previous = Object.fromEntries(
      ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
        key,
        globalThis[key],
      ]),
    );
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    const project = projectWithTargets();
    project.actionBar = {
      items: [{ id: "missing", target: { kind: "room", roomId: "removed-room" } }],
    };
    try {
      await act(async () =>
        root.render(
          React.createElement(ActionBarEditor, {
            ...editorProps,
            project,
            disabled: false,
            onChange() {},
          }),
        ),
      );
      const alert = document.querySelector('[role="alert"]');
      assert.ok(alert, "missing shortcut guidance");
      assert.match(alert.textContent, /Replace or remove/);
    } finally {
      await act(async () => root.unmount());
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  });
});
