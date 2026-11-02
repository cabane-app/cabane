import { selectConstructionTool } from "../tests/editor-browser-tools.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const origin = process.env.EDITOR_ORIGIN ?? "http://127.0.0.1:4186";
const output = "/tmp/cabane-construct-validation";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  // Isolated browser storage: never mutate the owner's saved draft.
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/construct`, { waitUntil: "networkidle" });
  await page.getByText("Draft saved locally", { exact: true }).waitFor();

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
  const initial = await record();
  const floor = initial.draft.floor;
  const bounds = await page.getByLabel("Home editor canvas", { exact: true }).boundingBox();
  const xs = floor.footprint.map((point) => point[0]);
  const zs = floor.footprint.map((point) => point[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);
  const scale = floor.coordinates.metersPerPlanUnit;
  const zoom = Math.max(
    8,
    Math.min(110, bounds.width / (width * scale * 1.48), bounds.height / (depth * scale * 1.58)),
  );
  const screen = ([x, z]) => [
    bounds.x + bounds.width / 2 + (x - (Math.min(...xs) + width / 2)) * scale * zoom,
    bounds.y + bounds.height / 2 + (z - (Math.min(...zs) + depth / 2)) * scale * zoom,
  ];
  const corners = [
    [2, -3],
    [5, -3],
    [5, -1],
    [2, -1],
  ];
  const draw = async (from, to) => {
    await page.mouse.move(...screen(from));
    await page.mouse.down();
    await page.mouse.move(...screen(to), { steps: 4 });
    await page.mouse.up();
  };
  const errorSelector = '.construction-inspector__validation li:not([data-severity="warning"])';
  const inspectorIssues = page.locator(errorSelector);
  const markers = page.locator(".construction-validation-marker");
  const expectCount = async (selector, count) => {
    await page.waitForFunction(
      ({ selector, count }) => document.querySelectorAll(selector).length === count,
      { selector, count },
    );
  };
  await selectConstructionTool(page, "Wall");
  for (let index = 0; index < 3; index += 1) {
    await draw(corners[index], corners[index + 1]);
    assert.equal(await inspectorIssues.count(), 0);
    assert.equal(await markers.count(), 0);
  }
  await page.screenshot({ path: `${output}/drawing-walls.png` });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const dialog = page.locator(".direction-publish-dialog");
  await dialog.waitFor();
  assert.equal(await dialog.locator("li").count(), 3, "Apply still reports each unfinished wall");
  assert.equal(
    await page.getByRole("button", { name: /^Apply (changes|anyway)$/ }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await expectCount(errorSelector, 3);
  assert.equal(await markers.count(), 3);
  await selectConstructionTool(page, "Wall");
  assert.equal(await inspectorIssues.count(), 0);
  assert.equal(await markers.count(), 0);
  await draw(corners[3], corners[0]);
  await page.screenshot({ path: `${output}/closed-room-wall-tool.png` });
  assert.equal(
    await inspectorIssues.count(),
    0,
    `room naming waits until leaving Wall: ${await inspectorIssues.allTextContents()}`,
  );
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await expectCount(errorSelector, 1);
  assert.match(await inspectorIssues.innerText(), /Name this room/);
  assert.doesNotMatch(await inspectorIssues.innerText(), /Expected a non-empty string/);
  assert.equal(await markers.count(), 1);
  await page.screenshot({ path: `${output}/single-room-name-issue.png` });
  // Switch modes after drawing: each mode owns its own camera framing.
  await selectConstructionTool(page, "Wall");
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await expectCount(".construction-validation-marker", 1);
  await page.getByRole("button", { name: "Construct", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Wall", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  await expectCount(".construction-validation-marker", 0);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await expectCount(errorSelector, 1);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  assert.equal(
    await dialog.locator('li:not([data-severity="warning"])').count(),
    1,
    "Apply does not reintroduce the schema duplicate",
  );
  assert.equal(
    await dialog.locator('li[data-severity="warning"]').count(),
    1,
    "keep the separate disconnected-room warning",
  );
  assert.equal(
    await page.getByRole("button", { name: /^Apply (changes|anyway)$/ }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await inspectorIssues.getByRole("button").click();
  await page.getByLabel("Room name", { exact: true }).fill("Garden room");
  await page.getByLabel("Room name", { exact: true }).press("Tab");
  await expectCount(errorSelector, 0);
  assert.equal(await markers.count(), 0);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  assert.equal(await dialog.locator('li:not([data-severity="warning"])').count(), 0);
  assert.equal(
    await page.getByRole("button", { name: "Apply anyway", exact: true }).isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByText("Draft saved locally", { exact: true }).waitFor();
  const saved = await record();
  assert.equal(saved.draft.floor.rooms.filter((room) => room.name === "Garden room").length, 1);
  assert.deepEqual(saved.published, initial.published);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Draft saved locally", { exact: true }).waitFor();
  assert.equal(await inspectorIssues.count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Verified Wall/Select validation timing, one room-name issue in plan/inspector/Apply, naming recovery, and unchanged published home.",
  );
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
