import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";
await withModules(async (load) => {
  const runtime = await load("/packages/engine/src/HomeAssistantRuntime.tsx");
  test("borrowed host lifecycle never owns authentication and guards replacement, reconnect and explicit actions", async () => {
    assert.equal(typeof runtime.HomeAssistantHostSessionProvider, "function");
    const dom = new JSDOM('<div id="root"></div>', {
      url: "https://ha.example/cabane?auth_callback=1&code=untouched",
    });
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    Object.defineProperty(dom.window, "localStorage", {
      get() {
        throw Error("Borrowed session accessed token storage");
      },
    });
    let latest,
      entityCallback,
      subscriptions = 0,
      removals = 0,
      services = 0;
    const makeConnection = () => {
      const listeners = new Map();
      return {
        connected: true,
        close() {
          return assert.fail("Closed host connection");
        },
        addEventListener(type, cb) {
          const set = listeners.get(type) ?? new Set();
          set.add(cb);
          listeners.set(type, set);
        },
        removeEventListener(type, cb) {
          listeners.get(type)?.delete(cb);
        },
        fire(type) {
          for (const cb of listeners.get(type) ?? []) cb(this);
        },
        async sendMessagePromise(message) {
          return message.type.startsWith("config/") ? [] : { ok: true };
        },
        async subscribeEvents() {
          subscriptions++;
          return () => removals++;
        },
        async subscribeMessage() {
          subscriptions++;
          return () => removals++;
        },
        count() {
          return [...listeners.values()].reduce((n, s) => n + s.size, 0);
        },
      };
    };
    const client = {
      getAuth() {
        return assert.fail("getAuth");
      },
      createConnection() {
        return assert.fail("createConnection");
      },
      subscribeEntities(c, cb) {
        entityCallback = cb;
        subscriptions++;
        return () => removals++;
      },
      async callService() {
        services++;
      },
    };
    function Probe() {
      latest = runtime.useHomeAssistantRuntime();
      return null;
    }
    const root = createRoot(document.getElementById("root"));
    const a = makeConnection(),
      b = makeConnection();
    const render = async (connection = a, url = "https://ha.example", override = undefined) =>
      act(async () => {
        root.render(
          React.createElement(
            React.StrictMode,
            null,
            React.createElement(
              runtime.HomeAssistantHostSessionProvider,
              { session: { connection, origin: "https://ha.example" } },
              React.createElement(
                runtime.HomeAssistantRuntimeTestProvider,
                { client, homeAssistantUrl: url, hostSession: override },
                React.createElement(Probe),
              ),
            ),
          ),
        );
      });
    try {
      await render();
      assert.equal(latest.status, "connected");
      assert.equal(services, 0);
      assert.equal(a.count(), 3);
      const cameraIdentity = latest.cameraClient;
      await act(async () =>
        entityCallback({ "light.test": { entity_id: "light.test", state: "on", attributes: {} } }),
      );
      assert.equal(
        latest.cameraClient,
        cameraIdentity,
        "entity updates must preserve camera client identity",
      );
      const count = subscriptions;
      await render();
      assert.equal(subscriptions, count, "same connection must remain attached");
      assert.deepEqual(await latest.sendStorageMessage({ type: "cabane/list" }), { ok: true });
      assert.deepEqual(
        await latest.cameraClient.sendMessagePromise({ type: "camera/capabilities" }),
        { ok: true },
      );
      await latest.cameraClient.subscribeMessage(() => {}, { type: "camera/webrtc/offer" });
      await act(async () => {
        await latest.callService({
          domain: "light",
          service: "turn_on",
          target: { entity_id: "light.test" },
        });
      });
      assert.equal(services, 1);
      const pendingService = latest.callService({
        domain: "light",
        service: "turn_on",
        target: { entity_id: "light.test" },
        data: { brightness: 100 },
        delivery: { mode: "coalesced-value", channel: "brightness" },
      });
      await act(async () => a.fire("disconnected"));
      await pendingService;
      assert.equal(services, 1);
      assert.equal(latest.status, "reconnecting");
      assert.equal(latest.canMutate, false);
      await act(async () =>
        entityCallback({ "light.test": { entity_id: "light.test", state: "on", attributes: {} } }),
      );
      assert.equal(
        latest.entityStates["light.test"].stale,
        true,
        "cached updates while reconnecting must remain stale",
      );
      await act(async () => a.fire("ready"));
      assert.equal(latest.status, "connected");
      const old = latest,
        oldEntities = entityCallback;
      let finishCamera;
      a.subscribeMessage = () => new Promise((resolve) => (finishCamera = resolve));
      const pendingCamera = latest.cameraClient.subscribeMessage(
        () => assert.fail("stale camera callback"),
        { type: "camera/webrtc/offer" },
      );
      let cameraReleased = false;
      let resolveStorage;
      a.sendMessagePromise = () => new Promise((resolve) => (resolveStorage = resolve));
      const pending = latest.sendStorageMessage({ type: "cabane/list" });
      await render(b);
      assert.equal(a.count(), 0);
      assert.equal(latest.status, "connected");
      await act(async () => old.disconnect());
      assert.equal(latest.status, "connected");
      await act(async () => oldEntities({ "light.old": { state: "on", attributes: {} } }));
      assert.deepEqual(latest.entityStates, {});
      resolveStorage({ old: true });
      await assert.rejects(pending, /no longer active/);
      finishCamera(() => {
        cameraReleased = true;
      });
      await assert.rejects(pendingCamera, /no longer active/);
      assert.equal(cameraReleased, true);
      await assert.rejects(
        old.cameraClient.sendMessagePromise({ type: "camera/capabilities" }),
        /no longer active|not connected/,
      );
      await act(async () => latest.disconnect());
      assert.equal(latest.status, "disconnected");
      assert.equal(b.count(), 0);
      await act(async () => latest.connect());
      assert.equal(latest.status, "connected");
      await render(b, "https://other.example");
      assert.equal(latest.status, "error");
      assert.match(latest.error, /explicit|change/i);
      assert.equal(b.count(), 0);
      await act(async () => {
        latest.connect();
        latest.retry();
      });
      assert.equal(latest.status, "error");
      await render(b, null);
      assert.equal(latest.status, "unconfigured");
      assert.equal(b.count(), 0);
      // A registry response from before disconnect cannot re-enable controls.
      let resolveRegistry;
      b.sendMessagePromise = (message) =>
        message.type === "config/area_registry/list"
          ? new Promise((resolve) => (resolveRegistry = resolve))
          : Promise.resolve([]);
      await render(b);
      assert.equal(latest.status, "connecting");
      await act(async () => b.fire("disconnected"));
      await act(async () => resolveRegistry([{ area_id: "stale", name: "Stale" }]));
      assert.equal(latest.status, "reconnecting");
      assert.deepEqual(latest.areas, []);
      b.sendMessagePromise = async () => [];
      await act(async () => b.fire("ready"));
      assert.equal(latest.status, "connected");
      await render(b, null, null);
      assert.equal(latest.status, "unconfigured");
      b.subscribeEvents = async () => {
        throw Error("registry subscription denied");
      };
      await render(b);
      assert.equal(latest.status, "error");
      await act(async () => b.fire("ready"));
      assert.equal(latest.status, "error", "ready cannot recover a missing registry subscription");
      await render(b, null, null);
      assert.equal(latest.status, "unconfigured");
      assert.equal(b.count(), 0);
      assert.match(window.location.search, /code=untouched/);
    } finally {
      await act(async () => root.unmount());
      assert.equal(subscriptions, removals);
      Object.assign(globalThis, previous);
      dom.window.close();
    }
  });
  for (const [page, origin, expected] of [
    ["https://ha.example/cabane", "https://ha.example", "connected"],
    ["http://ha.lan/cabane", "http://ha.lan", "connected"],
    ["https://ha.example/cabane", "http://ha.example", "error"],
    ["http://localhost:5173/cabane", "http://127.0.0.1:8123", "error"],
    ["http://ha.lan:8123/cabane", "http://ha.lan:8124", "error"],
    ["https://ha.example/cabane", "https://other.example", "error"],
    ["http://192.0.2.1:8123/cabane", "http://192.0.2.1:8123", "connected"],
    ["http://homeassistant.local:8123/cabane", "http://homeassistant.local:8123", "connected"],
  ])
    test(`borrowed transport: ${page} to ${origin}`, async () => {
      const dom = new JSDOM('<div id="root"></div>', { url: page });
      const previous = {
        window: globalThis.window,
        document: globalThis.document,
        IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
      };
      Object.assign(globalThis, {
        window: dom.window,
        document: dom.window.document,
        IS_REACT_ACT_ENVIRONMENT: true,
      });
      Object.defineProperty(window, "localStorage", {
        get() {
          return assert.fail("token storage accessed");
        },
      });
      let latest,
        reads = 0;
      const connection = {
        connected: true,
        addEventListener() {},
        removeEventListener() {},
        close() {
          return assert.fail("close");
        },
        async sendMessagePromise() {
          reads++;
          return [];
        },
        async subscribeEvents() {
          return () => {};
        },
      };
      const client = {
        getAuth() {
          return assert.fail("getAuth");
        },
        createConnection() {
          return assert.fail("createConnection");
        },
        subscribeEntities() {
          return () => {};
        },
        callService() {
          return assert.fail("unsolicited service");
        },
      };
      function Probe() {
        latest = runtime.useHomeAssistantRuntime();
        return null;
      }
      const root = createRoot(document.getElementById("root"));
      try {
        await act(async () =>
          root.render(
            React.createElement(
              runtime.HomeAssistantRuntimeTestProvider,
              { hostSession: { connection, origin }, homeAssistantUrl: origin, client },
              React.createElement(Probe),
            ),
          ),
        );
        assert.equal(latest.status, expected);
        if (expected === "error") {
          assert.equal(reads, 0);
          assert.match(latest.error, /HTTPS/);
        } else assert.equal(reads, 3);
      } finally {
        await act(async () => root.unmount());
        Object.assign(globalThis, previous);
        dom.window.close();
      }
    });
});
