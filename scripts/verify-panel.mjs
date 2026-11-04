import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("../", import.meta.url));
const bundle = resolve(root, process.env.CABANE_PANEL_BUNDLE ?? "apps/web/dist-panel");
const manifest = JSON.parse(await readFile(resolve(bundle, "manifest.json"), "utf8"));
for (const name of Object.keys(manifest.files).filter((name) => name.endsWith(".js"))) {
  const source = await readFile(resolve(bundle, name), "utf8");
  assert.ok(
    !/data:image\/[^;,]+;base64,[A-Za-z0-9+/=]{8192}/.test(source),
    `${name}: large imported images must remain separate assets, outside JavaScript`,
  );
}
// The documented weather texture is pinned; its CDN redirects to the same GitHub asset.
const hostedAssets = new Set([
  "https://rawcdn.githack.com/pmndrs/drei-assets/9225a9f1fbd449d9411125c2f419b843d0308c9f/cloud.png",
  "https://raw.githubusercontent.com/pmndrs/drei-assets/9225a9f1fbd449d9411125c2f419b843d0308c9f/cloud.png",
]);
const mime = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://fixture").pathname;
    if (path === "/cabane" || path === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(await readFile(resolve(root, "tests/fixtures/native-panel-host.html")));
      return;
    }
    if (!path.startsWith("/fixture-assets/deep/revision/")) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(bundle, path.slice("/fixture-assets/deep/revision/".length));
    if (!file.startsWith(bundle + sep)) {
      res.writeHead(403).end();
      return;
    }
    res.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  channel: "chromium",
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [],
  requests = [];
