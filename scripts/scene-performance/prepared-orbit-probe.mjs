import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";

/** Use R3F's DevTools registration for measurement without adding app probes. */
export function installOrbitSceneAccess({ fixedTime }) {
  const NativeDate = Date;
  const timestamp = NativeDate.parse(fixedTime);
  window.Date = new Proxy(NativeDate, {
    construct(target, args) {
      return Reflect.construct(target, args.length ? args : [timestamp]);
    },
    apply() {
      return new NativeDate(timestamp).toString();
    },
    get(target, key) {
      return key === "now" ? () => timestamp : Reflect.get(target, key);
    },
  });
  const stores = new Map();
  let id = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject() {
      return ++id;
    },
    onCommitFiberRoot(_, root) {
      const store = root.containerInfo;
      const canvas = store?.getState?.()?.gl?.domElement;
      if (canvas instanceof HTMLCanvasElement) stores.set(canvas, store);
    },
    onCommitFiberUnmount() {},
  };
  const store = () => {
    const canvas = document
      .querySelector("cabane-panel")
      ?.shadowRoot?.querySelector(".scene-canvas canvas");
    return stores.get(canvas);
  };
  const lodWorker = { sent: 0, pending: 0, failed: 0, changedAt: 0 };
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      if (!/\/geometry-lod\.worker-[^/]+\.js$/.test(new URL(url, location.href).pathname)) return;
      const ids = new Set();
      const send = this.postMessage;
      this.postMessage = function (message, ...args) {
        const result = send.call(this, message, ...args);
        ids.add(message.id);
        lodWorker.sent++;
        lodWorker.pending++;
        lodWorker.changedAt = performance.now();
        return result;
      };
      this.addEventListener("message", ({ data }) => {
        if (!ids.delete(data.id)) return;
        lodWorker.pending--;
        lodWorker.changedAt = performance.now();
      });
      this.addEventListener("error", () => {
        lodWorker.failed++;
      });
    }
  };
  window.__cabanePerf = { store, root: () => store()?.getState(), lodWorker };
}

export async function replayOrbitPan(page, cdp, seconds, offeredHz) {
  const point = await page.evaluate(() => {
    const { gl } = window.__cabanePerf.root();
    const canvas = gl.domElement;
    const { x, y, width, height } = canvas.getBoundingClientRect();
    const point = { x: x + width * 0.36, y: y + height * 0.56 };
    if (canvas.getRootNode().elementFromPoint(point.x, point.y) !== canvas)
      throw new Error("Orbit drag starts on an overlay instead of the canvas.");
    return point;
  });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...point,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  const start = performance.now();
  let slot = 0;
  let sent = 0;
  let last = point;
  try {
    for (;;) {
      const elapsed = performance.now() - start;
      if (elapsed >= seconds * 1000) break;
      const next = Math.floor((elapsed * offeredHz) / 1000);
      if (next <= slot) {
        await sleep(Math.max(1, ((slot + 1) * 1000) / offeredHz - elapsed));
        continue;
      }
      slot = next;
      const phase = (2 * Math.PI * elapsed) / 1150;
      last = {
        x: point.x + 125 * Math.sin(phase),
        y: point.y + 36 * Math.sin(2 * phase),
      };
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        ...last,
        button: "left",
        buttons: 1,
      });
      sent++;
    }
  } finally {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...last,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
  }

  return sent;
}

