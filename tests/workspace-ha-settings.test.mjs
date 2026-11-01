import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const { HomeAssistantPage } = await load("/apps/web/src/workspaces/HomeAssistantPage.tsx");
  const { WorkspaceHaStorageProvider } = await load(
    "/apps/web/src/workspaces/WorkspaceHaStorage.tsx",
  );
  const { createWorkspaceRepository } = await load("/packages/engine/src/index.ts");
  const { ownerProjectRegistries, createBrowserHomeProjectLifecycle } = await load(
    "/apps/web/src/project-runtime.ts",
  );

  test("HA settings offer personal setup while the demo only offers creating a workspace", () =>
    withStorageDom(async (dom) => {
      const repository = createWorkspaceRepository(dom.indexedDB, ownerProjectRegistries);
      const entry = await repository.createBlank("Settings boundary");
      let created = 0;
      let render;
      await dom.mount(async () => {
        const root = createRoot(dom.document.body.appendChild(dom.document.createElement("div")));
        render = (isDemo) =>
          root.render(
            React.createElement(
              MemoryRouter,
              null,
              React.createElement(
                WorkspaceHaStorageProvider,
                { id: entry.metadata.id, origin: null, repository },
                React.createElement(HomeAssistantPage, {
                  record: entry.record,
                  lifecycle: createBrowserHomeProjectLifecycle(dom.indexedDB, entry.metadata.id),
                  origin: null,
                  onChangeOrigin: async () => {},
                  onRecordChange() {},
                  isDemo,
                  onCreatePersonal: () => created++,
                }),
              ),
            ),
          );
        render(true);
        return { unmount: () => root.unmount() };
      });
      assert.match(dom.document.body.textContent, /Make this home yours/);
      assert.equal(
        [...dom.document.querySelectorAll("label")].some((node) =>
          node.textContent.includes("Home Assistant URL"),
        ),
        false,
      );
      assert.equal(dom.document.querySelector("#workspace-storage"), null);
      await dom.click("Create my workspace");
      assert.equal(created, 1);

      await act(async () => render(false));
      assert.ok(
        [...dom.document.querySelectorAll("label")].some(
          (node) => node.textContent.includes("Home Assistant URL") && node.control?.type === "url",
        ),
      );
      assert.match(
        dom.document.querySelector("#workspace-storage").textContent,
        /Connect Home Assistant first/,
      );
      assert.equal(dom.button("Enable sync"), undefined);
    }));
});
