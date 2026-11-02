import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { getBrowserTestServer, createBrowserTestSession } from "./browser-test-environment.mjs";

// Real-browser risk: CSS overflow and native focus in a narrow floor-control rail.
// Floor operations, persistence and history are covered by Node/DOM tests.
const fixture = `<!doctype html><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ConstructFloorControls} from '/src/editor-floors/ConstructFloorControls';
function Floors() {
  const [selectedId,onSelect]=React.useState('b');
  return React.createElement(ConstructFloorControls, {
    floors:[{id:'b',name:'Cellar'},{id:'g',name:'Ground floor'}],
    selectedId,onSelect,disabled:false,onAdd(){},onAddBelow(){},onSettings(){}
  });
}
createRoot(document.getElementById('root')).render(React.createElement(Floors));
</script>`;
test(
  "floor popover stays inside a narrow viewport and restores native keyboard focus",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const browser = await createBrowserTestSession();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.route("**/floor-menu-fixture", async (route) =>
        route.fulfill({
          contentType: "text/html",
          body: await server.transformIndexHtml("/floor-menu-fixture", fixture),
        }),
      );
      await page.goto(`${server.resolvedUrls.local[0]}floor-menu-fixture`);
      const current = page.getByRole("button", { name: "Current floor", exact: true });
      await current.click();
      const target = page.getByRole("menuitemradio", { name: "Ground floor", exact: true });
      const bounds = await target.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0);
      assert.ok(bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= 844);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.keyboard.press("Escape");
      assert.equal(await current.getAttribute("aria-expanded"), "false");
      assert.equal(await current.evaluate((element) => document.activeElement === element), true);
    } finally {
      await browser.close();
    }
  }),
);
