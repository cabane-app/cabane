import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { startFixtureServer, serverOrigin } from "./fixture-server.mjs";

const server = await startFixtureServer({ port: 4187 });
const browser = await chromium.launch({
  channel: "chromium",
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
const screenshotDir = process.env.CABANE_SHORTCUT_EVIDENCE ?? "/tmp/cabane-ha-shortcuts";
await mkdir(screenshotDir, { recursive: true });
try {
  await page.goto(`${serverOrigin(server)}/tests/ha-shortcuts-harness.html`);
  await page.getByRole("button", { name: "Add shortcut", exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "Add shortcut", exact: true }).click();
  await page.getByRole("button", { name: "Add scene", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Offline scene", exact: true }).isDisabled(),
    true,
  );
  await page.screenshot({ path: `${screenshotDir}/scene-picker.png` });
  await page.getByRole("button", { name: "Evening scene", exact: true }).click();
  await page.getByRole("button", { name: "Add shortcut", exact: true }).click();
  await page.getByRole("button", { name: "Add script", exact: true }).click();
  await page.getByRole("button", { name: "Daily routine", exact: true }).click();
  await page.getByRole("button", { name: "Edit Daily routine shortcut", exact: true }).click();
  await page.getByRole("button", { name: "Move left", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.screenshot({ path: `${screenshotDir}/draft-desktop.png` });
  await page.getByRole("button", { name: "Save & close", exact: true }).click();
  const confirm = page.getByRole("button", {
    name: /Save changes|Save anyway|Apply anyway|Confirm/,
  });
  await confirm.first().waitFor();
  await confirm.first().click();
  await page
    .getByRole("button", { name: "Evening scene", exact: true })
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Evening scene", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Evening scene", exact: true })
      .getAttribute("aria-busy"),
    "true",
  );
  assert.equal(
    await page.getByRole("button", { name: "Evening scene", exact: true }).isDisabled(),
    true,
  );
  await page.evaluate(() => window.shortcutFixture.settle());
  await page.getByRole("button", { name: "Evening scene", exact: true }).waitFor();
  await page.evaluate(() => window.shortcutFixture.fail(true));
  await page.getByRole("button", { name: "Daily routine", exact: true }).click();
  await page.evaluate(() => window.shortcutFixture.settle());
  await page.getByRole("alert").filter({ hasText: "Synthetic service failure" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.shortcutFixture.calls), [
    { domain: "scene", service: "turn_on", target: { entity_id: "scene.synthetic_evening" } },
    { domain: "script", service: "turn_on", target: { entity_id: "script.synthetic_routine" } },
  ]);
  await page.evaluate(() => window.shortcutFixture.setConnected(false));
  assert.equal(
    await page.getByRole("button", { name: "Evening scene", exact: true }).isDisabled(),
    true,
  );
  await page.evaluate(() => window.shortcutFixture.setConnected(true));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("button", { name: "Evening scene", exact: true }).waitFor();
  await page.screenshot({ path: `${screenshotDir}/home-mobile.png` });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: "More shortcuts", exact: true }).click();
  await page.getByRole("button", { name: "Edit Evening scene shortcut", exact: true }).waitFor();
  const record = await page.evaluate(() => window.shortcutFixture.readRecord());
  assert.ok(
    Object.values(
      record.bindings["https://synthetic.invalid"].published.actionEntityIdsByShortcutId,
    ).includes("scene.synthetic_evening"),
  );
  const tray = await page
    .locator(".shortcuts-workspace .scene-action-overflow__tray")
    .boundingBox();
  assert.ok(tray.x >= 0 && tray.x + tray.width <= 320, "overflow stays inside the viewport");
  await page.screenshot({ path: `${screenshotDir}/editor-mobile-overflow.png` });
  assert.deepEqual(errors, []);
  console.log(
    `HA shortcuts UI passed: mapping, unavailable choices, reorder/undo/redo, Save, activation, pending/error, disconnect, mobile overflow and persisted reload. Evidence: ${screenshotDir}`,
  );
} catch (error) {
  await page.screenshot({ path: `${screenshotDir}/failure.png` });
  console.error("Buttons:", await page.getByRole("button").allTextContents(), "Errors:", errors);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