/** Wait for actual LOD replies and settled batch uploads in the production panel. */
export async function waitForOrbitBuffers(page) {
  await page.evaluate(() => {
    const { gl, scene } = window.__cabanePerf.root();
    const original = gl.render;
    const ready = { signature: "", samples: 0, changedAt: performance.now() };
    gl.render = function (...args) {
      const result = original.apply(this, args);
      if (args[0] === scene) {
        const batches = scene.children
          .filter((object) => object.isBatchedMesh)
          .map(
            ({ geometry }) =>
              `${geometry.uuid}/${geometry.attributes.position.version}/${geometry.index?.version}`,
          );
        const signature = JSON.stringify([batches, this.info.render.triangles]);
        if (signature !== ready.signature) {
          ready.signature = signature;
          ready.changedAt = performance.now();
        }
        ready.samples++;
      }
      return result;
    };
    window.__orbitReady = ready;
    window.__finishOrbitReady = () => {
      gl.render = original;
      delete window.__finishOrbitReady;
      delete window.__orbitReady;
    };
  });
  try {
    await page.waitForFunction(
      () => {
        const { lodWorker, root } = window.__cabanePerf;
        if (lodWorker.failed) throw new Error("Geometry LOD worker failed.");
        root().invalidate();
        const { samples, changedAt } = window.__orbitReady;
        return (
          lodWorker.sent > 0 &&
          lodWorker.pending === 0 &&
          samples > 1 &&
          performance.now() - Math.max(changedAt, lodWorker.changedAt) >= 500
        );
      },
      null,
      { polling: 50, timeout: 60000 },
    );
  } finally {
    await page.evaluate(() => window.__finishOrbitReady());
  }
}

export async function orbitWorkload(page) {
  return page.evaluate(() => {
    const { gl, scene, camera } = window.__cabanePerf.root();
    const native = gl.getContext();
    const debug = native.getExtension("WEBGL_debug_renderer_info");
    const root = scene.getObjectByName("prepared-orbit-furniture");
    const stats = root?.userData.preparedOrbitFurniture ?? null;
    const buffers = [];
    root?.traverse((object) => {
      if (object.isBatchedMesh) buffers.push(object.geometry.uuid);
    });
    const liveItems = new Set();
    scene.traverse((object) => {
      if (!object.name.startsWith("scene-item-")) return;
      liveItems.add(object.name);
    });
    return {
      stats,
      buffers: buffers.sort(),
      liveItems: [...liveItems].sort(),
      lodRequests: window.__cabanePerf.lodWorker.sent,
      pose: [camera.position.toArray(), camera.quaternion.toArray(), camera.zoom],
      canvas: [gl.domElement.width, gl.domElement.height, gl.getPixelRatio()],
      gpu: debug
        ? [
            native.getParameter(debug.UNMASKED_VENDOR_WEBGL),
            native.getParameter(debug.UNMASKED_RENDERER_WEBGL),
          ]
        : null,
      multiDraw: Boolean(native.getExtension("WEBGL_multi_draw")),
      visible: document.visibilityState === "visible" && document.hasFocus(),
    };
  });
}

export async function captureOrbitPixels(page) {
  const result = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const { gl, scene, invalidate } = window.__cabanePerf.root();
        const render = gl.render;
        let workload;
        const timer = setTimeout(() => {
          gl.render = render;
          reject(new Error("Timed out waiting for the final canvas draw."));
        }, 5000);
        gl.render = function (...args) {
          const value = render.apply(this, args);
          if (args[0] === scene) {
            let meshes = 0;
            let batches = 0;
            scene.traverseVisible((object) => {
              if (object.isMesh && object.layers.mask !== 0) meshes++;
              if (object.isBatchedMesh) batches++;
            });
            workload = {
              meshes,
              batches,
              calls: this.info.render.calls,
              triangles: this.info.render.triangles,
            };
          }
          // The contour pass composites to the default framebuffer after all
          // geometry renders. Read it synchronously before the buffer is cleared.
          if (this.getRenderTarget() !== null) return value;
          gl.render = render;
          clearTimeout(timer);
          const context = gl.getContext();
          const width = context.drawingBufferWidth;
          const height = context.drawingBufferHeight;
          const pixels = new Uint8Array(width * height * 4);
          context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
          resolve({ width, height, data: pixels.toBase64(), workload });
          return value;
        };
        invalidate();
      }),
  );
  return {
    width: result.width,
    height: result.height,
    pixels: Buffer.from(result.data, "base64"),
    workload: result.workload,
  };
}

