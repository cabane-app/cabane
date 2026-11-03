import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { useThree } from "@react-three/fiber";
import { create } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { ScenePreview, ScenePreviewContext } = await load("/packages/engine/src/ScenePreview.tsx");
  test("workspace snapshots wait for camera motion to settle and cancel pending capture on unmount", async (t) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    let now = 0,
      nextId = 0,
      captures = 0,
      state;
    const timers = new Map();
    const schedule = (callback, delay, repeat = false) => {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay, interval: repeat ? delay : 0 });
      return id;
    };
    globalThis.window = {
      setTimeout: (callback, delay) => schedule(callback, delay),
      setInterval: (callback, delay) => schedule(callback, delay, true),
      clearTimeout: (id) => timers.delete(id),
      clearInterval: (id) => timers.delete(id),
    };
    t.mock.method(performance, "now", () => now);
    function Preview() {
      state = useThree();
      return createElement(
        ScenePreviewContext.Provider,
        { value: () => captures++ },
        createElement(ScenePreview, { enabled: true }),
      );
    }
    let renderer;
    const frame = async (time, move) => {
      now = time;
      for (const [id, timer] of [...timers]) {
        if (timer.at > now) continue;
        if (timer.interval) timer.at = now + timer.interval;
        else timers.delete(id);
        timer.callback();
      }
      move?.(state.camera);
      state.camera.updateMatrixWorld();
      state.camera.updateProjectionMatrix();
      await renderer.advanceFrames(1, 1 / 60);
    };
    try {
      renderer = await create(createElement(Preview));
      await frame(0);
      await frame(2500, (camera) => camera.position.x++);
      assert.equal(captures, 0, "a scheduled thumbnail must not interrupt a pan");
      await frame(2900, (camera) => (camera.zoom *= 1.1));
      await frame(3300, (camera) => (camera.rotation.y += 0.1));
      assert.equal(captures, 0, "zoom and rotation defer the same pending snapshot");
      await frame(3799, (camera) => (camera.position.x += 1e-9));
      assert.equal(captures, 0);
      await frame(3800);
      assert.equal(captures, 1, "the pending preview is captured after 500ms at rest");
      await frame(4000);
      assert.equal(captures, 1, "settling does not create a capture loop");
      await frame(30000, (camera) => camera.position.x++);
      assert.equal(captures, 1, "periodic refresh also waits for camera rest");
      await renderer.unmount();
      renderer = null;
      assert.equal(timers.size, 0, "unmount clears periodic and deferred requests");
    } finally {
      await renderer?.unmount();
      if (previous) Object.defineProperty(globalThis, "window", previous);
      else delete globalThis.window;
    }
  });
});
