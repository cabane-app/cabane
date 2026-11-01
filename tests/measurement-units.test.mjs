import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const units = await load("/packages/engine/src/measurement-units.ts");
  const { LengthInput } = await load("/apps/web/src/editor-chrome/LengthInput.tsx");
  const { ScenePreferences } = await load("/packages/engine/src/ScenePreferences.tsx");
  const { formatMeasurementText } = await load("/packages/engine/src/measurement-text.ts");
  const { EditorValidationPanel } = await load(
    "/apps/web/src/editor-workspace/EditorValidationPanel.tsx",
  );
  const { LightingCoordinates } = await load(
    "/apps/web/src/model-lighting/LightingCoordinates.tsx",
  );
  const { NumericField } = await load("/apps/web/src/editor-preview/furnish/NumericField.tsx");
  test("diagnostic measurements convert ranges and small clearances without changing identifiers", () => {
    for (const [metric, imperial] of [
      [
        "Surface contact gap 0.0010 m is outside 0–0.002 m.",
        "Surface contact gap 0.00328084 ft is outside 0–0.00656168 ft.",
      ],
      [
        "Height 0.2–5 m and width 0.2–3 m.",
        "Height 0.656168–16.4042 ft and width 0.656168–9.84252 ft.",
      ],
      [
        "Terrain heights must be between −100 and 100 metres.",
        "Terrain heights must be between -328.084 and 328.084 ft.",
      ],
      [
        "Leave at least 20 mm behind it; overlay between 0 and 3 cm.",
        "Leave at least 0.0656168 ft behind it; overlay between 0 and 0.0984252 ft.",
      ],
      ["Area 1 m²; width 0.01 m.", "Area 10.7639 ft²; width 0.0328084 ft."],
      ["Dimensions must be positive finite metres.", "Dimensions must be positive finite feet."],
      [
        'Room "2 m studio" needs 1 m; `heightMeters` stays metric, 90° and 20% stay unchanged.',
        'Room "2 m studio" needs 3.28084 ft; `heightMeters` stays metric, 90° and 20% stay unchanged.',
      ],
    ]) {
      assert.equal(formatMeasurementText(metric, "metric"), metric);
      assert.equal(formatMeasurementText(metric, "imperial"), imperial);
    }
  });
  test("existing issue text, accessible labels and lighting steps update when settings units change", () =>
    withStorageDom(async (dom) => {
      const issue = {
        code: "device.wall-height",
        path: "sceneItems[0].placement",
        severity: "error",
        message: "Wall attachment must fit between the floor and 2.4 metres.",
        suggestion: "Move it below 2.4 m.",
        target: { kind: "scene-item", id: "sensor" },
      };
      const before = JSON.stringify(issue);
      const moves = [];
      dom.document.body.innerHTML = '<div id="root"></div>';
      try {
        units.setMeasurementUnits("metric");
        await dom.mount(() => {
          const root = createRoot(dom.document.querySelector("#root"));
          root.render(
            createElement(
              Fragment,
              null,
              createElement(EditorValidationPanel, {
                issues: [issue],
                expanded: true,
                onSelect() {},
              }),
              createElement(LightingCoordinates, {
                label: "Position",
                position: [2, 0, 0],
                step: 0.01,
                onStep() {},
                onChange: (value) => moves.push(value),
              }),
            ),
          );
          return { unmount: () => root.unmount() };
        });
        assert.match(
          dom.document.querySelector(".editor-issues__message").textContent,
          /2.4 metres/,
        );
        assert.deepEqual(
          [...dom.document.querySelectorAll("option")].map((option) => option.textContent),
          ["1 mm", "1 cm", "10 cm"],
        );
        await act(() => units.setMeasurementUnits("imperial"));
        const message = dom.document.querySelector(".editor-issues__message").textContent;
        assert.match(message, /7.87402 ft/);
        assert.doesNotMatch(message, /metres|\d m\b/);
        assert.match(
          dom.document
            .querySelector('[aria-label^="Select scene-item"]')
            .getAttribute("aria-label"),
          /7.87402 ft/,
        );
        assert.deepEqual(
          [...dom.document.querySelectorAll("option")].map((option) => [
            option.value,
            option.textContent,
          ]),
          [
            ["0.001", "0.0033 ft"],
            ["0.01", "0.0328 ft"],
            ["0.1", "0.3281 ft"],
          ],
        );
        await act(() => dom.document.querySelector('[aria-label="Increase X"]').click());
        assert.deepEqual(
          moves,
          [[2.01, 0, 0]],
          "movement labels must describe the unchanged physical steps",
        );
        assert.equal(JSON.stringify(issue), before, "diagnostics stay metric and deterministic");
        await act(() => units.setMeasurementUnits("metric"));
        assert.match(
          dom.document.querySelector(".editor-issues__message").textContent,
          /2.4 metres/,
        );
      } finally {
        await act(() => units.setMeasurementUnits("metric"));
      }
    }));
  test("Arrange fields retain mixed-unit input through the floor scale", () =>
    withStorageDom(async (dom) => {
      const changes = [];
      dom.document.body.innerHTML = '<div id="root"></div>';
      try {
        units.setMeasurementUnits("imperial");
        await dom.mount(() => {
          const root = createRoot(dom.document.querySelector("#root"));
          root.render(
            createElement(NumericField, {
              label: "Position",
              value: 4,
              unit: "plan units",
              metersPerUnit: 0.5,
              onChange: (value) => changes.push(value),
            }),
          );
          return { unmount: () => root.unmount() };
        });
        const input = dom.document.querySelector("input");
        assert.equal(input.value, "6.5617");
        await act(() =>
          input.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true })),
        );
        assert.deepEqual(changes, [], "an untouched field must preserve authored precision");
        for (const [text, expected] of [
          ["90 cm", 1.8],
          ["5' 6\"", 3.3528],
        ]) {
          await act(() => {
            input.value = text;
            input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
          });
          await act(() =>
            input.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true })),
          );
          assert.ok(Math.abs(changes.at(-1) - expected) < 1e-10);
        }
      } finally {
        await act(() => units.setMeasurementUnits("metric"));
      }
    }));
  test("length input parses physical units and area conversion squares the scale", () => {
    for (const [text, system, expected] of [
      ["5' 6\"", "metric", 1.6764],
      ["-5 ft 6 in", "imperial", -1.6764],
      ["90 cm", "imperial", 0.9],
      ["900 mm", "metric", 0.9],
      ["0,5", "metric", 0.5],
      ["6", "imperial", 1.8288],
      ["12 in", "metric", 0.3048],
    ])
      assert.ok(Math.abs(units.parseLength(text, system) - expected) < 1e-10, text);
    for (const text of ["", "Infinity", "2 xyz", "5' nope", "1..2"])
      assert.ok(Number.isNaN(units.parseLength(text, "metric")));
    assert.equal(units.formatArea(0.3048 ** 2, "imperial"), "1.0 ft²");
    assert.equal(units.formatLength(0.3048, "imperial"), "1.00 ft");
  });
  test("unit changes preserve geometry; scaled input commits and validates authored values", async () => {
    const dom = new JSDOM('<div id="root"></div>', { url: "https://cabane.test" });
    const names = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
    const old = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    const changes = [];
    try {
      await act(() => {
        units.setMeasurementUnits("metric");
        root.render(
          createElement(
            Fragment,
            null,
            createElement(LengthInput, {
              label: "Position",
              value: 2,
              metersPerUnit: 0.5,
              min: 0,
              max: 5,
              showSteppers: true,
              onCommit: (value) => changes.push(value),
            }),
            createElement(ScenePreferences, {
              section: "editor",
            }),
          ),
        );
      });
      let input = document.querySelector("input");
      assert.equal(input.value, "1");
      await act(() =>
        document.querySelector('input[name="measurement-units"][value="imperial"]').click(),
      );
      input = document.querySelector("input");
      assert.equal(input.value, "3.28084");
      await act(() =>
        input.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true })),
      );
      assert.deepEqual(changes, [], "unit switch and untouched blur must not round geometry");
      const enter = async (text) => {
        await act(() => {
          input.value = text;
          input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        });
        await act(() =>
          input.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true })),
        );
      };
      await enter("5' 6\"");
      assert.ok(Math.abs(changes.at(-1) - 3.3528) < 1e-10);
      await enter("20 ft");
      assert.equal(changes.length, 1);
      assert.equal(input.getAttribute("aria-invalid"), "true");
      await act(() => {
        input.value = "1 ft";
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      await act(() => document.querySelector('[aria-label="Increase Position"]').click());
      assert.ok(
        Math.abs(changes.at(-1) - 0.6604) < 1e-10,
        "imperial arrows step one inch in scaled authored units",
      );
      assert.equal(window.localStorage.getItem("cabane.measurement-units.v1"), "imperial");
      await act(() =>
        document.querySelector('input[name="measurement-units"][value="metric"]').click(),
      );
      assert.equal(document.querySelector("input").value, "1");
    } finally {
      await act(() => root.unmount());
      names.forEach((name, i) =>
        old[i] ? Object.defineProperty(globalThis, name, old[i]) : delete globalThis[name],
      );
      dom.window.close();
    }
  });
});
