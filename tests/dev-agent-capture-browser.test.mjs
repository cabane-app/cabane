import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { getBrowserTestServer, createBrowserTestSession } from "./browser-test-environment.mjs";

test(
  "capture reads nonempty pixels from completed WebGL frames at multiple angles",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    // Real WebGL frame completion and buffer readback cannot be verified in Node/DOM.
    const { server } = await getBrowserTestServer();
    const browser = await createBrowserTestSession();
    try {
      const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
      await page.goto(server.resolvedUrls.local[0]);
      await page.evaluate(async () =>
        (await import("/tests/dev-agent-capture-harness.tsx")).mountCaptureHarness(),
      );
      await page.waitForFunction(() => document.documentElement.dataset.captureReady === "true");
      const results = await page.evaluate(async () => {
        const { captureScene } = await import("../scripts/dev-agent-capture-browser.mjs");
        const captures = [];
        for (const [name, azimuth, elevation] of [
          ["front", 45, 30],
          ["top", 0, 90],
        ]) {
          const result = await captureScene({
            operation: "capture",
            target: "capture-target",
            view: { name, azimuth, elevation },
            padding: 1.2,
            timeoutMs: 3000,
          });
          const image = await createImageBitmap(await (await fetch(result.png)).blob());
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          const center = [...context.getImageData(image.width / 2, image.height / 2, 1, 1).data];
          const pixels = context.getImageData(0, 0, image.width, image.height).data;
          let minX = image.width,
            minY = image.height,
            maxX = 0,
            maxY = 0;
          for (let y = 0; y < image.height; y++)
            for (let x = 0; x < image.width; x++) {
              const index = (y * image.width + x) * 4;
              if (pixels[index] > 200 && pixels[index + 1] < 40 && pixels[index + 2] < 40) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
              }
            }
          image.close();
          captures.push({
            center,
            width: result.width,
            height: result.height,
            position: result.camera.position,
            silhouette: [maxX - minX, maxY - minY],
          });
        }
        return captures;
      });
      for (const result of results) {
        assert.equal(result.width, 640);
        assert.equal(result.height, 400);
        assert.ok(
          result.center[0] > 200 && result.center[1] < 40 && result.center[2] < 40,
          JSON.stringify(result),
        );
        assert.equal(result.center[3], 255);
      }
      assert.notDeepEqual(results[0].position, results[1].position);
      assert.notDeepEqual(
        results[0].silhouette,
        results[1].silhouette,
        "pixels reflect the new angle rather than a stale frame",
      );
    } finally {
      await browser.close();
    }
  }),
);
