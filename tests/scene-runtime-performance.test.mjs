import assert from "node:assert/strict";
import { test } from "node:test";
import { developmentWorkload } from "../scripts/scene-performance/development-home.mjs";
import { compareInteractionReports } from "../scripts/scene-performance/interaction-comparison.mjs";
import { measureInteraction } from "../scripts/scene-performance/interaction-replay.mjs";
import {
  compareRuntimeReports,
  renderRuntimeReport,
  summarizeRun,
  summarizeRuns,
} from "../scripts/scene-performance/runtime-report.mjs";

const run = (frameIntervalsMs = [10, 20, 30, 40]) => ({
  frameIntervalsMs,
  cpuSubmitMs: frameIntervalsMs.map((_, index) => index + 1),
  calls: frameIntervalsMs.map((_, index) => [40, 1, 4, 9][index % 4]),
  triangles: frameIntervalsMs.map((_, index) => [1000, 100, 400, 900][index % 4]),
});

const report = () => ({
  schemaVersion: 1,
  configuration: {
    seconds: 12,
    runs: 3,
    warmupSeconds: 3,
    path: "orbit-v1",
    fixedTime: "2026-01-15T12:00:00.000Z",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    canvas: { width: 390, height: 844, dpr: 3 },
    profile: "mobile",
    cpuRate: 1,
    build: "production",
  },
  environment: {
    userAgent: "Test browser",
    gpu: { renderer: "Test GPU", vendor: "Test vendor", multiDraw: true },
    hardwareConcurrency: 8,
    coarsePointer: true,
    platform: "Test OS",
    browser: "1.0",
    cpuRate: 1,
    cpu: "Test CPU",
    headless: false,
  },
  source: { commit: "before", dirty: false, homeHash: "fixture-hash" },
  ...summarizeRuns([run(), run(), run()]),
});

test("development workload rejects unavailable lights, wrong light count and preview-only weather without exposing mappings", () => {
  const lights = Array.from({ length: 15 }, (_, i) => `light.private_${i}`);
  const session = {
    lights,
    weather: "weather.private",
    profile: { entityIdsBySlotId: { private: lights[0] } },
  };
  const states = [
    ...lights.map((entity_id, i) => ({
      entity_id,
      state: i < 10 ? "on" : "off",
      attributes: { brightness: 200 },
    })),
    { entity_id: session.weather, state: "cloudy", attributes: { cloud_coverage: 100 } },
  ];
  const project = { sceneItems: Array(239).fill({}) };
  const workload = developmentWorkload(project, session, states);
  assert.equal(workload.mappedLights, 15);
  assert.equal(workload.lightsOn, 10);
  assert.equal(workload.weatherSource, "Home Assistant");
  assert.ok(!JSON.stringify(workload).includes("private"));
  assert.throws(
    () => developmentWorkload(project, { ...session, lights: lights.slice(0, 14) }, states),
    /15 available/,
  );
  assert.throws(
    () => developmentWorkload(project, { ...session, lights: [lights[0], ...lights] }, states),
    /distinct/,
  );
  const unavailable = structuredClone(states);
  unavailable[0].state = "unavailable";
  assert.throws(() => developmentWorkload(project, session, unavailable), /15 available/);
  const fewerOn = structuredClone(states);
  fewerOn[0].state = "off";
  assert.throws(() => developmentWorkload(project, session, fewerOn), /10 mapped lights on/);
  const clear = structuredClone(states);
  clear.at(-1).state = "sunny";
  assert.throws(() => developmentWorkload(project, session, clear), /must report cloudy/);
  const changed = structuredClone(states);
  changed[0].attributes.brightness = 100;
  assert.notEqual(developmentWorkload(project, session, changed).fixtureHash, workload.fixtureHash);
});

test("runtime summary uses mean callback cadence and nearest-rank frame percentiles", () => {
  assert.deepEqual(summarizeRun(run()), {
    fps: 40,
    frameMsP50: 20,
    frameMsP95: 40,
    frameMsP99: 40,
    over33MsPercent: 25,
    over50MsPercent: 0,
    cpuSubmitMsP95: 4,
    callsMedian: 6.5,
    callsMax: 40,
    trianglesMedian: 650,
    trianglesMax: 1000,
  });
  const boundary = summarizeRun(run([1000 / 30, 1000 / 30 + 0.1, 50, 50.01]));
  assert.equal(boundary.over33MsPercent, 75);
  assert.equal(boundary.over50MsPercent, 25);
  assert.equal(summarizeRun(run(Array(20).fill(10))).cpuSubmitMsP95, 19);
});

