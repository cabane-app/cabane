import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

const fixture = `<!doctype html><style>.cabane-shell .scene-canvas{width:800px;height:600px}</style><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {useFrame,useThree} from '@react-three/fiber';
import {CabaneDashboard,HomeAssistantRuntimeProvider} from '@cabane/engine';
import {stableArchitectureModelRegistry} from '@cabane/catalog/architecture';
import {installedWalkTools} from '/src/walk-tools.ts'; const torchlight=installedWalkTools.find(tool=>tool.id==="cabane.torchlight");
import {neutralDemoManifest} from '/@fs/${process.cwd()}/packages/engine/src/demo.ts';
import '@cabane/engine/styles.css';
const manifest=structuredClone(neutralDemoManifest);
manifest.floors[0].openings=[];
manifest.home.walkStart={floorId:manifest.floors[0].id,at:[2.4,1.8]};
delete manifest.actionBar;
function ObservedTorch(props) {
 const {scene}=useThree();
 useFrame(()=>{window.beamOn=scene.getObjectsByProperty("isSpotLight",true).some(o=>o.intensity===48);});
 return React.createElement(torchlight.Scene,props);
}
createRoot(document.getElementById('root')).render(
 React.createElement(HomeAssistantRuntimeProvider,null,
  React.createElement(CabaneDashboard,{manifest,architectureModels:stableArchitectureModelRegistry,
   walkTools:[{...torchlight,Scene:ObservedTorch}]})));
</script>`;

test(
  "equipping the torchlight reuses compiled world lighting programs",
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
    await page.addInitScript(() => {
      const original = WebGL2RenderingContext.prototype.linkProgram;
      window.spotlightPrograms = 0;
      WebGL2RenderingContext.prototype.linkProgram = function (program) {
        if (
          this.getAttachedShaders(program).some(
            (shader) =>
              /#define NUM_SPOT_LIGHTS [1-9]/.test(this.getShaderSource(shader)) ||
              /uniform SpotLight spotLights\[ [1-9]/.test(this.getShaderSource(shader)),
          )
        )
          window.spotlightPrograms++;
        return original.call(this, program);
      };
    });
    await page.route("**/torchlight-smoke", async (route) =>
      route.fulfill({
        contentType: "text/html",
        body: await server.transformIndexHtml("/torchlight-smoke", fixture),
      }),
    );
    await page.goto(server.resolvedUrls.local[0] + "torchlight-smoke");
    await page.getByRole("button", { name: "Walk mode", exact: true }).click();
    await page.waitForFunction(() => document.pointerLockElement);
    await page.getByRole("button", { name: "Exit walk mode", exact: true }).waitFor();
    const before = await page.evaluate(() => window.spotlightPrograms);
    await page.keyboard.press("t");
    await page.waitForFunction(() => window.beamOn);
    await page.screenshot({ path: "test-results/torchlight.png" });
    await page.keyboard.press("t");
    await page.waitForFunction(() => !document.querySelector('[aria-label="Unequip Torchlight"]'));
    assert.equal(await page.evaluate(() => window.spotlightPrograms), before);
    assert.deepEqual(errors, []);
  }),
);
