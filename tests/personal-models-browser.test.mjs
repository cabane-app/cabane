import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { getBrowserTestServer, createBrowserTestSession } from "./browser-test-environment.mjs";
import { testGlb } from "./fixtures/personal-glb.mjs";
import { measureScene } from "../scripts/scene-performance/browser-probe.mjs";

test(
  "textured GLB imports into My models through the real browser",
  { timeout: 60000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    let browser;
    try {
      browser = await createBrowserTestSession();
      const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
      await page.addInitScript(() => {
        Object.defineProperty(crypto, "subtle", { configurable: true, value: undefined });
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const url = server.resolvedUrls.local[0];
      // Seed from the library without rendering the unrelated furnished demo.
      await page.goto(`${url}workspaces`);
      const rootPath = process.cwd();
      const id = await page.evaluate(async (rootPath) => {
        const engine = await import(`/@fs${rootPath}/packages/engine/src/index.ts`);
        const fixture = await import(`/@fs${rootPath}/tests/fixtures/multiple-floors.ts`);
        const registry = await import("/src/project-runtime.ts");
        const repository = engine.createWorkspaceRepository(
          window.indexedDB,
          registry.ownerProjectRegistries,
        );
        const schema = engine.parseHomeProjectSchema(fixture.makeLegacyProject());
        if (!schema.valid) throw new Error(schema.issues[0].message);
        const entry = await repository.create(engine.createSeedProjectRecord(schema.project), {
          name: "Personal GLB test",
        });
        return entry.metadata.id;
      }, rootPath);
      await page.goto(`${url}workspaces/${id}/arrange`);
      await page.getByRole("button", { name: "My models", exact: true }).click();
      // One textured file exercises the real picker, decoder, WebGL preview and
      // model library. Formats/supports/history matrices run in Node.
      const bytes = Buffer.from(testGlb({ textured: true, embedded: true }));
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Import model (.glb file)", exact: true }).click();
      await (
        await chooser
      ).setFiles({ name: "Personal desk.glb", mimeType: "model/gltf-binary", buffer: bytes });
      const dialog = page.getByRole("dialog", { name: "Import GLB", exact: true });
      await dialog.getByText("File details", { exact: true }).click();
      await dialog
        .getByText("Original materials and textures are preserved.", { exact: false })
        .waitFor();
      assert.match(await dialog.innerText(), /Embedded cameras are ignored/);
      await dialog.getByLabel("Name", { exact: true }).fill("Personal desk");
      await dialog.getByLabel("Width", { exact: true }).fill("0.7");
      await dialog.getByRole("button", { name: "Add to My models", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Add Personal desk", exact: true }).waitFor();
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
    }
  }),
);

test(
  "GLB import keeps its tabs and dialog frame when switching to Lighting",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    // Native dialog bounds, CSS sizing and focus navigation need a real browser.
    const { server } = await getBrowserTestServer("app");
    const browser = await createBrowserTestSession();
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
      const url = server.resolvedUrls.local[0];
      await page.goto(`${url}workspaces`);
      const id = await page.evaluate(async (rootPath) => {
        const { createWorkspaceRepository } = await import(
          `/@fs${rootPath}/packages/engine/src/index.ts`
        );
        const { ownerProjectRegistries } = await import("/src/project-runtime.ts");
        const repository = createWorkspaceRepository(window.indexedDB, ownerProjectRegistries);
        return (await repository.createBlank("Import navigation")).metadata.id;
      }, process.cwd());
      await page.goto(`${url}workspaces/${id}/arrange`);
      await page.getByRole("button", { name: "My models", exact: true }).click();
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Import model (.glb file)", exact: true }).click();
      await (
        await chooser
      ).setFiles({
        name: "Poses.glb",
        mimeType: "model/gltf-binary",
        buffer: Buffer.from(testGlb({ poses: true })),
      });
      const dialog = page.getByRole("dialog", { name: "Import GLB", exact: true });
      await dialog.getByRole("tab", { name: "States", exact: true }).waitFor();
      const bounds = await dialog.boundingBox();
      const tabsBounds = await dialog.getByRole("tablist").boundingBox();
      await dialog.getByRole("tab", { name: "Lighting", exact: true }).click();
      await dialog.getByLabel("Enable lighting", { exact: true }).check();
      for (const name of ["Model", "States", "Lighting"]) {
        const tab = dialog.getByRole("tab", { name, exact: true });
        await tab.click();
        assert.equal(await tab.getAttribute("aria-selected"), "true");
        assert.deepEqual(await dialog.boundingBox(), bounds);
        assert.deepEqual(await dialog.getByRole("tablist").boundingBox(), tabsBounds);
        assert.equal(await dialog.getByRole("tab").count(), 3);
      }
      assert.equal(await dialog.getByLabel("Enable lighting", { exact: true }).isChecked(), true);
      for (const name of [
        "Enable lighting",
        "Show handles",
        "Pick through glass",
        "Night preview",
      ]) {
        const checkbox = await dialog.getByRole("checkbox", { name, exact: true }).boundingBox();
        assert.equal(checkbox.width, 18, `${name}: normal checkbox width`);
        assert.equal(checkbox.height, 18, `${name}: normal checkbox height`);
      }
      await dialog.getByRole("tab", { name: "Lighting", exact: true }).press("ArrowLeft");
      const states = dialog.getByRole("tab", { name: "States", exact: true });
      assert.equal(await states.getAttribute("aria-selected"), "true");
      assert.equal(await states.evaluate((element) => element === document.activeElement), true);
    } finally {
      await browser.close();
    }
  }),
);

