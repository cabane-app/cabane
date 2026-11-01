import { selectConstructionTool } from "../tests/editor-browser-tools.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = process.env.EDITOR_ORIGIN ?? "http://127.0.0.1:4186";
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  // Isolated storage: UI edits never touch the owner's saved home.
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByLabel("Open scene menu").click();
  await page.getByRole("button", { name: "Construct", exact: true }).click();
  await page.getByRole("button", { name: "Wall", exact: true }).waitFor();
  await page.locator(".construction-plan__room-label").first().waitFor();
  await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((name) => name.includes("/@react-three_fiber.js"));
    const { _roots } = await import(url);
    window.constructSnapSnapshot = (name) => {
      const canvas = document.querySelector(".direction-preview__model canvas");
      const { scene, camera } = _roots.get(canvas).store.getState();
      const object = scene.getObjectByName(name);
      if (!object) return null;
      const projected = object.getWorldPosition(object.position.clone()).project(camera);
      const body = object
        .localToWorld(
          object.position.clone().set(-0.4 * (object.geometry?.parameters?.width ?? 0), 0, 0),
        )
        .project(camera);
      const rect = canvas.getBoundingClientRect();
      return {
        data: object.userData,
        screen: [
          rect.x + ((projected.x + 1) * rect.width) / 2,
          rect.y + ((1 - projected.y) * rect.height) / 2,
        ],
        bodyScreen: [
          rect.x + ((body.x + 1) * rect.width) / 2,
          rect.y + ((1 - body.y) * rect.height) / 2,
        ],
        position: object.position.toArray(),
        rotation: object.rotation.toArray(),
      };
    };
    window.constructWallTargetNames = () => {
      const { scene } = _roots
        .get(document.querySelector(".direction-preview__model canvas"))
        .store.getState();
      const names = [];
      scene.traverse((object) => {
        if (object.name.startsWith("construction-wall-target-")) names.push(object.name);
      });
      return names;
    };
  });
  const snapshot = (name) => page.evaluate((name) => window.constructSnapSnapshot(name), name);
  const guide = async () => (await snapshot("construction-wall-guide"))?.data;
  const waitForPaint = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }),
    );
  const move = async (x, y) => {
    await page.mouse.move(x, y, { steps: 8 });
    await waitForPaint();
  };
  const angleDistance = ({ from, to }) => {
    const angle = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
    return Math.abs(angle - Math.round(angle / 45) * 45);
  };
  const label = page.getByLabel("Wall length", { exact: true });
  const originalNames = await page.evaluate(() => window.constructWallTargetNames());
  await selectConstructionTool(page, "Wall");
  await page.mouse.move(700, 760);
  await page.mouse.down();
  await move(850, 906);
  await label.waitFor();
  assert.ok(
    angleDistance(await guide()) < 1e-8,
    "drawing near 45 degrees should catch the direction",
  );
  await move(920, 855);
  assert.ok(
    angleDistance(await guide()) > 10,
    "drawing outside the catch zone must release the direction",
  );
  await page.screenshot({ path: "/tmp/cabane-wall-free-angle.png" });
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await waitForPaint();
  const targetName = (await page.evaluate(() => window.constructWallTargetNames())).find(
    (name) => !originalNames.includes(name),
  );
  assert.ok(targetName, "the free-angle wall must commit");
  const before = await snapshot(targetName);
  // Pick along the actual wall body, away from its midpoint issue badge.
  await page.mouse.click(...before.bodyScreen);
  await waitForPaint();
  const wallId = targetName.slice("construction-wall-target-".length);
  const from = await snapshot(`construction-wall-endpoint-${wallId}-from`);
  const to = await snapshot(`construction-wall-endpoint-${wallId}-to`);
  assert.ok(from && to, "Select must expose the wall's endpoint handles");
  await page.mouse.move(...to.screen);
  await page.mouse.down();
  const nearAngle = [from.screen[0] + 135, from.screen[1] + 130];
  await move(...nearAngle);
  await label.waitFor();
  assert.ok(
    angleDistance(await guide()) < 1e-8,
    "an existing corner should catch the same direction",
  );
  await page.screenshot({ path: "/tmp/cabane-corner-angle-snap.png" });
  await move(from.screen[0] + 220, from.screen[1] + 95);
  assert.ok(
    angleDistance(await guide()) > 10,
    "the corner should release away from preferred angles",
  );
  await page.keyboard.down("Alt");
  await move(...nearAngle);
  assert.ok(angleDistance(await guide()) > 0.5, "Alt must bypass the corner's angle assist");
  await page.keyboard.up("Alt");
  await move(nearAngle[0] + 1, nearAngle[1]);
  assert.ok(angleDistance(await guide()) < 1e-8);
  await page.mouse.up();
  await waitForPaint();
  assert.equal(await label.count(), 0, "committing a corner clears the live label");
  const after = await snapshot(targetName);
  assert.notDeepEqual(after.rotation, before.rotation);
  await page.keyboard.press("ControlOrMeta+z");
  await waitForPaint();
  const undone = await snapshot(targetName);
  assert.deepEqual(undone.position, before.position, "one undo restores the previous corner");
  assert.deepEqual(undone.rotation, before.rotation);
  assert.deepEqual(errors, []);
  console.log(
    "Verified nearby-only angle snapping for wall drawing and corner dragging, free-angle release, Alt bypass, commit, and one-step undo through the normal UI.",
  );
} finally {
  await browser.close();
}
