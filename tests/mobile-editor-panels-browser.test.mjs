import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { getBrowserTestServer, createBrowserTestSession } from "./browser-test-environment.mjs";

// Browser-only risk: the native dialog must fill a phone viewport, contain focus,
// restore the dock focus on dismissal and leave the canvas bounds unchanged.
const fixture = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {EditorPanels} from '/src/editor-workspace/EditorPanels';
import {EditorPanelControls} from '/src/editor-workspace/EditorPanelControls';
import {useEditorPanels} from '/src/editor-workspace/useEditorPanels';
import {useMobileEditorViewport} from '/src/editor-workspace/useMobileEditorViewport';
import '/src/home-editor.css';
import '/src/editor-workspace/editor-panels.css';
import '/src/editor-workspace/mobile-editor-panels.css';
function Fixture() {
  const mobile=useMobileEditorViewport();
  const panels=useEditorPanels(null,false,false);
  return React.createElement('main',{className:'direction-preview','data-mobile-editor':mobile,'data-editor-mode':'construct'},
    React.createElement('div',{className:'direction-preview__model','aria-label':'Canvas'}),
    React.createElement(EditorPanels,{mobile,panels,mode:'construct',floorName:'Ground floor',issueCount:0,disabled:false},
      React.createElement('aside',{className:'direction-rail'},React.createElement('button',{onClick:panels.closeMobilePanel},'Choose wall'))),
    React.createElement(EditorPanelControls,{panels,issueCount:0,disabled:false}));
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
</script>`;

test(
  "mobile panels fill portrait and landscape, contain focus and dismiss back to the dock",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const browser = await createBrowserTestSession();
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      await page.route("**/mobile-panel-fixture", async (route) =>
        route.fulfill({
          contentType: "text/html",
          body: await server.transformIndexHtml("/mobile-panel-fixture", fixture),
        }),
      );
      await page.goto(`${server.resolvedUrls.local[0]}mobile-panel-fixture`);
      const dock = page.locator(".editor-panel-switcher:not(.editor-panel-switcher--tabs)");
      const trigger = dock.getByRole("button", { name: "Build tools", exact: true });
      const dialog = page.getByRole("dialog");
      const canvas = page.getByLabel("Canvas", { exact: true });
      const bounds = await canvas.boundingBox();
      assert.equal(await dialog.count(), 0);
      await trigger.click();
      assert.deepEqual(await dialog.boundingBox(), { x: 0, y: 0, width: 390, height: 844 });
      assert.deepEqual(await canvas.boundingBox(), bounds);
      await dialog.getByRole("button", { name: "Done", exact: true }).focus();
      await page.keyboard.press("Tab");
      assert.equal(await dialog.evaluate((el) => el.contains(document.activeElement)), true);
      await page.keyboard.press("Escape");
      assert.equal(await dialog.count(), 0);
      assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
      await page.setViewportSize({ width: 844, height: 390 });
      await trigger.click();
      assert.deepEqual(await dialog.boundingBox(), { x: 0, y: 0, width: 844, height: 390 });
      await dialog.getByRole("button", { name: "Choose wall" }).click();
      assert.equal(await dialog.count(), 0);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForFunction(() => !document.querySelector("dialog"));
      assert.equal(await page.locator("dialog").count(), 0);
      assert.equal(await page.getByRole("button", { name: "Choose wall" }).isVisible(), true);
    } finally {
      await browser.close();
    }
  }),
);
