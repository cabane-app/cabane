import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { connectedCanvasEvents, dashboardCanvasEvents } = await load(
    "/packages/engine/src/connected-canvas-events.ts",
  );
  test("late Canvas creation skips cleared and detached event targets and preserves live cleanup", () => {
    const browser = new JSDOM('<div id="target"></div>');
    let state = {
      set: (update) => {
        state = { ...state, ...update(state) };
      },
    };
    const store = { getState: () => state };
    state.events = connectedCanvasEvents(store);
    const target = browser.window.document.querySelector("#target");
    const detached = browser.window.document.createElement("div");
    detached.addEventListener = () => assert.fail("bound events to a stale Canvas");
    state.events.connect(null);
    state.events.connect(detached);
    assert.equal(state.events.connected, undefined);
    let added = 0,
      removed = 0;
    const add = target.addEventListener.bind(target),
      remove = target.removeEventListener.bind(target);
    target.addEventListener = (...args) => {
      added++;
      add(...args);
    };
    target.removeEventListener = (...args) => {
      removed++;
      remove(...args);
    };
    state.events.connect(target);
    assert.equal(state.events.connected, target);
    assert.ok(added > 0);
    target.remove();
    state.events.disconnect();
    assert.equal(removed, added);
    assert.equal(state.events.connected, undefined);
    browser.window.close();
  });

  test("dashboard overlay presses reach native listeners without picking scene geometry", () => {
    const browser = new JSDOM("<div><canvas></canvas><button><span>Room</span></button></div>");
    const canvas = browser.window.document.querySelector("canvas");
    const overlay = browser.window.document.querySelector("span");
    const target = canvas.parentElement;
    let picks = 0;
    let nativePresses = 0;
    let state = {
      gl: { domElement: canvas },
      internal: { interaction: [], lastEvent: {}, capturedMap: new Map() },
      set: (update) => {
        state = { ...state, ...update(state) };
      },
    };
    state.events = dashboardCanvasEvents({ getState: () => state });
    state.events.compute = () => picks++;
    state.events.connect(target);
    for (const type of ["pointerdown", "pointerup"]) {
      target.addEventListener(type, () => nativePresses++);
      overlay.dispatchEvent(new browser.window.PointerEvent(type, { bubbles: true }));
    }
    assert.equal(nativePresses, 2);
    assert.equal(picks, 0);
    for (const type of ["pointerdown", "pointerup"])
      canvas.dispatchEvent(new browser.window.PointerEvent(type, { bubbles: true }));
    assert.equal(nativePresses, 4);
    assert.equal(picks, 2);
    browser.window.close();
  });
});
