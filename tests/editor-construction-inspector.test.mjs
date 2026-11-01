import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { wallFinishSides } = await load(
    "/apps/web/src/editor-preview/construct/wall-finish-sides.ts",
  );
  const { WallFinishFields } = await load(
    "/apps/web/src/editor-preview/construct/WallFinishFields.tsx",
  );
  const { WallFinishPreviewProvider, useWallFinishPreview } = await load(
    "/apps/web/src/editor-preview/construct/WallFinishPreview.tsx",
  );

  const { ConstructionInspector } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionInspector.tsx",
  );
  const { ConstructionSelectionProperties } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionSelectionProperties.tsx",
  );
  const {
    createFloorEditorDraft,
    deriveFloorTopology,
    composeHomeBindingManifest,
    parseHomeProjectSchema,
    collectBindingSlots,
  } = await load("/packages/engine/src/index.ts");
  function ConstructionPanels(props) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(ConstructionInspector, props),
      props.editor.selection &&
        props.editor.selection.kind !== "opening" &&
        React.createElement(ConstructionSelectionProperties, { ...props, onClose() {} }),
    );
  }
  const { EditorValidationPanel } = await load(
    "/apps/web/src/editor-workspace/EditorValidationPanel.tsx",
  );
  const { FloorPaintConfirmation } = await load(
    "/apps/web/src/editor-preview/construct/FloorPaintConfirmation.tsx",
  );

  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { OpeningColorControls } = await load(
    "/apps/web/src/editor-preview/construct/OpeningColorControls.tsx",
  );
  const { ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { OpeningDetails } = await load(
    "/apps/web/src/editor-preview/construct/OpeningDetails.tsx",
  );
  const { OpeningOrientationControls } = await load(
    "/apps/web/src/editor-preview/construct/OpeningOrientationControls.tsx",
  );
  const { SelectedOpeningActionBar } = await load(
    "/apps/web/src/editor-preview/construct/SelectedOpeningControls.tsx",
  );

  test("window and door color pickers update the published floor preview, undo/redo, and reset", async () => {
    for (const kind of ["door", "window"]) {
      await withDom(async ({ dom, root }) => {
        const floor = ownerHomeProject.floors[0];
        const id = floor.openings.find((opening) => opening.kind === kind).id;
        let controller;
        function Harness() {
          controller = useConstructEditor(floor);
          return React.createElement(OpeningColorControls, {
            opening: controller.draft.openings.find((opening) => opening.id === id),
            onChange: controller.replaceSelectedOpening,
          });
        }
        await act(async () => root.render(React.createElement(Harness)));
        await act(async () => controller.selectOpening(id));
        const input = dom.window.document.querySelector('input[type="color"]');
        assert.ok(input);
        assert.equal(
          controller.previewFloor.openings.find((opening) => opening.id === id).color,
          undefined,
        );
        await act(async () => {
          input.value = "#325a84";
          input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        });
        assert.equal(
          controller.previewFloor.openings.find((opening) => opening.id === id).color,
          "#325a84",
        );
        await act(async () => controller.undo());
        assert.equal(
          controller.previewFloor.openings.find((opening) => opening.id === id).color,
          undefined,
        );
        await act(async () => controller.redo());
        assert.equal(
          controller.previewFloor.openings.find((opening) => opening.id === id).color,
          "#325a84",
        );
        const reset = [...dom.window.document.querySelectorAll("button")].find(
          (button) => button.textContent === "Reset color",
        );
        await act(async () => reset.click());
        assert.equal(
          controller.previewFloor.openings.find((opening) => opening.id === id).color,
          undefined,
        );
      });
    }
  });

  test("construction names commit, cancel and survive history, reopening and connection composition", async (context) => {
    const previousObservers = {
      IntersectionObserver: globalThis.IntersectionObserver,
      ResizeObserver: globalThis.ResizeObserver,
    };
    context.after(() => Object.assign(globalThis, previousObservers));
    globalThis.IntersectionObserver = globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    for (const kind of ["wall", "invisible-wall", "door", "window", "passage"]) {
      const isWall = kind === "wall" || kind === "invisible-wall";
      await withDom(async ({ dom, root }) => {
        const floor = {
          ...ownerHomeProject.floors[0],
          walls: ownerHomeProject.floors[0].walls.map((wall) =>
            isWall
              ? { ...wall, ...(kind === "invisible-wall" ? { virtual: true } : {}) }
              : { ...wall, name: "Kitchen wall" },
          ),
        };
        if (kind === "invisible-wall") floor.openings = [];
        if (kind === "passage") {
          const source = floor.openings.find((opening) => opening.kind === "window");
          floor.openings = floor.openings.map((opening) =>
            opening.id === source.id
              ? {
                  id: source.id,
                  kind: "passage",
                  shape: "rectangular",
                  wallId: source.wallId,
                  offsetFromWallStartPlanUnits: source.offsetFromWallStartPlanUnits,
                  widthPlanUnits: source.widthPlanUnits,
                  openingHeightMeters: source.openingHeightMeters,
                  sillHeightMeters: 0,
                }
              : opening,
          );
        }
        const item = isWall ? floor.walls[0] : floor.openings.find((entry) => entry.kind === kind);
        let controller;
        function Harness() {
          controller = useConstructEditor(floor);
          return isWall
            ? React.createElement(ConstructionSelectionProperties, {
                editor: controller,
                onClose() {},
              })
            : React.createElement(OpeningDetails, {
                opening: controller.draft.openings.find((entry) => entry.id === item.id),
                editor: controller,
                disabled: false,
                onClose() {},
              });
        }
        await act(async () => root.render(React.createElement(Harness)));
        await act(async () =>
          isWall ? controller.selectWall(item.id) : controller.selectOpening(item.id),
        );
        const input = () =>
          dom.window.document.querySelector(`[aria-label="${isWall ? "Wall" : "Opening"} name"]`);
        const current = () =>
          (isWall ? controller.previewFloor.walls : controller.previewFloor.openings).find(
            (entry) => entry.id === item.id,
          );
        const heading = () =>
          dom.window.document.querySelector(".selection-details h2").textContent;
        const typeLabel =
          kind === "invisible-wall" ? "Invisible wall" : kind[0].toUpperCase() + kind.slice(1);
        assert.equal(heading(), typeLabel);
        assert.equal(input().placeholder, item.id);
        dom.window.HTMLElement.prototype.attachEvent = () => {};
        dom.window.HTMLElement.prototype.detachEvent = () => {};
        const type = async (value) => {
          await act(async () => input().focus());
          await act(async () => {
            Object.getOwnPropertyDescriptor(
              dom.window.HTMLInputElement.prototype,
              "value",
            ).set.call(input(), value);
            input().dispatchEvent(new dom.window.Event("input", { bubbles: true }));
            input().dispatchEvent(
              new dom.window.KeyboardEvent("keyup", { key: "o", bubbles: true }),
            );
          });
        };
        const key = async (key) =>
          act(async () =>
            input().dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true })),
          );
        const name = `Kitchen ${kind}`;
        await type(`  ${name}  `);
        await key("Enter");
        assert.equal(current().name, name);
        assert.equal(current().id, item.id);
        assert.equal(heading(), name);
        assert.equal(
          dom.window.document.querySelector(".selection-details__header p").textContent,
          `${typeLabel} · ${floor.name}`,
        );
        if (!isWall) {
          assert.equal(
            dom.window.document.querySelector('[aria-label="Opening wall"]').value,
            "Kitchen wall",
          );
          await act(async () => controller.updateWallMetadata(item.wallId, { name: "Patio wall" }));
          assert.equal(
            dom.window.document.querySelector('[aria-label="Opening wall"]').value,
            "Patio wall",
          );
          await act(async () => controller.updateWallMetadata(item.wallId, { name: undefined }));
          assert.equal(
            dom.window.document.querySelector('[aria-label="Opening wall"]').value,
            item.wallId,
          );
          await act(async () => controller.undo());
          await act(async () => controller.undo());
        }
        await type("Cancelled");
        await key("Escape");
        assert.equal(input().value, name);
        assert.equal(current().name, name);
        await act(async () => controller.undo());
        assert.equal(current().name, undefined);
        assert.equal(heading(), typeLabel);
        await act(async () => controller.redo());
        assert.equal(current().name, name);
        assert.equal(heading(), name);
        if (kind === "door") {
          await act(async () =>
            dom.window.document.querySelector('[aria-label="Door presets"] button').click(),
          );
          assert.equal(current().name, name);
        }
        const saved = JSON.parse(JSON.stringify(controller.previewFloor));
        const reopened = deriveFloorTopology(createFloorEditorDraft(saved)).floor;
        assert.equal(
          (isWall ? reopened.walls : reopened.openings).find((entry) => entry.id === item.id).name,
          name,
        );
        const project = {
          ...ownerHomeProject,
          floors: ownerHomeProject.floors.map((entry) => (entry.id === floor.id ? saved : entry)),
        };
        assert.equal(parseHomeProjectSchema(project).valid, true);
        if (kind === "door" || kind === "window") {
          const slots = collectBindingSlots(
            composeHomeBindingManifest(project, neutralDemoManifest.extensions),
          );
          const slot = slots.find((entry) => entry.openingId === item.id);
          assert.equal(
            slot.spec.presentation.label,
            `${kind === "door" ? "Door" : "Window"} · ${name}`,
          );
          const previousSlot = collectBindingSlots(
            composeHomeBindingManifest(ownerHomeProject, neutralDemoManifest.extensions),
          ).find((entry) => entry.openingId === item.id);
          assert.equal(slot.slotId, previousSlot.slotId);
        }
        await type("   ");
        await act(async () => input().blur());
        assert.equal(current().name, undefined);
        assert.equal(input().placeholder, item.id);
        assert.equal(heading(), typeLabel);
      });
    }
  });

  const wall = { id: "living-east", from: [0, 0], to: [4.25, 0] };
  const opening = {
    id: "living-window",
    kind: "window",
    operation: "casement",
    variant: "plain",
    panelCount: 1,
    glazing: "clear",
    wallId: wall.id,
    offsetPlanUnits: 1.2,
    widthPlanUnits: 1.4,
    openingHeightMeters: 1.2,
    sillHeightMeters: 0.8,
  };
  const editor = (selection, actions = {}) => ({
    previewFloor: {
      ...neutralDemoManifest.floors[0],
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      rooms: Array.from({ length: 3 }, (_, i) => ({
        ...neutralDemoManifest.floors[0].rooms[0],
        id: `room-${i}`,
      })),
      walls: [{ ...wall, classification: "exterior", thicknessMeters: 0.2 }],
    },
    draft: {
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      walls: [wall, { id: "living-south", from: [4.25, 0], to: [4.25, 3] }],
      openings: [opening],
      rooms: [],
      defaultWallHeightMeters: 2.5,
      defaultCeilingHeightMeters: 2.5,
      exteriorWallThicknessMeters: 0.2,
      interiorWallThicknessMeters: 0.12,
    },
    selection,
    tool: "select",
    wallRuns: [],
    exteriorWallColor: "#c97370",
    defaultExteriorWallColor: "#c97370",
    canUndo: true,
    canRedo: false,
    topologyIssues: actions.topologyIssues ?? [],
    setTool: actions.setTool ?? (() => undefined),
    undo: () => undefined,
    redo: () => undefined,
    selectWall: actions.selectWall ?? (() => undefined),
    selectOpening: actions.selectOpening ?? (() => undefined),
    selectRoom: actions.selectRoom ?? (() => undefined),
    setExteriorWallColor: actions.setExteriorWallColor ?? (() => undefined),
    updateWallEndpoint: () => undefined,
    updateSelectedWallMetadata: actions.updateSelectedWallMetadata ?? (() => undefined),
    addOpening: actions.addOpening ?? (() => undefined),
    updateSelectedOpening: () => undefined,
    deleteSelected: actions.deleteSelected ?? (() => undefined),
  });

  const withDom = async (run) => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://cabane.local/",
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
    dom.window.HTMLCanvasElement.prototype.getContext = function getContext() {
      return new Proxy(
        {
          canvas: this,
          createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        },
        {
          set(target, property, value) {
            target[property] = value;
            return true;
          },
          get(target, property) {
            if (property in target) return target[property];
            return () => undefined;
          },
        },
      );
    };
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
        Event: previous.Event,
        IS_REACT_ACT_ENVIRONMENT: previous.actEnvironment,
      });
    }
  };

  test("keeps wall properties simple and moves tools out of the inspector", async () => {
    await withDom(async ({ dom, root }) => {
      await act(async () =>
        root.render(
          React.createElement(ConstructionPanels, {
            editor: editor({ kind: "wall", id: wall.id }),
          }),
        ),
      );

      const document = dom.window.document;
      assert.equal(document.querySelector(".selection-details h2").textContent, "Wall");
      assert.match(document.body.textContent, /4\.25 m/);
      assert.doesNotMatch(
        document.body.textContent,
        /Choose what to place|Place door|Place window|Place passage/,
      );
      assert.doesNotMatch(document.body.textContent, /Structure data/);
      assert.equal(document.querySelector("[aria-label='from X coordinate']"), null);

      assert.ok(document.querySelector('[aria-label="Wall thickness"]'));
      assert.ok(document.querySelector('[aria-label="Wall height"]'));
      assert.equal(document.querySelector('[aria-label="Construction tools"]'), null);
      assert.equal(document.querySelector('[aria-label="Construction history"]'), null);
      assert.equal(document.querySelector(".construction-inspector__counts"), null);
    });
  });

  test("edits an exterior wall color and keeps the same value in the wall tool", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const calls = [];
    const controller = editor(
      { kind: "wall", id: wall.id },
      {
        setExteriorWallColor: (color) => calls.push(["remember", color]),
        updateSelectedWallMetadata: (changes) => calls.push(["wall", changes]),
      },
    );
    await withDom(async ({ dom, root }) => {
      await act(async () =>
        root.render(
          React.createElement(ConstructionPanels, {
            editor: controller,
          }),
        ),
      );
      const selectedColor = dom.window.document.querySelector('[aria-label="Wall exterior color"]');
      assert.equal(selectedColor.value, "#c97370");
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
        selectedColor,
        "#b86f58",
      );
      await act(async () => {
        selectedColor.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        context.mock.timers.tick(159);
        assert.deepEqual(calls, [], "color changes remain pending before the debounce deadline");
        context.mock.timers.tick(1);
      });
      assert.deepEqual(calls, [
        ["remember", "#b86f58"],
        ["wall", { exteriorColor: "#b86f58", faceColors: undefined }],
      ]);
      calls.length = 0;

      controller.tool = "wall";
      controller.exteriorWallColor = "#b86f58";
      await act(async () =>
        root.render(
          React.createElement(ConstructionPanels, {
            editor: controller,
          }),
        ),
      );
      const drawingColor = dom.window.document.querySelector(
        '[aria-label="New wall exterior color"]',
      );
      assert.equal(drawingColor.value, "#b86f58");
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
        drawingColor,
        "#9b5e4b",
      );
      await act(async () => {
        drawingColor.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        context.mock.timers.tick(159);
        assert.deepEqual(calls, [], "color changes remain pending before the debounce deadline");
        context.mock.timers.tick(1);
      });
      assert.deepEqual(calls, [
        ["remember", "#9b5e4b"],
        ["wall", { exteriorColor: "#9b5e4b" }],
      ]);
    });
  });

  test("Floor tool offers finish and custom-area controls", async () => {
    const calls = [];
    const controller = editor(null);
    controller.tool = "floor";
    await withDom(async ({ dom, root }) => {
      await act(async () =>
        root.render(
          React.createElement(ConstructionPanels, {
            editor: controller,
            floorPainting: {
              finish: { kind: "preset", preset: "travertine" },
              target: "room",
              drawingActive: false,
              drawingError: null,
              onFinishChange: (finish) => calls.push(["finish", finish]),
              onTargetChange: (target) => calls.push(["target", target]),
              onCancelDrawing: () => calls.push(["cancel"]),
            },
          }),
        ),
      );
      const document = dom.window.document;
      assert.ok(document.querySelector('[aria-label="Light oak 2"]'));
      assert.ok(document.querySelector('[aria-label="Sand"]'));
      assert.ok(document.querySelector('[aria-label="Gravel"]'));
      assert.equal(
        document.querySelector('[aria-label="Travertine"]').getAttribute("aria-pressed"),
        "true",
      );
      await act(async () => document.querySelector('[aria-label="Custom area"]').click());
      assert.deepEqual(calls.at(-1), ["target", "custom-area"]);
    });
  });

  test("whole-room confirmation focuses Keep and exposes all three outcomes", async () => {
    const calls = [];
    await withDom(async ({ dom, root }) => {
      await act(async () =>
        root.render(
          React.createElement(FloorPaintConfirmation, {
            roomName: "Kitchen",
            onKeepZones: () => calls.push("keep"),
            onReplaceEverything: () => calls.push("replace"),
            onCancel: () => calls.push("cancel"),
          }),
        ),
      );
      const buttons = [...dom.window.document.querySelectorAll("dialog button")];
      assert.deepEqual(
        buttons.map((button) => button.textContent),
        ["Keep custom areas", "Replace everything", "Cancel"],
      );
      assert.equal(dom.window.document.activeElement, buttons[0]);
      await act(async () => buttons[1].click());
      await act(async () => buttons[2].click());
      assert.deepEqual(calls, ["replace", "cancel"]);
    });
  });

  test("teaches Shift-drag marquee selection while Select is idle", async () => {
    await withDom(async ({ dom, root }) => {
      await act(async () =>
        root.render(
          React.createElement(ConstructionPanels, {
            editor: editor(null),
            planImportControls: React.createElement(
              "section",
              { "aria-label": "Build from a floor plan" },
              "Have a floor plan?",
            ),
          }),
        ),
      );
      assert.match(dom.window.document.body.textContent, /Hold Shift and drag to select several/);
      assert.match(dom.window.document.body.textContent, /Delete or Backspace/);
      assert.ok(
        dom.window.document.body.textContent.indexOf("Hold Shift and drag") <
          dom.window.document.body.textContent.indexOf("Have a floor plan?"),
      );
    });
  });

  test("Use as room keeps structural conversion reversible through history and reopening", async () => {
    await withDom(async ({ dom, root }) => {
      const floor = ownerHomeProject.floors[0];
      const room = floor.rooms[0];
      let controller;
      function Harness() {
        controller = useConstructEditor(floor);
        return React.createElement(ConstructionSelectionProperties, {
          editor: controller,
          onClose() {},
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      await act(async () => controller.selectRoom(room.id));
      const toggle = dom.window.document.querySelector('[role="switch"]');
      assert.ok(toggle);
      assert.equal(
        dom.window.document.getElementById(toggle.getAttribute("aria-labelledby")).textContent,
        "Use as room",
      );
      assert.equal(
        dom.window.document.getElementById(toggle.getAttribute("aria-describedby")).textContent,
        "Turn off to fill a cupboard, shaft or pillar as a structural block, without room navigation or area mapping.",
      );
      const section = toggle.closest("fieldset");
      assert.equal(section.querySelector("legend").textContent, "Room");
      assert.equal(toggle.getAttribute("aria-checked"), "true");
      assert.ok(dom.window.document.querySelector('[aria-label="Room name"]'));
      await act(async () => toggle.click());
      assert.equal(toggle.getAttribute("aria-checked"), "false");
      assert.equal(dom.window.document.querySelector('[aria-label="Room name"]'), null);
      assert.equal(dom.window.document.querySelector('[aria-label="Room ceiling height"]'), null);
      assert.ok(
        [...dom.window.document.querySelectorAll("button")].some(
          (button) => button.textContent === "Delete space",
        ),
      );
      assert.equal(
        controller.previewFloor.rooms.find((candidate) => candidate.id === room.id).isSolid,
        true,
      );
      assert.equal(controller.previewFloor.walls.length, floor.walls.length);
      await act(async () => controller.undo());
      assert.notEqual(
        controller.previewFloor.rooms.find((candidate) => candidate.id === room.id).isSolid,
        true,
      );
      await act(async () => controller.redo());
      const saved = JSON.parse(JSON.stringify(controller.previewFloor));
      const reopened = createFloorEditorDraft(saved);
      assert.equal(
        deriveFloorTopology(reopened).floor.rooms.find((candidate) => candidate.id === room.id)
          .isSolid,
        true,
      );
      const project = {
        ...ownerHomeProject,
        floors: ownerHomeProject.floors.map((candidate) =>
          candidate.id === floor.id ? saved : candidate,
        ),
      };
      assert.equal(parseHomeProjectSchema(project).valid, true);
      const runtime = composeHomeBindingManifest(project, neutralDemoManifest.extensions);
      const runtimeFloor = runtime.floors.find((candidate) => candidate.id === floor.id);
      assert.equal(
        runtimeFloor.rooms.some((candidate) => candidate.id === room.id),
        false,
      );
      assert.equal(runtimeFloor.solidRooms[0].id, room.id);
      assert.equal(
        runtimeFloor.ceilings.some((ceiling) => ceiling.roomIds.includes(room.id)),
        false,
      );
      await act(async () => toggle.click());
      assert.equal(
        controller.previewFloor.rooms.find((candidate) => candidate.id === room.id).isSolid,
        false,
      );
      assert.equal(
        controller.previewFloor.rooms.find((candidate) => candidate.id === room.id).name,
        room.name,
      );
    });
  });

  test("platforms share room controls and keep their name and outdoor geometry through toggle and history", async (context) => {
    const priorObservers = {
      IntersectionObserver: globalThis.IntersectionObserver,
      ResizeObserver: globalThis.ResizeObserver,
    };
    context.after(() => Object.assign(globalThis, priorObservers));
    globalThis.IntersectionObserver = globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    await withDom(async ({ dom, root }) => {
      const floor = ownerHomeProject.floors[0];
      let controller;
      function Harness() {
        controller = useConstructEditor(floor);
        return React.createElement(ConstructionSelectionProperties, {
          editor: controller,
          onClose() {},
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      await act(async () => controller.selectRoom(floor.rooms[0].id));
      const originalSwitch = dom.window.document.querySelector('[role="switch"]');
      const originalRowClass = originalSwitch.parentElement.className;
      const originalCeilings = controller.previewFloor.ceilings;
      await act(async () =>
        controller.dispatch({
          type: "add-outdoor-platform",
          polygon: [
            [100, 100],
            [104, 100],
            [104, 104],
            [100, 104],
          ],
          finish: { kind: "solid", color: "#c8b79b" },
          defaultEdge: { kind: "open" },
        }),
      );
      const toggle = dom.window.document.querySelector('[role="switch"]');
      assert.equal(toggle.parentElement.className, originalRowClass);
      assert.equal(
        dom.window.document.getElementById(toggle.getAttribute("aria-labelledby")).textContent,
        "Use as room",
      );
      assert.match(
        dom.window.document.getElementById(toggle.getAttribute("aria-describedby")).textContent,
        /stays open to the sky/,
      );
      assert.equal(toggle.getAttribute("aria-checked"), "false");
      assert.equal(dom.window.document.querySelector('[aria-label="Room name"]'), null);
      await act(async () => toggle.click());
      const name = () => dom.window.document.querySelector('[aria-label="Room name"]');
      assert.equal(name().value, "Outdoor room");
      dom.window.HTMLElement.prototype.attachEvent = () => {};
      dom.window.HTMLElement.prototype.detachEvent = () => {};
      const type = async (value) => {
        await act(async () => name().focus());
        await act(async () => {
          Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
            name(),
            value,
          );
          name().dispatchEvent(new dom.window.Event("input", { bubbles: true }));
          name().dispatchEvent(new dom.window.Event("change", { bubbles: true }));
          name().dispatchEvent(new dom.window.KeyboardEvent("keyup", { key: "o", bubbles: true }));
        });
      };
      const key = async (key) =>
        act(async () =>
          name().dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true })),
        );
      await type("  Balcony  ");
      await key("Enter");
      assert.equal(controller.draft.outdoorPlatforms[0].roomName, "Balcony");
      await type("Cancelled");
      await key("Escape");
      assert.equal(name().value, "Balcony");
      assert.equal(controller.draft.outdoorPlatforms[0].roomName, "Balcony");
      await act(async () => toggle.click());
      assert.equal(controller.draft.outdoorPlatforms[0].useAsRoom, false);
      assert.equal(controller.draft.outdoorPlatforms[0].roomName, "Balcony");
      assert.equal(dom.window.document.querySelector('[aria-label="Room name"]'), null);
      await act(async () => controller.undo());
      assert.equal(name().value, "Balcony");
      assert.equal(toggle.getAttribute("aria-checked"), "true");
      assert.deepEqual(controller.previewFloor.ceilings, originalCeilings);
      assert.equal(controller.previewFloor.rooms.length, floor.rooms.length);
      assert.equal(controller.draft.outdoorPlatforms[0].isSolid, undefined);
    });
  });

  test("labels the selected room's usable interior area instead of its wall-centerline area", async () => {
    const polygon = [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ];
    const room = { id: "bedroom", name: "Bedroom", polygon, accent: "#c98164" };
    const state = editor({ kind: "room", id: room.id });
    state.draft.rooms = [{ ...room, anchor: [2, 1.5] }];
    state.previewFloor = {
      ...state.previewFloor,
      footprint: polygon,
      rooms: [room],
      wallJunctions: [],
      walls: polygon.map((from, index) => ({
        id: `wall-${index}`,
        from,
        to: polygon[(index + 1) % polygon.length],
        thicknessMeters: 0.2,
        classification: "exterior",
      })),
    };
    await withDom(async ({ dom, root }) => {
      await act(async () =>
        root.render(React.createElement(ConstructionPanels, { editor: state })),
      );
      const area = dom.window.document.querySelector('[title="Interior floor area"]');
      assert.equal(area.textContent, "10.6 m²");
      assert.equal(area.getAttribute("aria-label"), "Interior floor area: 10.6 square meters");
      assert.equal(
        [...dom.window.document.querySelectorAll("button")].some(
          (button) => button.textContent === "Delete room",
        ),
        true,
      );
    });
  });

  test("summarizes effective multiple-selection targets and deletes them from one action", async () => {
    let deletions = 0;
    const controller = editor(
      {
        kind: "multiple",
        targets: [
          { kind: "room", id: "bedroom" },
          { kind: "pool", id: "pool" },
        ],
      },
      { deleteSelected: () => deletions++ },
    );
    controller.deletionTargets = [
      { kind: "room", id: "bedroom" },
      { kind: "wall", id: "north" },
      { kind: "wall", id: "divider" },
      { kind: "opening", id: "door" },
      { kind: "pool", id: "pool" },
    ];
    await withDom(async ({ dom, root }) => {
      await act(async () =>
        root.render(React.createElement(ConstructionPanels, { editor: controller })),
      );
      const document = dom.window.document;
      assert.match(document.body.textContent, /5 elements selected/);
      assert.match(document.body.textContent, /Rooms1/);
      assert.match(document.body.textContent, /Walls2/);
      assert.match(document.body.textContent, /Openings1/);
      assert.match(document.body.textContent, /Pools1/);
      assert.equal(document.querySelector('[aria-label="Wall thickness"]'), null);
      const remove = [...document.querySelectorAll("button")].find(
        (button) => button.textContent === "Delete selection",
      );
      await act(async () => remove.click());
      assert.equal(deletions, 1);
    });
  });

  test("face labels and exterior orientation follow wall direction rather than compass position", () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    const divider = {
      id: "divider",
      from: [2.4, 0],
      to: [2.4, 3.6],
      classification: "interior",
      thicknessMeters: 0.12,
    };
    floor.walls.push(divider);
    floor.rooms = [
      {
        name: "Living room",
        polygon: [
          [0, 0],
          [2.4, 0],
          [2.4, 3.6],
          [0, 3.6],
        ],
      },
      {
        name: "Kitchen",
        polygon: [
          [2.4, 0],
          [4.8, 0],
          [4.8, 3.6],
          [2.4, 3.6],
        ],
      },
    ];
    assert.equal(wallFinishSides(divider, floor).roomLabel("left"), "Living room side");
    assert.equal(wallFinishSides(divider, floor).roomLabel("right"), "Kitchen side");
    const reversed = { ...divider, from: divider.to, to: divider.from };
    assert.equal(wallFinishSides(reversed, floor).roomLabel("left"), "Kitchen side");
    for (const wall of floor.walls.filter((w) => w.classification === "exterior")) {
      assert.equal(wallFinishSides(wall, floor).exteriorSide, "right");
      const flipped = { ...wall, from: wall.to, to: wall.from };
      const flippedFloor = {
        ...floor,
        walls: floor.walls.map((w) => (w.id === wall.id ? flipped : w)),
      };
      assert.equal(wallFinishSides(flipped, flippedFloor).exteriorSide, "left");
    }
  });

  test("wall face controls use the home palette, target the previewed face, and reset through history", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    for (const isExterior of [true, false])
      await withDom(async ({ dom, root }) => {
        const floor = structuredClone(neutralDemoManifest.floors[0]);
        const id = isExterior ? "north-wall" : "divider";
        if (!isExterior)
          floor.walls.push({
            id,
            from: [2.4, 0.5],
            to: [2.4, 3],
            classification: "interior",
            thicknessMeters: 0.12,
          });
        let controller, highlight;
        function PreviewProbe() {
          highlight = useWallFinishPreview().highlight;
          return null;
        }
        function Harness() {
          controller = useConstructEditor(floor);
          return React.createElement(
            WallFinishPreviewProvider,
            { palette: { interior: "#112233", exterior: "#445566" } },
            React.createElement(WallFinishFields, {
              editor: controller,
              wall: controller.draft.walls.find((w) => w.id === id),
              isExterior,
            }),
            React.createElement(PreviewProbe),
          );
        }
        await act(async () => root.render(React.createElement(Harness)));
        await act(async () => controller.selectWall(id));
        const wallNow = () => controller.previewFloor.walls.find((w) => w.id === id);
        const input = (label) => dom.window.document.querySelector(`[aria-label="${label}"]`);
        const paint = async (label, color) =>
          act(async () => {
            input(label).value = color;
            input(label).dispatchEvent(new dom.window.Event("input", { bubbles: true }));
            context.mock.timers.tick(160);
          });
        assert.equal(input(isExterior ? "Wall interior color" : "Wall color").value, "#112233");
        if (isExterior) {
          assert.equal(input("Wall exterior color").value, "#445566");
          await paint("Wall interior color", "#aabbcc");
          assert.deepEqual(wallNow().faceColors, { left: "#aabbcc" });
          await paint("Wall exterior color", "#223344");
          assert.equal(wallNow().exteriorColor, "#223344");
          assert.deepEqual(wallNow().faceColors, { left: "#aabbcc" });
          await act(async () =>
            dom.window.document.querySelector('[aria-label="Reset exterior color"]').click(),
          );
          assert.equal(wallNow().exteriorColor, undefined);
          assert.equal(input("Wall exterior color").value, "#445566");
          await act(async () => controller.undo());
          assert.equal(wallNow().exteriorColor, "#223344");
          await act(async () => controller.redo());
          assert.equal(wallNow().exteriorColor, undefined);
        } else {
          await paint("Wall color", "#aabbcc");
          assert.deepEqual(wallNow().faceColors, { left: "#aabbcc", right: "#aabbcc" });
          await act(async () =>
            dom.window.document.querySelector('input[type="checkbox"]').click(),
          );
          await paint("Side B color", "#223344");
          const resetSide = dom.window.document.querySelector('[aria-label="Reset side b color"]');
          await act(async () => resetSide.focus());
          assert.deepEqual(highlight, { floorId: floor.id, wallId: id, sides: ["right"] });
          await act(async () => resetSide.blur());
          assert.equal(highlight, null);
          assert.deepEqual(wallNow().faceColors, { left: "#aabbcc", right: "#223344" });
          await act(async () => controller.undo());
          assert.equal(wallNow().faceColors.right, "#aabbcc");
          await act(async () => controller.redo());
          assert.equal(wallNow().faceColors.right, "#223344");
          await act(async () =>
            dom.window.document.querySelector('[aria-label="Reset side b color"]').click(),
          );
          assert.deepEqual(wallNow().faceColors, { left: "#aabbcc" });
          await act(async () =>
            dom.window.document.querySelector('input[type="checkbox"]').click(),
          );
          assert.deepEqual(wallNow().faceColors, { left: "#aabbcc", right: "#aabbcc" });
          await act(async () =>
            dom.window.document.querySelector('[aria-label="Reset wall color"]').click(),
          );
          assert.equal(wallNow().faceColors, undefined);
        }
      });
  });

  test("wall inspector switches edge color between Auto and Custom", async () => {
    await withDom(async ({ dom, root }) => {
      const changes = [],
        controller = editor(
          { kind: "wall", id: wall.id },
          { updateSelectedWallMetadata: (change) => changes.push(change) },
        );
      controller.draft.walls[0].faceColors = { left: "#bcb99b", right: "#bcb99b" };
      await act(async () =>
        root.render(React.createElement(ConstructionPanels, { editor: controller })),
      );
      let mode = dom.window.document.querySelector('[aria-label="Wall edge color mode"]');
      assert.equal(mode.value, "auto");
      assert.equal(dom.window.document.querySelector('[aria-label="Wall edge color"]'), null);
      await act(async () => {
        mode.value = "custom";
        mode.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      assert.deepEqual(changes.pop(), { edgeColor: "#bcb99b" });
      controller.draft.walls[0].edgeColor = "#bcb99b";
      await act(async () =>
        root.render(React.createElement(ConstructionPanels, { editor: controller })),
      );
      assert.equal(
        dom.window.document.querySelector('[aria-label="Wall edge color"]').value,
        "#bcb99b",
      );
      mode = dom.window.document.querySelector('[aria-label="Wall edge color mode"]');
      await act(async () => {
        mode.value = "auto";
        mode.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      assert.deepEqual(changes.pop(), { edgeColor: undefined });
    });
  });

  test("keeps scale and heights available without the removed Advanced controls", async () => {
    await withDom(async ({ dom, root }) => {
      await act(async () =>
        root.render(
          React.createElement(ConstructionPanels, {
            editor: editor({ kind: "wall", id: wall.id }),
            onRoofChange: () => {},
          }),
        ),
      );
      const document = dom.window.document;
      assert.equal(document.querySelector(".construction-inspector__expert-toggle"), null);
      assert.equal(document.querySelector('[aria-label="Expert construction data"]'), null);
      assert.equal(document.querySelector('[aria-label="from X coordinate"]'), null);
      const sections = [
        ...document.querySelectorAll("details.construction-inspector__floor-disclosure"),
      ];
      assert.deepEqual(
        sections.map(
          (section) => section.querySelector(".sidebar-section-summary__copy > span").textContent,
        ),
        ["Roof", "Scale & heights"],
      );
      const floorSettings = sections[1];
      assert.equal(floorSettings.open, false);
      assert.ok(floorSettings.querySelector('[aria-label="Length per plan unit"]'));
      assert.ok(floorSettings.querySelector('[aria-label="Default wall height"]'));
      assert.ok(floorSettings.querySelector("summary small").textContent);
      assert.equal(floorSettings.querySelectorAll("summary svg").length, 2);
    });
  });

  test("window properties use the shared inspector instead of sidebar tool settings", async () => {
    await withDom(async ({ dom, root }) => {
      const controller = editor({ kind: "opening", id: opening.id });
      await act(async () =>
        root.render(React.createElement(ConstructionPanels, { editor: controller })),
      );
      assert.equal(dom.window.document.querySelector('[aria-label="Opening width"]'), null);
      assert.ok(dom.window.document.querySelector(".construction-inspector__floor-disclosure"));
      const changes = [];
      let closed = 0;
      await act(async () =>
        root.render(
          React.createElement(OpeningDetails, {
            opening,
            editor: {
              ...controller,
              reorientOpening: (openingId, change) =>
                changes.push({ type: "reorient-opening", openingId, change }),
            },
            disabled: false,
            onClose: () => closed++,
          }),
        ),
      );
      const document = dom.window.document;
      assert.ok(document.querySelector('.selection-details[data-mode="construct"]'));
      assert.ok(document.querySelector('[aria-label="Opening width"]'));
      assert.ok(document.querySelector('[aria-label="Window height from floor"]'));
      assert.equal(document.querySelector(".opening-properties__advanced").open, false);
      assert.ok(
        document.querySelector('[role="img"][aria-label="Window opening direction in plan view"]'),
      );
      await act(async () => document.querySelector('[aria-label="Swap hinge side"]').click());
      assert.deepEqual(changes, [
        { type: "reorient-opening", openingId: opening.id, change: "hinge" },
      ]);
      await act(async () => document.querySelector('[aria-label="Collapse properties"]').click());
      assert.equal(closed, 1);
    });
  });

  test("passage Details exposes size and shape without door orientation controls", async () => {
    await withDom(async ({ dom, root }) => {
      const passage = {
        id: "passage",
        kind: "passage",
        variant: "arched",
        archRiseMeters: 0.15,
        wallId: wall.id,
        offsetPlanUnits: 1,
        widthPlanUnits: 1.5,
        openingHeightMeters: 2.1,
        sillHeightMeters: 0,
      };
      const controller = editor({ kind: "opening", id: passage.id });
      controller.draft.openings = [passage];
      await act(async () =>
        root.render(
          React.createElement(OpeningDetails, {
            opening: passage,
            editor: controller,
            disabled: false,
            onClose() {},
          }),
        ),
      );
      const document = dom.window.document;
      assert.ok(document.querySelector('[aria-label="Passage properties"]'));
      assert.equal(document.querySelector('[aria-label="Opening width"]').value, "1.5");
      assert.equal(document.querySelector('[aria-label="Opening height"]').value, "2.1");
      assert.ok(document.querySelector('[aria-label="Passage shape"]'));
      assert.ok(document.querySelector('[aria-label="Passage arch rise"]'));
      assert.equal(document.querySelector(".opening-direction"), null);
    });
  });

  test("opening size edits update the preview and reject sizes that cannot fit", async () => {
    await withDom(async ({ dom, root }) => {
      let controller;
      function Harness() {
        controller = useConstructEditor(neutralDemoManifest.floors[0]);
        const selected = controller.draft.openings.find(
          (candidate) => candidate.id === "demo-window",
        );
        return React.createElement(OpeningDetails, {
          opening: selected,
          editor: controller,
          disabled: false,
          onClose() {},
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      await act(async () => controller.selectOpening("demo-window"));
      await act(async () => controller.updateSelectedOpening({ widthPlanUnits: 0.8 }));
      assert.equal(
        controller.previewFloor.openings.find((candidate) => candidate.id === "demo-window")
          .widthPlanUnits,
        0.8,
      );
      assert.equal(dom.window.document.querySelector('[aria-label="Opening width"]').value, "0.8");
      await act(async () => controller.updateSelectedOpening({ widthPlanUnits: 99 }));
      assert.match(dom.window.document.querySelector('[role="alert"]').textContent, /does not fit/);
      assert.equal(
        controller.draft.openings.find((candidate) => candidate.id === "demo-window")
          .widthPlanUnits,
        0.8,
      );
      await act(async () => controller.resizeSelectedOpening(1.45, 1.1));
      assert.equal(dom.window.document.querySelector('[aria-label="Opening width"]').value, "1.1");
      assert.equal(dom.window.document.querySelector('[role="alert"]'), null);
      await act(async () => controller.updateSelectedOpening({ openingHeightMeters: 99 }));
      assert.ok(dom.window.document.querySelector('[role="alert"]'));
      await act(async () => controller.updateSelectedOpening({ openingHeightMeters: 1.1 }));
      assert.equal(dom.window.document.querySelector('[role="alert"]'), null);
      assert.equal(
        controller.previewFloor.openings.find((candidate) => candidate.id === "demo-window")
          .openingHeightMeters,
        1.1,
      );
    });
  });

  test("orientation actions match the operation and panel count", async () => {
    await withDom(async ({ dom, root }) => {
      const cases = [
        [{ ...opening }, ["Swap hinge side", "Reverse opening direction"]],
        [{ ...opening, panelCount: 2 }, ["Reverse opening direction"]],
        [{ ...opening, operation: "fixed" }, []],
        [
          { kind: "door", operation: "hinged", leafCount: 1 },
          ["Swap hinge side", "Reverse opening direction"],
        ],
        [{ kind: "door", operation: "hinged", leafCount: 2 }, ["Reverse opening direction"]],
        [
          { kind: "door", operation: "sliding", leafCount: 1 },
          ["Reverse slide direction", "Switch wall side"],
        ],
        [{ kind: "door", operation: "sliding", leafCount: 2 }, ["Switch wall side"]],
      ];
      for (const [candidate, labels] of cases) {
        await act(async () =>
          root.render(
            React.createElement(OpeningOrientationControls, { opening: candidate, onChange() {} }),
          ),
        );
        assert.deepEqual(
          [...dom.window.document.querySelectorAll("button")].map((button) =>
            button.getAttribute("aria-label"),
          ),
          labels,
        );
      }
    });
  });

  test("offers Duplicate for every opening kind and disables only that action when the wall is full", async () => {
    await withDom(async ({ dom, root }) => {
      const calls = [];
      const actions = {
        disabled: false,
        canDuplicate: true,
        onChange: (change) => calls.push(change),
        onDuplicate: () => calls.push("duplicate"),
        onDelete: () => calls.push("delete"),
      };
      await act(async () =>
        root.render(React.createElement(SelectedOpeningActionBar, { opening, ...actions })),
      );
      let buttons = [...dom.window.document.querySelectorAll("button")];
      assert.deepEqual(
        buttons.map((button) => button.getAttribute("aria-label")),
        ["Duplicate", "Swap hinge side", "Reverse opening direction", "Delete"],
      );
      await act(async () => dom.window.document.querySelector('[aria-label="Duplicate"]').click());
      assert.deepEqual(calls, ["duplicate"]);

      const passage = {
        ...opening,
        id: "passage",
        kind: "passage",
        variant: "arched",
        archRiseMeters: 0.15,
      };
      await act(async () =>
        root.render(
          React.createElement(SelectedOpeningActionBar, {
            opening: passage,
            ...actions,
            canDuplicate: false,
          }),
        ),
      );
      buttons = [...dom.window.document.querySelectorAll("button")];
      assert.deepEqual(
        buttons.map((button) => button.getAttribute("aria-label")),
        ["Duplicate", "Delete"],
      );
      assert.equal(buttons[0].disabled, true);
      assert.equal(buttons[0].title, "No free space on this wall.");
      assert.equal(buttons[1].disabled, false);
      await act(async () => buttons[0].click());
      assert.deepEqual(calls, ["duplicate"]);
    });
  });

  test("lists complete errors, warnings and recovery text in the shared validation panel", async () => {
    await withDom(async ({ dom, root }) => {
      const focused = [];
      const issues = [
        {
          code: "opening",
          severity: "error",
          message: "The window extends beyond its wall.",
          suggestion: "Move it inward or reduce its width.",
          target: { kind: "opening", id: opening.id },
        },
        {
          code: "room",
          severity: "warning",
          message: "The bedroom has no walkable exit.",
          target: { kind: "room", id: "bedroom" },
        },
        { code: "spawn", severity: "fatal", message: "No safe walk position was found." },
      ];
      await act(async () =>
        root.render(
          React.createElement(EditorValidationPanel, {
            issues,
            onSelect: (issue) => focused.push(issue),
          }),
        ),
      );
      const panel = dom.window.document.querySelector('[aria-label="Editor validation"]');
      assert.equal(panel.querySelectorAll("li").length, 3);
      assert.match(panel.textContent, /2 errors.*1 warning/);
      for (const issue of issues) assert.ok(panel.textContent.includes(issue.message));
      assert.ok(panel.textContent.includes(issues[0].suggestion));
      assert.equal(panel.querySelectorAll("li").length, 3);
      assert.equal(
        [...panel.querySelectorAll("li")].filter((row) => !row.querySelector("button")).length,
        1,
      );
      for (const button of panel.querySelectorAll("li button"))
        await act(async () => button.click());
      assert.deepEqual(focused, issues.slice(0, 2));
    });
  });

  test("offers Locate for every editable diagnostic target and preserves the full issue", async () => {
    await withDom(async ({ dom, root }) => {
      const focused = [];
      const issues = [
        "wall",
        "opening",
        "niche",
        "room",
        "scene-item",
        "junction",
        "outdoor-platform",
        "floor-zone",
        "pool",
        "ceiling",
      ].map((kind) => ({
        code: `invalid.${kind}`,
        path: kind,
        severity: "error",
        source: "project",
        message: `Full ${kind} error`,
        suggestion: "Correct its dimensions.",
        target: { kind, id: `${kind}-id` },
      }));
      await act(async () =>
        root.render(
          React.createElement(EditorValidationPanel, {
            issues,
            onSelect: (issue) => focused.push(issue),
          }),
        ),
      );
      const buttons = dom.window.document.querySelectorAll(
        ".construction-inspector__validation li button",
      );
      assert.equal(buttons.length, issues.length);
      for (const [index, button] of buttons.entries()) {
        assert.match(
          button.textContent,
          issues[index].target.kind === "scene-item" ? /Select/ : /Locate/,
        );
        await act(async () => button.click());
      }
      assert.deepEqual(focused, issues);
    });
  });

  test("hides the shared validation panel when there are no diagnostics", async () => {
    await withDom(async ({ dom, root }) => {
      await act(async () =>
        root.render(React.createElement(EditorValidationPanel, { issues: [], onSelect() {} })),
      );
      assert.equal(dom.window.document.querySelector('[aria-label="Editor validation"]'), null);
    });
  });
});
