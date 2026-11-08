import assert from "node:assert/strict";
import test from "node:test";
import {
  BoxGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  PerspectiveCamera,
  Scene,
  PCFShadowMap,
  ShaderMaterial,
} from "three";
import { withModules } from "./test-server.mjs";
await withModules(async (load) => {
  const { ShadowMapCache } = await load("/packages/engine/src/shadow-map-cache.ts");
  const { applyCameraFadeToMesh } = await load("/packages/engine/src/rendering.tsx");
  const { SceneLightWallMask } = await load("/packages/engine/src/scene-light-wall-mask.ts");
  const fixture = () => {
    const scene = new Scene(),
      camera = new PerspectiveCamera(),
      cache = new ShadowMapCache();
    const caster = new Mesh(new BoxGeometry(), new MeshToonMaterial());
    caster.castShadow = true;
    const effect = new Mesh(new BoxGeometry(), new MeshToonMaterial({ transparent: true }));
    const light = new DirectionalLight();
    light.castShadow = true;
    light.position.set(2, 4, 3);
    scene.add(caster, effect, light);
    const dirty = () => {
      scene.updateMatrixWorld();
      return cache.needsUpdate(scene, camera, PCFShadowMap);
    };
    assert.equal(dirty(), true);
    assert.equal(dirty(), false);
    return { scene, camera, caster, effect, light, cache, dirty };
  };
  test("architectural cutaway fading retains shadow inputs through the opacity threshold", () => {
    const f = fixture();
    assert.equal(f.cache.needsUpdate(f.scene, f.camera, PCFShadowMap), false);
    for (const opacity of [1, 0.998, 0.994, 0.5, 0.12, 0.5, 0.994, 0.998, 1]) {
      applyCameraFadeToMesh(f.caster, opacity, true);
      assert.equal(f.caster.castShadow, true);
      assert.equal(f.cache.needsUpdate(f.scene, f.camera, PCFShadowMap), false);
    }
  });
  test("the engine's beauty-only wall-light mask does not invalidate unchanged shadow depth", () => {
    const f = fixture();
    const mask = new SceneLightWallMask();
    try {
      mask.prepareMaterial(f.caster.material);
      assert.equal(f.dirty(), false, "known fragment lighting hooks do not change shadow depth");
      f.caster.position.x++;
      assert.equal(f.dirty(), true);
      assert.equal(f.dirty(), false);
      mask.dispose();
      f.caster.material.onBeforeCompile = () => {};
      mask.prepareMaterial(f.caster.material);
      assert.equal(f.dirty(), true, "authored custom shaders stay conservative under the mask");
      assert.equal(f.dirty(), true);
    } finally {
      mask.dispose();
    }
  });
  test("noncasting animation and opaque tint changes reuse shadows; moving casters and sun refresh immediately", () => {
    const f = fixture();
    f.effect.position.x++;
    f.effect.material.opacity = 0.3;
    f.caster.material.color.set("red");
    f.caster.material.needsUpdate = true; // Visual shader recompilation does not change depth.
    assert.equal(f.dirty(), false);
    for (const change of [
      () => f.caster.position.x++,
      () => f.light.position.y++,
      () => f.light.target.position.z++,
      () => (f.caster.castShadow = false),
      () => (f.caster.castShadow = true),
      () => f.light.shadow.mapSize.set(1024, 1024),
    ]) {
      change();
      assert.equal(f.dirty(), true);
      assert.equal(f.dirty(), false);
    }
  });
  test("membership, parent transforms, visibility, layer changes and context reset invalidate", () => {
    const f = fixture(),
      group = new Group();
    f.scene.add(group);
    group.add(f.caster);
    f.dirty();
    for (const change of [
      () => group.position.y++,
      () => (group.visible = false),
      () => (group.visible = true),
      () => f.camera.layers.set(2),
      () => f.camera.layers.set(0),
      () => f.scene.remove(group),
      () => f.scene.add(group),
      () => f.cache.reset(),
    ]) {
      change();
      assert.equal(f.dirty(), true);
      assert.equal(f.dirty(), false);
    }
  });
  test("geometry edits, alpha cutouts and instance transforms invalidate; ordinary animation does not", () => {
    const f = fixture();
    for (const change of [
      () => (f.caster.geometry.attributes.position.needsUpdate = true),
      () => (f.caster.material.alphaTest = 0.5),
      () => (f.caster.material.opacity = 0.2),
      () => f.caster.geometry.setDrawRange(0, 3),
    ]) {
      change();
      assert.equal(f.dirty(), true);
      assert.equal(f.dirty(), false);
    }
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshToonMaterial(), 2);
    mesh.castShadow = true;
    f.scene.add(mesh);
    assert.equal(f.dirty(), true);
    assert.equal(f.dirty(), false);
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(1, 0, 0));
    mesh.instanceMatrix.needsUpdate = true;
    assert.equal(f.dirty(), true);
    assert.equal(f.dirty(), false);
  });
  test("custom shader, deformation and render hooks conservatively redraw on every frame", () => {
    for (const change of [
      (f) => (f.caster.material = new ShaderMaterial()),
      (f) => (f.caster.onBeforeShadow = () => {}),
      (f) => (f.effect.onBeforeRender = () => {}),
      (f) => (f.caster.morphTargetInfluences = [0.1]),
    ]) {
      const f = fixture();
      change(f);
      assert.equal(f.dirty(), true);
      assert.equal(f.dirty(), true);
    }
  });
  test("leaving a custom deformation refreshes the last custom shadow", () => {
    const f = fixture();
    f.caster.morphTargetInfluences = [0.2];
    assert.equal(f.dirty(), true);
    f.caster.morphTargetInfluences[0] = 0;
    assert.equal(f.dirty(), true);
    assert.equal(f.dirty(), false);
  });
  test("render restores renderer settings after failure and forces a fresh map on retry", () => {
    const f = fixture();
    f.cache.reset();
    let fail = true;
    const renderer = {
      shadowMap: { enabled: true, autoUpdate: true, type: PCFShadowMap, needsUpdate: false },
      localClippingEnabled: false,
      clippingPlanes: [],
      render() {
        assert.equal(this.shadowMap.autoUpdate, false);
        assert.equal(this.shadowMap.needsUpdate, true);
        if (fail) throw Error("lost context");
        this.shadowMap.needsUpdate = false;
      },
    };
    assert.throws(() => f.cache.render(renderer, f.scene, f.camera), /lost context/);
    assert.equal(renderer.shadowMap.autoUpdate, true);
    assert.equal(f.scene.matrixWorldAutoUpdate, true);
    fail = false;
    f.cache.render(renderer, f.scene, f.camera);
    assert.equal(renderer.shadowMap.autoUpdate, true);
  });
});
