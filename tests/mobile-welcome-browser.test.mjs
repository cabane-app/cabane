import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

test(
  "mobile welcome stays navigable while the optional 3D tour cannot download",
  { timeout: 10000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const browser = await createBrowserTestSession();
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      // Hold the real renderer entry at the network boundary, independent of CPU and link speed.
      let requests = 0;
      const requested = Promise.withResolvers();
      await page.route("**/src/HostedWorkspace.tsx*", () => {
        requests++;
        requested.resolve();
      });
      await page.goto(new URL("welcome", server.resolvedUrls.local[0]).href);
      const start = page.getByRole("button", { name: "Start 3D tour" });
      await start.waitFor();
      assert.equal(requests, 0);
      assert.equal(await page.locator("canvas").count(), 0);
      await start.click();
      await requested.promise;
      await page.locator(".onboarding-privacy summary").click();
      assert.equal(await page.locator(".onboarding-privacy[open]").count(), 1);
      await page.getByRole("button", { name: "Build my home" }).click();
      await page.getByRole("status").filter({ hasText: "Opening your home" }).waitFor();
    } finally {
      await browser.close();
    }
  }),
);
