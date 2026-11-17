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

test(
  "a dashboard removed before layout releases its unclaimed WebGL context",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    try {
      const page = await session.newPage();
      const hidden = `<div id="root" style="display:none"></div><script type="module">
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {DashboardCanvas} from '/@fs/${process.cwd()}/packages/engine/src/DashboardCanvas.tsx';
        const root = createRoot(document.querySelector('#root'));
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...options) {
          const context = getContext.call(this, type, ...options);
          if (type === 'webgl2' && this.closest('#root')) window.dashboardContext = context;
          return context;
        };
        window.removeDashboard = () => root.unmount();
        root.render(React.createElement(React.StrictMode, null,
          React.createElement(DashboardCanvas, {antialias: true, onCreated: () => {window.claimed = true}})));
      </script>`;
      const html = await server.transformIndexHtml("/__dashboard-hidden", hidden);
      await page.route("**/__dashboard-hidden", (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
      );
      await page.goto(server.resolvedUrls.local[0] + "__dashboard-hidden");
      await page.waitForFunction(() => !!window.dashboardContext);
      assert.deepEqual(
        await page.evaluate(() => {
          const state = {
            claimed: !!window.claimed,
            lost: window.dashboardContext.isContextLost(),
          };
          window.removeDashboard();
          return state;
        }),
        { claimed: false, lost: false },
      );
      await page.waitForFunction(() => window.dashboardContext.isContextLost());
    } finally {
      await session.close();
    }
  }),
);

test(
  "dashboard readiness follows the populated composited frame or a visible WebGL fallback",
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    try {
      const page = await session.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const startup = `<div id="root" style="width:256px;height:256px"></div><script type="module">
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {DashboardCanvas} from '/@fs/${process.cwd()}/packages/engine/src/DashboardCanvas.tsx';
        import {DashboardSceneReadyContext} from '/@fs/${process.cwd()}/packages/engine/src/DashboardSceneReady.tsx';
        import {StylizedScene} from '/@fs/${process.cwd()}/packages/engine/src/StylizedScene.tsx';
        import {useFrame} from '@react-three/fiber';
        const h=React.createElement;
        window.frames=0;window.presented=[];
        function Probe(){
          useFrame(({gl})=>{
            if(location.search==='?frame-error')gl.render=()=>{throw Error('first draw failed')};
          },-1);
          useFrame(()=>{window.frames++},2);
          return null;
        }
        const ready=()=>{
          const canvas=document.querySelector('canvas');
          if(!canvas){window.presented.push(document.querySelector('[role=alert]')?.textContent);return;}
          const gl=canvas.getContext('webgl2'),pixel=new Uint8Array(4);
          gl.readPixels(128,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
          window.presented.push(Array.from(pixel));
        };
        function Home(){
          const [populated,set]=React.useState(false);window.populate=set;
          return h(DashboardSceneReadyContext.Provider,{value:ready},
            h(DashboardCanvas,{antialias:true,dpr:1,frameloop:'demand',camera:{position:[0,0,5]}},
              h(StylizedScene,{onFirstFrame:ready},h(Probe),populated&&
                h('group',{name:'architecture-scene'},h('mesh',{},h('boxGeometry',{args:[2,2,1]}),
                  h('meshBasicMaterial',{color:'#ee5533'}))))));
        }
        createRoot(document.querySelector('#root')).render(h(React.StrictMode,null,h(Home)));
      </script>`;
      const html = await server.transformIndexHtml("/__dashboard-ready", startup);
      await page.route("**/__dashboard-ready", (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
      );
      await page.goto(server.resolvedUrls.local[0] + "__dashboard-ready");
      await page.waitForFunction(() => window.frames > 0);
      assert.deepEqual(await page.evaluate(() => window.presented), []);
      await page.evaluate(() => window.populate(true));
      await page.waitForFunction(() => window.presented.length === 1);
      const pixel = await page.evaluate(() => window.presented[0]);
      assert.ok(pixel[0] > pixel[1] + 25 && pixel[3] === 255, JSON.stringify(pixel));
      const settled = await page.evaluate(() => {
        window.populate(false);
        return window.frames;
      });
      await page.waitForFunction((count) => window.frames > count, settled);
      assert.equal(await page.evaluate(() => window.presented.length), 1);
      await page.route("**/__dashboard-ready?frame-error", (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
      );
      await page.goto(server.resolvedUrls.local[0] + "__dashboard-ready?frame-error");
      await page.waitForFunction(() => window.presented?.length === 1);
      assert.match(await page.evaluate(() => window.presented[0]), /3D view/);
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          return type === "webgl2" ? null : original.call(this, type, ...rest);
        };
      });
      await page.goto(server.resolvedUrls.local[0] + "__dashboard-ready");
      await page.waitForFunction(() => window.presented?.length === 1);
      assert.match(await page.getByRole("alert").innerText(), /3D view/);
      assert.match(await page.evaluate(() => window.presented[0]), /3D view/);
      assert.deepEqual(errors, [], "failed renderer initialization does not reject outside React");
    } finally {
      await session.close();
    }
  }),
);
