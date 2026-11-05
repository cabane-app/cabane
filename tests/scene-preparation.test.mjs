import assert from "node:assert/strict";
import test from "node:test";
import { Scene } from "three";
import { withModules } from "./test-server.mjs";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const settle = () => new Promise(setImmediate);
const frames = (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame");
  const callbacks = [];
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value(callback) {
      callbacks.push(callback);
      return callbacks.length;
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "requestAnimationFrame", previous);
    else delete globalThis.requestAnimationFrame;
  });
  return {
    get pending() {
      return callbacks.length;
    },
    advance() {
      for (const callback of callbacks.splice(0)) callback(0);
    },
  };
};

await withModules(async (load) => {
  const { registerSceneGeometryLods, registerSceneToonBatches, waitForScenePreparation } =
    await load("/packages/engine/src/scene-batching/scene-preparation.ts");

  test("scene preparation waits for both current jobs and a frame, isolated by scene", async (t) => {
    const raf = frames(t),
      scene = new Scene(),
      lods = deferred(),
      batches = deferred();
    registerSceneGeometryLods(new Scene(), new Promise(() => {}));
    registerSceneGeometryLods(scene, lods.promise);
    registerSceneToonBatches(scene, batches.promise);
    let done = false;
    const ready = waitForScenePreparation(scene).then(() => (done = true));
    await settle();
    assert.equal(done, false);
    assert.equal(raf.pending, 0);
    lods.resolve();
    await settle();
    assert.equal(done, false);
    assert.equal(raf.pending, 0);
    batches.resolve();
    await settle();
    assert.equal(done, false, "settled jobs still need the next rendered frame");
    assert.equal(raf.pending, 1);
    // Re-registering the same identities must not create another waiting cycle.
    registerSceneGeometryLods(scene, lods.promise);
    registerSceneToonBatches(scene, batches.promise);
    raf.advance();
    await ready;
    assert.equal(done, true);
    assert.equal(raf.pending, 0);
  });

  test("late LOD publication cannot hide next-frame batch preparation", async (t) => {
    const raf = frames(t),
      scene = new Scene(),
      lods = deferred(),
      batches = deferred();
    registerSceneGeometryLods(scene, lods.promise);
    // Rendering the newly published LOD family queues its GPU packing/upload.
    requestAnimationFrame(() => registerSceneToonBatches(scene, batches.promise));
    let done = false;
    const ready = waitForScenePreparation(scene).then(() => (done = true));
    lods.resolve();
    await settle();
    raf.advance();
    await settle();
    assert.equal(done, false, "the LOD promise alone does not finish scene preparation");
    batches.resolve();
    await settle();
    assert.equal(raf.pending, 1);
    raf.advance();
    await ready;
    assert.equal(done, true);
  });

  test("preparation discovers initial frame jobs and a replacement LOD promise", async (t) => {
    const raf = frames(t),
      scene = new Scene(),
      batches = deferred(),
      lods = deferred();
    requestAnimationFrame(() => registerSceneToonBatches(scene, batches.promise));
    let done = false;
    const ready = waitForScenePreparation(scene).then(() => (done = true));
    await settle();
    raf.advance();
    await settle();
    assert.equal(done, false);
    registerSceneGeometryLods(scene, lods.promise);
    batches.resolve();
    await settle();
    raf.advance();
    await settle();
    assert.equal(done, false, "new LOD work registered during packing is also awaited");
    lods.resolve();
    await settle();
    raf.advance();
    await ready;
    assert.equal(done, true);
  });

  test("preparation surfaces worker or packing failure", async (t) => {
    const raf = frames(t),
      scene = new Scene(),
      failure = new Error("packing failed");
    registerSceneToonBatches(scene, Promise.reject(failure));
    await assert.rejects(waitForScenePreparation(scene), (error) => error === failure);
    assert.equal(raf.pending, 0);
  });
});
