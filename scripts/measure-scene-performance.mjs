#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { startFixtureServer, serverOrigin } from "./fixture-server.mjs";
import { measureScene } from "./scene-performance/browser-probe.mjs";
import {
  BUDGETS,
  SCENARIOS,
  compareReports,
  summarizeMeasurement,
} from "./scene-performance/report.mjs";

const help = `Usage: npm run measure:scene -- [options]
  --output PATH       JSON report (default: test-results/scene-performance/latest.json)
  --baseline PATH     Compare peak counts with a previous JSON report
  --scenarios LIST    Comma-separated subset of orbit,walk,construct,arrange
  --samples N         Rendered frames per scenario (default: 10; minimum: 3)
  --native-gpu        Use the host GPU instead of SwiftShader for timing comparisons
  --direct-reference  Benchmark the original direct draw using a browser-only route override
  --motion            Move the camera; report frame-time percentiles and batch-buffer churn
  --check             Exit 1 if any measured peak is >=50 calls or >=150000 triangles
  --help              Print this help
Requires local Google Chrome. Runs a fresh offline demo at 1440x960, DPR 1.
Counts all passes in the main canvas; this is not a GPU timing/FPS benchmark.`;

function parseOptions(args) {
  const options = {
    output: "test-results/scene-performance/latest.json",
    samples: 10,
    scenarios: SCENARIOS,
  };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--help") {
      console.log(help);
      return null;
    }
    if (flag === "--native-gpu") {
      options.nativeGpu = true;
      continue;
    }
    if (flag === "--direct-reference") {
      options.directReference = true;
      continue;
    }
    if (flag === "--motion") {
      options.motion = true;
      continue;
    }
    if (flag === "--check") {
      options.check = true;
      continue;
    }
    if (!["--output", "--baseline", "--scenarios", "--samples"].includes(flag))
      throw new Error(`Unknown option: ${flag}`);
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    options[flag.slice(2)] = value;
  }
  options.samples = Number(options.samples);
  if (!Number.isInteger(options.samples) || options.samples < 3 || options.samples > 100)
    throw new Error("--samples must be an integer from 3 to 100.");
  if (typeof options.scenarios === "string") options.scenarios = options.scenarios.split(",");
  if (
    new Set(options.scenarios).size !== options.scenarios.length ||
    options.scenarios.some((id) => !SCENARIOS.includes(id))
  ) {
    throw new Error("--scenarios must contain unique names from orbit,walk,construct,arrange.");
  }
  options.scenarios = SCENARIOS.filter((id) => options.scenarios.includes(id));
  if (options.baseline && resolve(options.baseline) === resolve(options.output))
    throw new Error("Baseline and output must be different files.");
  return options;
}

