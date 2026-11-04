import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { getBrowserTestServer, createBrowserTestSession } from "./browser-test-environment.mjs";

// Browser-only risk: canvas capture must produce readable live video, and hiding
// the dashboard must stop its tracks and remove its parked media element.
const fixture = `<!doctype html><div id="root"></div><script type="module">
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DemoHomeAssistantSession} from '/packages/engine/src/DemoHomeAssistantSession.tsx';
import {useHomeAssistantRuntime} from '/packages/engine/src/HomeAssistantRuntime.tsx';
import {CameraStreamCoordinator} from '/packages/engine/src/CameraStreamCoordinator.tsx';
import {neutralDemoManifest} from '/packages/engine/src/demo.ts';
const manifest=structuredClone(neutralDemoManifest);
manifest.floors[0].rooms[0].devices=[{id:'screen',model:'camera-screen',placement:{at:[1,1],elevationMeters:0,support:{kind:'surface'}},entitySlots:[{id:'feed',compatibleDomains:['camera'],presentation:{label:'Garden camera'},deviceRole:'primary',required:true,cardinality:'one'}]}];
function Probe(){
 const runtime=useHomeAssistantRuntime();const [visible,setVisible]=useState(true);
 const entityId=Object.keys(runtime.entityStates).find(id=>id.startsWith('camera.'));
 const requirements=React.useMemo(()=>[{entityId,available:true,posterUrl:null}],[entityId]);
 return React.createElement(CameraStreamCoordinator,{requirements,client:runtime.cameraClient,origin:runtime.origin,documentVisible:visible},streams=>{
   window.media=streams[entityId]; window.hide=()=>setVisible(false);
   return React.createElement('output',null,streams[entityId]?.state);
 });
}
createRoot(document.getElementById('root')).render(React.createElement(DemoHomeAssistantSession,{manifest,night:false,children:()=>React.createElement(Probe)}));
</script>`;

test(
  "demo camera plays locally with readable frames and releases media when hidden",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const browser = await createBrowserTestSession();
    try {
      const page = await browser.newPage();
      await page.route("**/demo-camera-fixture", async (route) =>
        route.fulfill({
          contentType: "text/html",
          body: await server.transformIndexHtml(
            "/demo-camera-fixture",
            fixture.replaceAll("from '/packages/", `from '/@fs/${process.cwd()}/packages/`),
          ),
        }),
      );
      const external = [];
      page.on("request", (request) => {
        if (new URL(request.url()).origin !== new URL(server.resolvedUrls.local[0]).origin)
          external.push(request.url());
      });
      await page.goto(`${server.resolvedUrls.local[0]}demo-camera-fixture`);
      const failed = new Promise((_, reject) =>
        page.once("pageerror", (error) => reject(new Error(`${error.name}: ${error.message}`))),
      );
      await Promise.race([page.waitForFunction(() => window.media?.state === "playing"), failed]);
      const result = await page.evaluate(() => {
        const { video, transport, previewState } = window.media;
        window.track = video.srcObject.getVideoTracks()[0];
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, 1, 1);
        return {
          transport,
          previewState,
          width: video.videoWidth,
          readable: context.getImageData(0, 0, 1, 1).data[3] > 0,
        };
      });
      assert.deepEqual(result, {
        transport: "local",
        previewState: "live",
        width: 640,
        readable: true,
      });
      await page.evaluate(() => window.hide());
      await page.waitForFunction(
        () => window.track.readyState === "ended" && !document.querySelector("video"),
      );
      assert.deepEqual(external, []);
    } finally {
      await browser.close();
    }
  }),
);