page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
page.on("request", (request) => requests.push(request.url()));
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});
async function assertPanelBounds() {
  await page.waitForFunction(
    () => {
      const panel = document.querySelector("cabane-panel");
      const rect = panel.getBoundingClientRect();
      const host = panel.parentElement;
      const hostRect = host.getBoundingClientRect();
      const style = getComputedStyle(host);
      const content = panel.shadowRoot.querySelector(".panel-content").getBoundingClientRect();
      return (
        content.height > 100 &&
        Math.abs(rect.left - hostRect.left) < 1 &&
        Math.abs(rect.width - hostRect.width) < 1 &&
        Math.abs(rect.top - hostRect.top - parseFloat(style.paddingTop)) < 1 &&
        Math.abs(rect.bottom - (innerHeight - parseFloat(style.paddingBottom))) < 1 &&
        Math.abs(content.bottom - rect.bottom) < 1
      );
    },
    null,
    { timeout: 10000 },
  );
}
try {
  await page.goto(`${origin}/cabane?host=kept`);
  await page.waitForFunction(() => window.__hostFixture);
  await assertPanelBounds();
  await page.getByRole("button", { name: "Build my home" }).waitFor({ timeout: 60000 });
  assert.ok(
    await page.evaluate(() =>
      window.__hostFixture.stats.requests.every((type) => type === "cabane/workspaces/list"),
    ),
    "first launch may list saved homes but must not read host registries",
  );
  await page.getByRole("button", { name: "Open Home Assistant menu" }).click();
  assert.equal(await page.evaluate(() => window.__hostFixture.stats.menus), 1);
  await page.getByRole("button", { name: "Build my home" }).click();
  await page.getByRole("button", { name: /Workspaces:/ }).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: /Workspaces:/ }).click();
  await page.getByRole("heading", { name: "Your workspaces" }).waitFor();
  await page.getByRole("button", { name: "Import workspace", exact: true }).click();
  await page.getByRole("button", { name: "From Home Assistant", exact: true }).click();
  await page.getByText("No Cabane workspaces saved on this HA instance.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Sign in to Home Assistant" }).count(), 0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(page.url(), `${origin}/cabane?host=kept`);
  await page.getByRole("button", { name: "New workspace", exact: true }).click();
  await page.getByLabel("Workspace name").fill("Native fixture home");
  await page.getByRole("button", { name: "Create workspace", exact: true }).click();
  await page.getByRole("button", { name: /Workspaces: Native fixture home/ }).waitFor();
  await page.getByRole("button", { name: /Workspaces: Native fixture home/ }).click();
  // Exercise the installed panel's real error UI with a newer synthetic copy.
  await page.evaluate(async () => {
    const records = await new Promise((done, reject) => {
      const open = indexedDB.open("cabane-projects-v2");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const request = db.transaction("home-projects").objectStore("home-projects").getAll();
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
        request.onsuccess = () => {
          db.close();
          done(request.result.map((raw) => JSON.parse(raw)));
        };
      };
    });
    const record = records.find((entry) => entry.draft.home.name === "Native fixture home");
    record.homeId = "future-format-home";
    record.draft.home.id = record.homeId;
    record.published.home.id = record.homeId;
    record.draft.floors[0].futureArchitecture = { enabled: true };
    await window.__hostFixture.connection.sendMessagePromise({
      type: "cabane/workspaces/put",
      home_id: record.homeId,
      document: JSON.stringify({
        format: "cabane-workspace",
        version: 1,
        workspace: { name: "Future home", homeAssistantUrl: location.origin, hasPublished: false },
        record,
      }),
    });
  });
  await page.getByRole("button", { name: "Import workspace", exact: true }).click();
  await page.getByRole("button", { name: "From Home Assistant", exact: true }).click();
  await page
    .locator(".workspace-ha-library")
    .getByRole("button", { name: "Open", exact: true })
    .click();
  const upgrade = page.locator(".workspace-ha-library [role=alert]");
  await upgrade.waitFor();
  assert.match(await upgrade.innerText(), /newer version of Cabane/);
  assert.match(await upgrade.innerText(), /HACS, restart Home Assistant/);
  assert.match(await upgrade.innerText(), /reload your browser or Companion app/);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const card = page
    .locator(".workspace-card")
    .filter({ has: page.getByRole("button", { name: "Open Native fixture home", exact: true }) });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "Home Assistant settings", exact: true }).click();
  await page.getByRole("button", { name: "Use this Home Assistant", exact: true }).click();
  await page.getByText("Connected", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Enable sync", exact: true }).click();
  await page.getByText("Synced with HA", { exact: true }).waitFor();
  await page.getByText("Open Cabane in your Home Assistant sidebar", { exact: false }).waitFor();
  const before = await page.evaluate(() => window.__hostFixture.stats.activeRegistrySubscriptions);
  await page.evaluate(() => {
    for (let i = 0; i < 10; i++) window.__hostFixture.repeat();
  });
  assert.equal(
    await page.evaluate(() => window.__hostFixture.stats.activeRegistrySubscriptions),
    before,
  );
  await page.evaluate(() => window.__hostFixture.disconnect());
  await page.getByText("Connecting…", { exact: true }).waitFor();
  await page.evaluate(() => window.__hostFixture.reconnect());
  await page.getByText("Connected", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Disconnect workspace", exact: true }).click();
  await page.getByRole("button", { name: "Use this Home Assistant", exact: true }).waitFor();
  for (let remount = 0; remount < Number(process.env.CABANE_PANEL_REMOUNTS ?? 3); remount++) {
    await page.evaluate(() => window.__hostFixture.away());
    assert.equal(
      await page.evaluate(() => window.__hostFixture.stats.activeRegistrySubscriptions),
      0,
    );
    await page.evaluate(() => window.__hostFixture.back());
    await page
      .getByRole("button", { name: /Workspaces: Native fixture home/ })
      .waitFor({ timeout: 30000 });
    // Let the canvas commit and its effects attach before the next disconnect.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  }
  assert.equal(page.url(), `${origin}/cabane?host=kept`);
  assert.equal(await page.evaluate(() => window.__hostFixture.stats.close), 0);
  assert.equal(await page.evaluate(() => window.__hostFixture.stats.popup), 0);
  assert.equal(await page.evaluate(() => window.__hostFixture.stats.authAccess), 0);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).position), "static");
  const unexpectedRequests = requests.filter(
    (url) => new URL(url).origin !== origin && !hostedAssets.has(url),
  );
  assert.deepEqual(unexpectedRequests, [], `unexpected external requests: ${unexpectedRequests}`);
  assert.equal(
    requests.some((url) => url.includes("/_vercel/")),
    false,
  );
  assert.ok(requests.some((url) => url.endsWith("cabane-fonts.css")));
  assert.ok(
    requests.some((url) => url.includes("/assets/HomeEditor-")),
    "lazy editor chunk must load at the nested asset URL",
  );
  assert.deepEqual(errors, []);
  await mkdir(resolve(root, "screenshots/native-panel"), { recursive: true });
  await page.screenshot({ path: resolve(root, "screenshots/native-panel/desktop.png") });
  await page.setViewportSize({ width: 950, height: 900 });
  await assertPanelBounds();
  assert.equal(
    await page.locator("cabane-panel").evaluate((element) => element.getBoundingClientRect().width),
    750,
  );
  assert.equal(
    await page.locator(".build-tutorial").evaluate((element) => getComputedStyle(element).position),
    "static",
    "750px panel must use narrow layout inside a 950px host",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await assertPanelBounds();
  await page.screenshot({ path: resolve(root, "screenshots/native-panel/mobile.png") });
  await page.setViewportSize({ width: 844, height: 390 });
  await assertPanelBounds();
  console.log(
    "Native panel browser fixture passed: demo isolation, host menu, editor, memory routing, HA import, storage save, reconnect, detach/remount, local assets, no OAuth/host close.",
  );
} catch (error) {
  console.error("Page errors:", errors);
  console.error("Visible controls:", await page.getByRole("button").allTextContents());
  await mkdir(resolve(root, "screenshots/native-panel"), { recursive: true });
  await page.screenshot({ path: resolve(root, "screenshots/native-panel/failure.png") });
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
