import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { ConnectActionBar } = await load("/apps/web/src/editor-connect/ConnectActionBar.tsx");
  test("Connect refresh remains available without duplicating the sidebar plan action", async () => {
    const dom = new JSDOM("<div id='root'></div>", { url: "http://localhost" });
    const previous = Object.fromEntries(
      ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
        key,
        globalThis[key],
      ]),
    );
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(document.getElementById("root"));
    let refreshes = 0;
    const props = {
      refreshing: false,
      disconnected: false,
      onRefresh: () => {
        refreshes++;
      },
    };
    try {
      await act(async () => root.render(React.createElement(ConnectActionBar, props)));
      const buttons = [...document.querySelectorAll("button")];
      assert.deepEqual(
        buttons.map((button) => button.textContent.trim()),
        ["Refresh from Home Assistant"],
      );
      await act(async () => {
        buttons[0].click();
      });
      assert.equal(refreshes, 1);
      await act(async () =>
        root.render(
          React.createElement(ConnectActionBar, {
            ...props,
            disconnected: true,
          }),
        ),
      );
      assert.equal(buttons[0].disabled, true);
      await act(async () =>
        root.render(React.createElement(ConnectActionBar, { ...props, refreshing: true })),
      );
      assert.equal(buttons[0].disabled, true);
    } finally {
      await act(async () => root.unmount());
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  });
});
