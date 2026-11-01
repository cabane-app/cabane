import { selectConstructionTool } from "../tests/editor-browser-tools.mjs";
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { withModules } from "../tests/test-server.mjs";

const argument = (name, fallback) => process.argv[process.argv.indexOf(name) + 1] ?? fallback;
const origin = process.argv.includes("--origin") ? argument("--origin") : "http://127.0.0.1:4186";
const output = resolve(
  process.argv.includes("--output") ? argument("--output") : "/tmp/cabane-editor-performance",
);
await mkdir(output, { recursive: true });
const scaleRecord = process.argv.includes("--scale")
  ? await withModules(async (load) => {
      const { scaleFixtureManifest } = await load("/tests/fixtures/agent-home.tsx");
      const { ownerHomeProject } = await load("/home/src/index.ts");
      const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
      const { layoutFloorFromEditorFloor } = await load(
        "/apps/web/src/editor-preview/project-sync.ts",
      );
      const { createSeedProjectRecord } = await load("/packages/engine/src/index.ts");
      const floor = scaleFixtureManifest.floors[0];
      return createSeedProjectRecord({
        ...ownerHomeProject,
        floor: layoutFloorFromEditorFloor(floor),
        shortcuts: [],
        openingProfiles: {},
        roomProfiles: Object.fromEntries(
          floor.rooms.map((room) => [room.id, { dashboardSlots: [] }]),
        ),
        sceneItems: floor.rooms.flatMap((room) =>
          room.devices.map((slot) => ({
            id: slot.id,
            kind: "device",
            modelId: slot.model,
            placement: {
              kind: "absolute",
              at: slot.placement.at,
              elevationMeters: slot.placement.elevationMeters,
              rotationYRadians: 0,
            },
            size: stableDeviceRegistry[slot.model].defaultSize,
            entitySlots: slot.entitySlots,
          })),
        ),
      });
    })
  : null;
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.addInitScript(() => {
    window.editorSamples = [];
    window.editorFrames = [];
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    const listeners = new WeakMap();
    const samplesByEvent = new WeakMap();
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (
        this instanceof HTMLElement &&
        typeof listener === "function" &&
        ["pointerdown", "pointerup", "click", "pointermove"].includes(type)
      ) {
        let types = listeners.get(listener);
        if (!types) listeners.set(listener, (types = new Map()));
        const key = `${type}:${typeof options === "boolean" ? options : Boolean(options?.capture)}`;
        const originalListener = listener;
        if (!types.has(key))
          types.set(key, function (event) {
            if (!(event.target instanceof HTMLCanvasElement))
              return originalListener.call(this, event);
            const start = performance.now();
            try {
              return originalListener.call(this, event);
            } finally {
              let sample = samplesByEvent.get(event);
              if (!sample) {
                sample = { type, handlerMs: 0 };
                samplesByEvent.set(event, sample);
                window.editorSamples.push(sample);
                if (type !== "pointermove")
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => {
                      sample.feedbackMs = performance.now() - start;
                    }),
                  );
              }
              sample.handlerMs += performance.now() - start;
            }
          });
        listener = types.get(key);
      }
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const key = `${type}:${typeof options === "boolean" ? options : Boolean(options?.capture)}`;
      return remove.call(this, type, listeners.get(listener)?.get(key) ?? listener, options);
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  if (scaleRecord) {
    await page.evaluate(async (record) => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open("cabane-projects", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("home-projects", "readwrite");
        transaction.objectStore("home-projects").put(JSON.stringify(record), record.homeId);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    }, scaleRecord);
    await page.reload({ waitUntil: "networkidle" });
  }
  await page.getByLabel("Open scene menu").click();
  await page.getByRole("button", { name: "Edit home", exact: true }).click();
  await page.locator(".editor-header").waitFor();
  await page.waitForTimeout(1200);
  const report = {
    origin,
    fixture: scaleRecord ? "20 rooms / 100 device slots" : "owner",
    browser: browser.version(),
    viewport: "1440x960",
    renderer: "Chrome headless default GPU",
    scenarios: {},
    errors,
  };
  const measure = async (name, action) => {
    console.log(`Measuring ${name}`);
    await page.evaluate(() => {
      window.editorSamples = [];
      window.editorFrames = [];
      window.captureEditorFrames = true;
      let last = performance.now();
      const frame = (time) => {
        if (!window.captureEditorFrames) return;
        window.editorFrames.push(time - last);
        last = time;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await action();
    await page.evaluate(() => {
      window.captureEditorFrames = false;
    });
    await page.waitForTimeout(400);
    const samples = await page.evaluate(() => window.editorSamples);
    const percentile = (values, fraction) => {
      values.sort((a, b) => a - b);
      return Number(
        (values[Math.min(values.length - 1, Math.floor(values.length * fraction))] ?? 0).toFixed(2),
      );
    };
    report.scenarios[name] = Object.fromEntries(
      ["pointerdown", "pointerup", "click", "pointermove"].map((type) => {
        const matching = samples.filter((sample) => sample.type === type);
        return [
          type,
          {
            count: matching.length,
            handlerP95Ms: percentile(
              matching.map((sample) => sample.handlerMs),
              0.95,
            ),
            nextPaintP95Ms: percentile(
              matching.flatMap((sample) => sample.feedbackMs ?? []),
              0.95,
            ),
          },
        ];
      }),
    );
    const frames = await page.evaluate(() => window.editorFrames);
    report.scenarios[name].frameIntervalP95Ms = percentile(frames, 0.95);
  };
  const top = page.getByRole("button", { name: "2D", exact: true });
  if (await top.count()) await top.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}/construct.png` });
  await measure("construct-selection", async () => {
    for (let index = 0; index < 12; index += 1) {
      await page.mouse.click(index % 2 ? 600 : 550, 329);
      await page.waitForTimeout(100);
    }
  });
  await measure("construct-opening-placement", async () => {
    for (let index = 0; index < 6; index += 1) {
      await selectConstructionTool(page, "Door");
      await page.mouse.move(570, scaleRecord ? 245 : 327);
      await page.mouse.click(570, scaleRecord ? 245 : 327);
      await page.waitForTimeout(100);
      await page.keyboard.press("ControlOrMeta+z");
    }
  });
  await measure("construct-wall-placement", async () => {
    await selectConstructionTool(page, "Wall");
    for (let index = 0; index < 8; index += 1) {
      await page.mouse.move(700 + index * 35, 760);
      await page.mouse.down();
      await page.mouse.move(735 + index * 35, 760, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(160);
    }
    await page.keyboard.press("Escape");
  });
  // Restore all deliberately added walls before capturing or measuring Arrange.
  for (let index = 0; index < 8; index += 1) await page.keyboard.press("ControlOrMeta+z");
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${output}/arrange-3d.png` });
  const itemPoints = scaleRecord
    ? [
        [738, 331],
        [777, 357],
      ]
    : [
        [600, 348],
        [651, 423],
      ];
  await measure("arrange-selection", async () => {
    for (let index = 0; index < 12; index += 1) {
      await page.mouse.click(...itemPoints[index % 2]);
      await page.waitForTimeout(100);
      assert.equal(
        await page
          .locator('[aria-label="Selected device"], [aria-label="Selected furnishing"]')
          .count(),
        1,
        "selection benchmark must hit an item",
      );
    }
  });
  await measure("arrange-drag", async () => {
    for (let index = 0; index < 6; index += 1) {
      await page.mouse.move(...itemPoints[0]);
      await page.mouse.down();
      await page.mouse.move(itemPoints[0][0] + 12, itemPoints[0][1] + 12, { steps: 15 });
      await page.mouse.up();
      await page.waitForTimeout(160);
      await page.keyboard.press("ControlOrMeta+z");
    }
  });
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
