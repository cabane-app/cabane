import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { JSDOM } from "jsdom";
import { act } from "react";
import { IDBFactory } from "fake-indexeddb";

export async function withStorageDom(run, url = "https://cabane.test/") {
  const dom = new JSDOM("<!doctype html>", { url });
  const indexedDB = new IDBFactory();
  dom.window.indexedDB = indexedDB;
  dom.window.confirm = () => true;
  const intervals = new Map();
  let nextInterval = 0;
  dom.window.setInterval = (callback) => {
    intervals.set(++nextInterval, callback);
    return nextInterval;
  };
  dom.window.clearInterval = (id) => intervals.delete(id);
  const values = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event,
    indexedDB,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const cleanups = [];
  // Drain actual IndexedDB transactions and React effects until the asserted
  // state exists. No fixed sleep, retries of test cases, or real sync intervals.
  const until = async (predicate, message = "DOM condition did not settle") => {
    const deadline = performance.now() + 3000;
    do {
      let ready;
      await act(async () => {
        await setImmediate();
        ready = await predicate();
      });
      if (ready) return;
    } while (performance.now() < deadline);
    assert.fail(`${message}\n${dom.window.document.body.textContent}`);
  };
  const document = dom.window.document;
  const button = (name) =>
    [...document.querySelectorAll("button")].find((node) => node.textContent.trim() === name);
  try {
    return await run({
      document,
      window: dom.window,
      indexedDB,
      until,
      button,
      async mount(factory, options) {
        let harness;
        await act(async () => {
          harness = await factory(options);
        });
        cleanups.push(harness.unmount);
        return harness;
      },
      async click(name) {
        await until(
          () => button(name) && !button(name).disabled,
          `Missing enabled button: ${name}`,
        );
        await act(async () => button(name).click());
      },
      async pollSync() {
        await act(async () => {
          for (const callback of intervals.values()) callback();
        });
      },
    });
  } finally {
    await act(async () => {
      for (const cleanup of cleanups.reverse()) cleanup();
    });
    dom.window.close();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}
