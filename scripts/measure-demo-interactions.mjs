#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { compareInteractionReports } from "./scene-performance/interaction-comparison.mjs";
import {
  buildHarness,
  serveHarness,
  performanceProfiles,
} from "./scene-performance/production-harness.mjs";
import {
  installInteractionProbe,
  openArrange,
  openDemo,
  replayArrangeFloors,
  replayArrangeMoveDeselect,
  replayWalk,
} from "./scene-performance/interaction-replay.mjs";

const help = `Usage: npm run perf:interactions -- [options]
  Builds the production Solstice Atelier demo, replays real Arrange and Walk input,
  and closes its own loopback server/browser. No Home Assistant session is needed.
  --origin URL        Reuse an existing loopback harness; skip build/server startup
  --label NAME        Report label (default: demo-interactions)
  --baseline PATH     Compare matching input, scene, and browser/hardware context
  --output PATH       JSON path (default: test-results/performance/LABEL-TIMESTAMP.json)
  --profile NAME      desktop (1440×960, DPR 1); required for keyboard/pointer-lock Walk
  --cpu-rate N        Chromium CPU slowdown, 1–20 (default: 1)
  --runs N            Repetitions, 1–10 (default: 3)
  --walk-hold-ms N    Time holding each WASD key, 100–5000ms (default: 450)
  --cpu-profile       Save a diagnostic .cpuprofile for each scenario
  --headed            Show Chromium
  --check             Fail after saving unless editor frame/task ≤100ms and Walk p95 ≤33.4ms
  --help              Print this help

Compare cold first-floor switches separately from repeated switches. Keep 450ms and
sustained (for example 1500ms) Walk series separate. These desktop measurements do
not establish physical-phone performance.`;

function parseOptions(args) {
  const options = {
    label: "demo-interactions",
    profile: "desktop",
    cpuRate: 1,
    runs: 3,
    walkHoldMs: 450,
  };
  const values = {
    "--origin": "origin",
    "--label": "label",
    "--baseline": "baseline",
    "--profile": "profile",
    "--cpu-rate": "cpuRate",
    "--runs": "runs",
    "--walk-hold-ms": "walkHoldMs",
    "--output": "output",
  };
  const switches = { "--cpu-profile": "cpuProfile", "--headed": "headed", "--check": "check" };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--help") return null;
    if (switches[flag]) options[switches[flag]] = true;
    else {
      assert.ok(values[flag], `Unknown option ${flag}`);
      const value = args[++index];
      assert.ok(value && !value.startsWith("--"), `${flag} needs a value`);
      options[values[flag]] = value;
    }
  }
  assert.equal(
    options.profile,
    "desktop",
    "The trusted editor/Walk replay requires --profile desktop",
  );
  assert.match(
    options.label,
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/,
    "Label must use 1–80 letters, numbers, dots, underscores or hyphens",
  );
  for (const [key, minimum, maximum] of [
    ["cpuRate", 1, 20],
    ["runs", 1, 10],
    ["walkHoldMs", 100, 5000],
  ]) {
    options[key] = Number(options[key]);
    assert.ok(
      Number.isFinite(options[key]) && options[key] >= minimum && options[key] <= maximum,
      `${key} must be from ${minimum} to ${maximum}`,
    );
    if (key !== "cpuRate") assert.ok(Number.isInteger(options[key]), `${key} must be an integer`);
  }
  if (options.origin) {
    const origin = new URL(options.origin);
    assert.ok(
      origin.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) &&
        !origin.username &&
        !origin.password &&
        origin.pathname === "/" &&
        !origin.search &&
        !origin.hash,
      "--origin must be a loopback HTTP origin",
    );
    options.origin = origin.origin;
  }
  if (options.baseline && options.output)
    assert.notEqual(
      resolve(options.baseline),
      resolve(options.output),
      "Baseline and output must be different files",
    );
  return options;
}

