import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withStorageDom } from "./dom-test-environment.mjs";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { useSceneFeatures } = await load(
    "/packages/engine/src/scene-features/useSceneFeatures.tsx",
  );
  test("scene features require a shortcut and invocation, release on removal and isolate homes", async () => {
    await withStorageDom(async ({ document }) => {
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      const received = [];
      let calls;
      const definitions = ["pet", "other"].map((id) => ({
        id,
        label: id,
        Icon: () => null,
        Scene(props) {
          received.push(props);
          return React.createElement("output", null, id);
        },
      }));
      const shortcuts = definitions.map(({ id }) => ({
        id,
        target: { kind: "scene-feature", featureId: id },
      }));
      function Harness({ scope = "home", items = shortcuts, available = true, enabled = true }) {
        calls = useSceneFeatures(
          scope,
          definitions,
          {
            building: {},
            floor: { id: "floor" },
            elevation: 0,
            view: "walk",
            openingPositions: {},
            enabled,
            reducedMotion: false,
          },
          available,
          items,
        );
        return calls.scene;
      }
      const render = (props) => act(async () => root.render(React.createElement(Harness, props)));
      const invoke = (id) => act(async () => calls.invoke(id));
      try {
        await render({ items: [] });
        await invoke("pet");
        assert.equal(received.length, 0, "unconfigured features cannot mount");
        await render({});
        assert.equal(received.length, 0, "adding shortcut must not load scene");
        await invoke("pet");
        assert.equal(container.textContent, "pet");
        assert.equal(received.at(-1).invocation, 1);
        await invoke("pet");
        assert.equal(received.at(-1).invocation, 2, "repeat calls reach the mounted feature");
        await invoke("other");
        assert.equal(document.querySelectorAll("output").length, 2);
        await render({ enabled: false });
        assert.equal(received.at(-1).enabled, false);
        await render({ items: shortcuts.slice(1) });
        assert.equal(container.textContent, "other");
        await render({});
        assert.equal(container.textContent, "other", "readding shortcut must not reactivate");
        await render({ available: false });
        assert.equal(container.textContent, "");
        await render({ scope: "other-home" });
        assert.equal(container.textContent, "");
        await render({ scope: "home" });
        assert.equal(container.textContent, "", "returning home starts inactive");
      } finally {
        await act(async () => root.unmount());
      }
    });
  });
});
