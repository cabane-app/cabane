import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withStorageDom } from "./dom-test-environment.mjs";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { LightFields, lightDimmerPercent } = await load(
    "/packages/engine/src/home-assistant-dashboard/light-fields.tsx",
  );
  const light = (overrides = {}) => ({
    entityId: "light.test",
    state: "on",
    attributes: { brightness: 128 },
    available: true,
    stale: false,
    ...overrides,
  });

  test("a light that is off reads 0%, though Home Assistant reports its brightness as null", () => {
    assert.equal(lightDimmerPercent(light({ state: "off", attributes: { brightness: null } })), 0);
    assert.equal(lightDimmerPercent(light({ state: "off", attributes: {} })), 0);
    assert.equal(lightDimmerPercent(light({ state: "off", attributes: { brightness: 128 } })), 0);
  });

  test("a light that is unavailable or stale reads 0%", () => {
    assert.equal(lightDimmerPercent(light({ available: false })), 0);
    assert.equal(lightDimmerPercent(light({ stale: true })), 0);
    assert.equal(lightDimmerPercent(undefined), 0);
  });

  test("a lit light reads its brightness, from 1% to 100%, and never 0%", () => {
    assert.equal(lightDimmerPercent(light({ attributes: { brightness: 128 } })), 50);
    assert.equal(lightDimmerPercent(light({ attributes: { brightness: 255 } })), 100);
    assert.equal(lightDimmerPercent(light({ attributes: { brightness: 1 } })), 1);
  });

  test("a lit light that reports no brightness reads full", () => {
    assert.equal(lightDimmerPercent(light({ attributes: {} })), 100);
    assert.equal(lightDimmerPercent(light({ attributes: { brightness: null } })), 100);
  });

  async function withDimmer(state, run, onCallService = async () => undefined) {
    await withStorageDom(async ({ document, window }) => {
      const root = createRoot(document.body.appendChild(document.createElement("div")));
      const calls = [];
      try {
        await act(async () =>
          root.render(
            React.createElement(LightFields, {
              binding: { label: "Test light", state },
              enabled: true,
              onCallService: async (call) => {
                calls.push(call);
                await onCallService(call);
              },
            }),
          ),
        );
        const slider = document.querySelector('input[type="range"]');
        slider.attachEvent = () => undefined;
        slider.detachEvent = () => undefined;
        await act(async () => slider.focus());
        const key = async (key) =>
          act(async () =>
            slider.dispatchEvent(
              new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
            ),
          );
        const input = async (value) =>
          act(async () => {
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(
              slider,
              String(value),
            );
            slider.dispatchEvent(new window.Event("input", { bubbles: true }));
          });
        await run({ document, window, slider, calls, key, input });
      } finally {
        await act(async () => root.unmount());
      }
    });
  }

  test("decreasing an off light stays off, while moving from 1% to 0% turns it off once", async () => {
    await withDimmer(
      light({
        state: "off",
        attributes: { brightness: null, supported_color_modes: ["brightness"] },
      }),
      async ({ slider, calls, key }) => {
        for (const decrement of ["ArrowDown", "ArrowLeft", "PageDown", "Home"]) {
          await key(decrement);
        }
        assert.deepEqual(calls, []);
        assert.equal(slider.value, "0");
        await key("ArrowUp");
        assert.equal(slider.value, "1");
        assert.equal(calls[0].service, "turn_on");
        assert.deepEqual(calls[0].data, { brightness_pct: 1 });
        await key("ArrowDown");
        assert.equal(slider.value, "0");
        assert.deepEqual(calls[1], {
          domain: "light",
          service: "turn_off",
          target: { entity_id: "light.test" },
          data: undefined,
        });
        for (const decrement of ["ArrowDown", "ArrowLeft", "PageDown", "Home"])
          await key(decrement);
        assert.equal(calls.length, 2);
        await key("End");
        assert.equal(slider.value, "100");
        assert.deepEqual(calls[2].data, { brightness_pct: 100 });
        await key("Home");
        assert.equal(slider.value, "0");
        assert.equal(calls[3].service, "turn_off");
      },
    );
  });

  test("dragging to the bottom reaches off instead of stopping at 1%", async () => {
    await withDimmer(light(), async ({ window, slider, calls }) => {
      slider.attachEvent = () => undefined;
      slider.detachEvent = () => undefined;
      slider.getBoundingClientRect = () => ({ top: 0, height: 100 });
      let captured = false;
      slider.setPointerCapture = () => {
        captured = true;
      };
      slider.hasPointerCapture = () => captured;
      slider.releasePointerCapture = () => {
        captured = false;
      };
      const pointer = async (type, clientY) =>
        act(async () =>
          slider.dispatchEvent(
            Object.assign(
              new window.MouseEvent(type, { clientY, bubbles: true, cancelable: true }),
              { pointerId: 1 },
            ),
          ),
        );
      await pointer("pointerdown", 99);
      assert.equal(slider.value, "1");
      assert.deepEqual(calls[0].data, { brightness_pct: 1 });
      await pointer("pointermove", 100);
      assert.equal(slider.value, "0");
      assert.equal(calls[1].service, "turn_off");
      await pointer("pointerup", 100);
      await pointer("pointermove", 0);
      assert.equal(calls.length, 2);
    });
  });

  test("a failed off request restores the reading and permits retrying zero", async () => {
    let fail = true;
    await withDimmer(
      light(),
      async ({ document, slider, calls, input }) => {
        await input(0);
        assert.equal(calls[0].service, "turn_off");
        assert.equal(slider.value, "50");
        assert.match(document.querySelector('[role="alert"]').textContent, /Couldn’t update/);
        fail = false;
        await input(0);
        assert.equal(calls[1].service, "turn_off");
        assert.equal(slider.value, "0");
        assert.equal(document.querySelector('[role="alert"]'), null);
      },
      async () => {
        if (fail) throw new Error("Synthetic command failure");
      },
    );
  });
});
