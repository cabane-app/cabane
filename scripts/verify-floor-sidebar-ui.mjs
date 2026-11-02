import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { startFixtureServer, serverOrigin } from "./fixture-server.mjs";
const server = await startFixtureServer({ port: 4193 });
let browser;
try {
  browser = await chromium.launch({
    channel: "chromium",
    headless: true,
    args: ["--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${serverOrigin(server)}/tests/multiple-floor-editor-harness.html`);
  const select = page.getByRole("button", { name: "Current floor", exact: true });
  await select.waitFor();
  await select.press("ArrowDown");
  await page.getByRole("menu", { name: "Floors", exact: true }).waitFor();
  await page.keyboard.press("End");
  assert.equal(
    await page
      .getByRole("menuitem", { name: "Add floor above", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await select.evaluate((el) => el === document.activeElement), true);
  assert.equal(await page.getByRole("menu").count(), 0);
  const initial = await page.evaluate(() => window.readFixtureProject());
  await select.click();
  await page.getByRole("menuitemradio", { name: initial.floors[1].name, exact: true }).click();
  await page.getByRole("button", { name: "Floor settings", exact: true }).click();
  await page.screenshot({ path: "/tmp/cabane-floor-settings.png" });
  await page
    .getByRole("dialog", { name: "Floor settings", exact: true })
    .screenshot({ path: "/tmp/cabane-floor-settings-detail.png" });
  await page.getByRole("textbox", { name: "Floor name" }).fill("Upstairs");
  await page.getByRole("button", { name: "Save floor", exact: true }).click();
  await page.waitForFunction(
    async () => (await window.readFixtureProject()).floors[1].name === "Upstairs",
  );
  await select.click();
  await page.screenshot({ path: "/tmp/cabane-floor-menu.png" });
  await page.screenshot({
    path: "/tmp/cabane-floor-menu-detail.png",
    clip: { x: 12, y: 86, width: 276, height: 240 },
  });
  await page.getByRole("menuitem", { name: "Add floor above", exact: true }).click();
  await page.getByRole("button", { name: "Add floor", exact: true }).click();
  const addedResult = await page.waitForFunction(async () => {
    const project = await window.readFixtureProject();
    return project.floors.length === 4 ? project : null;
  });
  const added = await addedResult.jsonValue();
  assert.equal(
    await select.getAttribute("data-floor-id"),
    added.floors.at(-1).id,
    "adding selects the new floor, never the action option",
  );
  assert.deepEqual(
    added.floors.slice(0, 3).map((f) => f.id),
    initial.floors.map((f) => f.id),
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForFunction(async () => (await window.readFixtureProject()).floors.length === 3);
  const restoredFloor = await select.getAttribute("data-floor-id");
  assert.ok(
    initial.floors.some((f) => f.id === restoredFloor),
    "undo returns to an existing floor",
  );
  await select.click();
  await page.getByRole("menuitemradio", { name: initial.floors[0].name, exact: true }).click();
  await page.screenshot({ path: "/tmp/cabane-floor-sidebar.png" });
  await page.setViewportSize({ width: 900, height: 800 });
  assert.equal(await select.isVisible(), true);
  const row = await page.locator(".construct-floor-controls").boundingBox();
  const settings = await page
    .getByRole("button", { name: "Floor settings", exact: true })
    .boundingBox();
  assert.ok(settings.x + settings.width <= row.x + row.width + 1, "settings fits beside selector");
  await select.click();
  await page.screenshot({ path: "/tmp/cabane-floor-menu-narrow.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Floor settings", exact: true }).click();
  await page.screenshot({ path: "/tmp/cabane-floor-settings-narrow.png" });
  const longName = "Ground floor with a very long name that must not push the chevron outside";
  await page.getByRole("textbox", { name: "Floor name" }).fill(longName);
  await page.getByRole("button", { name: "Save floor", exact: true }).click();
  await page.waitForFunction(
    (name) =>
      document.querySelector(".construct-floor-controls__trigger span")?.textContent === name,
    longName,
  );
  const triggerBox = await select.boundingBox();
  const chevronBox = await select.locator("svg").boundingBox();
  assert.ok(
    chevronBox.x + chevronBox.width < triggerBox.x + triggerBox.width,
    "long names leave space for the chevron",
  );
  await select.click();
  await page.locator(".direction-rail__brand").click();
  assert.equal(await page.getByRole("menu").count(), 0, "outside click closes the menu");
  await page.getByRole("button", { name: "Floor settings", exact: true }).click();
  await page.getByRole("textbox", { name: "Floor name" }).fill("");
  assert.equal(
    await page.getByRole("button", { name: "Save floor", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Floor settings", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Delete floor", exact: true }).isDisabled(),
    true,
    "ground floor is protected",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await select.click();
  await page.getByRole("menuitemradio", { name: "Upstairs", exact: true }).click();
  await page.getByRole("button", { name: "Floor settings", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Delete floor", exact: true }).isDisabled(),
    true,
    "middle floors are protected",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await select.click();
  await page.getByRole("menuitemradio", { name: initial.floors.at(-1).name, exact: true }).click();
  await page.getByRole("button", { name: "Floor settings", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Floor settings", exact: true })
    .screenshot({ path: "/tmp/cabane-floor-delete-settings.png" });
  await page.getByRole("button", { name: "Delete floor", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => window.readFixtureProject())).floors.length,
    3,
    "deletion needs confirmation",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Floor settings", exact: true }).click();
  await page.getByRole("button", { name: "Delete floor", exact: true }).click();
  await page.getByRole("button", { name: "Remove top floor", exact: true }).click();
  await page.waitForFunction(async () => (await window.readFixtureProject()).floors.length === 2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForFunction(async () => (await window.readFixtureProject()).floors.length === 3);
  assert.deepEqual(errors, []);
  console.log("Floor sidebar: switching, settings, adding, undo, and compact layout passed.");
} finally {
  await browser?.close();
  await server.close();
}
