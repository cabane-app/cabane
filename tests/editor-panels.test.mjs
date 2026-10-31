import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";
import { connectedRuntimeFixture } from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const { useEditorPanels, editorPanelSelection, editorPanelsBusy } = await load(
    "/apps/web/src/editor-workspace/useEditorPanels.ts",
  );
  test("stair placement keeps mobile tools reachable between pointer gestures", () => {
    const controller = {
      unsettled: true,
      stairPlacement: { id: "placing-stairs" },
      dragging: false,
      marqueeSelecting: false,
      constructEditor: { drawStart: null },
    };
    assert.equal(
      editorPanelsBusy(controller),
      false,
      "the connection and shape chooser can reopen",
    );
    assert.equal(
      editorPanelsBusy({ ...controller, dragging: true }),
      true,
      "an active drag still owns the canvas",
    );
    assert.equal(
      editorPanelsBusy({ ...controller, stairPlacement: null }),
      true,
      "other unfinished edits still lock panels",
    );
  });
  const { EditorSelectionDetails } = await load(
    "/apps/web/src/editor-workspace/EditorSelectionDetails.tsx",
  );
  const { EditorValidationPanel } = await load(
    "/apps/web/src/editor-workspace/EditorValidationPanel.tsx",
  );
  const { EditorPanelControls } = await load(
    "/apps/web/src/editor-workspace/EditorPanelControls.tsx",
  );
  const { ConstructionInspector } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionInspector.tsx",
  );
  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { useFurnishingEditor } = await load(
    "/apps/web/src/editor-preview/furnish/useFurnishingEditor.ts",
  );
  const { interactionFloor: floor } = await load("/tests/fixtures/interaction-floor.ts");
  const { createEmptyHomeProject, createEmptyRuntimeBindingProfile, editorWallAttachments } =
    await load("/packages/engine/src/index.ts");
  const definition = {
    label: "A chair with a deliberately long descriptive model name",
    category: "Seating",
    defaultSize: [1, 1, 1],
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  };
  const items = ["one", "two"].map((id) => ({
    id,
    floorId: floor.id,
    kind: "furnishing",
    modelId: "chair",
    size: [1, 1, 1],
    placement: { kind: "absolute", at: [1, 2], elevationMeters: 0, rotationYRadians: 0 },
  }));
  items.push({
    ...items[0],
    id: "light",
    kind: "device",
    modelId: "light",
    entitySlots: [
      {
        id: "light-slot",
        deviceRole: "primary",
        compatibleDomains: ["light"],
        required: true,
        autoMap: "manual",
        presentation: { label: "Light", dashboardRole: "primary" },
      },
    ],
  });
  let editor, furnishing, panels;
  const project = {
    ...createEmptyHomeProject("panels", "Panel test"),
    floors: [floor],
    sceneItems: items,
  };
  const issue = {
    code: "opening.test",
    path: "openings[0]",
    severity: "warning",
    message: "Check this opening.",
    suggestion: "Adjust its dimensions.",
    target: { kind: "opening", id: floor.openings[0].id },
  };
  function Harness({ mode = "construct", busy = false, issues = [issue], shortcuts = false }) {
    editor = useConstructEditor(floor, floor);
    furnishing = useFurnishingEditor(items);
    const selection = editorPanelSelection(
      {
        mode,
        activeFloorId: floor.id,
        constructEditor: editor,
        stairDialog: null,
        furnishingEditor: furnishing,
      },
      shortcuts,
    );
    panels = useEditorPanels(selection, busy, issues.length > 0, mode);
    return React.createElement(
      "main",
      { "data-open": panels.propertiesOpen, "data-mobile-panel": panels.mobileSurface },
      React.createElement("button", { id: "canvas-focus" }, "Canvas"),
      React.createElement(
        "aside",
        { id: "tools" },
        React.createElement(ConstructionInspector, { editor }),
      ),
      React.createElement(EditorSelectionDetails, {
        mode,
        constructEditor: editor,
        furnishingEditor: furnishing,
        selectedOpening:
          editor.selection?.kind === "opening"
            ? editorWallAttachments(editor.draft).find(({ id }) => id === editor.selection.id)
            : null,
        selectedItem: furnishing.selectedItem,
        placementFloor: editor.previewFloor,
        visualSceneItems: furnishing.items,
        furnishingModels: { chair: definition },
        deviceModels: {
          light: {
            ...definition,
            label: "Light",
            category: "Lighting",
            lighting: { position: [0, 0.5, 0], color: "#ffffff", maxIntensity: 2, distance: 5 },
          },
        },
        snapshot: { project },
        connect: {
          profile: createEmptyRuntimeBindingProfile(project.home.id),
          displayRuntime: connectedRuntimeFixture({ status: "disconnected", canMutate: false }),
          selectSlot: () => false,
          assignEntities() {},
        },
        selectMode() {},
        stairDialog: null,
        commit() {},
        floorZoneDrawing: { active: false, cancel() {} },
        floorFinish: { kind: "preset", preset: "light-oak" },
        floorPaintTarget: "room",
        setFloorFinish() {},
        setFloorPaintTarget() {},
        liveStairIssues: null,
        disabled: busy,
        open: panels.propertiesOpen && !shortcuts,
        onCollapse: panels.collapseProperties,
      }),
      React.createElement(EditorValidationPanel, {
        issues,
        expanded: panels.issuesExpanded,
        onToggle: panels.toggleIssues,
        onSelect: () => {
          editor.selectOpening(floor.openings[0].id);
          panels.openProperties();
        },
      }),
      React.createElement(EditorPanelControls, {
        panels,
        issueCount: issues.length,
        disabled: busy,
      }),
    );
  }
  async function withDom(run) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://cabane.local/" });
    const names = [
      "window",
      "document",
      "navigator",
      "HTMLElement",
      "IS_REACT_ACT_ENVIRONMENT",
      "IntersectionObserver",
      "ResizeObserver",
    ];
    const previous = Object.fromEntries(
      names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    );
    for (const name of names)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value: name === "IS_REACT_ACT_ENVIRONMENT" ? true : dom.window[name],
      });
    globalThis.IntersectionObserver = globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await run(root, dom.window.document, dom.window);
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      for (const name of names) {
        if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
        else delete globalThis[name];
      }
    }
  }
  test("selection opens properties without stealing focus; collapse survives edits and a different selection reopens", async () => {
    await withDom(async (root, document) => {
      await act(async () => root.render(React.createElement(Harness)));
      const anchor = document.getElementById("canvas-focus");
      anchor.focus();
      await act(async () => editor.selectWall(floor.walls[0].id));
      assert.equal(document.querySelector(".selection-details h2").textContent, "Wall");
      assert.equal(document.activeElement, anchor);
      assert.equal(
        document.getElementById("tools").querySelector('[aria-label="Wall height"]'),
        null,
      );
      assert.ok(document.querySelector('.selection-details [aria-label="Wall height"]'));
      await act(async () => document.querySelector('[aria-label="Collapse properties"]').click());
      assert.equal(editor.selection.id, floor.walls[0].id);
      assert.equal(document.querySelector(".selection-details"), null);
      await act(async () => editor.updateSelectedWallMetadata({ heightMeters: 3 }));
      assert.equal(document.querySelector(".selection-details"), null);
      await act(async () => document.querySelector(".editor-properties-toggle").click());
      assert.equal(document.querySelector('[aria-label="Wall height"]').value, "3");
      await act(async () => panels.collapseProperties());
      await act(async () => editor.selectOpening(floor.openings[0].id));
      assert.ok(document.querySelector('.selection-details [aria-label="Opening width"]'));
      assert.equal(document.activeElement, anchor);
      await act(async () => editor.clearSelection());
      assert.equal(document.querySelector(".selection-details"), null);
      assert.equal(document.querySelector(".editor-properties-toggle"), null);
    });
  });
  test("mobile panels open only on request, preserve selection on dismissal and close across modes", async () => {
    await withDom(async (root) => {
      await act(async () => root.render(React.createElement(Harness)));
      assert.equal(panels.mobileOpen, false);
      await act(async () => editor.selectWall(floor.walls[0].id));
      assert.equal(panels.propertiesOpen, true, "desktop still opens Properties on selection");
      assert.equal(panels.mobileOpen, false, "canvas selection leaves the mobile panel closed");
      await act(async () => panels.openProperties());
      assert.equal(panels.mobileOpen, true);
      await act(async () => panels.closeMobilePanel());
      assert.equal(editor.selection.id, floor.walls[0].id);
      assert.equal(panels.propertiesOpen, true);
      await act(async () => editor.updateSelectedWallMetadata({ heightMeters: 3 }));
      assert.equal(panels.mobileOpen, false);
      await act(async () => panels.showTools());
      assert.equal(panels.mobileOpen, true);
      assert.equal(panels.mobileSurface, "tools");
      await act(async () => root.render(React.createElement(Harness, { mode: "furnish" })));
      assert.equal(panels.mobileOpen, false);
      await act(async () => panels.showIssues());
      await act(async () =>
        root.render(React.createElement(Harness, { mode: "furnish", issues: [] })),
      );
      assert.equal(panels.mobileOpen, false, "resolved issues do not leave an empty dialog open");
    });
  });
  test("panel changes wait for drag, drawing or marquee completion, including deselection", async () => {
    await withDom(async (root, document) => {
      await act(async () => root.render(React.createElement(Harness, { busy: true })));
      await act(async () => editor.selectWall(floor.walls[0].id));
      assert.equal(panels.propertiesOpen, false);
      await act(async () => root.render(React.createElement(Harness, { busy: false })));
      assert.equal(panels.propertiesOpen, true);
      await act(async () => root.render(React.createElement(Harness, { busy: true })));
      await act(async () => editor.clearSelection());
      assert.equal(panels.propertiesOpen, true);
      assert.equal(document.querySelector("main").getAttribute("data-open"), "true");
      await act(async () => root.render(React.createElement(Harness, { busy: false })));
      assert.equal(panels.propertiesOpen, false);
    });
  });
  test("furniture, devices and groups use the same inspector and retain numeric edits and undo", async () => {
    await withDom(async (root, document, window) => {
      await act(async () => root.render(React.createElement(Harness, { mode: "furnish" })));
      await act(async () => furnishing.select("one"));
      assert.equal(document.querySelector(".selection-details h2").textContent, definition.label);
      const width = [...document.querySelectorAll("label")].find((label) =>
        label.textContent.startsWith("Width"),
      );
      await act(async () => {
        width.control.value = "2,5";
        width.control.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
      await act(async () =>
        width.control.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true })),
      );
      assert.equal(furnishing.items[0].size[0], 2.5);
      await act(async () => furnishing.undo());
      assert.equal(furnishing.items[0].size[0], 1);
      await act(async () => furnishing.select("light"));
      assert.ok(document.querySelector('[aria-label="Selected device"]'));
      assert.ok(
        [...document.querySelectorAll("select")].some((select) =>
          select.textContent.includes("Night only"),
        ),
      );
      await act(async () => furnishing.selectMany(["one", "two"]));
      assert.equal(document.querySelector(".selection-details h2").textContent, "2 items");
      const remove = [...document.querySelectorAll("button")].find(
        (button) => button.textContent === "Delete selection",
      );
      await act(async () => remove.click());
      assert.deepEqual(
        furnishing.items.map(({ id }) => id),
        ["light"],
      );
      await act(async () => furnishing.undo());
      assert.equal(furnishing.items.length, 3);
    });
  });
  test("Issues stays outside tools, updates quietly, retains expansion across modes and Locate opens collapsed properties", async () => {
    await withDom(async (root, document) => {
      await act(async () => root.render(React.createElement(Harness)));
      const disclosure = () => document.querySelector(".editor-issues__disclosure");
      assert.equal(disclosure().getAttribute("aria-expanded"), "false");
      assert.equal(document.querySelector(".editor-issues ul").hidden, true);
      assert.equal(document.getElementById("tools").querySelector(".editor-issues"), null);
      await act(async () =>
        root.render(
          React.createElement(Harness, {
            issues: [issue, { ...issue, code: "another", severity: "error" }],
          }),
        ),
      );
      assert.equal(disclosure().getAttribute("aria-expanded"), "false");
      assert.match(disclosure().textContent, /1 error.*1 warning/);
      await act(async () => disclosure().click());
      assert.equal(document.querySelector(".editor-issues ul").hidden, false);
      await act(async () => root.render(React.createElement(Harness, { mode: "furnish" })));
      assert.equal(disclosure().getAttribute("aria-expanded"), "true");
      await act(async () => root.render(React.createElement(Harness)));
      await act(async () => editor.selectOpening(floor.openings[0].id));
      await act(async () => panels.collapseProperties());
      await act(async () => document.querySelector(".editor-issues li button").click());
      assert.ok(document.querySelector('.selection-details [aria-label="Opening width"]'));
      assert.equal(panels.mobileSurface, "properties");
      await act(async () => panels.showTools());
      assert.equal(panels.mobileSurface, "tools");
      await act(async () => root.render(React.createElement(Harness, { issues: [] })));
      assert.equal(document.querySelector(".editor-issues"), null);
      await act(async () => root.render(React.createElement(Harness, { shortcuts: true })));
      assert.equal(document.querySelector(".selection-details"), null);
    });
  });
});
