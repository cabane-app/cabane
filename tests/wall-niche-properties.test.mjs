import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { NicheProperties } = await load(
    "/apps/web/src/editor-preview/construct/NicheProperties.tsx",
  );
  test("selected niche details cap depth and expose window-like elevation controls", async () => {
    const dom = new JSDOM('<div id="root"></div>');
    const globals = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
    const previous = Object.fromEntries(
      globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    );
    for (const name of globals)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value: name === "IS_REACT_ACT_ENVIRONMENT" ? true : dom.window[name],
      });
    const root = createRoot(document.getElementById("root"));
    const niche = {
      kind: "niche",
      id: "niche",
      wallId: "wall",
      offsetPlanUnits: 1,
      widthPlanUnits: 0.6,
      openingHeightMeters: 1,
      sillHeightMeters: 0.1,
      side: "left",
      depthMeters: 0.1,
    };
    const calls = [];
    const editor = {
      draft: {
        walls: [{ id: "wall", thicknessMeters: 0.15 }],
        coordinates: { metersPerPlanUnit: 1 },
      },
      updateSelectedOpening: (patch) => calls.push(patch),
      replaceSelectedOpening: (opening) => calls.push(opening),
      reorientOpening: (openingId, change) =>
        calls.push({ type: "reorient-opening", openingId, change }),
    };
    try {
      await act(async () => root.render(React.createElement(NicheProperties, { niche, editor })));
      const depth = document.querySelector('[aria-label="Niche depth"]');
      assert.equal(Number(depth.max), 0.13);
      assert.ok(document.querySelector('[aria-label="Niche height from floor"]'));
      assert.equal(document.querySelector("details").open, false);
      await act(async () => document.querySelector("button").click());
      assert.deepEqual(calls[0], { type: "reorient-opening", openingId: "niche", change: "side" });
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      for (const name of globals) {
        if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
        else delete globalThis[name];
      }
    }
  });
});
