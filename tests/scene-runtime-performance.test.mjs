import assert from "node:assert/strict";
import { test } from "node:test";
import { developmentWorkload } from "../scripts/scene-performance/development-home.mjs";
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
