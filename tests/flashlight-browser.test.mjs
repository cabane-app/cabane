import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

// Keep this in Chromium: activating a pre-mounted light must reuse the actual
// WebGL program. Keyboard/action-bar behavior is covered by walk-tool-shortcuts.
// Render only a production toon surface and the installed tool's world lighting;
// dashboard startup, the handheld overlay and screenshots add no shader assertion.
const fixture = `<!doctype html><div id="root" style="width:64px;height:64px"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useThree} from '@react-three/fiber';
import {installedWalkTools} from '/src/walk-tools.ts';
import {renderWorldLighting} from '/@fs/${process.cwd()}/packages/engine/src/walk-tools/world-lighting.tsx';
import {ToonMaterial} from '/@fs/${process.cwd()}/packages/engine/src/rendering.tsx';
const flashlight=installedWalkTools.find(tool=>tool.label==="Flashlight");
function World() {
 const state=useThree();
 const [active,setActive]=React.useState(false);
 React.useLayoutEffect(()=>{window.flashlightProbe={...state,active,setActive};},[state,active]);
 return React.createElement(React.Fragment,null,
  renderWorldLighting([flashlight],active?flashlight:undefined,true),
  React.createElement('mesh',null,
   React.createElement('planeGeometry',{args:[4,4]}),
   React.createElement(ToonMaterial,{color:'#ffffff'})));
}
createRoot(document.getElementById('root')).render(
 React.createElement(Canvas,{frameloop:'never',dpr:1,camera:{position:[0,0,5]}},
  React.createElement(World)));
</script>`;

test(
  "equipping the flashlight reuses compiled world lighting programs",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    const page = await session.newPage();
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
    await page.route("**/flashlight-smoke", async (route) =>
      route.fulfill({
        contentType: "text/html",
        body: await server.transformIndexHtml("/flashlight-smoke", fixture),
      }),
    );
    await page.goto(server.resolvedUrls.local[0] + "flashlight-smoke");
    await page.waitForFunction(() => window.flashlightProbe);
    const render = () =>
      page.evaluate(() => {
        const { gl, scene, camera } = window.flashlightProbe;
        gl.render(scene, camera);
        return {
          programs: window.spotlightPrograms,
          intensities: scene
            .getObjectsByProperty("isSpotLight", true)
            .map((light) => light.intensity),
        };
      });
    const before = await render();
    assert.ok(before.programs > 0, "compile a world program with the inactive spotlight present");
    assert.deepEqual(before.intensities, [0]);
    for (const active of [true, false]) {
      await page.evaluate((value) => window.flashlightProbe.setActive(value), active);
      await page.waitForFunction((value) => window.flashlightProbe.active === value, active);
      const after = await render();
      assert.deepEqual(after.intensities, [active ? 48 : 0]);
      assert.equal(
        after.programs,
        before.programs,
        "toggling the beam must not link another shader",
      );
    }
    assert.deepEqual(errors, []);
  }),
);
