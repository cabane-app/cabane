#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { cpus, platform, release } from "node:os";
import { dirname, extname, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import {
  offCameraApartment,
  offCameraPrefix,
  prepareOrbitSeeds,
  seedOrbitWorkspace,
} from "./scene-performance/prepared-orbit-fixture.mjs";
import {
  installInteractionProbe,
  measureInteraction,
} from "./scene-performance/interaction-replay.mjs";
import {
  assertOffCamera,
  captureOrbitFrameCpu,
  captureOrbitPixels,
  compareOrbitPixels,
  installOrbitSceneAccess,
  orbitWorkload,
  replayOrbitPan,
  saveOrbitMismatch,
  waitForOrbitBuffers,
} from "./scene-performance/prepared-orbit-probe.mjs";
import { performanceProfiles } from "./scene-performance/production-harness.mjs";

const { values } = parseArgs({
  options: {
    help: { type: "boolean" },
    copies: { type: "string", default: "0,1,2,4" },
    runs: { type: "string", default: "3" },
    seconds: { type: "string", default: "5" },
    "cpu-rate": { type: "string", default: "1" },
    "input-hz": { type: "string", default: "60" },
    "warmup-ms": { type: "string", default: "6000" },
    bundle: { type: "string", default: process.env.CABANE_PANEL_BUNDLE ?? "apps/web/dist-panel" },
    output: {
      type: "string",
      default: `test-results/performance/prepared-orbit-${new Date().toISOString().replaceAll(":", "-")}.json`,
    },
  },
});
if (values.help) {
  console.log(`Measure the prepared Orbit slice in one native panel build.
Usage: node scripts/measure-prepared-orbit.mjs [--copies 0,1,2,4] [--runs 3] [--seconds 5]
       [--cpu-rate 1] [--input-hz 60] [--warmup-ms 6000] [--bundle apps/web/dist-panel]
       [--output PATH]
Requires the production panel build and native Chromium WebGL multi-draw.`);
  process.exit(0);
}
const copies = values.copies.split(",").map(Number);
assert.ok(
  copies.length >= 1 &&
    copies[0] === 0 &&
    copies.every(
      (count, index) =>
        Number.isInteger(count) &&
        count >= 0 &&
        count <= 8 &&
        (index === 0 || count > copies[index - 1]),
    ),
  "--copies must be increasing integers, starting at 0, up to 8",
);
const runs = Number(values.runs),
  seconds = Number(values.seconds),
  cpuRate = Number(values["cpu-rate"]),
  offeredHz = Number(values["input-hz"]),
  warmupMs = Number(values["warmup-ms"]);
assert.ok(Number.isInteger(runs) && runs >= 1 && runs <= 10, "--runs must be 1–10");
assert.ok(seconds >= 1 && seconds <= 60, "--seconds must be 1–60");
assert.ok(cpuRate >= 1 && cpuRate <= 20, "--cpu-rate must be 1–20");
assert.ok(offeredHz >= 5 && offeredHz <= 60, "--input-hz must be 5–60");
assert.ok(warmupMs >= 1000 && warmupMs <= 60000, "--warmup-ms must be 1000–60000");

const bundle = resolve(values.bundle);
const manifest = await readFile(resolve(bundle, "manifest.json"), "utf8");
const hostFixture = await readFile("tests/fixtures/native-panel-host.html");
const fixturePath = "home/fixtures/performance/dense-courtyard-apartment.project.json";
const fixture = await readFile(fixturePath, "utf8");
const fixedTime = "2026-09-23T12:00:00.000Z";
const projectTiers = copies.map((count) => offCameraApartment(JSON.parse(fixture), count));
const seeds = await prepareOrbitSeeds(projectTiers);
const output = resolve(values.output);
await mkdir(dirname(output), { recursive: true });
const assetPrefix = "/fixture-assets/deep/revision/";
const mime = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (pathname === "/seed")
      return response.writeHead(200, { "content-type": "text/html" }).end("<!doctype html>");
    if (pathname === "/cabane")
      return response.writeHead(200, { "content-type": "text/html" }).end(hostFixture);
    if (!pathname.startsWith(assetPrefix)) return response.writeHead(404).end();
    const path = resolve(bundle, pathname.slice(assetPrefix.length));
    if (!path.startsWith(bundle + sep)) return response.writeHead(403).end();
    const contents = await readFile(path);
    return response
      .writeHead(200, { "content-type": mime[extname(path)] ?? "application/octet-stream" })
      .end(contents);
  } catch {
    return response.writeHead(404).end();
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const localCloud = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "base64",
);
const variants = [
  { name: "legacy", search: "" },
  { name: "prepared", search: "?prepared-orbit=1" },
];
const report = {
  source: JSON.parse(manifest).source_commit,
  development: Boolean(JSON.parse(manifest).development),
  manifestHash: createHash("sha256").update(manifest).digest("hex"),
  fixturePath,
  fixtureHash: createHash("sha256").update(fixture).digest("hex"),
  fixedTime,
  cpuRate,
  offeredHz,
  warmupMs,
  seconds,
  runs,
  copies,
  cpu: cpus()[0]?.model,
  os: `${platform()} ${release()}`,
  results: [],
};
const pixelReference = new Map();
const tierReferences = new Map();
let expectedGpu;
let expectedCanvas;
const percentile = (values, fraction) => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.ceil(fraction * sorted.length) - 1];
};

