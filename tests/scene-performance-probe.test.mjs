import assert from "node:assert/strict";
import { test } from "node:test";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import { measureScene } from "../scripts/scene-performance/browser-probe.mjs";
import { captureRuntime } from "../scripts/scene-performance/runtime-probe.mjs";

for (const motion of [false, true])
  test(
    `probe advances a demand canvas and restores renderer/camera (motion=${motion})`,
    { timeout: 2000 },
    async (t) => {
      const before = new Set(),
        after = new Set(),
        subscribers = new Set();
      const canvas = { width: 1440, height: 960 };
      const scene = {
        children: [{ isBatchedMesh: true, geometry: { uuid: "persistent-buffer" } }],
        traverseVisible() {},
      };
      const camera = new PerspectiveCamera();
      camera.position.z = 10;
      const initialPosition = camera.position.clone(),
        initialQuaternion = camera.quaternion.clone();
      const shadowCamera = {},
        postCamera = {},
        postScene = {};
      const counters = () => ({ calls: 0, triangles: 0, lines: 0, points: 0 });
      const gl = {
        info: {
          autoReset: true,
          render: counters(),
          reset() {
            this.render = counters();
          },
        },
        shadowMap: { enabled: true, needsUpdate: false },
        getPixelRatio: () => 1,
        renderBufferDirect(camera, scene, geometry) {
          this.info.render.calls++;
          this.info.render.triangles += geometry.triangles;
        },
        render(nextScene, nextCamera) {
          // Like WebGLRenderer, a default reset here would lose previous passes.
          if (this.info.autoReset) this.info.reset();
          if (nextScene === scene && this.shadowMap.needsUpdate) {
            this.renderBufferDirect(
              shadowCamera,
              scene,
              { type: "BoxGeometry", triangles: 12 },
              {},
              { name: "box" },
            );
            this.shadowMap.needsUpdate = false;
          }
          this.renderBufferDirect(
            nextCamera,
            nextScene,
            { type: "BufferGeometry", triangles: nextScene === scene ? 12 : 1 },
            {},
            { name: nextScene === scene ? "box" : "contour" },
          );
        },
      };
      const originalRender = gl.render,
        originalDirect = gl.renderBufferDirect;
      let running = false;
      let renderedFrames = 0;
      const state = {
        gl,
        scene,
        camera,
        frameloop: "demand",
        setFrameloop(value) {
          this.frameloop = value;
        },
        internal: {
          active: true,
          subscribe(ref) {
            subscribers.add(ref);
            return () => subscribers.delete(ref);
          },
        },
        invalidate() {
          // Model R3F's end-of-frame stop decision: synchronous invalidation in an
          // after-effect does not schedule another frame on an otherwise idle canvas.
          if (running) return;
          running = true;
          setImmediate(() => {
            for (const effect of before) effect();
            for (const subscriber of subscribers) subscriber.current();
            renderedFrames++;
            gl.render(scene, camera);
            gl.render(postScene, postCamera);
            for (const effect of after) effect();
            running = false;
          });
        },
      };
      const api = {
        waitForSceneGeometryLods: async () => {
          assert.ok(renderedFrames > 0);
          assert.equal(state.frameloop, "never");
        },
        roots: new Map([[canvas, { store: { getState: () => state } }]]),
        addEffect: (effect) => {
          before.add(effect);
          return () => before.delete(effect);
        },
        addAfterEffect: (effect) => {
          after.add(effect);
          return () => after.delete(effect);
        },
      };
      const moduleSource =
        "const api=globalThis.__sceneProbeTest; export const _roots=api.roots, addEffect=api.addEffect, addAfterEffect=api.addAfterEffect;";
      const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#/@react-three_fiber.js?motion=${motion}`;
      for (const [key, value] of Object.entries({
        __sceneProbeTest: api,
        document: { querySelector: () => canvas },
      })) {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, value });
        t.after(() => {
          if (descriptor) Object.defineProperty(globalThis, key, descriptor);
          else delete globalThis[key];
        });
      }
      const lodModuleUrl = `data:text/javascript;base64,${Buffer.from("export const waitForSceneGeometryLods=globalThis.__sceneProbeTest.waitForSceneGeometryLods;").toString("base64")}#motion=${motion}`;
      const result = await measureScene({
        selector: "canvas",
        moduleUrl,
        lodModuleUrl,
        samples: 4,
        warmupFrames: 2,
        motion,
      });
      assert.equal(result.frames.length, 4);
      for (const frame of result.frames) {
        assert.equal(frame.calls, 2);
        assert.equal(frame.triangles, 13);
        assert.equal(frame.passes.scene.triangles, 12);
        assert.equal(frame.passes.postprocessing.triangles, 1);
        assert.equal(frame.passes.shadow, undefined);
      }
      assert.equal(result.shadowRefresh.calls, 3);
      assert.equal(result.shadowRefresh.triangles, 25);
      assert.equal(result.shadowRefresh.passes.shadow.triangles, 12);
      assert.equal(state.frameloop, "demand");
      assert.equal(gl.info.autoReset, true);
      assert.equal(gl.render, originalRender);
      assert.equal(gl.renderBufferDirect, originalDirect);
      assert.equal(before.size + after.size + subscribers.size, 0);
      assert.deepEqual(camera.position, initialPosition);
      assert.ok(camera.quaternion.equals(initialQuaternion));
      if (motion) {
        assert.equal(result.motion.batchBuffersCreated, 0);
        assert.ok(result.motion.cpuMs.p95 >= 0);
        assert.notDeepEqual(result.frames[0].cameraPosition, result.frames[1].cameraPosition);
      }
    },
  );

