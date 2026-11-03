/* global __PERFORMANCE_SOURCE__, __PERFORMANCE_SCENARIO__ */
import "fake-indexeddb/auto";
import { _roots, addAfterEffect } from "@react-three/fiber";
import { waitForSceneGeometryLods } from "../packages/engine/src/scene-batching/SceneGeometryLod";
import { captureRuntime } from "../scripts/scene-performance/runtime-probe.mjs";
import {
  summarizeRuns,
  renderRuntimeReport,
} from "../scripts/scene-performance/runtime-report.mjs";
import "./performance-harness.css";

// Fresh, memory-only workspaces/preferences on every page load. This dedicated
// harness must never read a phone's saved home, credentials or previous demo.
for (const name of ["localStorage", "sessionStorage"]) {
  const values = new Map();
  Object.defineProperty(window, name, {
    value: {
      get length() {
        return values.size;
      },
      key: (index) => [...values.keys()][index] ?? null,
      getItem: (key) => values.get(String(key)) ?? null,
      setItem: (key, value) => {
        values.set(String(key), String(value));
      },
      removeItem: (key) => {
        values.delete(String(key));
      },
      clear: () => values.clear(),
    },
  });
}

// Freeze lighting before the real application boots; performance.now/RAF stay real.
const fixedTime = "2026-09-23T12:00:00.000Z";
const NativeDate = Date;
globalThis.Date = new Proxy(NativeDate, {
  construct(target, args) {
    return Reflect.construct(target, args.length ? args : [fixedTime]);
  },
  apply() {
    return new NativeDate(fixedTime).toString();
  },
  get(target, key) {
    return key === "now" ? () => new NativeDate(fixedTime).getTime() : Reflect.get(target, key);
  },
});
const devHome =
  __PERFORMANCE_SCENARIO__ === "dev-home" ? await import("./performance-dev-home.mjs") : null;
const preparedHome = devHome ? await devHome.prepareDevelopmentHome() : null;
await import("../apps/web/src/main.tsx");

const panel = document.createElement("aside");
panel.className = "perf-panel";
panel.setAttribute("aria-label", "Performance benchmark");
panel.innerHTML = `<strong>Performance benchmark</strong>
  <p>${devHome ? "Repo home · live dev HA · night · cloudy · 10 lights on." : "Open <b>Explore the demo</b>."} Keep Orbit view and this tab visible.</p>
  <label>Device / experiment <input id="perf-label" value="manual" maxlength="100"></label>
  <button id="perf-run">Run benchmark · 3 × 10s</button>
  <button id="perf-gestures">Record my gestures · 10s</button>
  <p id="perf-status" role="status">Production build · steady camera motion</p>
  <span id="perf-downloads"></span>`;
document.body.append(panel);
const button = panel.querySelector("#perf-run");
const gestureButton = panel.querySelector("#perf-gestures");
const status = panel.querySelector("#perf-status");
const downloads = panel.querySelector("#perf-downloads");
const mainRoot = () => {
  const canvas = document.querySelector(".scene-canvas canvas");
  const root = _roots.get(canvas);
  return root?.store.getState().internal.active ? root : null;
};
const ready = () => {
  const state = mainRoot()?.store.getState();
  return Boolean(
    location.pathname === (preparedHome?.path ?? "/demo") &&
    state?.camera.isOrthographicCamera &&
    state.scene.getObjectByName("architecture-scene") &&
    state.controls,
  );
};
let running = false;
let urls = [];
const download = (name, type, content) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  urls.push(url);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.textContent = name.endsWith(".json") ? "Download JSON" : "View chart";
  if (type === "text/html") {
    link.target = "_blank";
    link.removeAttribute("download");
  }
  downloads.append(link);
};

