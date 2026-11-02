import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { CabaneDomProvider, useCabaneDom } = await load("/packages/engine/src/CabaneDom.tsx");
  const { useDesktopWalkInput } = await load("/packages/engine/src/desktop-walk-input.ts");
  const { requestWalkPointerLock } = await load(
    "/packages/engine/src/request-walk-pointer-lock.ts",
  );
  const { FloorPicker } = await load("/packages/engine/src/building/FloorPicker.tsx");
  const { ConstructFloorControls } = await load(
    "/apps/web/src/editor-floors/ConstructFloorControls.tsx",
  );
  const { EditorActionButton } = await load("/apps/web/src/editor-chrome/EditorActionButton.tsx");
  const { CameraViewer } = await load("/packages/engine/src/CameraViewer.tsx");
  const { makeVideo, closeVideo } = await load(
    "/packages/engine/src/camera-sessions/camera-video-lifecycle.ts",
  );
  async function fixture(run) {
    const browser = new JSDOM(
      '<body style="overflow:scroll"><button id="host">Host</button><dialog open>Host dialog</dialog><div id="panel"></div></body>',
      { url: "http://ha.local/" },
    );
    const names = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
    const previous = Object.fromEntries(names.map((name) => [name, globalThis[name]]));
    Object.assign(globalThis, {
      window: browser.window,
      document: browser.window.document,
      HTMLElement: browser.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    // React can initialize its legacy input watcher before JSDOM is installed.
    browser.window.HTMLElement.prototype.attachEvent = () => {};
    browser.window.HTMLElement.prototype.detachEvent = () => {};
    const shadow = document.querySelector("#panel").attachShadow({ mode: "open" });
    const container = document.createElement("div"),
      portals = document.createElement("div");
    shadow.append(container, portals);
    const root = createRoot(container);
    const environment = { root: shadow, container, portalContainer: portals, eventTarget: shadow };
    const render = async (child) =>
      act(async () => root.render(h(CabaneDomProvider, { environment }, child)));
    try {
      await run({ browser, shadow, container, portals, render });
    } finally {
      await act(async () => root.unmount());
      browser.window.close();
      Object.assign(globalThis, previous);
    }
  }
  test("apartment floor follows Add floor below and saves through a separate dialog", async () =>
    fixture(async ({ shadow, render }) => {
      const saved = [];
      await render(
        h(ConstructFloorControls, {
          floors: [{ id: "g", name: "Ground" }],
          selectedId: "g",
          disabled: false,
          onSelect() {},
          onAdd() {},
          onAddBelow() {},
          onSettings() {},
          apartmentFloor: 3,
          onApartmentFloor: (value) => saved.push(value),
        }),
      );
      await act(async () => shadow.querySelector('[aria-label="Current floor"]').click());
      const actions = [...shadow.querySelectorAll('[role="menuitem"]')];
      assert.equal(actions.at(-2).textContent.trim(), "Add floor below");
      assert.equal(actions.at(-1).textContent.trim(), "Setup apartment floor");
      await act(async () => actions.at(-1).click());
      assert.equal(shadow.querySelector("input").value, "3");
      await act(async () => shadow.querySelector('button[type="submit"]').click());
      assert.deepEqual(saved, [3]);
      assert.equal(shadow.querySelector("dialog"), null);
    }));
  test("DOM environment identity stays stable across unrelated renders", async () => {
    await fixture(async ({ render, shadow }) => {
      const values = [];
      function Probe() {
        values.push(useCabaneDom());
        return null;
      }
      await render(h(Probe, { revision: 1 }));
      await render(h(Probe, { revision: 2 }));
      assert.equal(values.length, 2);
      assert.equal(values[0], values[1]);
      assert.equal(values[1].root, shadow);
    });
  });
  test("panel floor menu keeps internal pointer clicks open until selection", async () =>
    fixture(async ({ browser, shadow, render }) => {
      const selected = [];
      await render(
        h(ConstructFloorControls, {
          floors: [
            { id: "g", name: "Ground" },
            { id: "u", name: "Upper" },
          ],
          selectedId: "g",
          disabled: false,
          onSelect: (id) => selected.push(id),
          onAdd() {},
          onAddBelow() {},
          onSettings() {},
        }),
      );
      const trigger = shadow.querySelector('[aria-label="Current floor"]');
      await act(async () => trigger.click());
      const upper = shadow.querySelector('[role="menuitemradio"]');
      await act(async () =>
        upper.dispatchEvent(
          new browser.window.MouseEvent("pointerdown", { bubbles: true, composed: true }),
        ),
      );
      assert.ok(upper.isConnected, "pointerdown on a floor must not dismiss its menu");
      await act(async () => upper.click());
      assert.deepEqual(selected, ["u"]);
      assert.equal(shadow.querySelector('[role="menu"]'), null);
      assert.equal(shadow.activeElement, trigger);
    }));
  test("panel floor menu navigates every entry using local keyboard focus", async () =>
    fixture(async ({ browser, shadow, render }) => {
      await render(
        h(ConstructFloorControls, {
          floors: [
            { id: "g", name: "Ground" },
            { id: "u", name: "Upper" },
          ],
          selectedId: "g",
          disabled: false,
          onSelect() {},
          onAdd() {},
          onAddBelow() {},
          onSettings() {},
        }),
      );
      const trigger = shadow.querySelector('[aria-label="Current floor"]');
      const key = async (value) =>
        act(async () =>
          shadow.activeElement.dispatchEvent(
            new browser.window.KeyboardEvent("keydown", {
              key: value,
              bubbles: true,
              composed: true,
              cancelable: true,
            }),
          ),
        );
      await act(async () => trigger.click());
      assert.equal(shadow.activeElement.textContent, "Ground");
      await key("Home");
      assert.equal(shadow.activeElement.textContent, "Upper");
      for (const label of ["Ground", "Add floor above", "Add floor below", "Upper"]) {
        await key("ArrowDown");
        assert.equal(shadow.activeElement.textContent, label);
      }
      await key("ArrowUp");
      assert.equal(shadow.activeElement.textContent, "Add floor below");
      await key("End");
      assert.equal(shadow.activeElement.textContent, "Add floor below");
      await key("Escape");
      assert.equal(shadow.querySelector('[role="menu"]'), null);
      assert.equal(shadow.activeElement, trigger);
    }));
  test("panel keyboard shortcuts ignore host events and host dialogs while respecting local inputs", async () =>
    fixture(async ({ browser, shadow, render }) => {
      const selected = [];
      await render(
        h(FloorPicker, {
          floors: [
            { id: "g", name: "Ground" },
            { id: "u", name: "Upper" },
          ],
          selectedId: "g",
          onSelect: (id) => selected.push(id),
        }),
      );
      const key = (target) =>
        target.dispatchEvent(
          new browser.window.KeyboardEvent("keydown", {
            key: "PageUp",
            bubbles: true,
            composed: true,
            cancelable: true,
          }),
        );
      await act(async () => key(document.querySelector("#host")));
      assert.deepEqual(selected, []);
      await act(async () => key(shadow.querySelector("button")));
      assert.deepEqual(selected, ["u"]);
      const input = document.createElement("input");
      shadow.append(input);
      await act(async () => key(input));
      assert.deepEqual(selected, ["u"]);
    }));
  test("walk input resets when focus leaves the panel and ignores host typing", async () =>
    fixture(async ({ browser, shadow, render }) => {
      const movement = { current: { x: 0, y: 0 } },
        sprint = { current: false };
      function WalkInput() {
        useDesktopWalkInput(true, movement, sprint);
        return h("button", null, "Walk");
      }
      await render(h(WalkInput));
      const button = shadow.querySelector("button");
      await act(async () => {
        button.focus();
        button.dispatchEvent(
          new browser.window.KeyboardEvent("keydown", {
            code: "KeyW",
            bubbles: true,
            composed: true,
          }),
        );
      });
      assert.equal(movement.current.y, -1);
      await act(async () => document.querySelector("#host").focus());
      assert.deepEqual(movement.current, { x: 0, y: 0 });
      await act(async () =>
        document.querySelector("#host").dispatchEvent(
          new browser.window.KeyboardEvent("keydown", {
            code: "KeyW",
            bubbles: true,
            composed: true,
          }),
        ),
      );
      assert.deepEqual(movement.current, { x: 0, y: 0 });
    }));
  test("active walk input keeps movement and other keys out of host shortcuts", async () =>
    fixture(async ({ browser, shadow, render }) => {
      const movement = { current: { x: 0, y: 0 } },
        sprint = { current: false };
      function WalkInput({ active }) {
        useDesktopWalkInput(active, movement, sprint);
        return h("button", null, "Walk");
      }
      const hostKeys = [];
      for (const type of ["keydown", "keyup"])
        window.addEventListener(type, (event) => hostKeys.push(`${type}:${event.code}`));
      const key = (code, target = shadow.querySelector("button"), type = "keydown") => {
        const event = new browser.window.KeyboardEvent(type, {
          code,
          bubbles: true,
          composed: true,
          cancelable: true,
        });
        target.dispatchEvent(event);
        return event;
      };
      await render(h(WalkInput, { active: true }));
      const localKeys = [];
      shadow.addEventListener("keydown", (event) => localKeys.push(event.code));
      assert.equal(key("KeyW").defaultPrevented, true);
      assert.equal(movement.current.y, -1);
      key("KeyW", shadow.querySelector("button"), "keyup");
      assert.deepEqual(movement.current, { x: 0, y: 0 });
      key("KeyE");
      assert.deepEqual(hostKeys, [], "HA must not open its entity search while walking");
      assert.deepEqual(localKeys, ["KeyW", "KeyE"], "other Cabane key handlers still run");
      key("KeyE", document.querySelector("#host"));
      assert.deepEqual(hostKeys, ["keydown:KeyE"], "host input outside Cabane remains available");
      await render(h(WalkInput, { active: false }));
      key("KeyE");
      assert.deepEqual(
        hostKeys,
        ["keydown:KeyE", "keydown:KeyE"],
        "leaving walk restores host shortcuts",
      );
    }));
  test("walk pointer lock focuses its persistent scene instead of the host or entry button", async () =>
    fixture(async ({ browser, shadow, render }) => {
      await render(h("main", null, h("button", null, "Explore")));
      const scene = shadow.querySelector("main");
      const button = shadow.querySelector("button");
      let locked = null;
      let focusCalls = 0;
      const focus = scene.focus.bind(scene);
      scene.focus = (options) => {
        focusCalls++;
        focus(options);
      };
      Object.defineProperty(shadow, "pointerLockElement", { get: () => locked });
      scene.requestPointerLock = () => {
        locked = scene;
        document.dispatchEvent(new browser.window.Event("pointerlockchange"));
        return Promise.resolve();
      };
      document.querySelector("#host").focus();
      await requestWalkPointerLock(scene);
      assert.ok(shadow.activeElement === scene, "keyboard input must enter the panel");
      assert.equal(focusCalls, 1, "the event and Promise must not focus the scene twice");
      button.remove();
      assert.ok(shadow.activeElement === scene, "removing the entry UI must not lose focus");
      document.querySelector("#host").focus();
      await requestWalkPointerLock(scene);
      assert.ok(shadow.activeElement === scene, "resuming existing pointer lock restores focus");
    }));
  test("editor tooltip stays inside the shadow portal and accounts for panel offsets", async () =>
    fixture(async ({ shadow, portals, render }) => {
      portals.getBoundingClientRect = () => ({ left: 240, top: 112, width: 800, height: 700 });
      await render(h(EditorActionButton, { icon: "undo", label: "Undo", onClick() {} }));
      const button = shadow.querySelector("button");
      button.getBoundingClientRect = () => ({
        left: 540,
        top: 212,
        width: 40,
        height: 40,
        bottom: 252,
      });
      await act(async () => button.focus());
      const tooltip = portals.querySelector('[role="tooltip"]');
      assert.ok(tooltip);
      assert.equal(document.querySelector('[role="tooltip"]'), null);
      assert.equal(tooltip.style.left, "320px");
      assert.equal(tooltip.style.top, "149px");
      assert.equal(shadow.activeElement, button);
    }));
  test("camera viewer keeps focus, overflow and parked video inside its panel", async () =>
    fixture(async ({ browser, shadow, container, render }) => {
      const opener = document.createElement("button");
      shadow.append(opener);
      opener.focus();
      const video = makeVideo(true, container);
      video.play = async () => {};
      video.pause = () => {};
      video.load = () => {};
      assert.equal(video.parentElement, container);
      let closes = 0;
      await render(
        h(CameraViewer, {
          roomName: "Room",
          deviceName: "Camera",
          onClose: () => closes++,
          media: {
            kind: "camera-stream",
            video,
            state: "playing",
            transport: "hls",
            previewState: "live",
            posterUrl: null,
            error: null,
          },
        }),
      );
      assert.equal(document.body.style.overflow, "scroll");
      assert.equal(container.style.overflow, "hidden");
      assert.equal(shadow.activeElement, shadow.querySelector("[data-camera-close]"));
      await act(async () =>
        document.querySelector("#host").dispatchEvent(
          new browser.window.KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            composed: true,
          }),
        ),
      );
      assert.equal(closes, 0);
      await act(async () =>
        shadow.activeElement.dispatchEvent(
          new browser.window.KeyboardEvent("keydown", {
            key: "Tab",
            shiftKey: true,
            bubbles: true,
            composed: true,
            cancelable: true,
          }),
        ),
      );
      const buttons = shadow.querySelectorAll(".camera-viewer button");
      assert.equal(shadow.activeElement, buttons[buttons.length - 1]);
      await render(null);
      assert.equal(shadow.activeElement, opener);
      assert.equal(video.parentElement, container);
      assert.equal(container.style.overflow, "");
      closeVideo(video);
      assert.equal(video.isConnected, false);
    }));
});
