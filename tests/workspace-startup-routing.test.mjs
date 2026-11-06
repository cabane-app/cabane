import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const { WorkspaceApplication } = await load("/apps/web/src/workspaces/WorkspaceApplication.tsx");
  const { initializeWorkspaces } = await load("/apps/web/src/workspaces/initialize-workspaces.ts");
  async function mount({ repository, path = "/" }) {
    const router = createMemoryRouter(
      [
        { path: "/", element: React.createElement(WorkspaceApplication) },
        { path: "*", element: React.createElement("div", null, "Destination") },
      ],
      { initialEntries: [path] },
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(React.createElement(RouterProvider, { router }));
    return {
      router,
      repository,
      unmount() {
        root.unmount();
        router.dispose();
        container.remove();
      },
    };
  }
  async function prepare(dom, count) {
    const repository = await initializeWorkspaces(dom.indexedDB);
    for (const entry of await repository.list())
      await repository.delete(entry.metadata.id, await repository.readRaw(entry.metadata.id));
    const ids = [];
    for (let index = 0; index < count; index++)
      ids.push((await repository.createBlank(`Home ${index}`)).metadata.id);
    return { repository, ids };
  }
  for (const count of [0, 1, 2])
    test(`standalone startup routes ${count} saved homes using the real repository`, () =>
      withStorageDom(async (dom) => {
        const { repository, ids } = await prepare(dom, count);
        const h = await dom.mount(mount, { repository });
        const expected = count === 1 ? `/workspaces/${ids[0]}` : "/workspaces";
        await dom.until(() => h.router.state.location.pathname === expected);
        assert.equal((await repository.list()).length, count);
      }));
  for (const target of ["saved", "missing", "absent"])
    test(`OAuth startup handles ${target} workspace identity before mounting a scene`, () =>
      withStorageDom(async (dom) => {
        const { repository, ids } = await prepare(dom, 2);
        if (target !== "absent")
          dom.window.sessionStorage.setItem(
            "cabane:editor-return:v1",
            JSON.stringify({
              workspaceId: target === "saved" ? ids[1] : "deleted-home",
              mode: "connect",
              view: "rooms",
            }),
          );
        const h = await dom.mount(mount, { repository, path: "/?auth_callback=1" });
        if (target === "saved") {
          await dom.until(() => h.router.state.location.pathname === `/workspaces/${ids[1]}`);
          assert.equal(h.router.state.location.search, "?auth_callback=1");
        } else {
          await dom.until(() =>
            dom.document.body.textContent.includes("This sign-in no longer has a workspace."),
          );
          await dom.click("Workspaces");
          assert.equal(h.router.state.location.pathname, "/workspaces");
        }
      }));
});
