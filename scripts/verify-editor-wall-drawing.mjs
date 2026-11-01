import { selectConstructionTool } from "../tests/editor-browser-tools.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = process.env.EDITOR_ORIGIN ?? "http://127.0.0.1:4186";
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  // A fresh profile keeps drawing and undo checks out of the owner's saved home.
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByLabel("Open scene menu").click();
  await page.getByRole("button", { name: "Construct", exact: true }).click();
  await page.locator(".construction-plan__room-label").first().waitFor();
  await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((name) => name.includes("/@react-three_fiber.js"));
    const { _roots } = await import(url);
    window.wallDrawingProbe = () => {
      const canvas = document.querySelector(".direction-preview__model canvas");
      const { camera, scene, pointer } = _roots.get(canvas).store.getState();
      const guide = scene.getObjectByName("construction-wall-guide");
      const tip = scene.getObjectByName("construction-wall-tip-marker");
      const projected = tip?.position.clone().project(camera);
      const rect = canvas.getBoundingClientRect();
      let wallCount = 0;
      scene.traverse((object) => {
        if (object.name.startsWith("construction-wall-target-")) wallCount++;
      });
      return {
        wallCount,
        guide: guide?.userData,
        pointer: pointer.toArray(),
        tip: projected && [
          rect.x + ((projected.x + 1) * rect.width) / 2,
          rect.y + ((1 - projected.y) * rect.height) / 2,
        ],
      };
    };
  });
  const probe = () => page.evaluate(() => window.wallDrawingProbe());
  const paint = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
    );

  for (const viewport of [
    { width: 1440, height: 960 },
    { width: 960, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await selectConstructionTool(page, "Wall");
    const canvas = page.locator(".direction-preview__model canvas");
    const bounds = await canvas.boundingBox();
    const x = Math.round(bounds.x + bounds.width * 0.42);
    const y = Math.round(bounds.y + bounds.height * 0.8);
    const initialWallCount = (await probe()).wallCount;
    // Alt isolates pointer tracking from intentionally magnetic/angle snapping.
    await page.keyboard.down("Alt");
    await page.mouse.click(x, y);
    await paint();
    const start = (await probe()).guide.from;
    // Cross the invisible midpoint container, then repeatedly move near the
    // start. Before the fix, alternate events use label-relative offsetX/Y and
    // shoot the preview to the canvas's top-left corner.
    for (const offset of [100, 50, 51, 52, 20, 21, 22, 10, 11, 12]) {
      await page.mouse.move(x + offset, y);
      await paint();
      const current = await probe();
      assert.deepEqual(current.guide.from, start, "hovering preserves the first edge");
      assert.equal(current.wallCount, initialWallCount, "hovering never commits a wall");
      assert.ok(
        current.tip && Math.hypot(current.tip[0] - x - offset, current.tip[1] - y) < 0.5,
        `preview jumped away from cursor at ${x + offset},${y}: ${current.tip}`,
      );
    }
    await page.screenshot({ path: `/tmp/cabane-wall-preview-${viewport.width}.png` });
    // Snapping must still use the cursor's canvas coordinates at the midpoint.
    await page.keyboard.up("Alt");
    for (const offset of [100, 50, 51, 52, 20, 21, 22]) {
      await page.mouse.move(x + offset, y);
      await paint();
      const current = await probe();
      assert.ok(
        Math.abs(current.pointer[0] - (((x + offset - bounds.x) / bounds.width) * 2 - 1)) < 0.001,
      );
      assert.ok(Math.abs(current.pointer[1] - (1 - ((y - bounds.y) / bounds.height) * 2)) < 0.001);
      assert.equal(current.wallCount, initialWallCount);
    }
    await page.mouse.click(x + 100, y);
    await paint();
    assert.equal((await probe()).wallCount, initialWallCount + 1, "release commits one wall");
    await page.keyboard.press("Escape");
    await paint();
    assert.equal((await probe()).guide, undefined, "Escape removes the transient preview");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await paint();
    assert.equal(
      (await probe()).wallCount,
      initialWallCount,
      "one Undo removes the committed wall",
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Verified wall-preview label crossings, short walls, snapping, commit, cancellation, and undo at two viewport sizes without flicker or browser errors.",
  );
} finally {
  await browser.close();
}
