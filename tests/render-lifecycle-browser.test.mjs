import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

const fixture = `<div id="root" style="width:256px;height:256px"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {SolarLighting} from '/@fs/${process.cwd()}/packages/engine/src/SceneLighting.tsx';
import {StylizedScene} from '/@fs/${process.cwd()}/packages/engine/src/StylizedScene.tsx';
const h=React.createElement;
function Scene(){
 const [settings,setSettings]=React.useState({mode:'night',shadowMapSize:1024,active:true,antialias:true,lit:false,pbr:false,walkMode:false});
 React.useEffect(()=>{window.changeScene=setSettings},[]);
 useFrame(({gl})=>{
  window.renderer=gl;
  const pixel=new Uint8Array(4);
  const context=gl.getContext();
  context.readPixels(128,128,1,1,context.RGBA,context.UNSIGNED_BYTE,pixel);
  window.frames.push({settings,pixel:Array.from(pixel),error:context.getError()});
 },2);
 return h(StylizedScene,{active:settings.active,antialias:settings.antialias},
  h(SolarLighting,{...settings,reducedMotion:true}),
  h('hemisphereLight',{args:['white','white',2]}),
  h('pointLight',{position:[0,1,3],intensity:settings.lit?2:0}),
  ...[0,2.5].map(x=>h('mesh',{key:x,position:[x,0,0],castShadow:true,receiveShadow:true},
   h('boxGeometry',{args:[2,2,1]}),
   h(settings.pbr?'meshStandardMaterial':'meshToonMaterial',{color:'#ff3333'}))));
}
window.frames=[];
createRoot(document.getElementById('root')).render(h(Canvas,{shadows:'percentage',dpr:1,frameloop:'always',camera:{position:[0,0,5]}},h(Scene)));
</script>`;

test(
  "house surfaces survive lighting and renderer lifecycle transitions",
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    try {
      const page = await session.newPage();
      const html = await server.transformIndexHtml("/__render-lifecycle", fixture);
      await page.route("**/__render-lifecycle", (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
      );
      await page.goto(server.resolvedUrls.local[0] + "__render-lifecycle");
      await page.waitForFunction(() => window.frames?.length >= 3);
      const phases = [
        {},
        { mode: "day" },
        { mode: "night" },
        { lit: true },
        { lit: false },
        { shadowMapSize: 2048 },
        { shadowMapSize: 1024 },
        { active: false },
        { active: true },
        { antialias: false },
        { antialias: true },
        { pbr: true },
        { walkMode: true },
        { walkMode: false },
      ];
      for (const phase of phases) {
        await page.evaluate((phase) => {
          window.frames = [];
          window.changeScene((previous) => ({ ...previous, ...phase }));
        }, phase);
        await page.waitForFunction(
          (phase) =>
            window.frames.length >= 3 &&
            Object.entries(phase).every(
              ([key, value]) => window.frames.at(-1).settings[key] === value,
            ),
          phase,
        );
        const frames = await page.evaluate(() => window.frames);
        for (const frame of frames) {
          assert.equal(frame.error, 0, JSON.stringify(frame));
          assert.ok(frame.pixel[0] > frame.pixel[2] + 20, JSON.stringify(frame));
        }
      }
      await page.evaluate(() => {
        window.renderer.forceContextLoss();
      });
      await page.waitForFunction(() => window.renderer.getContext().isContextLost());
      await page.evaluate(() => {
        window.renderer.domElement.addEventListener(
          "webglcontextrestored",
          () => {
            window.frames = [];
            window.restored = true;
          },
          { once: true },
        );
        window.renderer.forceContextRestore();
      });
      await page.waitForFunction(() => window.restored && window.frames.length >= 3);
      const restored = await page.evaluate(() => window.frames);
      for (const frame of restored) {
        assert.equal(frame.error, 0, JSON.stringify(frame));
        assert.ok(frame.pixel[0] > frame.pixel[2] + 20, JSON.stringify(frame));
      }
    } finally {
      await session.close();
    }
  }),
);