test("each runtime run has equal weight regardless of its frame count", () => {
  const raw = [run(Array(1000).fill(10)), run([20]), run([40])];
  const { runs, summary } = summarizeRuns(raw);
  assert.equal(summary.fps, 50);
  assert.equal(summary.frameMsP95, 20);
  assert.deepEqual(
    runs.map((entry) => entry.summary.fps),
    [100, 50, 25],
  );
  assert.deepEqual(runs[0].frameIntervalsMs, raw[0].frameIntervalsMs);
  assert.equal(raw[0].summary, undefined);
  assert.deepEqual(summarizeRuns([run([10]), run([20])]).summary.fps, 75);
});

test("invalid measurements cannot silently produce a plausible runtime summary", () => {
  for (const key of ["frameIntervalsMs", "cpuSubmitMs", "calls", "triangles"]) {
    for (const invalid of [[], [NaN], [Infinity], [-1], undefined]) {
      assert.throws(() => summarizeRun({ ...run(), [key]: invalid }), new RegExp(key));
    }
  }
  assert.throws(() => summarizeRun(run([0])), /frameIntervalsMs/);
  assert.throws(() => summarizeRuns([]), /No runtime runs/);
  for (const key of ["cpuSubmitMs", "calls", "triangles"]) {
    assert.throws(() => summarizeRun({ ...run(), [key]: [1] }), /same length/);
  }
  assert.equal(
    summarizeRun({ ...run([20]), cpuSubmitMs: [0], calls: [0], triangles: [0] }).callsMax,
    0,
  );
});

test("runtime comparison allows code changes and reports signed deltas", () => {
  const before = report();
  const after = report();
  after.source.commit = "after";
  after.source.dirty = true;
  after.label = "New run";
  after.createdAt = "2026-11-02";
  after.summary.frameMsP95 = 20;
  assert.deepEqual(compareRuntimeReports(after, before).frameMsP95, {
    before: 40,
    after: 20,
    delta: -20,
    percent: -50,
  });
  assert.equal(compareRuntimeReports(after, before).over50MsPercent.percent, null);
  after.configuration.viewport = { height: 844, width: 390 };
  assert.doesNotThrow(() => compareRuntimeReports(after, before));
});

test("runtime comparison rejects incompatible scenes, environments and missing metrics", () => {
  const baseline = report();
  for (const [section, key, value] of [
    ["configuration", "cpuRate", 4],
    ["configuration", "path", "orbit-v2"],
    ["configuration", "canvas", { width: 390, height: 844, dpr: 1 }],
    ["source", "homeHash", "different-fixture"],
    ["environment", "userAgent", "Different browser"],
    ["environment", "gpu", { renderer: "Different GPU" }],
    ["environment", "hardwareConcurrency", 4],
    ["environment", "coarsePointer", false],
    ["environment", "platform", "Different OS"],
    ["environment", "browser", "2.0"],
    ["environment", "cpuRate", 4],
    ["environment", "cpu", "Different CPU"],
    ["environment", "headless", true],
  ]) {
    const current = report();
    current[section][key] = value;
    assert.throws(() => compareRuntimeReports(current, baseline), /differs/);
  }
  assert.throws(() => compareRuntimeReports({ ...report(), schemaVersion: 2 }, baseline), /schema/);
  const missing = report();
  delete missing.summary.fps;
  assert.throws(
    () => compareRuntimeReports(report(), missing),
    /Invalid runtime summary metric fps/,
  );
  const missingHome = report();
  delete missingHome.source.homeHash;
  assert.throws(() => compareRuntimeReports(report(), missingHome), /homeHash/);
});

test("runtime HTML is standalone, escaped, and includes comparison and frame evidence", () => {
  const current = report();
  current.label = '</title><script>alert("title")</script>';
  current.environment.gpu.renderer = '<img src=x onerror="alert(1)">';
  current.comparison = compareRuntimeReports(current, current);
  const html = renderRuntimeReport(current);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("&lt;/title&gt;&lt;script&gt;"));
  assert.ok(html.includes("&lt;img src=x onerror="));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes('<th scope="col">Before</th>'));
  assert.ok(html.includes("16.7 ms"));
  assert.ok(html.includes("33.3 ms"));
  assert.equal((html.match(/<svg /g) || []).length, 3);
  assert.ok(html.includes("Run 3"));
  assert.ok(html.includes("not confirmed display presentation"));
  delete current.comparison;
  assert.ok(!renderRuntimeReport(current).includes('<th scope="col">Before</th>'));
  delete current.configuration.profile;
  assert.ok(renderRuntimeReport(current).includes("physical browser"));
});