test(
  "representative personal models render with 20 rooms, 100 simulated bindings and shared textured resources",
  { timeout: 120000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer();
    let browser;
    try {
      browser = await createBrowserTestSession();
      const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
      const errors = [];
      let moduleUrl;
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.url().includes("/@react-three_fiber.js")) moduleUrl = response.url();
      });
      await page.goto(server.resolvedUrls.local[0]);
      await page.evaluate(async () => {
        history.replaceState(null, "", "?stage=scale-personal&scenario=connected");
        document.body.innerHTML = '<div id="root"></div>';
        await import("/tests/agent-harness.tsx");
      });
      await page.locator('html[data-evidence-ready="true"]').waitFor();
      assert.ok(moduleUrl);
      await page.evaluate(async (moduleUrl) => {
        window.personalRoots = (await import(moduleUrl))._roots;
      }, moduleUrl);
      await page.waitForFunction(() => {
        const root = window.personalRoots.get(document.querySelector("canvas"));
        if (!root) return false;
        window.personalScene = root.store.getState().scene;
        return Boolean(window.personalScene);
      });
      await page.waitForFunction(() => {
        let imported = 0;
        window.personalScene.traverse((object) => {
          if (object.userData.importedModel) imported++;
        });
        return imported === 7;
      });
      const inventory = await page.evaluate(() => {
        const meshes = [];
        window.personalScene.traverse((object) => {
          if (object.userData.importedModel) meshes.push(object);
        });
        return {
          count: meshes.length,
          geometries: new Set(meshes.map((mesh) => mesh.geometry)).size,
          materials: new Set(meshes.map((mesh) => mesh.material)).size,
          textures: meshes.filter((mesh) => mesh.material.map).length,
          lights: meshes.filter((mesh) => mesh.material.type === "MeshStandardMaterial").length,
        };
      });
      assert.deepEqual(inventory, {
        count: 7,
        geometries: 3,
        materials: 3,
        textures: 2,
        lights: 5,
      });
      const measurement = await page.evaluate(measureScene, {
        selector: "canvas",
        moduleUrl,
        samples: 3,
        warmupFrames: 3,
      });
      assert.ok(measurement.frames.every((frame) => frame.triangles > 0 && frame.calls > 0));
      await mkdir("test-results/personal-models", { recursive: true });
      await writeFile(
        "test-results/personal-models/scale-scene.json",
        JSON.stringify(measurement, null, 2),
      );
      await page.screenshot({ path: "test-results/personal-models/scale-scene.png" });
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
    }
  }),
);
