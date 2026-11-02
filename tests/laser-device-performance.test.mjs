import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

// Synthetic service state, real gun input, activation resolver and scene lighting.
// Reduced motion isolates the device update from first-use effect shaders.
const fixture = `<!doctype html><style>.cabane-shell .scene-canvas{width:240px;height:180px}</style><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {useFrame,useThree} from '@react-three/fiber';
import {CabaneDashboard,HomeAssistantRuntimeProvider,HomeAssistantSceneLighting,ToonMaterial} from '@cabane/engine';
import {stableArchitectureModelRegistry} from '@cabane/catalog/architecture';
import {laserWalkTool} from '@cabane/walk-laser';
import {neutralDemoManifest} from '/@fs/${process.cwd()}/packages/engine/src/demo.ts';
import {activateWalkTarget} from '/@fs/${process.cwd()}/packages/engine/src/walk-tools/activate-walk-target.ts';
import '@cabane/engine/styles.css';
const manifest=structuredClone(neutralDemoManifest);
manifest.home.walkStart={floorId:manifest.floors[0].id,at:[2.4,1.8]};
const slot={id:'probe',model:'probe',entitySlots:[{id:'power',deviceRole:'primary',compatibleDomains:['light']}]};
const item={id:'probe',floorId:manifest.floors[0].id,kind:'device',modelId:'probe',lightState:'connected',size:[1,1,1],entitySlots:slot.entitySlots,placement:{kind:'absolute',at:[2.4,2.6],elevationMeters:1.52,rotationYRadians:0}};
const models={probe:{bounds:{min:[0,0,0],max:[1,1,1]},sceneLight:{position:[0,0,0],color:'#ffffff',maxIntensity:5,distance:6}}};
function ObservedGun(props) {
 const {gl,scene}=useThree();
 const [on,setOn]=React.useState(false);
 const bindings={rooms:{'demo-room':{sections:{},devices:[{slot,issues:[],entities:[{slotId:'power',domain:'light',issues:[],state:{entityId:'light.test',available:true,stale:false,state:on?'on':'off',attributes:{}}}]}]}},openings:{},issues:[]};
 React.useEffect(()=>{const ctx=gl.getContext(),original=ctx.compileShader;window.compiles=0;
 ctx.compileShader=function(...args){window.compiles++;return original.apply(this,args)};
 return()=>{ctx.compileShader=original};},[gl]);
 useFrame(()=>{
  window.shotFrames=(window.shotFrames??0)+1;window.lightOn=on;
  window.shotEffectsActive=false;
  scene.traverse(object=>{
   if((object.name==='laser-pulse'||object.name==='laser-impact')&&object.visible)window.shotEffectsActive=true;
  });
 });
 return React.createElement(React.Fragment,null,
 React.createElement(laserWalkTool.Scene,{...props,canActivateTarget:()=>true,activateTarget:target=>activateWalkTarget(target,bindings,{canMutate:true,callService:async()=>setOn(value=>!value)})}),
 React.createElement(HomeAssistantSceneLighting,{floor:manifest.floors[0],resolvedBindings:bindings,deviceModels:models,extensionDeviceModels:{},sceneItems:[item]}),
 React.createElement('mesh',{position:[2.4,1.52,2.6],userData:{walkDeviceInteraction:{id:'probe',label:'Probe light'}}},React.createElement('boxGeometry',{args:[.5,.5,.5]}),React.createElement(ToonMaterial,{color:'#ffffff'})));
}
createRoot(document.getElementById('root')).render(React.createElement(HomeAssistantRuntimeProvider,null,React.createElement(CabaneDashboard,{manifest,architectureModels:stableArchitectureModelRegistry,walkTools:[{...laserWalkTool,Scene:ObservedGun}]})));
</script>`;

for (const reducedMotion of ["reduce", "no-preference"])
  test(
    `device shots reuse scene and effect shaders (${reducedMotion})`,
    withBrowserDiagnostics(async () => {
      const { server } = await getBrowserTestServer("app");
      const browser = await createBrowserTestSession();
      const page = await browser.newPage({
        viewport: { width: 800, height: 600 },
        reducedMotion,
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await page.route("**/laser-device-fixture", async (route) =>
          route.fulfill({
            contentType: "text/html",
            body: await server.transformIndexHtml("/laser-device-fixture", fixture),
          }),
        );
        await page.goto(server.resolvedUrls.local[0] + "laser-device-fixture");
        await page.getByRole("button", { name: "Walk mode", exact: true }).click();
        await page.waitForFunction(() => document.pointerLockElement);
        await page.getByRole("button", { name: "Exit walk mode", exact: true }).waitFor();
        await page.keyboard.press("g");
        await page.waitForFunction(() => window.shotFrames > 10 && document.pointerLockElement);
        await page.evaluate(() => {
          window.compiles = 0;
        });
        for (const on of [true, false, true]) {
          await page.keyboard.press("f");
          await page.waitForFunction((on) => window.lightOn === on, on);
          const observed = await page.evaluate(() => ({
            frame: window.shotFrames,
            time: performance.now(),
          }));
          // Wait for rendered effects and the real 300 ms trigger cooldown,
          // without assuming that 45 frames will arrive at 60 Hz.
          await page.waitForFunction(
            ({ frame, time }) =>
              window.shotFrames > frame + 1 &&
              !window.shotEffectsActive &&
              performance.now() - time >= 300,
            observed,
          );
          assert.equal(await page.evaluate(() => window.compiles), 0);
        }
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    }),
  );