async function measure(browser, round, tier, variant) {
  const project = projectTiers[tier];
  const context = await browser.newContext({ ...performanceProfiles.desktop, timezoneId: "UTC" });
  try {
    await context.addInitScript(installOrbitSceneAccess, { fixedTime });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.pathname === "/pmndrs/drei-assets/9225a9f1fbd449d9411125c2f419b843d0308c9f/cloud.png")
        return route.fulfill({ body: localCloud, contentType: "image/png" });
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin + "/seed");
    await page.evaluate(seedOrbitWorkspace, seeds[tier]);
    await page.goto(origin + "/cabane" + variant.search);
    await page.bringToFront();
    const room = page
      .getByRole("navigation", { name: "Rooms on this floor" })
      .getByRole("button", { name: "Living room", exact: true });
    await room.click({ timeout: 30000 });
    assert.ok(await page.locator(".room-control-sheet").isVisible());
    await page.waitForFunction(() => {
      const root = window.__cabanePerf.root();
      return root?.internal.active && root.camera.isOrthographicCamera;
    });
    await page.waitForTimeout(warmupMs);
    if (variant.name === "prepared") {
      await page.waitForFunction(
        () => {
          const { scene } = window.__cabanePerf.root();
          const stats = scene.getObjectByName("prepared-orbit-furniture")?.userData
            .preparedOrbitFurniture;
          return stats?.items > 0 && stats.pendingChunks === 0 && stats.pendingLods === 0;
        },
        null,
        { timeout: 60000 },
      );
    }
    await waitForOrbitBuffers(page);
    const before = await orbitWorkload(page);
    assert.ok(
      before.visible && before.multiDraw && before.gpu,
      "Need a visible native multi-draw canvas",
    );
    assert.deepEqual(before.gpu, (expectedGpu ??= before.gpu), "Mismatched GPU");
    assert.deepEqual(
      before.canvas,
      (expectedCanvas ??= before.canvas),
      "Mismatched drawing buffer",
    );
    assert.equal(before.liveItems.length + (before.stats?.items ?? 0), project.sceneItems.length);
    if (variant.name === "prepared") {
      assert.ok(
        before.stats?.items > 0 && before.buffers.length > 0,
        "Prepared renderer did not activate",
      );
      assert.equal(before.stats.pendingChunks + before.stats.pendingLods, 0);
    } else assert.equal(before.stats, null, "Legacy run unexpectedly prepared furniture");

    const pixels = await captureOrbitPixels(page);
    assert.ok(
      pixels.pixels.some((value, index) => index % 4 !== 3 && value > 0),
      "Blank canvas readback",
    );
    const pairKey = `pair:${tier}`;
    const baseKey = `base:${variant.name}`;
    const pixelPair = pixelReference.get(pairKey);
    if (pixelPair) pixelReference.delete(pairKey);
    else pixelReference.set(pairKey, pixels);
    if (tier === 0) pixelReference.set(baseKey, pixels);
    const visual = {
      otherPath: pixelPair ? compareOrbitPixels(pixelPair, pixels) : null,
      noCopies: compareOrbitPixels(pixelReference.get(baseKey), pixels),
    };
    for (const [comparison, reference] of [
      [visual.otherPath, pixelPair],
      [visual.noCopies, pixelReference.get(baseKey)],
    ]) {
      if (!comparison || comparison.percentOver2 < 0.05) continue;
      const stem = `${output.replace(/\.json$/, "")}-r${round + 1}-c${copies[tier]}-${variant.name}`;
      report.mismatch = {
        round: round + 1,
        copies: copies[tier],
        variant: variant.name,
        comparison,
        referenceWorkload: reference.workload,
        candidateWorkload: pixels.workload,
        before,
        images: await saveOrbitMismatch(page, stem, reference, pixels),
      };
      throw new Error(`Mismatched foreground pixels: ${JSON.stringify(comparison)}`);
    }

    const cdp = await context.newCDPSession(page);
    if (cpuRate !== 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
    await installInteractionProbe(page);
    let sent;
    const result = await captureOrbitFrameCpu(page, () =>
      measureInteraction(
        page,
        "focused-pan",
        async () => {
          sent = await replayOrbitPan(page, cdp, seconds, offeredHz);
        },
        { settleMs: 160 },
      ),
    );
    assert.ok(
      result.cameraTravel > 0.5 && result.cameraTurnRadians < 0.01,
      "Expected real camera pan",
    );
    for (const type of ["pointerdown", "pointerup"])
      assert.ok(
        result.raw.events.some((event) => event.type === type && event.trusted),
        `Missing trusted ${type}`,
      );
    assert.equal(await room.getAttribute("aria-pressed"), "true");
    const after = await orbitWorkload(page);
    assert.deepEqual(after.liveItems, before.liveItems, "Mounted item identities changed");
    assert.deepEqual(after.stats, before.stats, "Prepared work changed during warm pan");
    assert.deepEqual(after.buffers, before.buffers, "Prepared geometry changed during warm pan");
    assert.deepEqual(errors, []);
    const offCamera = project.sceneItems.filter(({ id }) => id.startsWith(offCameraPrefix));
    const clearance = offCamera.length
      ? await assertOffCamera(page, {
          copies: offCamera,
          coordinates: project.floors[0].coordinates,
          travel: result.cameraTravel,
        })
      : null;
    assert.ok(
      result.mainRenderCount > 0 && result.mainTrianglesMedian > 0,
      "Missing render workload",
    );
    const workload = { calls: result.mainCallsMedian, triangles: result.mainTrianglesMedian };
    const workloadKey = `${round}:${variant.name}`;
    const originalWorkload = tierReferences.get(workloadKey);
    if (originalWorkload) {
      assert.ok(
        Math.abs(workload.triangles - originalWorkload.triangles) <=
          originalWorkload.triangles * 0.05,
        "Added off-camera geometry materially changed submitted triangles",
      );
    } else tierReferences.set(workloadKey, workload);
    const intervals = result.raw.frames.map(({ intervalMs }) => intervalMs);
    const summary = {
      round: round + 1,
      variant: variant.name,
      copies: copies[tier],
      offCameraItems: offCamera.length,
      authoredItems: project.sceneItems.length,
      sent,
      sentHz: sent / seconds,
      p95: result.frameMsP95,
      p99: percentile(intervals, 0.99),
      max: result.maxFrameMs,
      over50: intervals.filter((ms) => ms > 50).length,
      tasks50: result.raw.longTasks.length,
      frameCpuP95: percentile(result.frameCpuMs, 0.95),
      workload,
    };
    console.log(JSON.stringify(summary));
    report.results.push({ ...summary, visual, clearance, before, after, ...result });
    assert.ok(sent >= seconds * Math.min(5, offeredHz - 1), "Trusted drag input starved");
  } finally {
    await context.close();
  }
}

let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  report.browser = browser.version();
  for (let round = 0; round < runs; round++) {
    pixelReference.clear();
    const order = round % 2 ? variants.toReversed() : variants;
    for (let tier = 0; tier < copies.length; tier++)
      for (const variant of order) await measure(browser, round, tier, variant);
  }
} catch (error) {
  report.error = error.message;
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(output, JSON.stringify(report));
  console.log(`Wrote ${output}`);
}
