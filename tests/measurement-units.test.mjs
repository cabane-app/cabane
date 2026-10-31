import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const units = await load("/packages/engine/src/measurement-units.ts");
  const { LengthInput } = await load("/apps/web/src/editor-chrome/LengthInput.tsx");
  const { ScenePreferences } = await load("/packages/engine/src/ScenePreferences.tsx");
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
