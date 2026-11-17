import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

// Browser-only risk: actual shadow pixels through the production render pipeline.
const fixture = `<html><body><div id="root" style="width:256px;height:256px"></div>
<script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useThree} from '@react-three/fiber';
import * as T from 'three';
import {ActiveSceneLightPool} from '/@fs/${process.cwd()}/packages/engine/src/SceneLightPool.tsx';
import {buildContinuousWallGeometry} from '/@fs/${process.cwd()}/packages/engine/src/architecture-geometry/continuous-wall-geometry.ts';
import {applyCameraFadeToMesh} from '/@fs/${process.cwd()}/packages/engine/src/rendering.tsx';
import {StylizedScene} from '/@fs/${process.cwd()}/packages/engine/src/StylizedScene.tsx';
const h=React.createElement;
const floor={coordinates:{origin:[0,0],metersPerPlanUnit:1},defaultWallHeightMeters:3,
 rooms:[{id:'left',polygon:[[-4,-3],[0,-3],[0,3],[-4,3]]}],
 wallJunctions:[],walls:[{id:'divider',from:[0,-3],to:[0,3],thicknessMeters:.1}],openings:[]};
function Probe(){const state=useThree();
 React.useEffect(()=>{window.probe={state,T,floor,buildContinuousWallGeometry,applyCameraFadeToMesh}},[state]);
 return h(ActiveSceneLightPool,{sources:[{name:'lamp',position:[-1,1,0],color:'#ffffff',intensity:5,distance:10}]});}
createRoot(document.getElementById('root')).render(h(Canvas,{shadows:'percentage',frameloop:'never',dpr:1,
 camera:{position:[0,9,0],up:[0,0,-1],fov:60}},h(StylizedScene,{antialias:true},h(Probe))));
</script></body></html>`;