async function run({ seconds = 10, runs = 3, label = "manual", path = "orbit-v1" } = {}) {
  if (running) throw new Error("A benchmark is already running.");
  if (
    !Number.isFinite(seconds) ||
    seconds < 1 ||
    seconds > 60 ||
    !Number.isInteger(runs) ||
    runs < 1 ||
    runs > 10
  )
    throw new Error("Use 1–60 seconds and 1–10 runs.");
  if (!ready()) throw new Error("Open the benchmark home in Orbit view.");
  if (!["orbit-v1", "touch-orbit-v1", "manual-gestures-v1"].includes(path))
    throw new Error("Unknown camera path.");
  if (path === "touch-orbit-v1" && !window.__cabanePerfTouch)
    throw new Error("Touch replay requires the Chromium CLI driver.");
  const root = mainRoot();
  const state = root.store.getState();
  const camera = state.camera;
  const canvas = state.gl.domElement;
  running = true;
  button.disabled = true;
  gestureButton.disabled = true;
  panel.classList.add("perf-running");
  try {
    status.textContent = "Preparing scene geometry…";
    // Let the first render register its worker jobs, then await completion. This
    // explicitly measures warm steady-state, not first-load/LOD preparation cost.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        remove();
        reject(new Error("Scene did not render."));
      }, 30_000);
      const remove = addAfterEffect(() => {
        remove();
        clearTimeout(timer);
        resolve();
      });
      state.invalidate();
    });
    let prepareTimer;
    try {
      await Promise.race([
        waitForSceneGeometryLods(state.scene),
        new Promise((_, reject) => {
          prepareTimer = setTimeout(
            () => reject(new Error("Geometry preparation timed out.")),
            120_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(prepareTimer);
    }
    const gl = state.gl.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const workload = devHome ? (await devHome.readDevelopmentHome()).workload : null;
    const configuration = {
      build: "production",
      path,
      fixedTime,
      warmupSeconds: 3,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      seconds,
      runs,
      viewport: { width: innerWidth, height: innerHeight },
      deviceScaleFactor: devicePixelRatio,
      canvas: { width: canvas.width, height: canvas.height, dpr: state.gl.getPixelRatio() },
      cameraStart: {
        position: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
        target: state.controls.target.toArray(),
        zoom: camera.zoom,
      },
      ...(workload ? { workload } : {}),
    };
    const results = [];
    for (let index = 0; index < runs; index++) {
      if (!ready()) throw new Error("Return to the benchmark home's Orbit view and retry.");
      status.textContent = `Run ${index + 1}/${runs} · 3s warmup + ${seconds}s capture`;
      if (path === "manual-gestures-v1") status.textContent += " · keep dragging/pinching";
      results.push(
        await captureRuntime({
          root,
          addAfterEffect,
          seconds,
          isValid: ready,
          ...(path === "touch-orbit-v1" ? { driveInput: window.__cabanePerfTouch } : {}),
          ...(path === "manual-gestures-v1"
            ? {
                driveInput: ({ seconds }) =>
                  new Promise((resolve) => setTimeout(resolve, seconds * 1000)),
              }
            : {}),
        }),
      );
    }
    if (
      devHome &&
      JSON.stringify((await devHome.readDevelopmentHome()).workload) !== JSON.stringify(workload)
    )
      throw new Error("HA lights/weather changed during the benchmark. Discard this run.");
    let activePointLights = 0;
    let objects = 0,
      meshes = 0;
    const materials = new Set(),
      geometries = new Set();
    state.scene.traverse((object) => {
      objects++;
      if (object.isMesh) {
        meshes++;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          materials.add(material);
      }
      if (object.isPointLight && object.intensity > 0) activePointLights++;
    });
    const report = {
      schemaVersion: 1,
      measuredAt: new NativeDate().toISOString(),
      label,
      source: __PERFORMANCE_SOURCE__,
      configuration,
      scene: {
        activePointLights,
        objects,
        meshes,
        materials: materials.size,
        geometries: geometries.size,
      },
      environment: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        coarsePointer: matchMedia("(pointer: coarse)").matches,
        gpu: {
          vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : "unavailable",
          renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable",
          multiDraw: Boolean(gl.getExtension("WEBGL_multi_draw")),
        },
      },
      ...summarizeRuns(results),
    };
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls = [];
    downloads.replaceChildren();
    download("cabane-performance.json", "application/json", JSON.stringify(report, null, 2));
    download("cabane-performance.html", "text/html", renderRuntimeReport(report));
    status.textContent = `p95 ${report.summary.frameMsP95.toFixed(1)}ms · ${report.summary.over33MsPercent.toFixed(1)}% above 33.3ms`;
    return report;
  } catch (error) {
    status.textContent = error.message;
    throw error;
  } finally {
    running = false;
    button.disabled = false;
    gestureButton.disabled = false;
    panel.classList.remove("perf-running");
  }
}
button.addEventListener("click", () =>
  run({ label: panel.querySelector("#perf-label").value }).catch(() => {}),
);
gestureButton.addEventListener("click", () =>
  run({
    label: panel.querySelector("#perf-label").value,
    runs: 1,
    path: "manual-gestures-v1",
  }).catch(() => {}),
);
window.__cabanePerf = { ready, run };