async function run(options) {
  // fixture-server resolves its root at import time: fail clearly when invoked
  // outside the repository instead of benchmarking a different directory.
  const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (process.cwd() !== repository) throw new Error("Run the benchmark from the repository root.");
  const baseline = options.baseline
    ? JSON.parse(await readFile(resolve(options.baseline), "utf8"))
    : null;
  const homeFiles = await Promise.all(
    ["project", "layout", "items"].map((name) => readFile(`home/src/${name}.json`, "utf8")),
  );
  const project = JSON.parse(homeFiles[0]);
  const configuration = {
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    fixedTime: "2026-09-23T12:00:00.000Z",
    timezone: "UTC",
    renderer: options.nativeGpu ? "native" : "swiftshader",
    ...(options.motion ? { motion: true } : {}),
    samples: options.samples,
    warmupFrames: 8,
    scenarios: options.scenarios,
  };
  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    configuration,
    source: {
      renderingPath: options.directReference ? "direct-reference" : "runtime",
      commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      dirty: Boolean(
        execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
          encoding: "utf8",
        }).trim(),
      ),
      homeId: project.home.id,
      homeHash: createHash("sha256").update(homeFiles.join("\n")).digest("hex"),
    },
    budgets: {
      ...BUDGETS,
      comparison: "strictly-less-than",
      scope: "peak including forced shadow refresh",
    },
    scenarios: [],
  };
  // Validate baseline compatibility before doing expensive browser work.
  if (baseline) compareReports(report, baseline);
  let server, browser;
  try {
    console.log("Starting isolated server and Chrome…");
    // Keep Vite's client socket available: with ws disabled its dev client
    // produces spurious browser errors, especially on an ephemeral port.
    server = await startFixtureServer({ port: 0, fixture: false, hmr: true });
    browser = await chromium.launch({
      channel: "chromium",
      headless: true,
      args: options.nativeGpu ? [] : ["--use-angle=swiftshader"],
    });
    report.browser = browser.version();
    const context = await browser.newContext({
      viewport: configuration.viewport,
      deviceScaleFactor: 1,
      timezoneId: "UTC",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(120_000);
    if (options.directReference)
      await page.route("**/StylizedScene.tsx*", async (route) => {
        const response = await route.fetch();
        const source = await response.text();
        const pipeline =
          /resources\.shadows\.render\(gl, scene, camera, \(\) =>\s*resources\.lod\.render\(scene, camera, size.y \/ gl.getPixelRatio\(\), \(\) => resources\.batches\.render\(gl, scene, camera\)\)\)/;
        if (!pipeline.test(source)) {
          await route.abort();
          throw new Error("Direct-reference renderer override no longer matches StylizedScene.");
        }
        await route.fulfill({
          response,
          body: source.replace(pipeline, "resources.shadows.render(gl, scene, camera)"),
        });
      });
    const errors = [];
    let moduleUrl;
    // Observe the module request outside the page: Playwright's fixed clock can
    // mask Resource Timing entries in page.evaluate.
    page.on("response", (response) => {
      if (response.url().includes("/@react-three_fiber.js")) moduleUrl = response.url();
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource"))
        errors.push(message.text());
    });
    // Freeze Date only; requestAnimationFrame/performance timers keep running.
    if (options.motion) {
      // Freeze scene lighting without virtualizing performance.now or RAF timing.
      await page.addInitScript((timestamp) => {
        const NativeDate = Date;
        globalThis.Date = new Proxy(NativeDate, {
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
      }, new Date(configuration.fixedTime).getTime());
    } else await page.clock.setFixedTime(new Date(configuration.fixedTime));
    await page.goto(serverOrigin(server));
    console.log("Opening the bundled demo…");
    await page.getByRole("button", { name: /^Explore the demo/ }).click();
    await page.getByRole("button", { name: "Walk mode", exact: true }).waitFor();
    const capture = async (id, selector, expectedObject) => {
      console.log(`Measuring ${id}…`);
      await page.locator(selector).waitFor({ state: "visible" });
      if (!moduleUrl) throw new Error("Cannot locate the application's Vite R3F module request.");
      await page.waitForFunction(
        async ({ selector, expectedObject, moduleUrl }) => {
          const { _roots } = await import(moduleUrl);
          return Boolean(
            _roots
              .get(document.querySelector(selector))
              ?.store.getState()
              .scene.getObjectByName(expectedObject),
          );
        },
        { selector, expectedObject, moduleUrl },
      );
      const measurement = await page.evaluate(measureScene, {
        selector,
        moduleUrl,
        motion: Boolean(options.motion),
        preparationModuleUrl: `/@fs${process.cwd()}/packages/engine/src/scene-batching/scene-preparation.ts`,
        samples: options.samples,
        warmupFrames: configuration.warmupFrames,
      });
      report.graphics ??= await page.evaluate((selector) => {
        const gl = document.querySelector(selector).getContext("webgl2");
        const debug = gl?.getExtension("WEBGL_debug_renderer_info");
        return debug
          ? {
              vendor: gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),
              renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
            }
          : { renderer: "unavailable" };
      }, selector);
      const summary = summarizeMeasurement(measurement);
      report.scenarios.push({ id, ...measurement, summary });
      console.log(
        `  steady median: ${summary.steady.calls.median} calls / ${summary.steady.triangles.median} triangles; peak: ${summary.peak.calls} / ${summary.peak.triangles}`,
      );
      if (measurement.motion)
        console.log(
          `  motion: CPU p95 ${measurement.motion.cpuMs.p95.toFixed(2)} ms; frame interval p95 ${measurement.motion.frameIntervalMs.p95.toFixed(2)} ms; new batch buffers ${measurement.motion.batchBuffersCreated}`,
        );
      if (errors.length) throw new Error(`Browser errors during ${id}:\n${errors.join("\n")}`);
    };
    const dashboardCanvas = ".scene-canvas canvas";
    if (options.scenarios.includes("orbit"))
      await capture("orbit", dashboardCanvas, "architecture-scene");
    if (options.scenarios.includes("walk")) {
      await page.getByRole("button", { name: "Walk mode", exact: true }).click();
      await page.getByRole("button", { name: "Exit walk mode", exact: true }).waitFor();
      await capture("walk", dashboardCanvas, "architecture-scene");
      // While pointer lock is held, a mouse click may be routed to the scene
      // instead of the dock. Escape is the app's supported exit shortcut.
      await page.keyboard.press("Escape");
      // Chromium can consume Escape to release pointer lock before the app sees
      // it. In that case use the dock once mouse events are routed normally.
      await page.evaluate(() => {
        if (document.pointerLockElement) document.exitPointerLock();
      });
      await page.waitForFunction(() => document.pointerLockElement === null);
      if (await page.getByRole("button", { name: "Exit walk mode", exact: true }).isVisible()) {
        await page.getByRole("button", { name: "Exit walk mode", exact: true }).click();
      }
      await page.getByRole("button", { name: "Walk mode", exact: true }).waitFor();
    }
    if (options.scenarios.some((id) => id === "construct" || id === "arrange")) {
      // UI buttons avoid racing the keyboard listener reattachment after Walk.
      console.log("Opening Construct…");
      await page.getByRole("button", { name: "Build", exact: true }).hover();
      await page.getByRole("button", { name: "Open Construct", exact: true }).click();
      await page.getByRole("button", { name: "Arrange", exact: true }).waitFor();
      const editorCanvas = '[aria-label="Home editor canvas"] canvas';
      if (options.scenarios.includes("construct"))
        await capture("construct", editorCanvas, "construction-plan");
      if (options.scenarios.includes("arrange")) {
        await page.getByRole("button", { name: "Arrange", exact: true }).click();
        await page.getByRole("button", { name: "3D", exact: true }).click();
        await capture("arrange", editorCanvas, "architecture-scene");
      }
    }
    if (baseline) {
      report.comparison = compareReports(report, baseline);
      for (const [id, metrics] of Object.entries(report.comparison)) {
        console.log(
          `${id} vs baseline: calls ${metrics.calls.delta >= 0 ? "+" : ""}${metrics.calls.delta}; triangles ${metrics.triangles.delta >= 0 ? "+" : ""}${metrics.triangles.delta}`,
        );
      }
      if (baseline.source.homeHash !== report.source.homeHash)
        console.warn("Home content differs from baseline; counts include that change.");
      if (baseline.browser !== report.browser)
        console.warn("Chrome version differs from baseline.");
    }
    await mkdir(dirname(resolve(options.output)), { recursive: true });
    await writeFile(resolve(options.output), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Report: ${resolve(options.output)}`);
    const overBudget = report.scenarios.filter((scenario) =>
      Object.values(scenario.summary.withinBudget).some((passes) => !passes),
    );
    console.log(
      overBudget.length
        ? `Over budget: ${overBudget.map((scenario) => scenario.id).join(", ")}`
        : "All measured scenarios are below both budgets.",
    );
    if (options.check && overBudget.length) process.exitCode = 1;
  } finally {
    await browser?.close();
    await server?.close();
  }
}

try {
  const options = parseOptions(process.argv.slice(2));
  if (options) await run(options);
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