test(
  "solid walls block household light in the actual toon/PBR renderer",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    const page = await session.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const html = await server.transformIndexHtml("/__light-occlusion", fixture);
    await page.route("**/__light-occlusion", (route) =>
      route.fulfill({ contentType: "text/html", body: html }),
    );
    await page.goto(server.resolvedUrls.local[0] + "__light-occlusion");
    await page.waitForFunction(() => window.probe);
    const results = await page.evaluate(() => {
      const { state, T, floor, buildContinuousWallGeometry, applyCameraFadeToMesh } = window.probe;
      const { gl, scene, camera } = state;
      const light = scene.getObjectByName("lamp");
      const target = new T.WebGLRenderTarget(256, 256);
      const wall = new T.Mesh(
        buildContinuousWallGeometry(floor.walls[0], floor, []),
        new T.MeshStandardMaterial({ shadowSide: T.DoubleSide }),
      );
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
      const receiver = new T.Mesh(new T.PlaneGeometry(8, 6), new T.MeshStandardMaterial());
      receiver.rotation.x = -Math.PI / 2;
      receiver.receiveShadow = true;
      scene.add(receiver);
      const pixel = (point, channel = 0) => {
        const p = new T.Vector3(...point);
        p.project(camera);
        const bytes = new Uint8Array(4);
        gl.readRenderTargetPixels(
          target,
          Math.floor((p.x + 1) * 128),
          Math.floor((p.y + 1) * 128),
          1,
          1,
          bytes,
        );
        return bytes[channel];
      };
      const sample = () => {
        gl.setRenderTarget(target);
        state.advance(performance.now());
        return { own: pixel([-2, 0, 0]), behind: pixel([1, 0, 0]) };
      };
      const results = [];
      for (const toon of [false, true]) {
        receiver.material.dispose();
        receiver.material = toon ? new T.MeshToonMaterial() : new T.MeshStandardMaterial();
        for (const x of [-1, -0.3]) {
          light.position.x = x;
          light.intensity = 5;
          const on = sample();
          // These paths leave through different faces of the point shadow.
          const oblique = [
            [1, 0, -2.4],
            [1, 0, 2.4],
          ];
          on.oblique = oblique.map((point) => pixel(point));
          light.intensity = 0;
          const off = sample();
          off.oblique = oblique.map((point) => pixel(point));
          results.push({ toon, x, on, off });
        }
      }
      light.position.x = -1;
      light.intensity = 5;
      const corner = new T.Mesh(
        buildContinuousWallGeometry({ ...floor.walls[0], from: [-4, 1], to: [0, 1] }, floor, []),
        wall.material,
      );
      corner.castShadow = true;
      scene.add(corner);
      const cornerOn = sample();
      cornerOn.behind = pixel([-1, 0, 2]);
      light.intensity = 0;
      const cornerOff = sample();
      cornerOff.behind = pixel([-1, 0, 2]);
      results.push({ name: "corner", on: cornerOn, off: cornerOff, blocked: true });
      scene.remove(corner);
      corner.geometry.dispose();
      camera.position.set(-5, 6, 0);
      camera.lookAt(0, 0, 0);
      light.intensity = 5;
      sample();
      const wallOn = pixel([-0.05, 0.5, 0]);
      light.intensity = 0;
      sample();
      results.push({ wallFacing: true, on: wallOn, off: pixel([-0.05, 0.5, 0]) });
      camera.position.set(0, 9, 0);
      camera.lookAt(0, 0, 0);
      const replaceWall = (spec, openings = []) => {
        wall.geometry.dispose();
        wall.geometry = buildContinuousWallGeometry(spec, floor, openings);
      };
      for (const [name, spec, openings, blocked] of [
        ["thin-wall", { ...floor.walls[0], thicknessMeters: 0.04 }, [], true],
        ["low-partition", { ...floor.walls[0], heightMeters: 0.2 }, [], false],
        ["finite-end", { ...floor.walls[0], from: [0, 1] }, [], false],
        [
          "doorway",
          floor.walls[0],
          [
            {
              wallId: "divider",
              offsetFromWallStartPlanUnits: 2.5,
              widthPlanUnits: 1,
              sillHeightMeters: 0,
              openingHeightMeters: 2,
            },
          ],
          false,
        ],
      ]) {
        replaceWall(spec, openings);
        light.intensity = 5;
        const on = sample();
        light.intensity = 0;
        const off = sample();
        results.push({ name, on, off, blocked });
      }
      const door = new T.Mesh(new T.BoxGeometry(0.08, 2, 1), new T.MeshStandardMaterial());
      door.position.set(0, 1, 0);
      door.castShadow = true;
      scene.add(door);
      for (const open of [false, true]) {
        door.rotation.y = open ? Math.PI / 2 : 0;
        door.position.set(open ? 0.5 : 0, 1, open ? -0.5 : 0);
        // A change while the lamp is off must invalidate its cached shadow.
        const off = sample();
        light.intensity = 5;
        const on = sample();
        light.intensity = 0;
        results.push({ name: "door-" + open, on, off, blocked: !open });
      }
      scene.remove(door);
      door.geometry.dispose();
      door.material.dispose();
      replaceWall(floor.walls[0]);
      applyCameraFadeToMesh(wall, 0.12, true);
      light.intensity = 5;
      const faded = sample();
      light.intensity = 0;
      const dark = sample();
      results.push({ name: "cutaway", on: faded, off: dark, blocked: true });
      applyCameraFadeToMesh(wall, 1, true);
      // Observe actual shadow submissions while a static map is drawn, then
      // make sure orbiting and changing the lamp's colour reuse it.
      let shadowDraws = 0;
      const renderBufferDirect = gl.renderBufferDirect;
      gl.renderBufferDirect = function (...args) {
        if (args[3].isMeshDepthMaterial || args[3].isMeshDistanceMaterial) shadowDraws++;
        return renderBufferDirect.apply(this, args);
      };
      light.position.x = -1.1;
      light.intensity = 5;
      sample();
      const initialShadowDraws = shadowDraws;
      camera.position.x += 0.1;
      camera.lookAt(0, 0, 0);
      light.color.set("#ffeecc");
      light.intensity = 2.5;
      sample();
      results.push({ initialShadowDraws, shadowDraws });
      gl.renderBufferDirect = renderBufferDirect;
      // A custom shadow hook makes this caster dirty every frame. Both powered
      // lights must still get a turn, and each samples its own atlas slot.
      const second = new T.PointLight("blue", 5, 10);
      second.userData.cabaneSceneLight = true;
      second.position.set(1, 1, 0);
      scene.add(second);
      light.color.set("red");
      light.intensity = 5;
      wall.onBeforeShadow = () => {};
      sample();
      sample();
      sample();
      results.push({
        left: [pixel([-2, 0, 0]), pixel([-2, 0, 0], 2)],
        right: [pixel([2, 0, 0]), pixel([2, 0, 0], 2)],
      });
      results.push({ glError: gl.getContext().getError() });
      gl.setRenderTarget(null);
      target.dispose();
      return results;
    });
    for (const result of results) {
      if ("glError" in result) {
        assert.equal(result.glError, 0);
        continue;
      }
      if ("initialShadowDraws" in result) {
        assert.ok(result.initialShadowDraws > 0, JSON.stringify(result));
        assert.equal(result.shadowDraws, result.initialShadowDraws);
        continue;
      }
      if ("left" in result) {
        assert.ok(result.left[0] > 20 && result.left[1] <= 2, JSON.stringify(result));
        assert.ok(result.right[1] > 20 && result.right[0] <= 2, JSON.stringify(result));
        continue;
      }
      if (result.wallFacing) {
        assert.ok(result.on > result.off + 20, JSON.stringify(result));
        continue;
      }
      if (result.blocked === false) {
        assert.ok(result.on.behind > result.off.behind + 10, JSON.stringify(result));
        continue;
      }
      assert.ok(result.on.own > result.off.own + 20, JSON.stringify(result));
      assert.ok(result.on.behind <= result.off.behind + 2, JSON.stringify(result));
      result.on.oblique?.forEach((pixel, index) => {
        assert.ok(pixel <= result.off.oblique[index] + 2, JSON.stringify(result));
      });
    }
    assert.deepEqual(errors, []);
    await session.close();
  }),
);
