import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const { WorkspaceApplication } = await load("/apps/web/src/workspaces/WorkspaceApplication.tsx");
  test("the receiving route opens without a local home and malformed links offer library recovery", async (context) => {
    // The real runtime defers subscription teardown. Keep its grace timers inside
    // this case, as native-startup-state does.
    context.mock.timers.enable({ apis: ["setTimeout"] });
    await withStorageDom(async (dom) => {
      const harness = await dom.mount(async () => {
        const router = createMemoryRouter(
          [{ path: "*", element: React.createElement(WorkspaceApplication) }],
          { initialEntries: ["/open/home-123?ha=https%3A%2F%2Fha.example&view=dashboard"] },
        );
        const root = createRoot(dom.document.body.appendChild(dom.document.createElement("div")));
        root.render(React.createElement(RouterProvider, { router }));
        return {
          router,
          unmount() {
            root.unmount();
            router.dispose();
          },
        };
      });
      await dom.until(() => dom.button("Sign in & open"));
      await act(async () => harness.router.navigate("/open/home-123?ha=javascript:bad"));
      await dom.until(
        () => dom.document.querySelector("h1")?.textContent === "This link is incomplete",
      );
      const recovery = [...dom.document.querySelectorAll("a")].find(
        (node) => node.textContent === "Open from Home Assistant",
      );
      assert.equal(recovery.getAttribute("href"), "/workspaces?import=home-assistant");
    });
  });
});
