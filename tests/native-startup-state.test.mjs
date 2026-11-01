import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const { HomeAssistantHostSessionProvider } = await load("/packages/engine/src/index.ts");
  const { WorkspaceApplication } = await load("/apps/web/src/workspaces/WorkspaceApplication.tsx");
  const { initializeWorkspaces } = await load("/apps/web/src/workspaces/initialize-workspaces.ts");
  const { exportWorkspaceBackup } = await load("/apps/web/src/workspaces/workspace-transfer.ts");

  const { readSyncCursor } = await load("/apps/web/src/workspaces/workspace-sync-state.ts");

  function startupTest(name, run) {
    test(name, async (context) => {
      // The HA client defers subscription teardown for several seconds. Keep
      // those grace timers off the wall clock and reset them after each case.
      context.mock.timers.enable({ apis: ["setTimeout"] });
      await run();
    });
  }

  async function mount(input) {
    const {
      mode,
      path = "/",
      corrupt = false,
      failRestore = false,
      savedOrigin,
    } = typeof input === "string" ? { mode: input } : input;
    const { repository } = await initializeWorkspaces(indexedDB, window.localStorage, {
      skipLegacyMigration: true,
    });
    const requests = [];
    let failList = mode === "error";
    let saved;
    if (["saved", "error", "local"].includes(mode)) {
      const entry = await repository.createBlank("Saved HA home");
      saved = {
        home_id: entry.metadata.id,
        name: "Saved HA home",
        version: 1,
        corrupt,
        document: exportWorkspaceBackup(
          {
            ...entry.metadata,
            homeAssistantUrl: savedOrigin === undefined ? window.location.origin : savedOrigin,
          },
          entry.record,
        ),
      };
      if (mode !== "local")
        await repository.delete(entry.metadata.id, await repository.readRaw(entry.metadata.id));
      else window.localStorage.setItem("cabane:last-opened-workspace", entry.metadata.id);
    }
    if (mode === "dismissed") await repository.dismissOnboarding("welcome");
    const connection = {
      connected: mode !== "disconnected",
      haVersion: "2026.10.0",
      addEventListener() {},
      removeEventListener() {},
      get auth() {
        throw Error("must not read auth");
      },
      close() {
        throw Error("must not close host");
      },
      async sendMessagePromise(message) {
        requests.push(message.type);
        if (message.type === "cabane/workspaces/list") {
          if (mode === "timeout") return new Promise(() => {});
          if (failList) throw Error("Storage unavailable");
          return saved ? [saved] : [];
        }
        if (message.type === "cabane/workspaces/get") {
          if (failRestore) throw Error("Could not download the saved home");
          return saved;
        }
        if (message.type === "cabane/workspaces/delete") {
          assert.equal(message.home_id, saved.home_id);
          assert.equal(message.expected_version, saved.version);
          saved = null;
          return null;
        }
        if (message.type.startsWith("config/")) return [];
        throw Error(`Unexpected request ${message.type}`);
      },
      async subscribeEvents() {
        return () => {};
      },
      async subscribeMessage(callback) {
        queueMicrotask(() => callback({ a: {} }));
        return () => {};
      },
    };
    // React development diagnostics enumerate props; keep the access trap for
    // application reads without making diagnostic serialization invoke it.
    Object.defineProperty(connection, "auth", { enumerable: false });
    window.open = () => {
      throw Error("must not start OAuth");
    };
    // Real startup and navigation, stopping at the destination. Chrome tests
    // separately cover mounting the destination, rendering and page reloads.
    const router = createMemoryRouter(
      [
        { path: "/", element: React.createElement(WorkspaceApplication) },
        ...(path === "/workspaces"
          ? [{ path: "/workspaces", element: React.createElement(WorkspaceApplication) }]
          : []),
        { path: "*", element: React.createElement("div", null, "Destination") },
      ],
      { initialEntries: [path] },
    );
    const app = React.createElement(RouterProvider, { router });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      React.createElement(
        React.StrictMode,
        null,
        mode === "standalone"
          ? app
          : React.createElement(
              HomeAssistantHostSessionProvider,
              { session: { connection, origin: window.location.origin } },
              app,
            ),
      ),
    );
    return {
      repository,
      savedId: saved?.home_id,
      requests,
      router,
      retry: () => {
        failList = false;
      },
      unmount: () => {
        root.unmount();
        router.dispose();
        container.remove();
      },
    };
  }

  startupTest("native LAN HTTP startup discovers saved homes without OAuth", () =>
    withStorageDom(async (dom) => {
      const h = await dom.mount(mount, "saved");
      await dom.until(() => dom.document.body.textContent.includes("Saved HA home"));
      assert.ok(h.requests.includes("cabane/workspaces/list"));
      assert.ok(!h.requests.includes("cabane/workspaces/put"));
      assert.ok(!dom.document.body.textContent.includes("Open Cabane over HTTPS"));
    }, "http://homeassistant.local:8123/cabane"),
  );

  startupTest(
    "native library appends suggested cards and adds the exact saved home with sync",
    () =>
      withStorageDom(async (dom) => {
        const h = await dom.mount(mount, { mode: "saved", path: "/workspaces" });
        const target = () =>
          dom.document.querySelector('[aria-label="Add Saved HA home from Home Assistant"]');
        await dom.until(target);
        const cards = [...dom.document.querySelectorAll(".workspace-grid > .workspace-card")];
        assert.ok(cards.length > 1);
        assert.ok(cards.at(-1).classList.contains("workspace-card--suggested"));
        assert.equal(dom.document.querySelector("dialog"), null);
        assert.ok(
          h.requests.every(
            (type) => type === "cabane/workspaces/list" || type.startsWith("config/"),
          ),
        );
        await act(async () => target().click());
        await dom.until(() => h.router.state.location.pathname === `/workspaces/${h.savedId}`);
        assert.equal((await h.repository.read(h.savedId)).metadata.name, "Saved HA home");
        assert.equal(
          (await readSyncCursor(indexedDB, window.location.origin, h.savedId)).enabled,
          true,
        );
        assert.ok(!h.requests.includes("cabane/workspaces/put"));
        await act(async () => h.router.navigate("/workspaces"));
        await dom.until(() => dom.document.querySelector('[aria-label="Open Saved HA home"]'));
        assert.equal(target(), null);
      }),
  );

  startupTest("a remote card can delete a rejected saved home without restoring it", () =>
    withStorageDom(async (dom) => {
      const h = await dom.mount(mount, {
        mode: "saved",
        path: "/workspaces",
        savedOrigin: "https://old-ha.test",
      });
      await dom.until(() =>
        dom.document.querySelector('[aria-label="Add Saved HA home from Home Assistant"]'),
      );
      await act(async () =>
        dom.document.querySelector('[aria-label="Add Saved HA home from Home Assistant"]').click(),
      );
      await dom.until(() => dom.document.body.textContent.includes("different Home Assistant"));
      const card = dom.document.querySelector(".workspace-card--suggested");
      await act(async () =>
        [...card.querySelectorAll("button")]
          .find((button) => button.textContent === "Delete")
          .click(),
      );
      await dom.click("Delete permanently");
      await dom.until(() => !dom.document.querySelector(".workspace-card--suggested"));
      assert.equal(await h.repository.read(h.savedId), null);
      assert.ok(h.requests.includes("cabane/workspaces/delete"));
      assert.ok(!h.requests.includes("cabane/workspaces/put"));
      assert.equal(dom.document.querySelector("dialog"), null);
    }),
  );

  startupTest("the library permanently deletes both a local home and its HA copy", () =>
    withStorageDom(async (dom) => {
      const h = await dom.mount(mount, { mode: "local", path: "/workspaces" });
      await dom.until(() => dom.document.querySelector('[aria-label="Open Saved HA home"]'));
      const card = dom.document
        .querySelector('[aria-label="Open Saved HA home"]')
        .closest("article");
      await act(async () =>
        [...card.querySelectorAll("button")]
          .find((button) => button.textContent === "Delete")
          .click(),
      );
      await dom.until(() => dom.document.body.textContent.includes("Other devices may still"));
      await dom.click("Delete permanently");
      await dom.until(() => h.requests.includes("cabane/workspaces/delete"));
      await dom.until(() => !dom.document.querySelector("dialog"));
      assert.ok(h.requests.includes("cabane/workspaces/delete"));
      assert.equal(dom.document.querySelector('[aria-label="Open Saved HA home"]'), null);
      assert.equal(dom.document.querySelector(".workspace-card--suggested"), null);
    }),
  );

  startupTest("native library omits local and corrupt homes from suggestions", async () => {
    for (const options of [{ mode: "local" }, { mode: "saved", corrupt: true }]) {
      await withStorageDom(async (dom) => {
        const h = await dom.mount(mount, { ...options, path: "/workspaces" });
        await dom.until(() => h.requests.includes("cabane/workspaces/list"));
        assert.equal(dom.document.querySelector(".workspace-card--suggested"), null);
      });
    }
  });

  startupTest(
    "suggestion discovery retries errors and a failed add preserves local workspaces",
    async () => {
      await withStorageDom(async (dom) => {
        const h = await dom.mount(mount, { mode: "error", path: "/workspaces" });
        await dom.until(() => dom.document.body.textContent.includes("Storage unavailable"));
        h.retry();
        await dom.click("Retry suggested workspaces");
        await dom.until(() => dom.document.querySelector(".workspace-card--suggested"));
        assert.equal(dom.document.querySelector('[role="alert"]'), null);
      });
      await withStorageDom(async (dom) => {
        const h = await dom.mount(mount, { mode: "saved", path: "/workspaces", failRestore: true });
        const before = await h.repository.list();
        await dom.until(() => dom.document.querySelector(".workspace-card--suggested"));
        await act(async () =>
          dom.document.querySelector(".workspace-card--suggested button").click(),
        );
        await dom.until(() =>
          dom.document.body.textContent.includes("Could not download the saved home"),
        );
        assert.deepEqual(await h.repository.list(), before);
        assert.equal(h.router.state.location.pathname, "/workspaces");
        assert.equal(
          dom.document.querySelector(".workspace-card--suggested button").disabled,
          false,
        );
      });
    },
  );

  for (const [mode, path] of [
    ["empty", "/welcome"],
    ["standalone", "/welcome"],
    ["dismissed", "/demo"],
    ["local", "/workspaces/"],
  ]) {
    startupTest(`native startup preserves the ${mode} destination`, () =>
      withStorageDom(async (dom) => {
        const h = await dom.mount(mount, mode);
        await dom.until(() => h.router.state.location.pathname.startsWith(path));
        const count = h.requests.filter((type) => type === "cabane/workspaces/list").length;
        assert.ok(mode === "empty" ? count > 0 : count === 0, mode);
        if (mode === "empty")
          assert.ok(h.requests.every((type) => type === "cabane/workspaces/list"));
      }),
    );
  }

  startupTest("native startup can build a new home or cancel and persist dismissal", async () => {
    await withStorageDom(async (dom) => {
      const h = await dom.mount(mount, "saved");
      await dom.click("Create a new home");
      await dom.until(() => h.router.state.location.pathname === "/build");
    });
    await withStorageDom(async (dom) => {
      const h = await dom.mount(mount, "saved");
      await dom.click("Cancel");
      await dom.until(() => h.router.state.location.pathname === "/workspaces");
      assert.equal((await h.repository.readOnboarding()).welcomeDismissed, true);
      await act(async () => h.router.navigate("/"));
      await dom.until(() => h.router.state.location.pathname === "/demo");
    });
  });

  startupTest("disconnected native startup never requests storage", () =>
    withStorageDom(async (dom) => {
      const h = await dom.mount(mount, "disconnected");
      await dom.until(() =>
        dom.document.body.textContent.includes(
          "Home Assistant is disconnected. Reconnect and try again.",
        ),
      );
      assert.deepEqual(h.requests, []);
    }),
  );

  startupTest("native startup distinguishes a timed-out check from an empty home list", () =>
    withStorageDom(async (dom) => {
      const timers = new Map();
      const setTimeout = dom.window.setTimeout.bind(dom.window);
      const clearTimeout = dom.window.clearTimeout.bind(dom.window);
      let id = -1;
      dom.window.setTimeout = (callback, ms, ...args) => {
        if (ms !== 10000) return setTimeout(callback, ms, ...args);
        timers.set(id, callback);
        return id--;
      };
      dom.window.clearTimeout = (id) => {
        timers.delete(id);
        clearTimeout(id);
      };
      await dom.mount(mount, "timeout");
      await dom.until(() => timers.size > 0);
      assert.match(dom.document.body.textContent, /Checking for homes saved on Home Assistant/);
      await act(async () => {
        for (const callback of timers.values()) callback();
      });
      assert.match(
        dom.document.body.textContent,
        /Home Assistant took too long to check saved homes. Try again./,
      );
    }),
  );

  startupTest("native startup retries failed checks and can explore the demo", () =>
    withStorageDom(async (dom) => {
      const h = await dom.mount(mount, "error");
      await dom.until(() => dom.document.body.textContent.includes("Storage unavailable"));
      assert.doesNotMatch(
        dom.document.body.textContent,
        /No Cabane workspaces saved on this HA instance/,
      );
      h.retry();
      await dom.click("Try again");
      await dom.until(() => dom.document.body.textContent.includes("Saved HA home"));
      await dom.click("Explore the demo");
      await dom.until(() => h.router.state.location.pathname === "/demo");
    }),
  );
});
