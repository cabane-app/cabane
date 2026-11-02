import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { withStorageDom } from "./dom-test-environment.mjs";
import { withModules } from "./test-server.mjs";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
const until = async (predicate) => {
  const deadline = performance.now() + 3000;
  while (!predicate()) {
    assert.ok(performance.now() < deadline, "Relay condition did not settle");
    await setImmediate();
  }
};

await withModules(async (load) => {
  const { createHaAgentClient } = await load("/apps/web/src/agent-pilot/ha-agent-client.ts");
  const { useAgentRelay } = await load("/apps/web/src/agent-pilot/useAgentRelay.ts");
  const { HomeAssistantHostSessionProvider } = await load(
    "/packages/engine/src/HomeAssistantHostSession.tsx",
  );
  function fixture(t, execute = async () => ({}), options = {}) {
    const listeners = new Map(),
      subscriptions = [],
      answers = [],
      states = [];
    const connection = {
      connected: true,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
      async subscribeMessage(fn, message, settings) {
        const sub = { fn, message, settings, closed: false };
        subscriptions.push(sub);
        if (options.delay) await options.delay.promise;
        if (!options.noSession)
          fn({
            type: "session",
            protocolVersion: "3",
            sessionId: `session-${subscriptions.length}`,
            workspaceId: message.workspace_id,
            code: "MCBN-TEST",
            pairingExpiresIn: 300,
          });
        return async () => {
          sub.closed = true;
        };
      },
      async sendMessagePromise(message) {
        answers.push(message);
        if (options.respondError) throw options.respondError;
      },
    };
    const client = createHaAgentClient({
      connection,
      workspaceId: "workspace",
      execute,
      onConnection: (state) => states.push(state),
    });
    t.after(() => client.close());
    return {
      client,
      connection,
      subscriptions,
      answers,
      states,
      listeners,
      event: (event) => subscriptions.at(-1).fn(event),
    };
  }
  const request = (id = "one") => ({
    type: "request",
    requestId: id,
    method: "inspect_workspace",
    params: {},
  });
  test("panel uses its HA subscription, receives a code and returns an editor result", async (t) => {
    const f = fixture(t, async () => ({ name: "Draft" }));
    await f.client.start();
    assert.equal(f.states.at(-1).status, "waiting");
    assert.equal(f.states.at(-1).code, "MCBN-TEST");
    assert.deepEqual(f.subscriptions[0].message, {
      type: "cabane/agent/open",
      workspace_id: "workspace",
    });
    assert.deepEqual(f.subscriptions[0].settings, { resubscribe: false });
    f.event({ type: "paired" });
    assert.equal(f.states.at(-1).status, "connected");
    f.event(request());
    await until(() => f.answers.length === 1);
    assert.deepEqual(f.answers[0], {
      type: "cabane/agent/respond",
      session_id: "session-1",
      request_id: "one",
      response: { ok: true, result: { name: "Draft" } },
    });
  });
  test("commands remain serial and queued edits cannot run after disconnect", async (t) => {
    const pending = deferred(),
      seen = [];
    const f = fixture(t, async (r) => {
      seen.push(r.requestId);
      if (r.requestId === "one") await pending.promise;
      return {};
    });
    await f.client.start();
    f.event(request());
    f.event(request("two"));
    await until(() => seen.length === 1);
    f.client.disconnect();
    pending.resolve();
    await setImmediate();
    await setImmediate();
    assert.deepEqual(seen, ["one"]);
    assert.deepEqual(f.answers, []);
    assert.equal(f.subscriptions[0].closed, true);
  });
  test("HA disconnection revokes active work and reconnection requires fresh pairing", async (t) => {
    let current;
    const f = fixture(t, async (_r, isActive) => {
      current = isActive;
      return {};
    });
    await f.client.start();
    f.event(request());
    await until(() => current);
    f.connection.connected = false;
    f.listeners.get("disconnected")();
    assert.equal(current(), false);
    f.connection.connected = true;
    f.event(request("late"));
    await setImmediate();
    assert.equal(f.states.at(-1).status, "disconnected");
  });
  test("late subscriptions from an unmounted workspace are unsubscribed", async (t) => {
    const delay = deferred();
    const f = fixture(t, undefined, { delay });
    const start = f.client.start();
    f.client.close();
    delay.resolve();
    await start;
    assert.equal(f.subscriptions[0].closed, true);
    assert.ok(!f.states.some((x) => x.status === "waiting"));
  });
  test("an editor error does not break the following request", async (t) => {
    const f = fixture(t, async (r) => {
      if (r.requestId === "one") throw new Error("Busy");
      return {};
    });
    await f.client.start();
    f.event(request());
    f.event(request("two"));
    await until(() => f.answers.length === 2);
    assert.equal(f.answers[0].response.error.message, "Busy");
    assert.equal(f.answers[1].response.ok, true);
  });
  test("oversized results report an error without dropping the HA connection", async (t) => {
    const f = fixture(t, async () => ({ data: "x".repeat(4 * 1024 * 1024) }));
    await f.client.start();
    f.event({ type: "paired" });
    f.event(request());
    await until(() => f.answers.length === 1);
    assert.equal(f.answers[0].response.ok, false);
    assert.match(f.answers[0].response.error.message, /may have completed/);
    assert.ok(JSON.stringify(f.answers[0]).length < 1000);
    assert.equal(f.states.at(-1).status, "connected");
    assert.equal(f.subscriptions[0].closed, false);
  });
  test("expired responses leave the relay usable while other transport errors disconnect it", async (t) => {
    const f = fixture(t, undefined, { respondError: { code: "request_expired" } });
    await f.client.start();
    f.event(request());
    await until(() => f.answers.length === 1);
    await setImmediate();
    assert.equal(f.states.at(-1).status, "waiting");
    const g = fixture(t, undefined, { respondError: { code: "not_found" } });
    await g.client.start();
    g.event(request());
    await until(() => g.states.at(-1).status === "disconnected");
  });
  test("server expiry clears the code and invalidates later requests", async (t) => {
    let calls = 0;
    const f = fixture(t, async () => {
      calls++;
    });
    await f.client.start();
    f.event({ type: "closed", message: "Expired" });
    f.event(request());
    await setImmediate();
    assert.equal(f.states.at(-1).message, "Expired");
    assert.equal(f.states.at(-1).code, undefined);
    assert.equal(calls, 0);
  });
  test("hook has no standalone connection and unsubscribes on workspace switch", async () => {
    await withStorageDom(async (dom) => {
      let value;
      const subscriptions = [];
      const connection = {
        connected: true,
        addEventListener() {},
        removeEventListener() {},
        async subscribeMessage(fn, msg) {
          const sub = { fn, closed: false };
          subscriptions.push(sub);
          fn({
            type: "session",
            protocolVersion: "3",
            sessionId: "session",
            workspaceId: msg.workspace_id,
            code: "MCBN-TEST",
            pairingExpiresIn: 300,
          });
          return async () => {
            sub.closed = true;
          };
        },
      };
      const controller = {};
      function Harness({ id }) {
        value = useAgentRelay(id, controller);
        return null;
      }
      const root = createRoot(dom.window.document.createElement("div"));
      await act(async () => root.render(createElement(Harness, { id: "standalone" })));
      await act(async () => value.start());
      assert.equal(subscriptions.length, 0);
      const render = (id) =>
        createElement(
          HomeAssistantHostSessionProvider,
          { session: { connection, origin: "https://ha.test" } },
          createElement(Harness, { id }),
        );
      await act(async () => root.render(render("one")));
      await act(async () => value.start());
      assert.equal(value.connection.status, "waiting");
      await act(async () => root.render(render("two")));
      assert.equal(subscriptions[0].closed, true);
      assert.equal(value.connection.code, undefined);
      await act(async () => root.unmount());
    });
  });
});
