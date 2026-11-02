import { selectConstructionTool } from "../tests/editor-browser-tools.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = process.env.EDITOR_ORIGIN ?? "http://127.0.0.1:4186";
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  // A fresh context keeps construction tests out of the owner's saved home.
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByLabel("Open scene menu").click();
  await page.getByRole("button", { name: "Construct", exact: true }).click();
  const labels = page.locator(".construction-plan__room-label");
  await labels.first().waitFor();
  await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((name) => name.includes("/@react-three_fiber.js"));
    const { _roots } = await import(url);
    window.editorCameraPose = () => {
      const { camera, controls } = _roots
        .get(document.querySelector(".direction-preview__model canvas"))
        .store.getState();
      return {
        id: camera.uuid,
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        quaternion: camera.quaternion.toArray(),
        zoom: camera.zoom,
      };
    };
  });
  const pose = () => page.evaluate(() => window.editorCameraPose());
  const waitForPaint = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }),
    );

  // Start with a user-controlled pan/zoom, not just the default fitted view.
  const fitted = await pose();
  await page.mouse.move(900, 700);
  await page.mouse.wheel(0, 160);
  await page.waitForTimeout(300);
  await page.mouse.move(900, 700);
  await page.mouse.down();
  await page.mouse.move(925, 685, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(
    () => {
      const {
        position: [x, , z],
      } = window.editorCameraPose();
      const previous = window.cameraSettleProbe;
      const stable =
        previous && Math.hypot(x - previous.x, z - previous.z) < 0.00005 ? previous.stable + 1 : 0;
      window.cameraSettleProbe = { x, z, stable };
      return stable >= 5;
    },
    null,
    { polling: "raf" },
  );
  const before = await pose();
  assert.notDeepEqual(before, fitted, "the test must first change the camera through its controls");
  await page.screenshot({ path: "/tmp/cabane-camera-before-room.png" });
  const assertStationary = async (action) => {
    await waitForPaint();
    const after = await pose();
    assert.equal(after.id, before.id, `${action} must not remount the camera`);
    assert.equal(after.zoom, before.zoom, `${action} must not change zoom`);
    for (const field of ["position", "target", "quaternion"]) {
      // MapControls may retain a subpixel damping tail when the demand loop
      // stops. Reject visible movement without confusing that with a refit.
      const tolerance = field === "quaternion" ? 1e-7 : 1 / before.zoom;
      assert.ok(
        Math.hypot(...after[field].map((value, index) => value - before[field][index])) < tolerance,
        `${action} changed camera ${field}: ${before[field]} -> ${after[field]}`,
      );
    }
  };
  await selectConstructionTool(page, "Wall");
  const corners = [
    [650, 730],
    [850, 730],
    [850, 830],
    [650, 830],
    [650, 730],
  ];
  let roomCountBeforeClose;
  for (let index = 0; index < 4; index += 1) {
    await page.mouse.move(...corners[index]);
    await page.mouse.down();
    await page.mouse.move(...corners[index + 1], { steps: 5 });
    await page.mouse.up();
    await assertStationary(`wall ${index + 1}`);
    if (index === 2) roomCountBeforeClose = await labels.count();
  }
  await page.waitForFunction(
    (count) => document.querySelectorAll(".construction-plan__room-label").length === count,
    roomCountBeforeClose + 1,
  );
  await assertStationary("closing the room");
  await page.screenshot({ path: "/tmp/cabane-camera-after-room.png" });
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForFunction(
    (count) => document.querySelectorAll(".construction-plan__room-label").length === count,
    roomCountBeforeClose,
  );
  await assertStationary("undoing the closing wall");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.waitForFunction(
    (count) => document.querySelectorAll(".construction-plan__room-label").length === count,
    roomCountBeforeClose + 1,
  );
  await assertStationary("redoing the closing wall");
  assert.deepEqual(errors, []);
  console.log(
    "Verified pan/zoom, four wall gestures, room closure, undo and redo without camera movement or browser errors.",
  );
} finally {
  await browser.close();
}