async function measure(options) {
  const baseline = options.baseline
    ? JSON.parse(await readFile(resolve(options.baseline), "utf8"))
    : null;
  let comparisonError;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = resolve(
    options.output ?? `test-results/performance/${options.label}-${timestamp}.json`,
  );
  await mkdir(dirname(output), { recursive: true });
  let server, browser;
  const errors = [];
  try {
    let origin = options.origin;
    if (!origin) {
      const buildRoot = fileURLToPath(new URL("../test-results/performance/", import.meta.url));
      await mkdir(buildRoot, { recursive: true });
      const buildDirectory = await mkdtemp(resolve(buildRoot, "interactions-build-"));
      await buildHarness(undefined, "demo", buildDirectory);
      server = await serveHarness({ scenario: "demo", host: "127.0.0.1", port: 0, buildDirectory });
      origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    }
    browser = await chromium.launch({ channel: "chromium", headless: !options.headed });
    const context = await browser.newContext(performanceProfiles[options.profile]);
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    page.on("pageerror", (error) => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await openDemo(page, origin);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: options.cpuRate });
    const arrangeStarted = performance.now();
    await openArrange(page);
    const arrangeEntryMs = performance.now() - arrangeStarted;
    await installInteractionProbe(page);
    const metadata = await page.evaluate(() => {
      const state = window.__cabanePerf.root();
      const gl = state.gl.getContext();
      const extension = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        source: window.__cabanePerf.source ?? null,
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        gpu: extension
          ? {
              vendor: gl.getParameter(extension.UNMASKED_VENDOR_WEBGL),
              renderer: gl.getParameter(extension.UNMASKED_RENDERER_WEBGL),
            }
          : null,
        canvas: {
          width: state.gl.domElement.width,
          height: state.gl.domElement.height,
          dpr: state.gl.getPixelRatio(),
        },
      };
    });
    const results = [];
    const profiles = [];
    try {
      for (const [name, replay] of [
        ["arrange-move-deselect", replayArrangeMoveDeselect],
        ["arrange-floors", replayArrangeFloors],
        ["walk-input", replayWalk],
      ]) {
        console.log(`Measuring ${name} · CPU ×${options.cpuRate} · ${options.runs} repetitions`);
        if (options.cpuProfile) {
          await cdp.send("Profiler.enable");
          await cdp.send("Profiler.start");
        }
        try {
          await replay(page, {
            runs: options.runs,
            walkHoldMs: options.walkHoldMs,
            onResult: (result) => {
              results.push(result);
              console.log(
                `${result.name}: max frame ${result.maxFrameMs.toFixed(1)}ms · p50/p95 ${result.frameMsP50.toFixed(1)}/${result.frameMsP95.toFixed(1)}ms · ${result.fps.toFixed(1)} FPS · feedback ${result.maxFeedbackMs.toFixed(1)}ms`,
              );
            },
          });
        } finally {
          if (options.cpuProfile) {
            const { profile } = await cdp.send("Profiler.stop");
            const path = output.replace(/\.json$/i, "") + `-${name}.cpuprofile`;
            await writeFile(path, JSON.stringify(profile));
            profiles.push({ name, path });
          }
        }
      }
    } finally {
      const report = {
        measuredAt: new Date().toISOString(),
        label: options.label,
        path: "demo-editor-walk-v1",
        source: metadata.source,
        configuration: {
          origin,
          profile: options.profile,
          scenario: "demo",
          cpuRate: options.cpuRate,
          runs: options.runs,
          walkHoldMs: options.walkHoldMs,
          captureTailFrames: 2,
          viewport: { width: 1440, height: 960 },
          build: "production",
          arrangeEntryMs,
        },
        environment: {
          browser: browser.version(),
          platform: `${platform()} ${release()}`,
          cpu: cpus()[0]?.model,
          headless: !options.headed,
          userAgent: metadata.userAgent,
          hardwareConcurrency: metadata.hardwareConcurrency,
          gpu: metadata.gpu,
          canvas: metadata.canvas,
        },
        results,
        profiles,
        errors,
      };
      if (options.baseline) {
        try {
          report.comparison = compareInteractionReports(report, baseline);
        } catch (error) {
          comparisonError = error;
          report.comparisonError = error.message;
        }
      }
      await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`JSON: ${output}`);
    }
    assert.deepEqual(errors, [], "Browser errors during interaction replay");
    if (comparisonError) throw comparisonError;
    if (options.check)
      for (const result of results) {
        if (result.name.startsWith("walk-"))
          assert.ok(
            result.frameMsP95 <= 33.4,
            `${result.name}: Walk frame p95 ${result.frameMsP95.toFixed(1)}ms exceeds 33.4ms`,
          );
        else
          assert.ok(
            result.maxFrameMs <= 100 && result.maxLongTaskMs <= 100,
            `${result.name}: max frame ${result.maxFrameMs.toFixed(1)}ms / long task ${result.maxLongTaskMs.toFixed(1)}ms exceeds the 100ms editor budget`,
          );
      }
  } finally {
    try {
      await browser?.close();
    } finally {
      await server?.close();
    }
  }
}

const options = parseOptions(process.argv.slice(2));
if (options) await measure(options);
else console.log(help);
