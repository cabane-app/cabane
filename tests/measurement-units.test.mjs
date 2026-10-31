import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const units = await load("/packages/engine/src/measurement-units.ts");
  const { LengthInput } = await load("/apps/web/src/editor-chrome/LengthInput.tsx");
  const { WalkPreferences } = await load("/packages/engine/src/WalkPreferences.tsx");
  const { UnitsSettings } = await load("/apps/web/src/editor-chrome/UnitsSettings.tsx");
  const { NumericField } = await load("/apps/web/src/editor-preview/furnish/NumericField.tsx");
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
            createElement(WalkPreferences, {
              overlayPreferences: {},
              onOverlayPreferencesChange() {},
              inverted: false,
              onChange() {},
              lightingMode: "day",
              lightingSource: "Local",
              onLightingModeChange() {},
              onClose() {},
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
  test("the construct inspector offers the shared unit preference", async () => {
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
    try {
      await act(() => {
        units.setMeasurementUnits("metric");
        root.render(createElement(UnitsSettings));
      });
      const radios =
        Array.from(document.querySelectorAll('input[name="editor-measurement-units"]')) ?? [];
      assert.equal(radios.length, 2);
      assert.equal(radios[0].value, "metric");
      assert.equal(radios[0].checked, true);
      await act(() => {
        radios[1].click();
      });
      assert.equal(dom.window.localStorage.getItem("cabane.measurement-units.v1"), "imperial");
      // The helper mirrors the session store without a React hook, so non-React validation
      // code picks up the same preference.
      assert.equal(units.readMeasurementUnits(), "imperial");
      assert.equal(units.formatLengthPlain(0.3048, "metric"), "0.30 m");
      assert.equal(units.formatLengthPlain(0.3048, "imperial", 3), "1.000 ft");
    } finally {
      await act(() => root.unmount());
      names.forEach((name, i) =>
        old[i] ? Object.defineProperty(globalThis, name, old[i]) : delete globalThis[name],
      );
      dom.window.close();
    }
  });

  test("plan-unit numeric fields convert through the floor scale in the selected units", async () => {
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
        units.setMeasurementUnits("imperial");
        root.render(
          createElement(NumericField, {
            label: "X",
            unit: "plan units",
            metersPerUnit: 0.5,
            value: 4,
            onChange: (value) => changes.push(value),
          }),
        );
      });
      const input = document.querySelector("input");
      assert.equal(
        input.value,
        "6.5617",
        "4 plan units at 0.5 m per plan unit display as 6.5617 ft",
      );
      await act(() => {
        input.value = "2";
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      await act(() =>
        input.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true })),
      );
      assert.deepEqual(
        changes,
        [1.2192],
        "entering 2 ft at 0.5 m per plan unit stores 1.2192 plan units",
      );
    } finally {
      await act(() => root.unmount());
      names.forEach((name, i) =>
        old[i] ? Object.defineProperty(globalThis, name, old[i]) : delete globalThis[name],
      );
      dom.window.close();
    }
  });
});
