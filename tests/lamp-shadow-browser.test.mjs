import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { getBrowserTestServer, createBrowserTestSession } from "./browser-test-environment.mjs";

// Browser-only risk: real lamp geometry must not enclose its native emitter in
// an opaque shadow caster (poles, glass and diffusers used to extinguish lamps).
const fixture = `<html><body><div id="root" style="width:192px;height:192px"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{Canvas,useThree}from'@react-three/fiber';import * as T from 'three';
import{stableDeviceRegistry}from'/@fs/${process.cwd()}/packages/catalog/src/device/index.ts';
import{ActiveSceneLightPool,StylizedScene}from'/@fs/${process.cwd()}/packages/engine/src/index.ts';
import{modelLightEmissions}from'/@fs/${process.cwd()}/packages/engine/src/model-lighting/execution.ts';
const h=React.createElement;const on={state:'on',available:true,stale:false,attributes:{brightness:255}};
function Probe(){const state=useThree();const[id,setId]=React.useState('table-lamp');
 const model=stableDeviceRegistry[id];const lighting=model.lighting;
 const sources=lighting?modelLightEmissions(lighting):[{...model.sceneLight,name:'bulb',intensity:model.sceneLight.maxIntensity}];
 React.useEffect(()=>{window.lamps={state,id,select:setId,T}},[state,id]);
 return h(React.Fragment,null,h('mesh',{rotation:[-Math.PI/2,0,0],receiveShadow:true},h('planeGeometry',{args:[10,10]}),h('meshStandardMaterial',{color:'white'})),
 h('group',{position:[0,1,0]},h(model.component,{state:on,visualState:'connected-active',reducedMotion:true}),h(ActiveSceneLightPool,{key:id,sources})));
}
createRoot(document.getElementById('root')).render(h(Canvas,{shadows:'percentage',frameloop:'never',dpr:1,camera:{position:[0,9,0],up:[0,0,-1],fov:60}},h(StylizedScene,{enabled:false},h(Probe))));
</script></body></html>`;

test(
  "catalog lamps illuminate beyond their own poles, glass and diffusers",
  { timeout: 10000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    const page = await session.newPage();
    const body = await server.transformIndexHtml("/__lamp-shadows", fixture);
    await page.route("**/__lamp-shadows", (route) =>
      route.fulfill({ contentType: "text/html", body }),
    );
    await page.goto(server.resolvedUrls.local[0] + "__lamp-shadows");
    await page.waitForFunction(() => window.lamps);
    for (const [id, point] of [
      ["table-lamp", [0.7, 0, 0]],
      ["floor-lamp", [1.6, 0, 0]],
      ["ceiling-light", [0.7, 0, 0]],
      ["recessed-downlight", [0.7, 0, 0]],
      ["smoked-globe-wall-light", [0.7, 0, 0.5]],
      ["wall-sconce", [0.7, 0, 0.5]],
      ["under-cabinet-led-strip", [0.3, 0, 0]],
    ]) {
      await page.evaluate((id) => window.lamps.select(id), id);
      await page.waitForFunction((id) => window.lamps.id === id, id);
      const result = await page.evaluate((point) => {
        const { state, T } = window.lamps;
        const { gl, scene, camera } = state;
        const target = new T.WebGLRenderTarget(192, 192);
        const lights = [];
        scene.traverse((o) => {
          if (o.isPointLight) lights.push(o);
        });
        // The atlas updates one lamp per frame, including each strip emitter.
        for (const _light of lights) state.advance(performance.now());
        const pixel = () => {
          gl.setRenderTarget(target);
          state.advance(performance.now());
          const p = new T.Vector3(...point).project(camera),
            bytes = new Uint8Array(4);
          gl.readRenderTargetPixels(
            target,
            Math.floor((p.x + 1) * 96),
            Math.floor((p.y + 1) * 96),
            1,
            1,
            bytes,
          );
          return bytes[0];
        };
        const on = pixel();
        for (const light of lights) light.intensity = 0;
        const off = pixel();
        gl.setRenderTarget(null);
        target.dispose();
        return { on, off, error: gl.getContext().getError() };
      }, point);
      assert.ok(result.on > result.off + 3, `${id}: ${JSON.stringify(result)}`);
      assert.equal(result.error, 0);
    }
    await session.close();
  }),
);
