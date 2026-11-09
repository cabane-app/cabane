import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { StairWarnings } = await load("/apps/web/src/editor-floors/StairWarnings.tsx");
  const { familyBathtubDefinition } = await load(
    "/packages/catalog/src/furnishing/definitions/family-bathtub.tsx",
  );
  const { StairDetails } = await load("/apps/web/src/editor-floors/StairDetails.tsx");
  const { makeStairProject } = await load("/tests/fixtures/multiple-floors.ts");
  const { useEditorConstructionTools } = await load(
    "/apps/web/src/editor-workspace/useEditorConstructionTools.ts",
  );
  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );

  async function withDom(run) {
    const dom = new JSDOM('<div id="root"></div>');
    const globals = {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    };
    const previous = Object.fromEntries(
      Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
    );
    for (const [key, value] of Object.entries(globals))
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    dom.window.HTMLElement.prototype.attachEvent = () => {};
    dom.window.HTMLElement.prototype.detachEvent = () => {};
    const root = createRoot(document.getElementById("root"));
    try {
      await run({ dom, root });
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      for (const key of Object.keys(globals)) {
        if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
        else delete globalThis[key];
      }
    }
  }
  test("new same-floor stairs always resolve surfaces, including the default on a single floor", async () => {
    for (const singleFloor of [true, false])
      await withDom(async ({ root }) => {
        const project = makeStairProject();
        if (singleFloor) project.floors = [project.floors[0]];
        let tools;
        function Harness() {
          const editor = useConstructEditor(project.floors[0]);
          tools = useEditorConstructionTools(project, project.floors[0].id, "construct", editor);
          return null;
        }
        await act(async () => root.render(React.createElement(Harness)));
        await act(async () => tools.beginStairPlacement());
        if (singleFloor) assert.equal(tools.stairPlacement.terrain.surfaces, true);
        else assert.equal(tools.stairPlacement.upperFloorId, project.floors[1].id);
        await act(async () => tools.beginStairPlacement("surfaces"));
        assert.equal(tools.stairPlacement.terrain.surfaces, true);
        assert.equal(tools.stairPlacement.terrain.floorId, project.floors[0].id);
      });
  });
  test("same-floor properties describe surface support instead of a competing terrain mode", async () =>
    withDom(async ({ root }) => {
      const project = makeStairProject();
      const stair = {
        id: "local-stair",
        terrain: { floorId: project.floors[0].id, end: "upper", surfaces: true },
        at: [-1, 2],
        widthMeters: 1,
        runMeters: 2,
        rotationYRadians: Math.PI / 2,
      };
      await act(async () =>
        root.render(
          React.createElement(StairDetails, { project, stair, onSave() {}, onCancel() {} }),
        ),
      );
      assert.match(document.body.textContent, /Same floor/);
      assert.match(document.body.textContent, /Follows both surfaces/);
      assert.doesNotMatch(document.body.textContent, /To ground|Between surfaces/);
    }));
  test("railing selection saves immediately with an explicit ascending-side description", async () =>
    withDom(async ({ root, dom }) => {
      const project = makeStairProject(),
        saved = [];
      await act(async () =>
        root.render(
          React.createElement(StairDetails, {
            project,
            stair: project.stairs[0],
            onSave: (value) => saved.push(value),
            onCancel() {},
          }),
        ),
      );
      const select = document.querySelector('select[aria-label="Stair railings"]');
      assert.equal(select.value, "both");
      assert.match(select.parentElement.textContent, /walking upstairs/);
      for (const value of ["left", "right", "none", "both"]) {
        await act(async () => {
          select.value = value;
          select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
        });
        assert.equal(saved.at(-1).railings, value);
      }
    }));
  test("stair fields identify blocking values accessibly and preserve the last saved geometry", async () =>
    withDom(async ({ root, dom }) => {
      const project = makeStairProject(),
        saved = [];
      await act(async () =>
        root.render(
          React.createElement(StairDetails, {
            project,
            stair: project.stairs[0],
            onSave: (stair) => saved.push(stair),
            onCancel() {},
          }),
        ),
      );
      const input = document.querySelector('input[aria-label="Width"]');
      async function commit(value) {
        await act(async () => input.focus());
        await act(async () => {
          Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(
            input,
            value,
          );
          input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
          input.dispatchEvent(new dom.window.KeyboardEvent("keyup", { key: "0", bubbles: true }));
        });
        await act(async () => input.blur());
      }
      await commit("0");
      assert.equal(saved.length, 0);
      assert.equal(input.getAttribute("aria-invalid"), "true");
      assert.match(
        document.getElementById(input.getAttribute("aria-describedby").split(" ").at(-1))
          .textContent,
        /at least 0.01 m/,
      );
      await commit("");
      assert.equal(saved.length, 0);
      assert.match(
        document.getElementById(input.getAttribute("aria-describedby").split(" ").at(-1))
          .textContent,
        /valid length/,
      );
      await commit("0.4");
      assert.equal(saved.length, 1);
      assert.equal(saved[0].widthMeters, 0.4);
      assert.equal(input.getAttribute("aria-invalid"), null);
    }));
  test("leaving a rounded stair field untouched preserves its precise geometry", async () =>
    withDom(async ({ root }) => {
      const project = makeStairProject(),
        saved = [];
      const stair = { ...project.stairs[0], widthMeters: 1.2345 };
      await act(async () =>
        root.render(
          React.createElement(StairDetails, {
            project,
            stair,
            onSave: (value) => saved.push(value),
            onCancel() {},
          }),
        ),
      );
      const input = document.querySelector('input[aria-label="Width"]');
      await act(async () => input.focus());
      await act(async () => input.blur());
      assert.deepEqual(saved, []);
    }));
  test("selected live stair warnings appear in details without urgent alerts", async () =>
    withDom(async ({ root }) => {
      const project = makeStairProject();
      const message = "Move the stairs clear of the wall.";
      await act(async () =>
        root.render(
          React.createElement(StairDetails, {
            project,
            stair: project.stairs[0],
            liveIssues: [
              { code: "stair.obstruction", severity: "warning", path: "stairs[0]", message },
            ],
            onSave() {},
            onCancel() {},
          }),
        ),
      );
      assert.equal(document.querySelectorAll('[role="alert"]').length, 0);
      assert.match(
        document.querySelector('[aria-label="Stair warnings"]').textContent,
        /Move the stairs clear/,
      );
    }));
  test("placement warnings are counted once and hidden behind a closed disclosure", async () =>
    withDom(async ({ root }) => {
      const warning = {
        code: "stair.obstruction",
        severity: "warning",
        path: "stairs[0]",
        message: "A wall intersects these stairs.",
      };
      await act(async () =>
        root.render(
          React.createElement(StairWarnings, { compact: true, issues: [warning, warning] }),
        ),
      );
      const disclosure = document.querySelector('details[aria-label="Stair warnings"]');
      assert.equal(disclosure.open, false);
      assert.equal(disclosure.querySelector("summary").textContent, "1 warning");
      assert.equal(disclosure.querySelectorAll("li").length, 1);
      await act(async () =>
        root.render(React.createElement(StairWarnings, { compact: true, issues: [] })),
      );
      assert.equal(document.querySelector("details"), null);
    }));
  test("stair details use registry collision bounds for item warnings", async () =>
    withDom(async ({ root }) => {
      const project = makeStairProject();
      project.sceneItems = [
        {
          id: "bath",
          kind: "furnishing",
          modelId: "tub",
          floorId: "ground",
          size: [1.64, 0.782, 0.78],
          placement: { kind: "absolute", at: [4, 1.5], rotationYRadians: 0, elevationMeters: 0 },
        },
      ];
      const props = { project, stair: project.stairs[0], onSave() {}, onCancel() {} };
      await act(async () => root.render(React.createElement(StairDetails, props)));
      assert.equal(document.querySelector('[aria-label="Stair warnings"]'), null);
      await act(async () =>
        root.render(
          React.createElement(StairDetails, {
            ...props,
            registries: { furnishingModels: { tub: familyBathtubDefinition } },
          }),
        ),
      );
      assert.match(document.querySelector('[aria-label="Stair warnings"]').textContent, /bath/);
    }));
});
