import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { waitForAsyncCondition } from "./async-condition.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { getBrowserTestServer, createBrowserTestSession } from "./browser-test-environment.mjs";

test(
  "the settings page imports a full backup into the draft without publishing it",
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer();
    let browser;
    try {
      browser = await createBrowserTestSession();
      const page = await browser.newPage();
      page.on("dialog", (dialog) => dialog.accept());
      // This fixture server has no app Vite defines; the editor imports thumbnail caching.
      await page.addInitScript(() => {
        globalThis.__THUMBNAIL_REVISION__ = "test";
      });
      await page.goto(server.resolvedUrls.local[0]);
      const imported = await page.evaluate(async () => {
        const harness = await import("/tests/fixtures/ha-storage-harness.tsx");
        const { exportWorkspaceBackup } =
          await import("/apps/web/src/workspaces/workspace-transfer.ts");
        window.haHarness = await harness.mountHaStorageHarness({ fullPage: true });
        const entry = await window.haHarness.repository.read(window.haHarness.id);
        const originalPublished = JSON.stringify(entry.record.published);
        entry.record.draft.home.name = "Restored draft";
        return { json: exportWorkspaceBackup(entry.metadata, entry.record), originalPublished };
      });
      const backupDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export backup", exact: true }).click();
      assert.match((await backupDownload).suggestedFilename(), /-backup\.cabane$/);
      await page.locator('input[type="file"]').setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(imported.json),
      });
      await page
        .getByText("Backup imported into the draft. Review it here before saving.")
        .waitFor();
      await waitForAsyncCondition(async () =>
        page.evaluate(
          async () =>
            (await window.haHarness.repository.read(window.haHarness.id)).record.draft.home.name ===
            "Restored draft",
        ),
      );
      const saved = await page.evaluate(
        async () => (await window.haHarness.repository.read(window.haHarness.id)).record,
      );
      assert.equal(saved.draft.home.name, "Restored draft");
      assert.equal(JSON.stringify(saved.published), imported.originalPublished);
      assert.equal(saved.publishedAt, 0);
    } finally {
      await browser?.close();
    }
  }),
);
