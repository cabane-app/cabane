import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { act, create } from "@react-three/test-renderer";
import { Texture, TextureLoader, SRGBColorSpace, Box3, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { FramedWallArt } = await load(
    "/packages/catalog/src/furnishing/presets/decor/framed-wall-art.tsx",
  );
  test("bundled prints share one texture and retain its upload identity across floor remounts", async (t) => {
    let complete;
    const loader = t.mock.method(TextureLoader.prototype, "load", (_src, onLoad) => {
      complete = onLoad;
      return new Texture();
    });
    const print = () => createElement(FramedWallArt, { variant: "atlantic-village" });
    const first = await create(createElement("group", null, print(), print()));
    const texture = new Texture({ width: 1484, height: 1060 });
    const dispose = t.mock.method(texture, "dispose");
    try {
      assert.equal(loader.mock.callCount(), 1);
      await act(async () => complete(texture));
      const prints = first.scene.instance.children.flatMap((child) =>
        child.getObjectsByProperty("name", "framed-art-image"),
      );
      assert.equal(prints.length, 2);
      assert.ok(prints.every((mesh) => mesh.material.map === texture));
      assert.equal(texture.colorSpace, SRGBColorSpace);
      assert.equal(texture.anisotropy, 4);
      assert.equal(texture.flipY, true);
    } finally {
      await first.unmount();
    }
    assert.equal(dispose.mock.callCount(), 0);
    const remounted = await create(print());
    try {
      assert.equal(loader.mock.callCount(), 1);
      assert.equal(
        remounted.scene.instance.getObjectByName("framed-art-image").material.map,
        texture,
      );
    } finally {
      await remounted.unmount();
    }
    assert.equal(dispose.mock.callCount(), 0);
  });
  test("prints retain their aspect ratio when the frame is resized and release their texture", async (t) => {
    let complete;
    t.mock.method(TextureLoader.prototype, "load", (_src, onLoad) => {
      complete = onLoad;
      return new Texture();
    });
    const renderer = await create(
      createElement(FramedWallArt, {
        imageUrl: "/test-print.png",
        size: [1.6, 0.6, 0.04],
      }),
    );
    const texture = new Texture({ width: 1400, height: 1000 });
    const dispose = t.mock.method(texture, "dispose");
    await act(async () => complete(texture));
    const mesh = renderer.scene.instance.getObjectByName("framed-art-image");
    renderer.scene.instance.updateMatrixWorld(true);
    const extent = new Box3().setFromObject(mesh).getSize(new Vector3());
    assert.ok(Math.abs(extent.x / extent.y - 1.4) < 0.00001);
    assert.ok(extent.x <= 1.6 * 0.85 && extent.y <= 0.6 * 0.8 + 0.00001);
    assert.equal(mesh.material.map, texture);
    assert.equal(texture.colorSpace, SRGBColorSpace);
    assert.equal(mesh.material.color.getHexString(), "ffffff");
    await renderer.unmount();
    assert.equal(dispose.mock.callCount(), 1);
  });

  test("failed and stale image loads leave the frame usable without leaking textures", async (t) => {
    const requests = [];
    t.mock.method(TextureLoader.prototype, "load", (src, success, _progress, failure) => {
      requests.push({ src, success, failure });
      return new Texture();
    });
    const renderer = await create(createElement(FramedWallArt, { imageUrl: "/first.png" }));
    await renderer.update(createElement(FramedWallArt, { imageUrl: "/second.png" }));
    const stale = new Texture({ width: 14, height: 10 });
    const dispose = t.mock.method(stale, "dispose");
    await act(async () => {
      requests[0].success(stale);
      requests[1].failure(new Error("Unavailable"));
    });
    assert.equal(dispose.mock.callCount(), 1);
    assert.equal(renderer.scene.instance.getObjectByName("framed-art-image"), undefined);
    assert.ok(renderer.scene.instance.getObjectByName("wall-art-canvas"));
    await renderer.unmount();
  });
});
