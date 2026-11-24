import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

// Keep one real input/rendering smoke. Placement, traversal, persistence,
// closing and reduced-motion matrices belong to the Node portal tests.
const fixture = `<!doctype html><style>.cabane-shell .scene-canvas{width:240px;height:180px}</style><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {useFrame,useThree} from '@react-three/fiber';
import {CabaneDashboard,DashboardSceneReadyContext,HomeAssistantRuntimeProvider} from '@cabane/engine';
import {stableArchitectureModelRegistry} from '@cabane/catalog/architecture';
import {laserWalkTool} from '@cabane/walk-laser';
import {neutralDemoManifest} from '/@fs/${process.cwd()}/packages/engine/src/demo.ts';
import '@cabane/engine/styles.css';
const manifest=structuredClone(neutralDemoManifest);
manifest.floors[0].openings=[];
manifest.home.walkStart={floorId:manifest.floors[0].id,at:[2.4,1.8]};
delete manifest.actionBar;
function ObservedGun(props) {
 const {scene}=useThree();
 useFrame(()=>{window.portalVisible=Boolean(scene.getObjectByName('gun-portal-blue'));});
 return React.createElement(laserWalkTool.Scene,props);
}
createRoot(document.getElementById('root')).render(
 React.createElement(DashboardSceneReadyContext.Provider,{value:()=>{window.sceneReady=true}},
  React.createElement(HomeAssistantRuntimeProvider,null,
  React.createElement(CabaneDashboard,{manifest,architectureModels:stableArchitectureModelRegistry,
   walkTools:[{...laserWalkTool,Scene:ObservedGun}]}))));
</script>`;

test(
  "portal gun equips and creates a visible portal through normal desktop input",
  { timeout: 30_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    const page = await session.newPage({
      viewport: { width: 800, height: 600 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/portal-smoke", async (route) =>
      route.fulfill({
        contentType: "text/html",
        body: await server.transformIndexHtml("/portal-smoke", fixture),
      }),
    );
    await page.goto(server.resolvedUrls.local[0] + "portal-smoke");
    await page.waitForFunction(() => window.sceneReady);
    await page.getByRole("button", { name: "Walk mode", exact: true }).click();
    await page.waitForFunction(() => document.pointerLockElement);
    await page.getByRole("button", { name: "Exit walk mode", exact: true }).waitFor();
    await page.keyboard.press("g");
    await page.waitForFunction(() => document.pointerLockElement && window.portalVisible === false);
    await page.mouse.down({ button: "right" });
    await page.mouse.up({ button: "right" });
    await page.waitForFunction(() => window.portalVisible);
    await page.locator("[data-action=portal][data-next-portal=gold]").waitFor();
    assert.deepEqual(errors, []);
  }),
);
