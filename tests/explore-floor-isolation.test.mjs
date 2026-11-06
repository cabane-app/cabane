import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { EditorWorkspace } = await load("/apps/web/src/editor-workspace/EditorWorkspace.tsx");
  const {
    FloorNavigationProvider,
    createMemoryProjectRecordStore,
    createHomeProjectRepository,
    createHomeProjectLifecycle,
  } = await load("/packages/engine/src/index.ts");
  const { makeStairProject, emptyRegistries } = await load("/tests/fixtures/multiple-floors.ts");

  for (const mode of ["construct", "furnish"])
    test(`Explore from ${mode} changes floors without switching the editor behind it`, async () => {
      const dom = new JSDOM('<!doctype html><div id="root"></div>', {
        url: "http://fixture.invalid/",
        pretendToBeVisual: true,
      });
      const { window } = dom;
      window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      window.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      window.matchMedia = (query) => ({
        matches: query === "(orientation: landscape)",
        addEventListener() {},
        removeEventListener() {},
      });
      window.HTMLElement.prototype.requestPointerLock = function () {
        window.document.pointerLockElement = this;
        window.document.dispatchEvent(new window.Event("pointerlockchange"));
        return Promise.resolve();
      };
      window.document.exitPointerLock = () => {
        window.document.pointerLockElement = null;
        window.document.dispatchEvent(new window.Event("pointerlockchange"));
      };
      const names = [
        "window",
        "document",
        "navigator",
        "screen",
        "HTMLElement",
        "HTMLCanvasElement",
        "HTMLInputElement",
        "HTMLTextAreaElement",
        "ResizeObserver",
        "IntersectionObserver",
        "addEventListener",
        "removeEventListener",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "IS_REACT_ACT_ENVIRONMENT",
      ];
      const previous = Object.fromEntries(
        names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
      );
      for (const name of names)
        Object.defineProperty(globalThis, name, {
          configurable: true,
          writable: true,
          value:
            name === "IS_REACT_ACT_ENVIRONMENT"
              ? true
              : [
                    "addEventListener",
                    "removeEventListener",
                    "requestAnimationFrame",
                    "cancelAnimationFrame",
                  ].includes(name)
                ? window[name].bind(window)
                : window[name],
        });
      const root = createRoot(document.getElementById("root"));
      try {
        const seed = makeStairProject();
        seed.roomProfiles = Object.fromEntries(
          seed.floors.flatMap((floor) =>
            floor.rooms.map((room) => [room.id, { dashboardSlots: [] }]),
          ),
        );
        const repository = createHomeProjectRepository(
          createMemoryProjectRecordStore(),
          emptyRegistries,
        );
        const lifecycle = createHomeProjectLifecycle(repository, seed);
        const loaded = await lifecycle.load();
        await act(async () =>
          root.render(
            createElement(
              FloorNavigationProvider,
              { initialFloorId: "first" },
              createElement(EditorWorkspace, {
                initialRecord: loaded.record,
                lifecycle,
                onClose() {},
                autosaveDelayMs: 0,
              }),
            ),
          ),
        );
        if (mode === "furnish")
          await act(async () =>
            [...document.querySelectorAll("button")]
              .find((button) => button.textContent === "Arrange")
              .click(),
          );
        const selectedEditorFloor = () =>
          document
            .querySelector('.editor-floor-controls [aria-pressed="true"]')
            ?.getAttribute("aria-label");
        assert.equal(selectedEditorFloor(), "first floor");
        const cameraButtons = [...document.querySelectorAll(".direction-camera button")];
        assert.deepEqual(
          cameraButtons.map((button) => button.getAttribute("aria-label")),
          ["3D", "2D", "Explore"],
        );
        assert.deepEqual(
          cameraButtons.map((button) => button.getAttribute("aria-keyshortcuts")),
          ["Shift+1", "Shift+2", "Shift+3"],
        );
        assert.equal(cameraButtons[0].disabled, false);
        const shortcut = async (digit, options = {}, target = window) => {
          const event = new window.KeyboardEvent("keydown", {
            key: ["!", "@", "#"][digit - 1],
            code: `Digit${digit}`,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
            ...options,
          });
          await act(async () => target.dispatchEvent(event));
          return event.defaultPrevented;
        };
        if (mode === "furnish") {
          for (const options of [
            { shiftKey: false },
            { ctrlKey: true },
            { altKey: true },
            { metaKey: true },
            { repeat: true },
            { isComposing: true },
          ]) {
            assert.equal(await shortcut(2, options), false);
            assert.equal(cameraButtons[0].getAttribute("aria-pressed"), "true");
          }
          const input = document.createElement("input");
          document.body.append(input);
          assert.equal(await shortcut(2, {}, input), false);
          input.remove();
          const modal = document.createElement("section");
          modal.setAttribute("role", "dialog");
          modal.setAttribute("aria-modal", "true");
          document.body.append(modal);
          assert.equal(await shortcut(2), false, "view shortcuts stay behind modal dialogs");
          modal.remove();
          assert.equal(await shortcut(2), true);
          assert.equal(cameraButtons[1].getAttribute("aria-pressed"), "true");
          assert.equal(await shortcut(1), true);
          assert.equal(cameraButtons[0].getAttribute("aria-pressed"), "true");
        } else {
          assert.equal(cameraButtons[1].getAttribute("aria-pressed"), "true");
          await act(async () => cameraButtons[0].click());
          assert.ok(document.querySelector('[aria-label="3D construction preview"]'));
          const measure = document.querySelector('.editor-action-bar [aria-label="Measure"]');
          await act(async () => measure.click());
          assert.equal(cameraButtons[1].getAttribute("aria-pressed"), "true");
          assert.equal(measure.getAttribute("aria-pressed"), "true");
          assert.equal(await shortcut(1), true);
          assert.equal(cameraButtons[0].getAttribute("aria-pressed"), "true");
          assert.equal(measure.getAttribute("aria-pressed"), "false");
        }
        const beforeExplore = (await repository.load(seed.home.id)).draft;
        assert.equal(await shortcut(3), true);
        const dialog = document.querySelector('[aria-label="Explore draft"]');
        assert.ok(dialog);
        assert.ok(dialog.querySelector(".mode-walk"), "Explore uses the shared walking dashboard");
        const selectedExploreFloor = () =>
          dialog
            .querySelector('.building-floor-controls [aria-pressed="true"]')
            ?.getAttribute("aria-label");
        assert.equal(
          selectedExploreFloor(),
          "first floor",
          "Explore starts on the selected editor floor",
        );
        for (const label of ["Ground floor", "first floor", "Ground floor"]) {
          await act(async () => dialog.querySelector(`button[aria-label="${label}"]`).click());
          assert.equal(selectedExploreFloor(), label);
          assert.equal(
            selectedEditorFloor(),
            "first floor",
            "Explore must not switch the hidden editor",
          );
        }
        assert.equal(await shortcut(2), true, "Shift+2 returns from Explore to the plan");
        assert.equal(document.querySelector('[aria-label="Explore draft"]'), null);
        assert.equal(cameraButtons[1].getAttribute("aria-pressed"), "true");
        await shortcut(3);
        assert.ok(document.querySelector('[aria-label="Explore draft"]'));
        await shortcut(1);
        assert.equal(document.querySelector('[aria-label="Explore draft"]'), null);
        assert.equal(cameraButtons[0].getAttribute("aria-pressed"), "true");
        assert.equal(selectedEditorFloor(), "first floor");
        assert.deepEqual(
          (await repository.load(seed.home.id)).draft,
          beforeExplore,
          "walking must not modify the saved draft",
        );
      } finally {
        await act(async () => root.unmount());
        window.close();
        for (const name of names) {
          if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
          else delete globalThis[name];
        }
      }
    });
});
