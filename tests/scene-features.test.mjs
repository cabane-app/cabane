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
  test("optional scene features activate independently, pause and cleanly leave the home", async () => {
    await withStorageDom(async ({ document }) => {
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      const received = [];
      const definitions = ["Pet", "Another feature"].map((label) => ({
        id: label,
        label,
        Scene(props) {
          received.push({ label, ...props });
          return React.createElement("output", null, label);
        },
      }));
      const geometry = { coordinates: {}, floors: [], stairs: [], sceneItems: [] };
      const inputs = {
        building: geometry,
        floor: { id: "floor" },
        elevation: 2,
        view: "walk",
        openingPositions: { door: 0.7 },
        enabled: true,
        reducedMotion: false,
      };
      function Harness({ scope = "home", available = true, enabled = true }) {
        const feature = useSceneFeatures(scope, definitions, { ...inputs, enabled }, available);
        return React.createElement(
          React.Fragment,
          null,
          React.createElement("details", { open: true }, feature.menuItems),
          feature.scene,
        );
      }
      const render = (props) => act(async () => root.render(React.createElement(Harness, props)));
      const click = (label) =>
        act(async () =>
          [...document.querySelectorAll("button")]
            .find((button) => button.textContent.endsWith(label))
            .click(),
        );
      try {
        await render({});
        assert.equal(received.length, 0, "disabled installations must not mount their scene");
        await click("Enable Pet");
        assert.equal(document.querySelector("details").open, false);
        assert.deepEqual(
          [...document.querySelectorAll("output")].map((node) => node.textContent),
          ["Pet"],
        );
        assert.equal(received.at(-1).building, geometry);
        assert.equal(received.at(-1).openingPositions, inputs.openingPositions);
        await click("Enable Another feature");
        assert.equal(document.querySelectorAll("output").length, 2);
        await render({ enabled: false });
        assert.equal(received.at(-1).enabled, false);
        await click("Disable Pet");
        assert.equal(document.querySelector("output").textContent, "Another feature");
        await render({ available: false });
        assert.equal(document.querySelectorAll("output, button").length, 0);
        await render({ scope: "other-home" });
        assert.equal(document.querySelectorAll("output").length, 0);
      } finally {
        await act(async () => root.unmount());
      }
    });
  });
});