const interactionReport = () => ({
  path: "demo-editor-walk-v1",
  label: "baseline",
  configuration: {
    origin: "http://127.0.0.1:4182",
    cpuRate: 1,
    runs: 1,
    walkHoldMs: 450,
    captureTailFrames: 2,
    viewport: { width: 1440, height: 960 },
  },
  source: { commit: "before", dirty: false, homeHash: "same-home" },
  environment: {
    browser: "1.0",
    platform: "Test OS",
    cpu: "Test CPU",
    gpu: { vendor: "Test", renderer: "Test GPU" },
    canvas: { width: 1080, height: 821, dpr: 1 },
    headless: true,
  },
  results: [
    {
      name: "arrange-move-1",
      canvasStart: { width: 1080, height: 821, dpr: 1 },
      canvasEnd: { width: 1080, height: 821, dpr: 1 },
      canvasStable: true,
      fps: 50,
      frameMsP50: 20,
      frameMsP95: 40,
      maxFrameMs: 100,
      maxLongTaskMs: 0,
      maxFeedbackMs: 120,
    },
  ],
});

test("interaction comparison allows code/origin changes and computes per-scenario signed metrics", () => {
  const before = interactionReport(),
    after = interactionReport();
  after.label = "candidate";
  after.source.commit = "after";
  after.source.dirty = true;
  after.configuration.origin = "http://127.0.0.1:4183";
  after.configuration.viewport = { height: 960, width: 1440 };
  Object.assign(after.results[0], { fps: 60, frameMsP95: 20, maxLongTaskMs: 5 });
  const comparison = compareInteractionReports(after, before)["arrange-move-1"];
  assert.deepEqual(comparison.fps, { before: 50, after: 60, delta: 10, percent: 20 });
  assert.deepEqual(comparison.frameMsP95, { before: 40, after: 20, delta: -20, percent: -50 });
  assert.deepEqual(comparison.maxLongTaskMs, { before: 0, after: 5, delta: 5, percent: null });
  assert.equal(comparison.maxFrameMs.delta, 0);
});

test("interaction comparison rejects changed or missing input, scene and machine context", () => {
  const baseline = interactionReport();
  for (const [path, value] of [
    [["path"], "different-input"],
    [["configuration", "cpuRate"], 4],
    [["configuration", "runs"], 2],
    [["configuration", "walkHoldMs"], 1500],
    [["configuration", "captureTailFrames"], 0],
    [["configuration", "viewport"], { width: 390, height: 844 }],
    [["source", "homeHash"], "other-home"],
    [["environment", "browser"], "2.0"],
    [["environment", "platform"], "Other OS"],
    [["environment", "cpu"], "Other CPU"],
    [["environment", "gpu"], { renderer: "Other GPU" }],
    [["environment", "canvas"], { width: 1080, height: 821, dpr: 2 }],
    [["environment", "headless"], false],
  ]) {
    const changed = interactionReport();
    const target = path.slice(0, -1).reduce((value, key) => value[key], changed);
    target[path.at(-1)] = value;
    assert.throws(() => compareInteractionReports(changed, baseline), /context.*differs/);
  }
  const missing = interactionReport();
  delete missing.configuration.captureTailFrames;
  assert.throws(
    () => compareInteractionReports(interactionReport(), missing),
    /Missing.*captureTailFrames/,
  );
});

test("interaction comparison matches scenario names and rejects incomplete or invalid evidence", () => {
  const baseline = interactionReport();
  baseline.results.push({ ...baseline.results[0], name: "walk-input-1" });
  const after = structuredClone(baseline);
  after.results.reverse();
  assert.equal(compareInteractionReports(after, baseline)["walk-input-1"].fps.delta, 0);
  assert.throws(() => compareInteractionReports(interactionReport(), baseline), /inventory/);
  for (const value of [undefined, NaN, Infinity, -1]) {
    const invalid = structuredClone(baseline);
    invalid.results[0].frameMsP95 = value;
    assert.throws(() => compareInteractionReports(after, invalid), /Invalid interaction metric/);
  }
  const duplicate = structuredClone(baseline);
  duplicate.results.push({ ...duplicate.results[0] });
  assert.throws(() => compareInteractionReports(after, duplicate), /unique/);
});

