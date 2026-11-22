import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const { WorkspaceApplication } = await load("/apps/web/src/workspaces/WorkspaceApplication.tsx");
  const { initializeWorkspaces } = await load("/apps/web/src/workspaces/initialize-workspaces.ts");
  const { isDashboardEntryPath, populatedPublishedHome } = await load(
    "/apps/web/src/workspaces/workspace-presentation.ts",
  );
  test("cold demo startup presents the home entry while welcome, editor and sign-in resolve separately", () => {
    const markup = (path) =>
      renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          { initialEntries: [path] },
          React.createElement(WorkspaceApplication),
        ),
      );
    assert.match(markup("/demo"), /aria-label="Opening home"/);
    for (const path of ["/", "/welcome", "/build", "/demo?auth_callback=1", "/workspaces"])
      assert.doesNotMatch(markup(path), /aria-label="Opening home"/);
  });
  test("personal home entry requires a published floor and the workspace dashboard route", () => {
    const published = {
      floors: [
        {
          footprint: [
            [0, 0],
            [3, 0],
            [0, 3],
          ],
        },
      ],
    };
    assert.equal(populatedPublishedHome({ publishedAt: 1, published }), published);
    assert.equal(populatedPublishedHome({ publishedAt: 0, published, draft: published }), null);
    assert.equal(
      populatedPublishedHome({ publishedAt: 1, published: { floors: [{ footprint: [] }] } }),
      null,
    );
    assert.equal(populatedPublishedHome(undefined), null);
    assert.ok(isDashboardEntryPath("/workspaces/my%20home/"));
    for (const path of [
      "/welcome",
      "/build",
      "/workspaces",
      "/workspaces/home/arrange",
      "/workspaces/home/settings",
      "/open/home",
    ])
      assert.equal(isDashboardEntryPath(path), false);
  });
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
    const { repository } = await initializeWorkspaces(dom.indexedDB, dom.window.localStorage);
    for (const entry of await repository.list())
      await repository.delete(entry.metadata.id, await repository.readRaw(entry.metadata.id));
    const ids = [];
    for (let index = 0; index < count; index++)
      ids.push((await repository.createBlank(`Home ${index}`)).metadata.id);
    return { repository, ids };
  }
  const { mobileWelcomeEligibility } = await load("/packages/engine/src/welcome.ts");
  test("mobile welcome checks installation and demo identity without seeding or reading home documents", () =>
    withStorageDom(async (dom) => {
      assert.equal(await mobileWelcomeEligibility(dom.indexedDB), "fresh");
      const { repository } = await initializeWorkspaces(dom.indexedDB, dom.window.localStorage);
      const demo = (await repository.readOnboarding()).demoWorkspaceId;
      await repository.createBlank("Personal");
      assert.equal(await mobileWelcomeEligibility(dom.indexedDB), "demo");
      await repository.delete(demo, await repository.readRaw(demo));
      assert.equal(await mobileWelcomeEligibility(dom.indexedDB), "other");
      assert.deepEqual(
        (await repository.list()).map((entry) => entry.metadata.name),
        ["Personal"],
      );
    }));
  test("a deleted Build destination retains the full introduction's recovery action", () =>
    withStorageDom(async (dom) => {
      const { repository } = await initializeWorkspaces(dom.indexedDB, dom.window.localStorage);
      const build = await repository.startOnboarding("build");
      assert.equal(await mobileWelcomeEligibility(dom.indexedDB), "demo");
      const id = build.metadata.id;
      await repository.delete(id, await repository.readRaw(id));
      assert.equal(await mobileWelcomeEligibility(dom.indexedDB), "other");
    }));
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
