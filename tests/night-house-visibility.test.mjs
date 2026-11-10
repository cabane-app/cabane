import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";
test(
  "house surfaces remain visible when the sun starts dormant",
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    try {
      const page = await session.newPage();
      const html = await server.transformIndexHtml(
        "/__night-house",
        `<div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {Canvas,useThree} from '@react-three/fiber';
import {SolarLighting} from '/@fs/${process.cwd()}/packages/engine/src/SceneLighting.tsx';
function Probe(){const state=useThree();React.useEffect(()=>{window.nightState=state},[state]);return null;}
createRoot(document.getElementById('root')).render(React.createElement(Canvas,{shadows:'percentage',frameloop:'demand'},React.createElement(SolarLighting,{mode:'night',reducedMotion:true,shadowMapSize:1024}),React.createElement(Probe)));
</script>`,
      );
      await page.route("**/__night-house", (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
      );
      await page.goto(server.resolvedUrls.local[0] + "__night-house");
      await page.waitForFunction(() => window.nightState?.gl.info.render.frame > 0);
      const result = await page.evaluate(async (root) => {
        const T = await import(root + "/node_modules/three/build/three.module.js");
        const gl = window.nightState.gl;
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.z = 5;
        const mesh = new T.Mesh(
          new T.BoxGeometry(2, 2, 2),
          new T.MeshToonMaterial({ color: "white" }),
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        scene.add(new T.HemisphereLight(0xffffff, 0xffffff, 2));
        const sun = window.nightState.scene.children.find((object) => object.isDirectionalLight);
        scene.add(sun);
        const target = new T.WebGLRenderTarget(32, 32);
        gl.setRenderTarget(target);
        try {
          gl.render(scene, camera);
          const pixel = new Uint8Array(4);
          gl.readRenderTargetPixels(target, 16, 16, 1, 1, pixel);
          return { pixel: Array.from(pixel), error: gl.getContext().getError() };
        } finally {
          target.dispose();
          gl.dispose();
        }
      }, "/@fs" + process.cwd());
      assert.ok(result.pixel[0] > 30, JSON.stringify(result));
      assert.equal(result.error, 0);
    } finally {
      await session.close();
    }
  }),
);
