import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";
import { connectedManifestFixture, connectedRuntimeFixture } from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const {
    loadStoredCompletionFlag,
    modelingNudgeStorageKey,
    onboardingStorageKey,
    validateHomeAssistantUrlInput,
  } = await load("/packages/engine/src/CabaneApp.tsx");
  const { HomeAssistantConnectionFlow } = await load(
    "/packages/engine/src/HomeAssistantConnectionFlow.tsx",
  );
  const { OnboardingIntroduction } = await load(
    "/packages/engine/src/onboarding/OnboardingIntroduction.tsx",
  );
  const { createSetupRecord, deriveSetupProgress, loadSetupRecord, setupStorageKey } = await load(
    "/packages/engine/src/setup-progress.ts",
  );
  const { useSetupRecord } = await load("/packages/engine/src/useSetupRecord.ts");
  const { createEmptyRuntimeBindingProfile } = await load(
    "/packages/engine/src/runtime-binding-profile.ts",
  );
  const manifest = connectedManifestFixture(neutralDemoManifest);

  const withDom = async (run) => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://dashboard.local/",
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

  const runtimeValue = (overrides = {}) => ({
    ...connectedRuntimeFixture({
      status: "unconfigured",
      configured: false,
      canMutate: false,
      origin: null,
      areas: [],
      devices: [],
      entityRegistry: [],
      entityStates: {},
    }),
    connect: () => undefined,
    disconnect: async () => undefined,
    retry: () => undefined,
    refreshing: false,
    refreshError: null,
    refresh: async () => undefined,
    callService: async () => undefined,
    cameraClient: null,
    ...overrides,
  });

  test("validates the browser-owned HA origin and presents the focused connection task", async () => {
    assert.match(
      validateHomeAssistantUrlInput("http://ha.local:8123/path").error,
      /remove any path/,
    );
    assert.deepEqual(validateHomeAssistantUrlInput("http://ha.local:8123"), {
      normalized: "http://ha.local:8123",
      error: null,
    });
    await withDom(async ({ dom, root }) => {
      let deferrals = 0;
      await act(async () =>
        root.render(
          React.createElement(HomeAssistantConnectionFlow, {
            homeAssistantUrl: null,
            runtime: runtimeValue(),
            onHomeAssistantUrlChange: () => undefined,
            onImportBrowserData: () => ({ valid: true, issues: [] }),
            onDefer: () => {
              deferrals += 1;
            },
            onClose: () => undefined,
          }),
        ),
      );
      const text = dom.window.document.body.textContent;
      assert.match(text, /Where does your Home Assistant live/);
      assert.match(text, /Import Cabane browser data/);
      const later = [...dom.window.document.querySelectorAll("button")].find(
        (button) => button.textContent === "Do it later",
      );
      await act(async () => later.click());
      assert.equal(deferrals, 1);
      assert.doesNotMatch(text, /Set up my home/);
    });
  });

  test("migrates validated legacy onboarding flags without deleting them", () => {
    const values = new Map([
      ["smart-home-3d:onboarding:v1:fixture-home", "complete"],
      ["smart-home-3d:modeling-nudge:v1:fixture-home", "complete"],
    ]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    assert.equal(loadStoredCompletionFlag(storage, onboardingStorageKey("fixture-home")), true);
    assert.equal(loadStoredCompletionFlag(storage, modelingNudgeStorageKey("fixture-home")), true);
    assert.equal(values.get(onboardingStorageKey("fixture-home")), "complete");
    assert.equal(values.get(modelingNudgeStorageKey("fixture-home")), "complete");
    assert.equal(values.has("smart-home-3d:onboarding:v1:fixture-home"), true);
    assert.equal(values.has("smart-home-3d:modeling-nudge:v1:fixture-home"), true);
  });

  test("introduces the whole product with two immediately available entry paths", async () => {
    await withDom(async ({ dom, root }) => {
      const actions = [];
      await act(async () =>
        root.render(
          React.createElement(OnboardingIntroduction, {
            onExplore: () => actions.push("explore"),
            onBuild: () => actions.push("build"),
            onDismiss: () => actions.push("dismiss"),
            busy: false,
            error: null,
          }),
        ),
      );
      const text = dom.window.document.body.textContent;
      assert.match(text, /Your home.In your hands/);
      assert.match(text, /Build your rooms in 3D/);
      assert.match(text, /Simulated devices/);
      for (const label of ["Explore the demo", "Build my home"]) {
        const button = [...dom.window.document.querySelectorAll("button")].find((node) =>
          node.textContent.includes(label),
        );
        assert.equal(button.disabled, false);
        await act(async () => button.click());
      }
      assert.deepEqual(actions, ["explore", "build"]);
      assert.doesNotMatch(
        text,
        /Connect my Home Assistant|steps complete|Sign in from this browser/,
      );
    });
  });

  test("successful Apply completes the build step and survives a Home remount", async () => {
    await withDom(async ({ dom, root }) => {
      const deferred = {
        ...createSetupRecord(),
        connectionStage: "deferred",
        buildChoice: "deferred",
      };
      dom.window.localStorage.setItem(setupStorageKey(manifest.home.id), JSON.stringify(deferred));
      function SetupProbe({ applied }) {
        const { setupState } = useSetupRecord(manifest.home.id, applied);
        return React.createElement("output", {}, JSON.stringify(setupState.record));
      }
      const currentRecord = () =>
        JSON.parse(dom.window.document.querySelector("output").textContent);
      const render = (applied) =>
        act(async () => root.render(React.createElement(SetupProbe, { applied })));

      // Returning with only a saved draft must not complete a deferred build.
      await render(false);
      assert.deepEqual(currentRecord(), deferred);
      await render(true);
      assert.deepEqual(currentRecord(), { ...deferred, buildChoice: "construction" });
      assert.equal(
        deriveSetupProgress({
          manifest,
          runtime: runtimeValue(),
          profile: createEmptyRuntimeBindingProfile(manifest.home.id),
          record: currentRecord(),
        }).steps[1].complete,
        true,
      );

      await act(async () => root.render(null));
      await render(false);
      assert.deepEqual(currentRecord(), { ...deferred, buildChoice: "construction" });
    });
  });

  test("persists build choices before opening Construction unmounts onboarding", async () => {
    await withDom(async ({ dom, root }) => {
      function SetupProbe({ onLeave }) {
        const { updateSetupRecord } = useSetupRecord(manifest.home.id);
        return React.createElement(
          "button",
          {
            onClick: () => {
              updateSetupRecord((record) => ({ ...record, connectionStage: "deferred" }));
              updateSetupRecord((record) => ({ ...record, buildChoice: "construction" }));
              onLeave();
            },
          },
          "Open Construction",
        );
      }
      function Parent() {
        const [editing, setEditing] = React.useState(false);
        return editing
          ? React.createElement("p", {}, "Construction")
          : React.createElement(SetupProbe, { onLeave: () => setEditing(true) });
      }
      await act(async () =>
        root.render(React.createElement(React.StrictMode, {}, React.createElement(Parent))),
      );
      await act(async () => dom.window.document.querySelector("button").click());
      assert.equal(dom.window.document.body.textContent, "Construction");
      assert.deepEqual(loadSetupRecord(dom.window.localStorage, manifest.home.id).record, {
        ...createSetupRecord(),
        connectionStage: "deferred",
        buildChoice: "construction",
      });
    });
  });

  test("keeps Apply completion in memory and warns if setup storage fails", async () => {
    await withDom(async ({ dom, root }) => {
      const deferred = {
        ...createSetupRecord(),
        connectionStage: "connected",
        buildChoice: "deferred",
        activated: true,
      };
      const stored = JSON.stringify(deferred);
      Object.defineProperty(dom.window, "localStorage", {
        value: {
          getItem: () => stored,
          setItem: () => {
            throw new Error("Storage full");
          },
        },
      });
      function SetupProbe() {
        const { setupState } = useSetupRecord(manifest.home.id, true);
        return React.createElement("output", {}, JSON.stringify(setupState));
      }
      await act(async () => root.render(React.createElement(SetupProbe)));
      const state = JSON.parse(dom.window.document.querySelector("output").textContent);
      assert.deepEqual(state.record, { ...deferred, buildChoice: "construction" });
      assert.equal(state.durable, false);
      assert.match(state.warning, /may not survive reload/);
      assert.equal(dom.window.localStorage.getItem(setupStorageKey(manifest.home.id)), stored);
    });
  });
});
