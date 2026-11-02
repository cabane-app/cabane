import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

// Browser-only risk: a dense copied lighting setup must compile real toon/PBR
// wall-masked shaders, and retain a bounded shader layout after peak use.
const fixture = `<html><body><div id="root" style="width:640px;height:360px"></div>
<script type="module">
import React from "react";
import {createRoot} from "react-dom/client";
import {Canvas,useThree,useFrame} from "@react-three/fiber";
import {ActiveSceneLightPool} from "/@fs/${process.cwd()}/packages/engine/src/SceneLightPool.tsx";
import {SceneLightWallMask} from "/@fs/${process.cwd()}/packages/engine/src/scene-light-wall-mask.ts";
const h=React.createElement;
const floor={rooms:[],walls:[],openings:[],coordinates:{origin:[0,0],metersPerPlanUnit:1}};
function Scene(){
 const state=useThree();
 const [on,setOn]=React.useState(true);
 const [copies,setCopies]=React.useState(8);
 const [samples,setSamples]=React.useState(7);
 const mask=React.useMemo(()=>new SceneLightWallMask(),[]);
 React.useEffect(()=>()=>mask.dispose(),[mask]);
 React.useEffect(()=>{window.lightPool={state,toggle:()=>setOn(value=>!value),configure:(copies,samples)=>{setCopies(copies);setSamples(samples)}}},[state]);
 useFrame(({gl,scene,camera})=>mask.render(gl,scene,camera),1);
 const sources=Array.from({length:copies},(_,copy)=>Array.from({length:4},(_,i)=>({
   name:copy+"-source-"+i,position:[copy%8-3.5,1+i*.1,Math.floor(copy/8)-2],
   ...(i>1?{strip:{end:[copy%8-2.5,1+i*.1,Math.floor(copy/8)-2],samples}}:{}),
   color:"#ffcc88",intensity:on?1:0,distance:5,
 }))).flat();
 return h(React.Fragment,null,
  h(ActiveSceneLightPool,{floor,sources}),
  ...Array.from({length:20},(_,i)=>h("mesh",{key:i,position:[(i%5-2)*2.2,0,Math.floor(i/5)*2-3]},
    h("boxGeometry",{args:[1.5,.8,1.3]}),h(i%2?"meshToonMaterial":"meshStandardMaterial",{color:"#bba998"}))));
}
createRoot(document.getElementById("root")).render(h(Canvas,{frameloop:"demand",dpr:1,
 camera:{position:[9,9,12],fov:45}},h(Scene)));
</script></body></html>`;

test(
  "dense copied lighting compiles bounded toon/PBR shaders and reuses its peak layout through state changes",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    const page = await session.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      // This isolated test server intentionally has no HMR websocket.
      if (
        message.type() === "error" &&
        !/WebSocket connection|^\[vite\]|^Failed to send error to Vite server/.test(message.text())
      )
        errors.push(message.text());
    });
    try {
      const awaitHtml = await server.transformIndexHtml("/__light-pool", fixture);
      await page.route("**/__light-pool", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: awaitHtml,
        }),
      );
      await page.goto(server.resolvedUrls.local[0] + "__light-pool");
      await page.waitForFunction(() => window.lightPool?.state.gl.info.render.frame > 0);
      const before = await page.evaluate(() => {
        const { gl, scene } = window.lightPool.state;
        const ids = [];
        scene.traverse((object) => {
          if (object.isPointLight) ids.push(object.uuid);
        });
        return {
          ids,
          programs: gl.info.programs.map((program) => program.id),
          runnable: gl.info.programs.every((program) => program.diagnostics?.runnable !== false),
          frame: gl.info.render.frame,
          error: gl.getContext().getError(),
        };
      });
      assert.equal(before.ids.length, 64);
      assert.equal(before.runnable, true);
      assert.equal(before.error, 0);
      await page.evaluate(() => window.lightPool.configure(64, 4294967296));
      await page.waitForFunction(() => {
        let intensity = 0;
        window.lightPool.state.scene.traverse((object) => {
          if (object.isPointLight) intensity += object.intensity;
        });
        return intensity === 256;
      });
      const crowded = await page.evaluate(() => {
        const { gl, scene } = window.lightPool.state;
        const ids = [];
        scene.traverse((object) => {
          if (object.isPointLight) ids.push(object.uuid);
        });
        return {
          ids,
          programs: gl.info.programs.map((program) => program.id),
          frame: gl.info.render.frame,
          error: gl.getContext().getError(),
        };
      });
      assert.deepEqual(crowded.ids, before.ids);
      assert.deepEqual(crowded.programs, before.programs);
      assert.equal(crowded.error, 0);
      await page.evaluate(() => window.lightPool.toggle());
      await page.waitForFunction(
        (frame) => window.lightPool.state.gl.info.render.frame > frame,
        crowded.frame,
      );
      const after = await page.evaluate(() => {
        const { gl, scene } = window.lightPool.state;
        const lights = [];
        scene.traverse((object) => {
          if (object.isPointLight) lights.push(object);
        });
        return {
          ids: lights.map((light) => light.uuid),
          intensity: lights.reduce((sum, light) => sum + light.intensity, 0),
          programs: gl.info.programs.map((program) => program.id),
        };
      });
      assert.deepEqual(after.ids, before.ids);
      assert.deepEqual(after.programs, before.programs);
      assert.equal(after.intensity, 0);
      await page.evaluate(() => {
        window.lightPool.configure(1, 7);
        window.lightPool.toggle();
      });
      await page.waitForFunction(() => {
        let intensity = 0;
        window.lightPool.state.scene.traverse((object) => {
          if (object.isPointLight) intensity += object.intensity;
        });
        return Math.abs(intensity - 4) < 1e-8;
      });
      const reduced = await page.evaluate(() => {
        const { gl, scene } = window.lightPool.state;
        const ids = [];
        scene.traverse((object) => {
          if (object.isPointLight) ids.push(object.uuid);
        });
        return {
          ids,
          programs: gl.info.programs.map((program) => program.id),
          error: gl.getContext().getError(),
        };
      });
      assert.deepEqual(reduced.ids, before.ids);
      assert.deepEqual(reduced.programs, before.programs);
      assert.equal(reduced.error, 0);
      assert.deepEqual(errors, []);
    } finally {
      await session.close();
    }
  }),
);
