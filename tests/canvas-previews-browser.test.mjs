import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

// Reproduce the reported red/blue swap at the browser's WebGL-to-2D boundary.
// The local GPU need not have the affected Firefox backend for this to go red.
const fixture = `<html><body><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ModelThumbnailRenderer,ModelThumbnail} from '/src/editor-preview/furnish/catalog/ModelThumbnailRenderer.tsx';
import {saveWorkspacePreview,readWorkspacePreview} from '/src/workspaces/workspace-presentation.ts';
const original=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(source,...args){
  original.call(this,source,...args);
  if(!(source instanceof HTMLCanvasElement) || !source.getContext('webgl2')) return;
  const image=this.getImageData(0,0,this.canvas.width,this.canvas.height);
  for(let i=0;i<image.data.length;i+=4){
    const red=image.data[i]; image.data[i]=image.data[i+2]; image.data[i+2]=red;
  }
  this.putImageData(image,0,0);
};
const entry={key:'warm-box',kind:'procedural',definition:{bounds:{min:[-.5,-.5,-.5],max:[.5,.5,.5]},
  component:()=>React.createElement('mesh',null,
    React.createElement('boxGeometry'),React.createElement('meshBasicMaterial',{color:'#e67319',toneMapped:false}))}};
function App(){
  const scrollRoot=React.useRef(null);
  return React.createElement(ModelThumbnailRenderer,{enabled:true,scrollRoot},
    React.createElement('div',{ref:scrollRoot,style:{width:160,height:160}},
      React.createElement(ModelThumbnail,{entry,transparent:true,showAdd:false})));
}
const style=document.createElement('style');
style.textContent='.catalog-card__preview,.catalog-card__preview canvas{display:block;width:160px;height:160px}.catalog-thumbnail-renderer{position:fixed;left:-10000px}';
document.head.append(style);
createRoot(document.getElementById('root')).render(React.createElement(App));
window.captureWorkspace=async()=>{
  localStorage.setItem('cabane:workspace-preview:probe','stale-blue-preview');
  const stale=readWorkspacePreview('probe');
  const legacy=localStorage.getItem('cabane:workspace-preview:probe');
  const source=document.createElement('canvas');source.width=800;source.height=600;
  const gl=source.getContext('webgl2',{premultipliedAlpha:true});
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(0,300,800,300);gl.clearColor(.45,.2,.05,.5);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.scissor(0,0,800,300);gl.clearColor(.1,.3,.8,1);gl.clear(gl.COLOR_BUFFER_BIT);
  saveWorkspacePreview('probe',source);
  gl.getExtension('WEBGL_lose_context').loseContext();
  const image=new Image();image.src=readWorkspacePreview('probe');await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  return {stale,legacy,width:canvas.width,height:canvas.height,
    top:[...ctx.getImageData(320,120,1,1).data],bottom:[...ctx.getImageData(320,360,1,1).data]};
};
</script></body></html>`;

test(
  "catalog and workspace previews retain RGBA colors when GPU canvas copies swap red and blue",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    const page = await session.newPage();
    const html = await server.transformIndexHtml("/__canvas-previews", fixture);
    await page.route("**/__canvas-previews", (route) =>
      route.fulfill({ contentType: "text/html", body: html }),
    );
    await page.goto(server.resolvedUrls.local[0] + "__canvas-previews");
    await page.waitForFunction(() => {
      const canvas = document.querySelector(".catalog-card__preview canvas");
      return canvas?.getContext("2d").getImageData(80, 80, 1, 1).data[3] > 0;
    });
    const catalog = await page.evaluate(() => {
      const ctx = document.querySelector(".catalog-card__preview canvas").getContext("2d");
      return {
        center: [...ctx.getImageData(80, 80, 1, 1).data],
        corner: [...ctx.getImageData(0, 0, 1, 1).data],
      };
    });
    const workspace = await page.evaluate(() => window.captureWorkspace());
    assert.ok(catalog.center[0] > catalog.center[2] + 100, JSON.stringify(catalog));
    assert.equal(catalog.corner[3], 0, "catalog cutouts retain transparency");
    assert.equal(workspace.stale, null, "discard previews made by the old copy path");
    assert.equal(workspace.legacy, null, "remove obsolete images from local storage");
    assert.deepEqual([workspace.width, workspace.height], [640, 480]);
    assert.ok(workspace.top[0] > workspace.top[2] + 150, JSON.stringify(workspace));
    assert.ok(Math.abs(workspace.top[3] - 128) <= 1, "retain unpremultiplied half opacity");
    assert.ok(workspace.bottom[2] > workspace.bottom[0] + 150, "keep the image upright");
  }),
);
