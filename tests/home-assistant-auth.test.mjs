import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { ERR_INVALID_HTTPS_TO_HTTP } from "home-assistant-js-websocket";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const auth = await load("/packages/engine/src/home-assistant-auth.ts");
  const runtime = await load("/packages/engine/src/HomeAssistantRuntime.tsx");
  const { requestPopupAuthorizationCode } = await load(
    "/packages/engine/src/home-assistant-popup-auth.ts",
  );

  test("borrowed sessions reject invalid, credentialed and non-web origins", () => {
    for (const url of [
      "not a URL",
      "file:///cabane",
      "ftp://ha.lan",
      "http://user:secret@ha.lan",
    ]) {
      assert.ok(auth.borrowedHomeAssistantTransportError(url, url));
    }
  });

  const popupFixture = () => {
    let receive;
    let tick;
    let opened;
    let cleared = false;
    const popup = {
      closed: false,
      close() {
        this.closed = true;
      },
    };
    const host = {
      location: { origin: "https://dashboard.example" },
      crypto: { randomUUID: () => "random-attempt-state" },
      open: (url) => {
        opened = new URL(url);
        return popup;
      },
      addEventListener: (_type, listener) => {
        receive = listener;
      },
      removeEventListener: () => {
        receive = undefined;
      },
      setInterval: (fn) => {
        tick = fn;
        return 1;
      },
      clearInterval: () => {
        cleared = true;
      },
    };
    return {
      host,
      popup,
      send: (event) => receive?.(event),
      tick: () => tick(),
      opened: () => opened,
      cleared: () => cleared,
    };
  };

  test("embedded OAuth accepts only the initiating popup, origin and state", async () => {
    const f = popupFixture();
    const pending = requestPopupAuthorizationCode(f.host, "https://ha.example", () => true);
    assert.equal(f.opened().origin, "https://ha.example");
    assert.equal(f.opened().searchParams.get("client_id"), f.host.location.origin);
    assert.equal(
      f.opened().searchParams.get("redirect_uri"),
      "https://dashboard.example/ha-auth-callback.html",
    );
    const valid = {
      origin: f.host.location.origin,
      source: f.popup,
      data: {
        type: "cabane:ha-authorization",
        state: "random-attempt-state",
        code: "synthetic-code",
      },
    };
    f.send({ ...valid, origin: "https://attacker.example" });
    f.send({ ...valid, source: {} });
    f.send({ ...valid, data: { ...valid.data, state: "wrong-state" } });
    assert.equal(f.popup.closed, false);
    f.send(valid);
    assert.equal(await pending, "synthetic-code");
    assert.equal(f.popup.closed, true);
    assert.equal(f.cleared(), true);
  });

  test("embedded OAuth works without crypto.randomUUID", async () => {
    const f = popupFixture();
    let randomCalls = 0;
    f.host.crypto = {
      getRandomValues(bytes) {
        randomCalls++;
        return bytes.fill(255);
      },
    };
    const pending = requestPopupAuthorizationCode(f.host, "https://ha.example", () => true);
    const state = f.opened().searchParams.get("state");
    assert.equal(randomCalls, 1);
    assert.equal(state, "ffffffff-ffff-4fff-bfff-ffffffffffff");
    f.send({
      origin: f.host.location.origin,
      source: f.popup,
      data: { type: "cabane:ha-authorization", state, code: "synthetic-code" },
    });
    assert.equal(await pending, "synthetic-code");
    assert.equal(f.cleared(), true);
  });

  test("embedded OAuth handles blocked/closed popups and cancelled sessions", async () => {
    const blocked = popupFixture();
    blocked.host.open = () => null;
    await assert.rejects(
      requestPopupAuthorizationCode(blocked.host, "https://ha.example", () => true),
      /Allow popups/,
    );
    for (const cancelled of [false, true]) {
      const f = popupFixture();
      let current = true;
      const pending = requestPopupAuthorizationCode(f.host, "https://ha.example", () => current);
      if (cancelled) current = false;
      else f.popup.closed = true;
      f.tick();
      await assert.rejects(pending, /closed or expired/);
      assert.equal(f.cleared(), true);
    }
  });

  test("popup callback clears credentials from the URL and targets only its own origin", async () => {
    const source = await readFile(
      new URL("../apps/web/public/ha-auth-callback.js", import.meta.url),
      "utf8",
    );
    for (const hasOpener of [true, false]) {
      const calls = [];
      const status = { textContent: "" };
      runInNewContext(source, {
        URLSearchParams,
        document: { getElementById: () => status },
        window: {
          location: {
            search: "?code=synthetic-code&state=random-state",
            pathname: "/ha-auth-callback.html",
            origin: "https://dashboard.example",
          },
          history: { replaceState: (...args) => calls.push(["clean", ...args]) },
          opener: hasOpener ? { postMessage: (...args) => calls.push(["message", ...args]) } : null,
        },
      });
      assert.deepEqual(calls[0], ["clean", null, "", "/ha-auth-callback.html"]);
      if (hasOpener) {
        assert.equal(calls[1][1].code, "synthetic-code");
        assert.equal(calls[1][1].state, "random-state");
        assert.equal(calls[1][2], "https://dashboard.example");
      } else {
        assert.equal(calls.length, 1);
        assert.match(status.textContent, /connect again/);
      }
    }
  });

  test("requires encrypted transport except paired loopback HTTP development", () => {
    const cases = [
      ["http://dashboard.test", "http://ha.test", false],
      ["http://dashboard.test", "https://ha.test", false],
      ["https://dashboard.test", "http://ha.test", false],
      ["https://dashboard.test", "https://ha.test", true],
      ["http://localhost:5173", "http://127.0.0.1:8123", true],
      ["http://127.0.0.1:5173", "http://[::1]:8123", true],
      ["http://localhost:5173", "https://ha.test", false],
      ["https://dashboard.test", "http://localhost:8123", false],
      ["http://localhost.evil.test", "http://localhost:8123", false],
      ["http://192.168.1.2", "http://192.168.1.3:8123", false],
      ["file:///dashboard", "https://ha.test", false],
    ];
    for (const [dashboard, ha, allowed] of cases) {
      assert.equal(
        auth.homeAssistantTransportError(dashboard, ha) === null,
        allowed,
        `${dashboard} → ${ha}`,
      );
    }
  });

  const { getCallbackAuthOnce } = await load(
    "/packages/engine/src/home-assistant-callback-auth.ts",
  );
  test("callback deduplication is scoped to its initiating workspace URL", async () => {
    let calls = 0;
    const client = {
      getAuth: async () => {
        calls++;
        return { fixture: true };
      },
    };
    const a = { redirectUrl: "https://app.test/workspaces/a?auth_callback=1&code=fixture-a" };
    const b = { redirectUrl: "https://app.test/workspaces/b?auth_callback=1&code=fixture-b" };
    const first = getCallbackAuthOnce(client, "https://ha.test", "https://app.test", a);
    assert.equal(getCallbackAuthOnce(client, "https://ha.test", "https://app.test", a), first);
    const second = getCallbackAuthOnce(client, "https://ha.test", "https://app.test", b);
    assert.notEqual(second, first);
    await Promise.all([first, second]);
    assert.equal(calls, 2);
  });

  test("normalizes only credential-free HTTP Home Assistant origins", () => {
    assert.equal(
      auth.normalizeHomeAssistantUrl(" http://ha.local:8123/path?x=1 "),
      "http://ha.local:8123",
    );
    assert.equal(auth.normalizeHomeAssistantUrl("https://example.test"), "https://example.test");
    assert.equal(auth.normalizeHomeAssistantUrl("ftp://ha.local"), null);
    assert.equal(auth.normalizeHomeAssistantUrl("http://user:secret@ha.local"), null);
    assert.equal(auth.normalizeHomeAssistantUrl("not a URL"), null);
  });

  test("loads only tokens for the configured HA origin and dashboard client", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const data = {
      hassUrl: "http://ha.local:8123",
      clientId: "http://dashboard.local",
      expires: Date.now() + 30_000,
      refresh_token: "fixture-refresh",
      access_token: "fixture-access",
      expires_in: 1800,
    };
    auth.saveStoredAuthData(storage, data, data.hassUrl, data.clientId);
    assert.deepEqual(
      auth.loadStoredAuthData(storage, "http://ha.local:8123", "http://dashboard.local"),
      data,
    );
    assert.equal(
      auth.loadStoredAuthData(storage, "http://ha.local:8123", "http://other-dashboard.local"),
      null,
    );
    auth.saveStoredAuthData(storage, data, data.hassUrl, data.clientId);
    assert.equal(
      auth.loadStoredAuthData(storage, "http://different.local:8123", "http://dashboard.local"),
      null,
    );
    assert.equal(values.has(auth.HOME_ASSISTANT_TOKEN_STORAGE_KEY), false);
    values.set(auth.homeAssistantAuthStorageKey(data.hassUrl, data.clientId), "{");
    assert.equal(
      auth.loadStoredAuthData(storage, "http://ha.local:8123", "http://dashboard.local"),
      null,
    );
  });

  test("stores the non-secret Home Assistant origin in browser storage", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    auth.saveStoredHomeAssistantUrl(storage, "http://ha.local:8123");
    assert.equal(auth.loadStoredHomeAssistantUrl(storage), "http://ha.local:8123");
    values.set(auth.HOME_ASSISTANT_URL_STORAGE_KEY, "not-a-url");
    assert.equal(auth.loadStoredHomeAssistantUrl(storage), null);
    assert.equal(values.has(auth.HOME_ASSISTANT_URL_STORAGE_KEY), false);
    auth.saveStoredHomeAssistantUrl(storage, null);
    assert.equal(values.has(auth.HOME_ASSISTANT_URL_STORAGE_KEY), false);
  });

  test("server sign-ins survive A to B to A and scoped sign-out", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const a = {
      hassUrl: "https://a.test",
      clientId: "https://app.test",
      expires: 1,
      refresh_token: "fixture",
      access_token: "fixture",
      expires_in: 1800,
    };
    const b = { ...a, hassUrl: "https://b.test" };
    auth.saveStoredAuthData(storage, a, a.hassUrl, a.clientId);
    auth.saveStoredAuthData(storage, b, b.hassUrl, b.clientId);
    assert.deepEqual(auth.loadStoredAuthData(storage, a.hassUrl, a.clientId), a);
    assert.deepEqual(auth.loadStoredAuthData(storage, b.hassUrl, b.clientId), b);
    assert.deepEqual(auth.loadStoredAuthData(storage, a.hassUrl + "/path", a.clientId), a);
    auth.saveStoredAuthData(storage, null, b.hassUrl, b.clientId);
    assert.deepEqual(auth.loadStoredAuthData(storage, a.hassUrl, a.clientId), a);
    assert.equal(auth.loadStoredAuthData(storage, b.hassUrl, b.clientId), null);
    values.set(auth.HOME_ASSISTANT_TOKEN_STORAGE_KEY, JSON.stringify(b));
    assert.equal(auth.loadStoredAuthData(storage, b.hassUrl, b.clientId), null);
    assert.ok(
      values.has(auth.HOME_ASSISTANT_TOKEN_STORAGE_KEY),
      "runtime never touches migration input",
    );
  });

  test("logout ignores legacy credentials and rejects writes from an older generation", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const tokens = {
      hassUrl: "http://ha.test",
      clientId: "http://dashboard.test",
      expires: 1,
      expires_in: 1,
      refresh_token: "synthetic",
      access_token: "synthetic",
    };
    values.set(auth.LEGACY_HOME_ASSISTANT_TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    const otherServer = { ...tokens, hassUrl: "http://other-ha.test" };
    auth.saveStoredAuthData(storage, otherServer, otherServer.hassUrl, otherServer.clientId, null);
    auth.invalidateStoredAuthData(storage, tokens.hassUrl, tokens.clientId);
    assert.deepEqual(
      auth.loadStoredAuthData(storage, otherServer.hassUrl, otherServer.clientId),
      otherServer,
      "logout generation must not invalidate another server's credentials",
    );
    assert.equal(auth.loadStoredAuthData(storage, tokens.hassUrl, tokens.clientId), null);
    assert.equal(values.has(auth.LEGACY_HOME_ASSISTANT_TOKEN_STORAGE_KEY), true);
    // A cross-process write can race between checking the marker and setItem.
    // The persisted generation makes that record unusable even on reload.
    auth.saveStoredAuthData(storage, tokens, tokens.hassUrl, tokens.clientId, null);
    assert.equal(auth.loadStoredAuthData(storage, tokens.hassUrl, tokens.clientId), null);
    auth.saveStoredAuthData(
      storage,
      tokens,
      tokens.hassUrl,
      tokens.clientId,
      auth.readLogoutGeneration(storage, tokens.hassUrl, tokens.clientId),
    );
    assert.deepEqual(auth.loadStoredAuthData(storage, tokens.hassUrl, tokens.clientId), tokens);
  });

  test("cleans OAuth callback material without changing the route or hash", () => {
    let replacement = null;
    const history = {
      replaceState: (_state, _title, value) => {
        replacement = value;
      },
    };
    const href =
      "http://dashboard.local/house?auth_callback=1&code=secret&state=opaque&view=room#focus";
    assert.equal(auth.hasAuthenticationCallback(href), true);
    assert.equal(auth.cleanAuthenticationCallback(href, history), true);
    assert.equal(replacement, "/house?view=room#focus");
  });

  test("normalizes live HA state and marks retained reconnect values stale", () => {
    const states = runtime.normalizeEntityStates({
      "light.demo": {
        entity_id: "light.demo",
        state: "on",
        attributes: { brightness: 90 },
        last_changed: "2026-08-27T10:00:00Z",
        last_updated: "2026-08-27T10:00:01Z",
        context: { id: "one", parent_id: null, user_id: null },
      },
      "sensor.missing": {
        entity_id: "sensor.missing",
        state: "unavailable",
        attributes: {},
        last_changed: "2026-08-27T10:00:00Z",
        last_updated: "2026-08-27T10:00:01Z",
        context: { id: "two", parent_id: null, user_id: null },
      },
    });
    assert.equal(states["light.demo"].available, true);
    assert.equal(states["light.demo"].lastConfirmedAt, "2026-08-27T10:00:01Z");
    assert.equal(states["sensor.missing"].available, false);
    const stale = runtime.markEntityStatesStale(states);
    assert.equal(stale["light.demo"].state, "on");
    assert.equal(stale["light.demo"].stale, true);
  });

  test("presents the official mixed-content failure as an actionable error", () => {
    assert.equal(
      runtime.homeAssistantErrorMessage(ERR_INVALID_HTTPS_TO_HTTP),
      "A secure dashboard cannot connect to an insecure Home Assistant URL.",
    );
  });
});
