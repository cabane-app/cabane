import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

// The real file input, browser raster decoder and canvas export cannot be covered in JSDOM.
const fixture = `<html><body><div id="root" class="construction-inspector"></div>
<script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {neutralDemoManifest} from '@cabane/engine';
import {useConstructEditor} from '/src/editor-preview/construct/useConstructEditor.ts';
import {WallFinishFields} from '/src/editor-preview/construct/WallFinishFields.tsx';
import '/src/home-editor.css';
const floor=structuredClone(neutralDemoManifest.floors[0]);
const id=floor.walls[0].id;
function Fixture(){
  const editor=useConstructEditor(floor);
  React.useEffect(()=>{editor.selectWall(id);},[]);
  React.useEffect(()=>{window.wallImageProbe=editor.previewFloor.walls.find(w=>w.id===id);});
  return React.createElement(WallFinishFields,{editor,wall:editor.draft.walls.find(w=>w.id===id),isExterior:true});
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
</script></body></html>`;

test(
  "wall image file picker prepares a raster and preserves it after a rejected replacement",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    const page = await session.newPage();
    try {
      const html = await server.transformIndexHtml("/__wall-image", fixture);
      await page.route("**/__wall-image", (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
      );
      await page.goto(server.resolvedUrls.local[0] + "__wall-image");
      await page.getByLabel("Interior finish", { exact: true }).selectOption("custom-image");
      const payload = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 120;
        canvas.height = 60;
        const context = canvas.getContext("2d");
        context.fillStyle = "#31748a";
        context.fillRect(0, 0, 120, 60);
        context.fillStyle = "#fff7e8";
        context.fillRect(20, 10, 80, 40);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      const picker = page.getByLabel("Interior image file", { exact: true });
      await picker.setInputFiles({
        name: "Kitchen tile.png",
        mimeType: "image/png",
        buffer: Buffer.from(payload, "base64"),
      });
      await page.getByRole("img", { name: "Interior image preview" }).waitFor();
      const before = await page.evaluate(() =>
        Object.values(window.wallImageProbe.faceFinishes).find((f) => f.pattern === "custom-image"),
      );
      assert.equal(before.image.name, "Kitchen tile.png");
      assert.equal(before.image.width / before.image.height, 2);
      assert.match(before.image.dataUrl, /^data:image\/jpeg;base64,/);
      assert.equal(
        await page.getByLabel("Interior image width", { exact: true }).inputValue(),
        "1.2",
      );
      await picker.setInputFiles({
        name: "unsafe.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      });
      await page.getByRole("alert").waitFor();
      assert.match(
        await page.getByRole("alert").innerText(),
        /Choose a PNG, JPG or WebP.*previous finish is unchanged/,
      );
      const after = await page.evaluate(() =>
        Object.values(window.wallImageProbe.faceFinishes).find((f) => f.pattern === "custom-image"),
      );
      assert.deepEqual(after, before);
      await page.getByLabel("Interior image width", { exact: true }).fill("7");
      await page.getByLabel("Interior image width", { exact: true }).press("Enter");
      await page.getByLabel("Interior finish", { exact: true }).selectOption("square-tile");
      const patterned = await page.evaluate(() =>
        Object.values(window.wallImageProbe.faceFinishes).find((f) => f.pattern === "square-tile"),
      );
      assert.equal(
        patterned.repeatMeters,
        5,
        "switching from a wide image keeps generated patterns within their supported range",
      );
      assert.equal(patterned.image, undefined);
    } finally {
      await session.close();
    }
  }),
);