export function compareOrbitPixels(reference, candidate) {
  assert.equal(reference.width, candidate.width);
  assert.equal(reference.height, candidate.height);
  let changed = 0;
  let largest = 0;
  for (let index = 0; index < candidate.pixels.length; index += 4) {
    const difference = Math.max(
      Math.abs(reference.pixels[index] - candidate.pixels[index]),
      Math.abs(reference.pixels[index + 1] - candidate.pixels[index + 1]),
      Math.abs(reference.pixels[index + 2] - candidate.pixels[index + 2]),
    );
    if (difference > 2) changed++;
    largest = Math.max(largest, difference);
  }
  return { percentOver2: (100 * changed) / (candidate.width * candidate.height), largest };
}

export async function saveOrbitMismatch(page, stem, reference, candidate) {
  const difference = Buffer.alloc(reference.pixels.length, 255);
  for (let offset = 0; offset < difference.length; offset += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const index = offset + channel;
      difference[index] = Math.min(
        255,
        4 * Math.abs(reference.pixels[index] - candidate.pixels[index]),
      );
    }
  }
  const images = [];
  for (const [suffix, pixels] of [
    ["reference", reference.pixels],
    ["candidate", candidate.pixels],
    ["difference", difference],
  ]) {
    const image = await page.evaluate(
      ({ data, width, height }) => {
        const source = Uint8Array.fromBase64(data);
        const rgba = new Uint8ClampedArray(source.length);
        const stride = width * 4;
        for (let row = 0; row < height; row++) {
          const start = row * stride;
          rgba.set(source.subarray(start, start + stride), (height - row - 1) * stride);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
        return canvas.toDataURL().split(",")[1];
      },
      { data: pixels.toString("base64"), width: candidate.width, height: candidate.height },
    );
    const path = `${stem}-${suffix}.png`;
    await writeFile(path, Buffer.from(image, "base64"));
    images.push(path);
  }
  return images;
}

export async function captureOrbitFrameCpu(page, action) {
  await page.evaluate(() => {
    const store = window.__cabanePerf.store();
    const { internal } = store.getState();
    if (internal.priority === 0) throw new Error("The dashboard render pass must own drawing.");
    const samples = [];
    let start;
    // Bracket all R3F callbacks, including work scheduled before the contour pass.
    // The dashboard already owns the render, so the final positive priority does
    // not change whether Fiber calls the default renderer.
    const begin = internal.subscribe(
      {
        current: () => {
          start = performance.now();
        },
      },
      -Infinity,
      store,
    );
    const finish = internal.subscribe(
      {
        current: () => {
          samples.push(performance.now() - start);
        },
      },
      Infinity,
      store,
    );
    window.__finishOrbitCpu = () => {
      begin();
      finish();
      delete window.__finishOrbitCpu;
      return samples;
    };
  });
  let result;
  let frameCpuMs;
  try {
    result = await action();
  } finally {
    frameCpuMs = await page.evaluate(() => window.__finishOrbitCpu());
  }
  assert.ok(frameCpuMs.length >= 2, "No full Orbit frame timings were captured");
  return { ...result, frameCpuMs };
}

export async function assertOffCamera(page, { copies, coordinates, travel }) {
  const nearest = await page.evaluate(
    ({ copies, coordinates, travel }) => {
      const { camera } = window.__cabanePerf.root();
      if (!camera.isOrthographicCamera) throw new Error("Expected the dashboard Orbit camera.");
      const horizontalProjection = Math.abs(camera.projectionMatrix.elements[0]);
      return Math.min(
        ...copies.map(({ placement, size }) => {
          const [x, z] = placement.at.map(
            (coordinate, index) =>
              (coordinate - coordinates.origin[index]) * coordinates.metersPerPlanUnit,
          );
          const center = camera.position
            .clone()
            .set(x, placement.elevationMeters, z)
            .project(camera);
          const margin = (2 * travel + Math.hypot(...size) + 2) * horizontalProjection;
          return Math.abs(center.x) - margin;
        }),
      );
    },
    { copies, coordinates, travel },
  );
  assert.ok(nearest > 1, "An off-camera item could enter the measured pan frustum.");
  return nearest;
}