for (const [interrupted, touch] of [
  [false, false],
  [true, false],
  [false, true],
])
  test(`runtime capture accumulates passes and restores state (hidden=${interrupted}, touch=${touch})`, async (t) => {
    const after = new Set(),
      subscribers = new Map();
    const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
    const canvas = Object.assign(new EventTarget(), { width: 390, height: 844 });
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", { configurable: true, value: document });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, "document", descriptor);
      else delete globalThis.document;
    });
    let clock = 100;
    t.mock.method(performance, "now", () => (clock += 5));
    const camera = new OrthographicCamera();
    camera.position.set(10, 12, 10);
    const pose = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      zoom: camera.zoom,
    };
    const gl = {
      domElement: canvas,
      getPixelRatio: () => 1,
      info: {
        autoReset: true,
        reset() {
          this.render = { calls: 0, triangles: 0 };
        },
      },
      render(triangles) {
        if (this.info.autoReset) this.info.reset();
        this.info.render.calls++;
        this.info.render.triangles += triangles;
      },
    };
    const originalRender = gl.render;
    let pending = false,
      frames = 0;
    const state = {
      gl,
      camera,
      controls: { target: new Vector3(), enabled: true, enableDamping: true, update() {} },
      internal: {
        priority: 1,
        subscribe(ref, priority) {
          subscribers.set(ref, priority);
          return () => subscribers.delete(ref);
        },
      },
      invalidate() {
        if (pending) return;
        pending = true;
        setImmediate(() => {
          pending = false;
          if (!subscribers.size) return;
          for (const [ref] of [...subscribers].sort((a, b) => a[1] - b[1])) ref.current();
          if (touch) camera.zoom += 0.01;
          gl.render(120); // beauty (including submitted shadow triangles)
          gl.render(2); // contour postprocessing
          frames++;
          if (interrupted && frames === 2) {
            document.visibilityState = "hidden";
            document.dispatchEvent(new Event("visibilitychange"));
          }
          for (const effect of after) effect();
        });
      },
    };
    const measurement = captureRuntime({
      root: { store: { getState: () => state } },
      addAfterEffect(effect) {
        after.add(effect);
        return () => after.delete(effect);
      },
      seconds: 0.08,
      warmupSeconds: 0,
      ...(touch
        ? {
            driveInput: async () => {
              assert.equal(state.controls.enabled, true);
              state.controls.target.x += 3;
              state.camera.position.x += 3;
            },
          }
        : {}),
    });
    if (interrupted) await assert.rejects(measurement, /Tab was hidden/);
    else {
      const result = await measurement;
      if (touch) assert.ok(result.movingFrames > 0, "zoom-only input counts as camera movement");
      assert.ok(result.frameIntervalsMs.length >= 2);
      assert.deepEqual(
        result.calls,
        result.calls.map(() => 2),
      );
      assert.deepEqual(
        result.triangles,
        result.triangles.map(() => 122),
      );
      assert.deepEqual(
        result.cpuSubmitMs,
        result.cpuSubmitMs.map(() => 10),
      );
      assert.ok(result.frameIntervalsMs.every((value) => value === 25));
    }
    assert.equal(subscribers.size + after.size, 0);
    assert.equal(gl.render, originalRender);
    assert.equal(gl.info.autoReset, true);
    assert.equal(state.controls.enabled, true);
    assert.deepEqual(state.controls.target, new Vector3());
    assert.equal(state.controls.enableDamping, true);
    assert.deepEqual(camera.position, pose.position);
    assert.ok(camera.quaternion.equals(pose.quaternion));
    assert.equal(camera.zoom, pose.zoom);
  });
