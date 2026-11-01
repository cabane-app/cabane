import { selectConstructionTool } from "../tests/editor-browser-tools.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = process.env.EDITOR_ORIGIN ?? "http://127.0.0.1:4186";
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
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
    window.wallMeasurementSnapshot = () => {
      const canvas = document.querySelector(".direction-preview__model canvas");
      const { scene, camera } = _roots.get(canvas).store.getState();
      const rect = canvas.getBoundingClientRect();
      const result = { lengths: [], angles: [], targets: [] };
      scene.traverse((object) => {
        if (
          object.name === "construction-wall-guide" ||
          object.name.startsWith("construction-wall-guide-")
        )
          result.lengths.push(object.userData);
        if (object.name === "construction-angle-guide") result.angles.push(object.userData);
        if (
          object.name.startsWith("construction-wall-target-") ||
          object.name.startsWith("construction-wall-endpoint-")
        ) {
          const projected = object.getWorldPosition(object.position.clone()).project(camera);
          result.targets.push({
            name: object.name,
            screen: [
              rect.x + ((projected.x + 1) * rect.width) / 2,
              rect.y + ((1 - projected.y) * rect.height) / 2,
            ],
          });
        }
      });
      return result;
    };
  });
  const snapshot = () => page.evaluate(() => window.wallMeasurementSnapshot());
  const paint = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        ),
    );
  const move = async (...point) => {
    await page.mouse.move(...point, { steps: 10 });
    await paint();
  };
  const lengths = page.getByLabel("Wall length", { exact: true });
  const angles = page.getByLabel("Wall angle", { exact: true });
  const checkLabels = async () => {
    const state = await snapshot();
    assert.equal(await lengths.count(), 2);
    assert.equal(await angles.count(), 1);
    assert.deepEqual(
      (await lengths.allTextContents()).sort(),
      state.lengths
        .filter((entry) => entry.labelVisible)
        .map((entry) => entry.label)
        .sort(),
    );
    assert.equal(await angles.textContent(), state.angles[0].label);
    assert.equal(
      await page.locator(".construction-validation-marker").count(),
      0,
      "issue badges leave room for live measurements during a gesture",
    );
    const boxes = await page
      .locator('[aria-label="Wall length"], [aria-label="Wall angle"]')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            right: rect.right,
            bottom: rect.bottom,
            pointerEvents: getComputedStyle(element).pointerEvents,
          };
        }),
      );
    for (const [index, box] of boxes.entries()) {
      assert.equal(box.pointerEvents, "none");
      assert.ok(
        box.x >= 270 && box.right <= 1440 && box.y >= 0 && box.bottom <= 960,
        "measurements stay inside the canvas",
      );
      for (const other of boxes.slice(index + 1)) {
        assert.ok(
          box.right <= other.x ||
            other.right <= box.x ||
            box.bottom <= other.y ||
            other.bottom <= box.y,
          "length and angle labels should not overlap",
        );
      }
    }
    return state;
  };

  const original = await snapshot();
  await selectConstructionTool(page, "Wall");
  await move(720, 740);
  await page.mouse.down();
  await move(920, 740);
  await page.mouse.up();
  await page.mouse.down();
  await move(920, 880);
  await lengths.first().waitFor();
  const drawing = await checkLabels();
  assert.equal(drawing.angles[0].label, "90°");
  await page.screenshot({ path: "/tmp/cabane-connected-wall-drawing.png" });
  await page.keyboard.down("Alt");
  await move(975, 875);
  const free = await checkLabels();
  assert.notEqual(
    free.angles[0].label,
    "90°",
    "angles update continuously with Alt rather than reporting the snap direction",
  );
  await page.keyboard.up("Alt");
  await move(920, 880);
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await paint();
  assert.equal(await lengths.count(), 0);
  assert.equal(await angles.count(), 0);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await paint();
  const existingNames = new Set(original.targets.map(({ name }) => name));
  const newWalls = (await snapshot()).targets.filter(
    ({ name }) => name.startsWith("construction-wall-target-") && !existingNames.has(name),
  );
  assert.equal(newWalls.length, 2);
  // Select on the wall body, clear of its existing midpoint issue badge.
  await page.mouse.click(newWalls[0].screen[0] - 85, newWalls[0].screen[1]);
  await paint();
  const wallId = newWalls[0].name.slice("construction-wall-target-".length);
  const corner = (await snapshot()).targets.find(
    ({ name }) => name === `construction-wall-endpoint-${wallId}-to`,
  );
  assert.ok(corner);
  await move(...corner.screen);
  await page.mouse.down();
  await page.keyboard.down("Alt");
  await move(corner.screen[0] + 25, corner.screen[1] + 35);
  const resizing = await checkLabels();
  assert.notEqual(resizing.angles[0].label, "90°");
  assert.ok(
    resizing.lengths.every(
      (entry) => !drawing.lengths.some((before) => before.label === entry.label),
    ),
    "both wall lengths change when their common corner moves",
  );
  await page.screenshot({ path: "/tmp/cabane-connected-corner-resizing.png" });
  await page.keyboard.up("Alt");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelectorAll('[aria-label="Wall length"]').length === 0,
  );
  assert.equal(await lengths.count(), 0, "cancellation removes every live length");
  assert.equal(await angles.count(), 0, "cancellation removes every angle");
  assert.ok(
    (await page.locator(".construction-validation-marker").count()) > 0,
    "issue badges return after the gesture",
  );
  await page.getByRole("button", { name: "Measure", exact: true }).click();
  await page.mouse.click(720, 740);
  await move(920, 740);
  await page.getByRole("button", { name: /^Copy measurement:/ }).waitFor();
  assert.equal(await angles.count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Verified connected wall lengths, live corner angles, free movement, shared-corner resizing, label placement, cancellation, and unchanged Measure UI in isolated browser storage.",
  );
} finally {
  await browser.close();
}
