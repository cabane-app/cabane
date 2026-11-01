import { selectConstructionTool } from "../tests/editor-browser-tools.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const origin = process.env.EDITOR_ORIGIN ?? "http://127.0.0.1:4186";
const output = "/tmp/cabane-editor-verification";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  let page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}/home-overview.png` });
  await page.locator('.room-status-overlay[data-visible="true"]').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}/home-room-focus.png` });
  await page.getByRole("button", { name: "Walk inside", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}/home-walk.png` });
  await page.reload({ waitUntil: "networkidle" });
  const openEditor = async () => {
    await page.getByLabel("Open scene menu").click();
    await page.getByRole("button", { name: "Construct", exact: true }).click();
    await page.locator(".editor-header").waitFor();
  };
  const record = () =>
    page.evaluate(async () => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open("cabane-projects", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const records = await new Promise((resolve, reject) => {
        const request = database.transaction("home-projects").objectStore("home-projects").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return JSON.parse(records[0]);
    });
  await openEditor();
  await page.getByText("Draft saved locally", { exact: true }).waitFor();
  const initial = await record();
  assert.equal(await page.getByRole("button", { name: "3D", exact: true }).isDisabled(), true);
  assert.equal(
    await page.getByRole("button", { name: "2D", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page.locator(".construction-plan__room-label").count(),
    initial.draft.floor.rooms.length,
  );
  await page.screenshot({ path: `${output}/plan-desktop.png` });
  // Select every real opening through the plan, not through inspector controls.
  const canvasBounds = await page.getByLabel("Home editor canvas", { exact: true }).boundingBox();
  const floor = initial.draft.floor;
  const xs = floor.footprint.map((point) => point[0]);
  const zs = floor.footprint.map((point) => point[1]);
  const width = Math.max(...xs) - Math.min(...xs),
    depth = Math.max(...zs) - Math.min(...zs);
  const scale = floor.coordinates.metersPerPlanUnit;
  const zoom = Math.max(
    8,
    Math.min(
      110,
      canvasBounds.width / (width * scale * 1.48),
      canvasBounds.height / (depth * scale * 1.58),
    ),
  );
  for (const opening of floor.openings) {
    const wall = floor.walls.find((wall) => wall.id === opening.wallId);
    const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
    const progress = (opening.offsetFromWallStartPlanUnits + opening.widthPlanUnits / 2) / length;
    const x = wall.from[0] + (wall.to[0] - wall.from[0]) * progress;
    const z = wall.from[1] + (wall.to[1] - wall.from[1]) * progress;
    await page.mouse.click(
      canvasBounds.x + canvasBounds.width / 2 + (x - (Math.min(...xs) + width / 2)) * scale * zoom,
      canvasBounds.y + canvasBounds.height / 2 + (z - (Math.min(...zs) + depth / 2)) * scale * zoom,
    );
    await page.getByRole("button", { name: "Delete opening", exact: true }).waitFor();
    assert.ok(
      Math.abs(
        Number(await page.getByLabel("Opening width", { exact: true }).inputValue()) -
          opening.widthPlanUnits * scale,
      ) < 0.001,
      `selected opening ${opening.id}`,
    );
  }
  console.log(
    `Verified direct plan selection for all ${floor.openings.length} doors/windows/passages`,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.getByRole("button", { name: "Construct", exact: true }).click();
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "2D", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${output}/arrange-3d.png` });
  await page.getByRole("button", { name: "Construct", exact: true }).click();

  // Three consecutive releases must be individually undoable, without waiting
  // for autosave or a deferred topology timer between the gestures.
  await selectConstructionTool(page, "Wall");
  for (let index = 0; index < 3; index += 1) {
    await page.mouse.move(700 + index * 40, 750);
    await page.mouse.down();
    await page.mouse.move(740 + index * 40, 750, { steps: 2 });
    await page.mouse.up();
  }
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("dialog", { name: "Explore draft" }).waitFor();
  await page.locator(".direction-preview-dialog .mode-walk").waitFor();
  await page.screenshot({ path: `${output}/immediate-preview.png` });
  await page.getByRole("button", { name: /Back to editor/ }).press("Enter");
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.keyboard.press("ControlOrMeta+z");
  await selectConstructionTool(page, "Wall");
  await page.mouse.move(860, 750);
  await page.mouse.down();
  await page.mouse.move(900, 750, { steps: 2 });
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+z");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.locator(".cabane-shell").waitFor();
  const saved = await record();
  assert.equal(
    saved.draft.floor.walls.length,
    initial.draft.floor.walls.length + 2,
    "Home flushes the latest edit and undo",
  );
  assert.deepEqual(saved.published, initial.published, "Home saves the draft without applying it");
  await openEditor();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("dialog", { name: "Explore draft" }).waitFor();
  await page.locator(".direction-preview-dialog .mode-walk").waitFor();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${output}/preview-3d.png` });
  await page.getByRole("button", { name: /Back to editor/ }).press("Enter");

  // Check the same draft at phone portrait and landscape sizes.
  for (const [name, viewport] of Object.entries({
    portrait: { width: 390, height: 844 },
    landscape: { width: 844, height: 390 },
  })) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
    assert.equal(await page.getByRole("button", { name: "Wall", exact: true }).isVisible(), true);
    assert.equal(await page.getByRole("button", { name: "Apply", exact: true }).isVisible(), true);
    await page.screenshot({ path: `${output}/plan-${name}.png` });
  }
  // Apply in an isolated browser context; never touch the owner's browser data.
  await page.close();
  page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await openEditor();
  console.log("Checking immediate Apply");
  await page.getByText("Draft saved locally", { exact: true }).waitFor();
  await page.mouse.click(570, 500);
  await page.getByLabel("Room name", { exact: true }).fill("Plan verification room");
  // The Apply click blurs and commits the active field; do not wait for autosave.
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("button", { name: /^(Apply changes|Apply anyway)$/ }).click();
  await page.locator(".cabane-shell").waitFor();
  const applied = await record();
  assert.ok(
    applied.published.floor.rooms.some((room) => room.name === "Plan verification room"),
    "Apply resolves the latest committed field edit",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Verified 2D-only Construct, remembered Arrange camera, three rapid releases, one-step undo, immediate Home/Explore/Apply, unchanged published home before Apply, and responsive plan controls.",
  );
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
