import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { getBrowserTestServer, createBrowserTestSession } from "./browser-test-environment.mjs";
import { testGlb } from "./fixtures/personal-glb.mjs";

// Browser-only risk: one Object3D must stay parented to the same scene while
// editor tools change. Node tests own saving, recovery, forms and connection matrices.
test(
  "Model Editor keeps one canvas, GLB parent and material owner across tools",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer("app");
    const session = await createBrowserTestSession();
    try {
      const page = await session.newPage({ viewport: { width: 1280, height: 800 } });
      const errors = [];
      let fiberUrl;
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.url().includes("/@react-three_fiber.js")) fiberUrl = response.url();
      });
      // A blank Vite page avoids mounting the unrelated home renderer.
      await page.goto(`${server.resolvedUrls.local[0]}@vite/client`);
      await page.evaluate(
        async ({ rootPath, bytes }) => {
          document.body.innerHTML = "";
          const harness = await import(`/@fs${rootPath}/tests/model-editor-harness.tsx`);
          harness.mountModelEditor(bytes);
        },
        { rootPath: process.cwd(), bytes: [...testGlb({ textured: true })] },
      );
      const dialog = page.getByRole("dialog", { name: "Model Editor", exact: true });
      await dialog.getByRole("button", { name: "Add to My models", exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector(".lighting-stage canvas")?.width > 0);
      assert.ok(fiberUrl);
      await page.evaluate(async (fiberUrl) => {
        window.editorRoots = (await import(fiberUrl))._roots;
      }, fiberUrl);
      await page.waitForFunction(() => {
        const canvas = document.querySelector(".lighting-stage canvas");
        const scene = window.editorRoots.get(canvas)?.store.getState().scene;
        let model;
        scene?.traverse((object) => {
          if (object.userData.importedModel) model = object;
        });
        if (!model) return false;
        window.editorEvidence = {
          canvas,
          model,
          parent: model.parent,
          material: model.material,
          geometry: model.geometry,
          texture: model.material.map,
          disposed: 0,
        };
        model.material.addEventListener("dispose", () => window.editorEvidence.disposed++);
        return true;
      });
      for (let index = 0; index < 3; index++) {
        await dialog.getByRole("tab", { name: "Lighting", exact: true }).click();
        if (index === 0) {
          await dialog.getByLabel("Enable lighting", { exact: true }).check();
          await dialog.getByText("Surface list", { exact: true }).click();
          await dialog.locator(".lighting-surfaces input").first().check();
          await dialog.getByLabel("Preview brightness", { exact: true }).press("Home");
          await page.waitForFunction(() => window.editorEvidence.material.emissiveIntensity === 0);
        }
        await dialog.getByRole("tab", { name: "Model", exact: true }).click();
        assert.deepEqual(
          await page.evaluate(() => {
            const e = window.editorEvidence;
            return {
              canvases: document.querySelectorAll("dialog canvas").length,
              canvas: document.querySelector(".lighting-stage canvas") === e.canvas,
              parent: e.model.parent === e.parent,
              mounted: !!e.parent?.parent,
              material: e.model.material === e.material,
              geometry: e.model.geometry === e.geometry,
              texture: e.model.material.map === e.texture,
              disposed: e.disposed,
            };
          }),
          {
            canvases: 1,
            canvas: true,
            parent: true,
            mounted: true,
            material: true,
            geometry: true,
            texture: true,
            disposed: 0,
          },
        );
      }
      await mkdir("test-results/model-editor", { recursive: true });
      await page.screenshot({ path: "test-results/model-editor/desktop.png" });
      await page.setViewportSize({ width: 390, height: 844 });
      await dialog.getByRole("tab", { name: "Lighting", exact: true }).click();
      // Remove ordinary orbit settling from an exact comparison of layout ownership.
      await page.evaluate(() => {
        window.editorRoots
          .get(window.editorEvidence.canvas)
          .store.getState().controls.enableDamping = false;
      });
      const area = await dialog.locator(".lighting-stage").boundingBox();
      await page.mouse.move(area.x + 30, area.y + 35);
      await page.mouse.down({ button: "right" });
      await page.mouse.move(area.x + 45, area.y + 42, { steps: 3 });
      await page.mouse.up({ button: "right" });
      await page.mouse.down();
      await page.mouse.move(area.x + 55, area.y + 47, { steps: 2 });
      await page.mouse.up();
      await page.mouse.wheel(0, 15);
      await page.waitForFunction(() => {
        const state = window.editorRoots.get(window.editorEvidence.canvas).store.getState();
        const next = [...state.camera.position.toArray(), ...state.controls.target.toArray()].map(
          (n) => Number(n.toFixed(5)),
        );
        const key = JSON.stringify(next);
        window.navigationStable =
          window.navigationKey === key ? (window.navigationStable ?? 0) + 1 : 0;
        window.navigationKey = key;
        window.navigationBefore = next;
        return window.navigationStable >= 3;
      });
      await dialog.getByRole("tab", { name: "Model", exact: true }).click();
      await dialog.getByRole("tab", { name: "Lighting", exact: true }).click();
      const navigation = await page.evaluate(() => {
        const state = window.editorRoots.get(window.editorEvidence.canvas).store.getState();
        const after = [...state.camera.position.toArray(), ...state.controls.target.toArray()].map(
          (n) => Number(n.toFixed(5)),
        );
        return { after, before: window.navigationBefore };
      });
      assert.deepEqual(
        navigation.after,
        navigation.before,
        "Switching inspector sections must retain manual orbit/zoom and target",
      );
      await dialog.locator('[role="tabpanel"]:visible').evaluate((node) => {
        node.scrollTop = 0;
      });
      assert.equal(await dialog.getByText("Focus", { exact: true }).isVisible(), true);
      assert.equal(
        await dialog.locator(".lighting-preview-column").evaluate((node) => {
          const slider = node.querySelector('input[type="range"]').getBoundingClientRect();
          return slider.bottom <= node.getBoundingClientRect().bottom + 1;
        }),
        true,
        "Mobile preview controls must remain fully visible",
      );
      await page.screenshot({ path: "test-results/model-editor/mobile.png" });
      assert.equal(await dialog.evaluate((node) => node.scrollWidth > node.clientWidth), false);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByText("Editor closed", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.editorEvidence.disposed), 1);
      assert.deepEqual(errors, []);
    } finally {
      await session.close();
    }
  }),
);
