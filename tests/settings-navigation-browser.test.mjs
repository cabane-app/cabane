import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { getBrowserTestServer, createBrowserTestSession } from "./browser-test-environment.mjs";

// Browser-only risk: safe-area insets must not put settings categories behind
// the floating editor header, and horizontal scrolling must leave them tappable.
const fixture = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {HomeEditorHeader} from '/src/editor-workspace/HomeEditorHeader';
import {SettingsNavigation} from '/src/editor-settings/SettingsNavigation';
import {settingsSections} from '/src/editor-settings/settings-sections';
import '/src/home-editor.css';
import '/src/editor-workspace/editor-panels.css';
import '/src/editor-workspace/mobile-editor-panels.css';
import '/src/editor-settings/editor-settings.css';
const project={home:{name:'Test home'},floors:[{id:'ground',name:'Ground floor'}]};
function Fixture() {
  const [section,onSelect]=React.useState('home-assistant');
  const entry=settingsSections.find(entry=>entry.id===section);
  return React.createElement('main',{className:'direction-preview is-settings','data-editor-mode':'settings','data-mobile-editor':false},
    React.createElement(HomeEditorHeader,{
      settingsMode:true,mode:'construct',activeFloorId:'ground',
      snapshot:{project,bindings:{}},workspace:{record:{published:project},canUndo:false,canRedo:false},
      floorZoneDrawing:{active:false},poolDrawing:{active:false},publishErrors:[],
      onModeTabChange(){},undoProject(){},redoProject(){}
    }),
    React.createElement('aside',{className:'direction-rail'},
      React.createElement('div',{className:'editor-sidebar-content'},
        React.createElement(SettingsNavigation,{section,onSelect,disabled:false}))),
    React.createElement('section',{className:'editor-settings'},
      React.createElement('div',{className:'editor-settings__content'},
        React.createElement('header',{className:'editor-settings__heading'},
          React.createElement('h1',null,entry.label),React.createElement('p',null,entry.description)))));
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
</script>`;

test(
  "settings categories stay below the mobile header and remain tappable with safe-area insets",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const browser = await createBrowserTestSession();
    try {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 59, bottom: 34 } });
      await page.route("**/settings-fixture", async (route) =>
        route.fulfill({
          contentType: "text/html",
          body: await server.transformIndexHtml("/settings-fixture", fixture),
        }),
      );
      await page.goto(`${server.resolvedUrls.local[0]}settings-fixture`);
      const navigation = page.getByRole("navigation", { name: "Settings sections" });
      await navigation.waitFor();
      for (const width of [393, 320, 1440]) {
        await page.setViewportSize({ width, height: 852 });
        if (width <= 760) {
          const header = await page.locator(".editor-header").boundingBox();
          const categories = await navigation.boundingBox();
          const content = await page.locator(".editor-settings").boundingBox();
          assert.ok(header.y + header.height <= categories.y, "header must not cover categories");
          assert.ok(
            categories.y + categories.height <= content.y,
            "categories must not cover content",
          );
        }
        for (const label of [
          "Home Assistant",
          "Shortcuts",
          "Backups",
          "Orbital view",
          "Editor",
          "Explore",
        ]) {
          const button = navigation.getByRole("button", { name: label, exact: true });
          await button.click();
          assert.equal(await button.getAttribute("aria-current"), "page");
          assert.equal(await page.getByRole("heading", { level: 1 }).textContent(), label);
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
      }
    } finally {
      await browser.close();
    }
  }),
);
