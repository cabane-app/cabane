import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { HomeAssistantHostSessionProvider } = await load(
    "/packages/engine/src/HomeAssistantHostSession.tsx",
  );
  const { WorkspaceLibrary } = await load("/apps/web/src/workspaces/WorkspaceLibrary.tsx");
  const { WorkspaceDeleteDialog } = await load(
    "/apps/web/src/workspaces/WorkspaceDeleteDialog.tsx",
  );
  const entry = {
    metadata: {
      id: "a",
      name: "Lake house",
      homeAssistantUrl: null,
      hasPublished: false,
      createdAt: 1,
    },
  };
  async function mount(overrides = {}, hosted = false) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://synthetic.invalid",
    });
    dom.window.HTMLElement.prototype.attachEvent = () => {};
    dom.window.HTMLElement.prototype.detachEvent = () => {};
    const names = ["window", "document", "navigator", "HTMLElement"];
    const previous = Object.fromEntries(
      names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    );
    for (const name of names)
      Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
    const calls = [];
    const props = {
      entries: [entry],
      ...Object.fromEntries(
        [
          "Open",
          "Create",
          "Rename",
          "Duplicate",
          "Delete",
          "Import",
          "Export",
          "Recover",
          "ExportRaw",
          "AgentPilot",
        ].map((name) => [
          `on${name}`,
          async (...args) => {
            calls.push([name, ...args]);
          },
        ]),
      ),
      ...overrides,
    };
    props.renderDelete = (selected, onCancel) =>
      createElement(WorkspaceDeleteDialog, {
        name: selected.metadata.name,
        busy: false,
        error: null,
        onCancel,
        onDelete: () => props.onDelete(selected.metadata.id),
        onBackup: () => props.onExport(selected.metadata.id, true),
      });
    const root = createRoot(dom.window.document.getElementById("root"));
    await act(async () =>
      root.render(
        createElement(
          HomeAssistantHostSessionProvider,
          { session: hosted ? { connection: {}, origin: "https://ha.test" } : null },
          createElement(MemoryRouter, null, createElement(WorkspaceLibrary, props)),
        ),
      ),
    );
    return {
      dom,
      calls,
      async click(text) {
        const button = [...dom.window.document.querySelectorAll("button")].find(
          (node) => node.textContent.trim() === text,
        );
        assert.ok(button, text);
        await act(async () => button.click());
      },
      async close() {
        await act(async () => root.unmount());
        dom.window.close();
        for (const name of names) {
          if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
          else delete globalThis[name];
        }
      },
    };
  }
  test("library setup targets the chosen home and never opens it as an editor", async () => {
    const intents = [];
    const h = await mount({
      onSettings: async (...args) => intents.push(args),
      entries: [entry, { ...entry, metadata: { ...entry.metadata, id: "b", name: "City flat" } }],
    });
    try {
      await h.click("Add Cabane to Home Assistant");
      await h.click("City flat");
      assert.deepEqual(intents, [["b", "dashboard"]]);
      assert.deepEqual(h.calls, []);
    } finally {
      await h.close();
    }
  });
  test("the card opens its home while management actions remain independent", async () => {
    const h = await mount();
    try {
      const target = h.dom.window.document.querySelector('button[aria-label="Open Lake house"]');
      assert.ok(target);
      assert.equal(target.className, "workspace-card-target");
      await act(async () => h.dom.window.document.querySelector("summary").click());
      assert.deepEqual(h.calls, []);
      await h.click("Rename");
      assert.deepEqual(h.calls, []);
      await h.click("Cancel");
      await act(async () => target.click());
      assert.deepEqual(h.calls, [["Open", "a"]]);
    } finally {
      await h.close();
    }
  });
  test("the workspace menu opens the selected home for agent pairing in HA only", async () => {
    const standalone = await mount();
    assert.ok(!standalone.dom.window.document.body.textContent.includes("Connect LLM agent"));
    await standalone.close();
    const h = await mount({}, true);
    try {
      await act(async () => h.dom.window.document.querySelector("summary").click());
      await h.click("Connect LLM agent");
      assert.deepEqual(h.calls, [["AgentPilot", "a"]]);
    } finally {
      await h.close();
    }
  });
  test("a damaged home keeps recovery actions instead of a hidden open target", async () => {
    const h = await mount({ entries: [{ ...entry, error: "Record needs recovery" }] });
    try {
      assert.equal(h.dom.window.document.querySelector(".workspace-card-target"), null);
      await h.click("Recover workspace");
      assert.deepEqual(h.calls, [["Recover", "a"]]);
    } finally {
      await h.close();
    }
  });
  test("duplicate defaults to editable copy name and waits for confirmation", async () => {
    const h = await mount();
    try {
      await h.click("Duplicate");
      assert.equal(h.dom.window.document.querySelector("input").value, "Lake house copy");
      assert.deepEqual(h.calls, []);
      await act(async () =>
        h.dom.window.document
          .querySelector("form")
          .dispatchEvent(new h.dom.window.Event("submit", { bubbles: true, cancelable: true })),
      );
      assert.deepEqual(h.calls, [["Duplicate", "a", "Lake house copy"]]);
      assert.equal(h.dom.window.document.querySelector("dialog"), null);
    } finally {
      await h.close();
    }
  });
  test("delete opens the supplied dialog without deleting until confirmed", async () => {
    const h = await mount();
    try {
      await h.click("Delete");
      assert.match(h.dom.window.document.querySelector("dialog").textContent, /Delete Lake house/);
      assert.deepEqual(h.calls, []);
      await h.click("Download backup");
      assert.deepEqual(h.calls, [["Export", "a", true]]);
      assert.ok(h.dom.window.document.querySelector("dialog"));
      await h.click("Delete permanently");
      assert.deepEqual(h.calls.at(-1), ["Delete", "a"]);
      await h.click("Cancel");
      assert.equal(
        h.dom.window.document.activeElement,
        h.dom.window.document.querySelector("summary"),
      );
    } finally {
      await h.close();
    }
  });
  test("empty library keeps creation and import available", async () => {
    const h = await mount({ entries: [] });
    try {
      assert.match(h.dom.window.document.body.textContent, /A place for your next home/);
      await h.click("New workspace");
      assert.equal(
        h.dom.window.document.querySelector("button.workspace-primary:disabled")?.textContent,
        "Create workspace",
      );
    } finally {
      await h.close();
    }
  });
  test("connection and storage are separate static facts with explicit menu destinations", async () => {
    const intents = [];
    const h = await mount({
      onSettings: async (...args) => intents.push(args),
      remoteImport: createElement("p", null, "Remote homes"),
    });
    try {
      assert.match(
        h.dom.window.document.querySelector(".workspace-availability").textContent,
        /ConnectionHA not connectedStorageLocal only/,
      );
      assert.equal(h.dom.window.document.querySelector(".workspace-availability button"), null);
      await h.click("Add Cabane to Home Assistant");
      assert.deepEqual(intents, [["a", "dashboard"]]);
      assert.equal(
        [...h.dom.window.document.querySelectorAll(".workspace-library-actions button")].some(
          (button) => button.textContent.includes("Home Assistant"),
        ),
        false,
      );
      await h.click("Import workspace");
      await h.click("From Home Assistant");
      assert.match(h.dom.window.document.querySelector("dialog").textContent, /Remote homes/);
    } finally {
      await h.close();
    }
  });
});
