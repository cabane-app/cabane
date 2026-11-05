import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright-core";
const cacheDir = await mkdtemp(resolve(tmpdir(), "cabane-batching-"));
const server = await createServer({
  cacheDir,
  root: resolve("apps/web"),
  server: { host: "127.0.0.1", port: 0 },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    channel: "chromium",
    headless: true,
    args: ["--use-angle=swiftshader"],
  });
  const page = await browser.newPage();
  await page.clock.setFixedTime(new Date("2026-09-23T12:00:00Z"));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/__batch-test", (route) =>
    route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }),
  );
  await page.goto(`${server.resolvedUrls.local[0]}__batch-test`);
  const transformed = await server.transformRequest(
    `/@fs${process.cwd()}/packages/engine/src/scene-batching/SceneToonBatcher.ts`,
  );
  const threeUrl = transformed.code.match(/from ["']([^"']*three[^"']*)["']/)[1];
  const result = await page.evaluate(
    async ({ root, threeUrl }) => {
      let mainThreadWasm = 0;
      const instantiate = WebAssembly.instantiate;
      WebAssembly.instantiate = (...args) => {
        mainThreadWasm++;
        return instantiate(...args);
      };
      const T = await import(threeUrl);
      const { SceneToonBatcher } = await import(
        `${root}/packages/engine/src/scene-batching/SceneToonBatcher.ts`
      );
      const { SceneGeometryLod } = await import(
        `${root}/packages/engine/src/scene-batching/SceneGeometryLod.ts`
      );
      const { roundedBoxGeometry } = await import(
        `${root}/packages/engine/src/rounded-box/rounded-box-geometry.ts`
      );
      const renderer = new T.WebGLRenderer();
      renderer.setSize(128, 128);
      renderer.shadowMap.enabled = true;
      const scene = new T.Scene(),
        camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(5, 4, 7);
      camera.lookAt(0, 0, 0);
      scene.add(new T.AmbientLight(0xffffff, 2));
      const light = new T.DirectionalLight(0xffffff, 3);
      light.position.set(3, 6, 4);
      light.castShadow = true;
      scene.add(light);
      const parent = new T.Group();
      parent.rotation.y = 0.2;
      scene.add(parent);
      for (let i = 0; i < 8; i++) {
        const mesh = new T.Mesh(
          roundedBoxGeometry(0.6, 0.7, 0.6, 0.05, 1, 4, 4, 0.4),
          new T.MeshToonMaterial({ color: i % 2 ? "red" : "blue" }),
        );
        mesh.position.set((i % 4) - 1.5, 0.1, Math.floor(i / 4) - 0.5);
        mesh.castShadow = mesh.receiveShadow = true;
        if (i === 0) {
          const scaled = new T.Group();
          scaled.scale.set(1.2, 1, 0.8);
          mesh.rotation.y = 0.4;
          scaled.add(mesh);
          parent.add(scaled);
        } else parent.add(mesh);
      }
      const floor = new T.Mesh(
        new T.BoxGeometry(6, 0.1, 6),
        new T.MeshToonMaterial({ color: "white" }),
      );
      floor.position.y = -0.4;
      floor.receiveShadow = true;
      scene.add(floor);
      const glass = new T.Mesh(
        new T.BoxGeometry(0.7, 1, 0.7),
        new T.MeshToonMaterial({ color: "green", transparent: true, opacity: 0.3 }),
      );
      glass.position.y = 1;
      parent.children[0].add(glass);
      const sphere = new T.Mesh(
        new T.SphereGeometry(0.7, 48, 32),
        new T.MeshToonMaterial({ color: "yellow" }),
      );
      sphere.position.set(0, 1.2, 0);
      sphere.castShadow = true;
      scene.add(sphere);
      const instances = new T.InstancedMesh(
        new T.SphereGeometry(0.1, 12, 8),
        new T.MeshToonMaterial({ color: "cyan" }),
        5,
      );
      for (let i = 0; i < 5; i++)
        instances.setMatrixAt(i, new T.Matrix4().makeTranslation(i * 0.4 - 1, 1.5, 1));
      instances.castShadow = true;
      scene.add(instances);
      const target = new T.WebGLRenderTarget(128, 128);
      renderer.setRenderTarget(target);
      const batcher = new SceneToonBatcher();
      let pendingUploads = false;
      const render = (batched) => {
        renderer.shadowMap.needsUpdate = true;
        if (batched) pendingUploads = batcher.render(renderer, scene, camera);
        else renderer.render(scene, camera);
        const pixels = new Uint8Array(128 * 128 * 4);
        renderer.readRenderTargetPixels(target, 0, 0, 128, 128, pixels);
        return {
          pixels,
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
        };
      };
      const before = render(false),
        after = render(true);
      let maxDifference = 0,
        changed = 0;
      for (let i = 0; i < before.pixels.length; i++) {
        const delta = Math.abs(before.pixels[i] - after.pixels[i]);
        maxDifference = Math.max(maxDifference, delta);
        if (delta > 1) changed++;
      }
      const lod = new SceneGeometryLod(() => {});
      lod.render(scene, camera, 128, () => {});
      await lod.ready;
      let reduced;
      lod.render(scene, camera, 128, () => {
        reduced = render(true);
      });
      while (pendingUploads) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        lod.render(scene, camera, 128, () => {
          reduced = render(true);
        });
      }
      let lodChanged = 0;
      for (let i = 0; i < before.pixels.length; i += 4) {
        if (
          [0, 1, 2].some(
            (channel) => Math.abs(before.pixels[i + channel] - reduced.pixels[i + channel]) > 8,
          )
        )
          lodChanged++;
      }
      lod.dispose();
      batcher.dispose();
      target.dispose();
      renderer.dispose();
      return {
        before: { calls: before.calls, triangles: before.triangles },
        after: { calls: after.calls, triangles: after.triangles },
        maxDifference,
        changed,
        lodTriangles: reduced.triangles,
        lodChangedFraction: lodChanged / (128 * 128),
        mainThreadWasm,
      };
    },
    { root: `/@fs${process.cwd()}`, threeUrl },
  );
  assert.deepEqual(errors, []);
  assert.equal(result.mainThreadWasm, 0, "LOD WASM must execute only in its worker");
  assert.ok(result.after.calls < result.before.calls, JSON.stringify(result));
  assert.equal(result.after.triangles, result.before.triangles);
  assert.equal(result.changed, 0, JSON.stringify(result));
  assert.ok(result.lodTriangles < result.before.triangles / 2, JSON.stringify(result));
  assert.ok(result.lodChangedFraction < 0.01, JSON.stringify(result));
  console.log(
    "GPU batching preserves colors, nested transforms, transparency and shadows:",
    result,
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
