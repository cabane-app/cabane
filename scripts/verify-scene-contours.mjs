import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright-core";

// Exercise the production fragment shader on a real WebGL2 context, with known
// camera-space depth fields. This catches contour artifacts that TS cannot.
const server = await createServer({
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
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/__contour-test", (route) =>
    route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }),
  );
  await page.goto(`${server.resolvedUrls.local[0]}__contour-test`);
  const results = await page.evaluate(async (root) => {
    const T = await import(`${root}/node_modules/three/build/three.module.js`);
    const { FullScreenQuad } = await import(
      `${root}/node_modules/three/examples/jsm/postprocessing/Pass.js`
    );
    const { contourFragmentShader } = await import(
      `${root}/packages/engine/src/scene-contour-shader.ts`
    );
    const renderer = new T.WebGLRenderer();
    const width = 32;
    const beauty = new T.DataTexture(new Uint8Array(width * width * 4).fill(255), width, width);
    beauty.needsUpdate = true;
    const depth = new T.DataTexture(
      new Float32Array(width * width),
      width,
      width,
      T.RedFormat,
      T.FloatType,
    );
    depth.minFilter = depth.magFilter = T.NearestFilter;
    const target = new T.WebGLRenderTarget(width, width);
    const material = new T.ShaderMaterial({
      uniforms: {
        beauty: { value: beauty },
        sceneDepth: { value: depth },
        texel: { value: new T.Vector2(1 / width, 1 / width) },
        nearPlane: { value: 0.1 },
        farPlane: { value: 100 },
        perspective: { value: true },
        inkStrength: { value: 0.72 },
        ink: { value: new T.Color("#35434c") },
      },
      vertexShader:
        "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: contourFragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new FullScreenQuad(material);
    const run = (field, perspective, inkStrength) => {
      material.uniforms.perspective.value = perspective;
      material.uniforms.inkStrength.value = inkStrength;
      for (let y = 0; y < width; y++)
        for (let x = 0; x < width; x++) {
          const z = field(x, y);
          depth.image.data[y * width + x] = perspective
            ? 100 / 99.9 - 10 / (99.9 * z)
            : (z - 0.1) / 99.9;
        }
      depth.needsUpdate = true;
      renderer.setRenderTarget(target);
      quad.render(renderer);
      const pixels = new Uint8Array(width * width * 4);
      renderer.readRenderTargetPixels(target, 0, 0, width, width, pixels);
      let inked = 0;
      // Exclude clamped image borders from the slope checks.
      for (let y = 2; y < width - 2; y++)
        for (let x = 2; x < width - 2; x++) {
          if (pixels[(y * width + x) * 4] < 245) inked++;
        }
      return inked;
    };
    const result = [true, false].flatMap((perspective) =>
      [0.72, 0.35].map((inkStrength) => ({
        perspective,
        flat: run(() => 4, perspective, inkStrength),
        slope: run((x, y) => 4 + x * 0.03 + y * 0.02, perspective, inkStrength),
        occlusion: run((x) => (x < 16 ? 4 : 10), perspective, inkStrength),
        contact: run((x) => (x < 16 ? 4 : 4.01), perspective, inkStrength),
        nearby: run((x) => (x < 16 ? 4 : 4.2), perspective, inkStrength),
      })),
    );
    quad.dispose();
    material.dispose();
    target.dispose();
    depth.dispose();
    beauty.dispose();
    renderer.dispose();
    return result;
  }, `/@fs${process.cwd()}`);
  assert.deepEqual(errors, [], "WebGL shader errors");
  for (const result of results) {
    assert.equal(result.flat, 0, "Flat surfaces must have no interior lines");
    assert.equal(result.slope, 0, "Slanted surfaces must have no interior lines");
    assert.equal(result.contact, 0, "Nearly coplanar contacts must stay clean");
    assert.equal(result.nearby, 28, "Nearby objects cannot paint halos on their surroundings");
    assert.equal(
      result.occlusion,
      28,
      "Only the visible side of the depth boundary gets a one-pixel contour",
    );
  }
  console.log(
    "GPU contours passed: perspective + orthographic, flat + slanted surfaces, contacts, one-pixel occlusion boundaries.",
  );
} finally {
  await browser?.close();
  await server.close();
}
