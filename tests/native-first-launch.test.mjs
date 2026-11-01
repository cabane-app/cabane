import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { testGlb } from "./fixtures/personal-glb.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

const fixture = `<!doctype html><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createMemoryRouter, RouterProvider} from 'react-router';
import {HomeAssistantHostSessionProvider} from '@cabane/engine';
import {WorkspaceApplication} from '/src/workspaces/WorkspaceApplication';
import {initializeWorkspaces} from '/src/workspaces/initialize-workspaces';
import {exportWorkspaceBackup} from '/src/workspaces/workspace-transfer';
const mode = new URLSearchParams(location.search).get('mode');
const {repository} = await initializeWorkspaces(indexedDB, localStorage, {skipLegacyMigration:true});
window.repository=repository;
const requests=[]; window.requests=requests; window.failList=mode==='error';
let saved;
if (mode==='saved' || mode==='error' || mode==='local') {
 const entry=await repository.createBlank('Saved HA home');
 saved={home_id:entry.metadata.id, name:'Saved HA home', version:1, document:exportWorkspaceBackup({...entry.metadata,homeAssistantUrl:location.origin},entry.record)};
 if(mode!=='local') await repository.delete(entry.metadata.id,await repository.readRaw(entry.metadata.id));
 else localStorage.setItem('cabane:last-opened-workspace',entry.metadata.id);
}
if(mode==='dismissed') await repository.dismissOnboarding('welcome');
const connection={connected:mode!=='disconnected',haVersion:'2026.10.0',addEventListener(){},removeEventListener(){},
 get auth(){throw Error('must not read auth')},close(){throw Error('must not close host')},
 async sendMessagePromise(message){requests.push(message.type);
  if(message.type==='cabane/workspaces/list') {if(mode==='timeout')return new Promise(()=>{});if(window.failList)throw Error('Storage unavailable');return saved?[saved]:[];}
  if(message.type==='cabane/workspaces/get')return saved;
  if(message.type.startsWith('config/'))return [];
  throw Error('Unexpected request '+message.type);
 },async subscribeEvents(){return ()=>{}},async subscribeMessage(callback){queueMicrotask(()=>callback({a:{}}));return ()=>{}}
};
Object.defineProperty(connection,"auth",{enumerable:false});
window.open=()=>{throw Error('must not start OAuth')};
window.router=createMemoryRouter([{path:'*',element:React.createElement(WorkspaceApplication)}],{initialEntries:['/']});
const app=React.createElement(RouterProvider,{router:window.router});
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,mode==='standalone'?app:React.createElement(HomeAssistantHostSessionProvider,{session:{connection,origin:location.origin}},app)));
</script>`;

test(
  "native first launch imports a saved home through the real host and preserves it on reload",
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    let browser;
    try {
      browser = await createBrowserTestSession();
      const open = async (mode) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        if (mode === "timeout") await page.clock.install();
        await page.route(
          (url) => url.pathname === "/native-first-launch",
          async (route) =>
            route.fulfill({
              contentType: "text/html",
              body: await server.transformIndexHtml("/native-first-launch", fixture),
            }),
        );
        await page.goto(server.resolvedUrls.local[0] + "native-first-launch?mode=" + mode, {
          waitUntil: "domcontentloaded",
        });
        return page;
      };
      const saved = await open("saved");
      await saved
        .getByRole("heading", { name: "Import a workspace", exact: true })
        .waitFor({ timeout: 15000 });
      await saved.getByText("Saved HA home", { exact: true }).waitFor();
      assert.equal(
        await saved.getByRole("button", { name: "Create a new home", exact: true }).count(),
        1,
      );
      assert.equal(
        await saved.getByRole("button", { name: "Explore the demo", exact: true }).count(),
        1,
      );
      await saved.getByRole("button", { name: "Open", exact: true }).click();
      await saved.getByRole("button", { name: /Workspaces: Saved HA home/ }).waitFor();
      assert.equal(await saved.getByRole("dialog").count(), 0);
      assert.equal(
        (await saved.evaluate(() => window.requests)).some(
          (type) => type === "call_service" || type === "cabane/workspaces/put",
        ),
        false,
      );
      await saved.reload();
      await saved.waitForFunction(() =>
        window.router?.state.location.pathname.startsWith("/workspaces/"),
      );
      assert.equal(
        await saved.getByRole("heading", { name: "Import a workspace", exact: true }).count(),
        0,
      );
      await saved.context().close();
    } finally {
      await browser?.close();
    }
  }),
);

// A non-loopback HTTP origin exposes actual browser capability restrictions.
test(
  "native HTTP supports UUIDs, SHA-256 and IndexedDB model storage",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer();
    const browser = await createBrowserTestSession();
    try {
      const page = await browser.newPage();
      await page.route("http://homeassistant.local:8123/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/native-first-launch") {
          await route.fulfill({
            contentType: "text/html",
            body: "<!doctype html><title>HTTP capabilities</title>",
          });
        } else {
          const response = await route.fetch({
            url: new URL(url.pathname + url.search, server.resolvedUrls.local[0]).href,
          });
          await route.fulfill({ response });
        }
      });
      await page.goto("http://homeassistant.local:8123/native-first-launch?mode=saved");

      const result = await page.evaluate(async (glb) => {
        const { sha256Hex } = await import("/packages/engine/src/sha256-digest.ts");
        const { createBrowserUuid } = await import("/packages/engine/src/browser-uuid.ts");
        const { borrowedHomeAssistantTransportError } =
          await import("/packages/engine/src/home-assistant-auth.ts");
        const { createModelAssetRepository } =
          await import("/packages/engine/src/imported-models/asset-storage.ts");
        const bytes = new Uint8Array(glb);
        const sha256 = await sha256Hex(bytes);
        const repository = createModelAssetRepository(indexedDB);
        await repository.restore([{ bytes, sha256, byteLength: bytes.length }]);
        return {
          secure: isSecureContext,
          subtle: typeof crypto.subtle,
          uuid: typeof crypto.randomUUID,
          generated: createBrowserUuid(),
          digest: await sha256Hex(new TextEncoder().encode("abc")),
          stored: Array.from(await repository.read(sha256)),
          expected: Array.from(bytes),
          transportError: borrowedHomeAssistantTransportError(location.href, location.origin),
        };
      }, Array.from(testGlb()));
      assert.equal(result.secure, false);
      assert.equal(result.subtle, "undefined");
      assert.equal(result.uuid, "undefined");
      assert.equal(
        result.digest,
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      );
      assert.match(result.generated, /^[a-f0-9-]{14}4[a-f0-9-]{21}$/);
      assert.deepEqual(result.stored, result.expected);
      assert.equal(result.transportError, null);
    } finally {
      await browser.close();
    }
  }),
);