test("interaction capture rejects empty or incomplete RAF evidence", async () => {
  const names = ["window", "requestAnimationFrame"];
  const previous = Object.fromEntries(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  let record;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { __cabaneInteraction: { begin() {}, end: () => record } },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback) => queueMicrotask(() => callback(0)),
  });
  const page = {
    evaluate: async (callback, argument) => callback(argument),
    waitForTimeout: async () => {},
  };
  const capture = () => measureInteraction(page, "frame-evidence", async () => {}, { settleMs: 0 });
  try {
    for (const frames of [[], [{ atMs: 16, intervalMs: 16 }]]) {
      record = {
        frames,
        events: [{ trusted: true }],
        renders: [{ submitMs: 1 }],
        longTasks: [],
        cameraStart: null,
        cameraSamples: [],
      };
      await assert.rejects(capture(), /at least two complete RAF intervals/);
    }
    record = {
      ...record,
      canvasStart: { width: 1080, height: 821, dpr: 1 },
      canvasEnd: { width: 1080, height: 821, dpr: 1 },
      canvasStable: true,
      frames: [
        { atMs: 16, intervalMs: 16 },
        { atMs: 32, intervalMs: 16 },
      ],
    };
    const measured = await capture();
    assert.ok(Number.isFinite(measured.fps) && measured.fps > 0);
    assert.ok(Number.isFinite(measured.over33MsPercent));
    record.canvasStable = false;
    await assert.rejects(capture(), /canvas dimensions/);
    record.canvasStable = true;
    record.canvasEnd.dpr = 0.75;
    await assert.rejects(capture(), /canvas dimensions/);
  } finally {
    for (const name of names) {
      if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
      else delete globalThis[name];
    }
  }
});

test("interaction comparison rejects missing, changed and unstable per-scenario drawing buffers", () => {
  const baseline = interactionReport();
  baseline.results.push({
    ...baseline.results[0],
    name: "walk-input-1",
    canvasStart: { width: 1800, height: 1200, dpr: 1.25 },
    canvasEnd: { width: 1800, height: 1200, dpr: 1.25 },
  });
  for (const change of [
    (result) => {
      delete result.canvasStart;
    },
    (result) => {
      result.canvasStart = result.canvasEnd = { width: 1440, height: 960, dpr: 1 };
    },
    (result) => {
      result.canvasEnd.dpr = 1;
    },
    (result) => {
      result.canvasStable = false;
    },
    (result) => {
      delete result.canvasStable;
    },
  ]) {
    const changed = structuredClone(baseline);
    change(changed.results[1]);
    assert.throws(() => compareInteractionReports(changed, baseline), /canvas/);
  }
  assert.equal(
    compareInteractionReports(structuredClone(baseline), baseline)["walk-input-1"].fps.delta,
    0,
  );
});

test("interaction capture uses nearest-rank quantiles and even workload medians", async () => {
  const names = ["window", "requestAnimationFrame"];
  const previous = Object.fromEntries(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const values = Array.from({ length: 20 }, (_, index) => index + 1);
  const canvas = { width: 1080, height: 821, dpr: 1 };
  const record = {
    name: "quantiles",
    durationMs: 210,
    frames: values.map((intervalMs) => ({ intervalMs })),
    events: values.map((feedbackMs) => ({ trusted: true, feedbackMs })),
    renders: values.map((value) => ({
      submitMs: value,
      main: true,
      calls: value,
      triangles: value * 100,
      shadowUpdate: false,
    })),
    longTasks: [],
    cameraStart: null,
    cameraSamples: [],
    canvasStart: canvas,
    canvasEnd: { ...canvas },
    canvasStable: true,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { __cabaneInteraction: { begin() {}, end: () => record } },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback) => queueMicrotask(() => callback(0)),
  });
  const page = {
    evaluate: async (callback, argument) => callback(argument),
    waitForTimeout: async () => {},
  };
  try {
    const summary = await measureInteraction(page, "quantiles", async () => {}, { settleMs: 0 });
    assert.equal(summary.frameMsP50, 10);
    assert.equal(summary.frameMsP95, 19);
    assert.equal(summary.feedbackMsP95, 19);
    assert.equal(summary.cpuSubmitMsP95, 19);
    assert.equal(summary.mainCallsMedian, 10.5);
    assert.equal(summary.mainTrianglesMedian, 1050);
  } finally {
    for (const name of names) {
      if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
      else delete globalThis[name];
    }
  }
});
