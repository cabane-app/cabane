import assert from "node:assert/strict";
import test from "node:test";
import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  PerspectiveCamera,
  Scene,
} from "three";
import { withModules } from "./test-server.mjs";
await withModules(async (load) => {
  const { SceneToonBatcher } = await load(
    "/packages/engine/src/scene-batching/SceneToonBatcher.ts",
  );
  const { registerGeometryLods } = await load(
    "/packages/engine/src/scene-batching/geometry-lod-family.ts",
  );
  const { ScenePointShadows } = await load("/packages/engine/src/scene-point-shadows.ts");
  function fixture(prepareMaterial) {
    const scene = new Scene(),
      camera = new PerspectiveCamera(),
      batcher = new SceneToonBatcher(prepareMaterial);
    const a = new Mesh(new BoxGeometry(), new MeshToonMaterial({ color: "red" }));
    const b = new Mesh(new BoxGeometry(), new MeshToonMaterial({ color: "blue" }));
    const child = new Mesh(
      new BoxGeometry(),
      new MeshToonMaterial({ transparent: true, opacity: 0.5 }),
    );
    a.add(child);
    scene.add(a, b);
    const renderer = {
      info: { render: { frame: 0 } },
      shadowMap: { enabled: false },
      extensions: { has: () => true },
      localClippingEnabled: false,
      clippingPlanes: [],
      render() {},
    };
    return { scene, camera, batcher, a, b, child, renderer };
  }
  test("style shader defines survive batching and switching back", () => {
    const f = fixture();
    const draw = (flat) => {
      for (const mesh of [f.a, f.b]) {
        if (flat) mesh.material.defines.FLAT_SHADED = "";
        else delete mesh.material.defines.FLAT_SHADED;
      }
      f.renderer.render = (scene) => {
        const batch = scene.children.find((object) => object.isBatchedMesh);
        assert.ok(batch);
        assert.equal("FLAT_SHADED" in batch.material.defines, flat);
      };
      f.batcher.render(f.renderer, f.scene, f.camera, () => f.renderer.render(f.scene));
    };
    draw(false);
    draw(true);
    draw(false);
    f.batcher.dispose();
  });
  test("batches colors and transforms while retaining children and restoring originals", () => {
    const f = fixture(),
      original = f.a.material;
    f.a.position.x = 2;
    f.a.layers.mask = f.b.layers.mask = 3;
    let previous;
    f.renderer.render = (scene) => {
      const batch = scene.children.find((object) => object.isBatchedMesh);
      assert.ok(batch);
      assert.equal(f.child.material.visible, true);
      assert.equal(f.child.layers.test(f.camera.layers), true, "children keep their own draw");
      assert.equal(batch.layers.mask, 3);
      const matrix = new Matrix4();
      batch.getMatrixAt(0, matrix);
      assert.deepEqual(matrix.elements, new Matrix4().elements);
      assert.equal(batch.geometry.attributes.position.getX(0), 2.5);
      assert.equal(batch.geometry.attributes.color.getX(0), 1);
      if (previous) {
        assert.equal(batch, previous);
        assert.equal(batch.getVisibleAt(0), false);
        assert.equal(f.a.material, original);
        assert.equal(f.a.layers.mask, 3, "animated sources keep their ordinary draw");
      } else {
        assert.equal(
          f.a.layers.test(f.camera.layers),
          false,
          "batch sources skip renderer culling and geometry updates before material checks",
        );
      }
      previous = batch;
    };
    f.batcher.render(f.renderer, f.scene, f.camera);
    f.a.position.x = 3;
    original.color.set("green");
    f.batcher.render(f.renderer, f.scene, f.camera);
    assert.equal(f.a.material, original);
    assert.equal(f.a.layers.mask, 3);
    assert.equal(f.b.layers.mask, 3);
    assert.equal(f.scene.children.length, 2);
    f.batcher.dispose();
  });
  test("camera LOD/fade/visibility changes reuse every GPU buffer and preserve fallback draws", () => {
    const f = fixture(),
      source = f.a.geometry,
      low = new BoxGeometry(0.9, 0.9, 0.9),
      original = f.a.material;
    registerGeometryLods(source, [low]);
    original.userData.cameraFadeBaseOpacity = 1;
    original.userData.cameraFadeBaseTransparent = false;
    original.userData.cameraFadeBaseDepthWrite = true;
    f.a.userData.cameraFadeBaseCastShadow = false;
    let batch, buffers;
    f.renderer.render = (scene) => {
      const current = scene.children.find((object) => object.isBatchedMesh);
      assert.ok(current);
      if (batch) {
        assert.equal(current, batch);
        assert.equal(current.geometry, buffers);
      }
      batch = current;
      buffers = current.geometry;
      const faded = original.opacity < 1;
      assert.equal(current.getVisibleAt(0), !faded && f.a.visible);
      if (faded) assert.equal(f.a.material, original);
    };
    for (let frame = 0; frame < 90; frame++) {
      f.camera.position.x = frame / 10;
      f.a.geometry = frame % 2 ? low : source;
      original.transparent = frame % 3 === 0;
      original.opacity = original.transparent ? 0.5 : 1;
      original.depthWrite = !original.transparent;
      original.needsUpdate = true;
      f.a.visible = frame % 5 !== 0;
      f.batcher.render(f.renderer, f.scene, f.camera);
    }
    assert.equal(f.a.material, original);
    f.batcher.dispose();
  });
  test("preserves all instances instead of treating an InstancedMesh as one ordinary mesh", () => {
    const f = fixture();
    const instances = new InstancedMesh(f.a.geometry, f.a.material, 10);
    f.scene.add(instances);
    f.renderer.render = () => {
      assert.equal(instances.material.visible, true);
      assert.equal(instances.count, 10);
    };
    f.batcher.render(f.renderer, f.scene, f.camera);
    f.batcher.dispose();
  });
  test("reflections, shear and fade depth/shadow overrides retain their original draw", () => {
    const mutations = [
      (mesh) => {
        mesh.scale.x = -1;
      },
      (mesh) => {
        mesh.matrixAutoUpdate = false;
        mesh.matrix.makeShear(0.2, 0, 0, 0, 0, 0);
      },
      (mesh) => {
        mesh.material.userData.cameraFadeBaseDepthWrite = true;
        mesh.material.depthWrite = false;
      },
      (mesh) => {
        mesh.userData.cameraFadeBaseCastShadow = false;
        mesh.castShadow = true;
      },
    ];
    for (const mutate of mutations) {
      const f = fixture();
      mutate(f.a);
      f.renderer.render = (scene) => {
        const batch = scene.children.find((object) => object.isBatchedMesh);
        assert.ok(batch);
        assert.equal(batch.getVisibleAt(0), false);
        assert.equal(f.a.material.visible, true);
        assert.equal(batch.getVisibleAt(1), true);
      };
      f.batcher.render(f.renderer, f.scene, f.camera);
      f.batcher.dispose();
    }
  });
  test("restores scene after render failure and falls back without multi-draw", () => {
    const f = fixture(),
      original = f.a.material;
    f.a.layers.mask = f.b.layers.mask = 3;
    f.renderer.render = () => {
      throw new Error("render failed");
    };
    assert.throws(() => f.batcher.render(f.renderer, f.scene, f.camera), /render failed/);
    assert.equal(f.a.material, original);
    assert.equal(f.a.layers.mask, 3);
    assert.equal(f.b.layers.mask, 3);
    assert.equal(f.scene.children.length, 2);
    f.renderer.extensions.has = () => false;
    f.renderer.render = (scene) => {
      assert.equal(scene.children.length, 2);
      assert.equal(f.a.material, original);
    };
    f.batcher.render(f.renderer, f.scene, f.camera);
    f.batcher.dispose();
  });
  test("geometry changes rebuild; transparent and custom render objects stay unbatched", () => {
    const f = fixture();
    let previous;
    f.renderer.render = (scene) => {
      const batch = scene.children.find((object) => object.isBatchedMesh);
      assert.ok(batch);
      if (previous) assert.notEqual(batch, previous);
      previous = batch;
    };
    f.batcher.render(f.renderer, f.scene, f.camera);
    f.a.geometry.attributes.position.needsUpdate = true;
    f.batcher.render(f.renderer, f.scene, f.camera);
    f.a.onBeforeRender = () => {};
    f.renderer.render = (scene) => assert.equal(scene.children.length, 2);
    f.batcher.render(f.renderer, f.scene, f.camera);
    f.batcher.dispose();
  });

  test("large LOD updates spread batch construction across frames", () => {
    const f = fixture();
    const source = new SphereGeometry(1, 64, 64);
    const low = new SphereGeometry(1, 32, 32);
    const sources = Array.from({ length: 24 }, () => new Mesh(source, f.a.material));
    const scene = new Scene();
    scene.add(...sources);
    const build = () => {
      const seen = new Set();
      let frames = 0;
      let pending;
      do {
        let newVertices = 0;
        pending = f.batcher.render(f.renderer, scene, f.camera, () => {
          const batches = scene.children.filter((object) => object.isBatchedMesh);
          for (const batch of batches) {
            if (seen.has(batch.geometry)) continue;
            seen.add(batch.geometry);
            newVertices += batch.geometry.attributes.position.count;
          }
          const drawnDirectly = sources.filter((mesh) => mesh.layers.test(f.camera.layers));
          assert.equal(
            batches.reduce((count, batch) => count + batch.instanceCount, 0) + drawnDirectly.length,
            sources.length,
            "unfinished batches leave their sources in the regular render",
          );
        });
        assert.ok(newVertices <= 65_536, `Packed ${newVertices} vertices in one frame`);
        frames++;
      } while (pending && frames < 12);
      assert.equal(pending, false);
      assert.ok(frames > 1);
      assert.ok(sources.every((mesh) => mesh.material === f.a.material));
    };
    try {
      build();
      registerGeometryLods(source, [low]);
      for (const mesh of sources) mesh.geometry = low;
      build();
    } finally {
      f.batcher.dispose();
      source.dispose();
      low.dispose();
    }
  });

  test("point shadow hooks compose with authored materials and isolate shared canvases", () => {
    const owner = new ScenePointShadows();
    const otherOwner = new ScenePointShadows();
    const f = fixture();
    const material = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(), material);
    let renders = 0;
    const onBeforeRender = () => renders++;
    const onBeforeCompile = (shader) => {
      shader.uniforms.authored = { value: true };
    };
    const customProgramCacheKey = () => "authored";
    Object.assign(material, { onBeforeCompile, onBeforeRender, customProgramCacheKey });
    f.scene.add(mesh, new PointLight());
    const preview = new Scene();
    const previewMesh = new Mesh(mesh.geometry, material);
    preview.add(previewMesh);

    const shaderFor = (scene, object) => {
      const shader = {
        uniforms: {},
        vertexShader: "",
        fragmentShader: "#include <lights_fragment_begin>",
      };
      f.renderer.info.render.frame++;
      material.onBeforeRender(f.renderer, scene, f.camera, mesh.geometry, object, null);
      material.onBeforeCompile(shader, f.renderer);
      return shader;
    };

    owner.update(f.renderer, f.scene, f.camera);
    otherOwner.update(f.renderer, preview, f.camera);
    const mainShader = shaderFor(f.scene, mesh);
    const mainPoints = mainShader.uniforms.cabanePointShadows.value;
    assert.deepEqual(
      mainPoints.map((point) => point.toArray()),
      [[-1, 0, 0, 0]],
    );
    assert.equal(mainShader.uniforms.authored.value, true);
    assert.equal(material.customProgramCacheKey(), "authored|cabane-point-shadows");
    assert.deepEqual(shaderFor(preview, previewMesh).uniforms.cabanePointShadows.value, []);
    assert.deepEqual(shaderFor(new Scene(), mesh).uniforms.cabanePointShadows.value, []);
    assert.equal(renders, 3, "the authored render hook runs for every draw");

    owner.dispose();
    assert.notEqual(material.onBeforeCompile, onBeforeCompile, "the preview still owns the hook");
    otherOwner.dispose();
    assert.equal(material.onBeforeCompile, onBeforeCompile);
    assert.equal(material.onBeforeRender, onBeforeRender);
    assert.equal(material.customProgramCacheKey, customProgramCacheKey);

    const reopened = new ScenePointShadows();
    reopened.update(f.renderer, f.scene, f.camera);
    material.dispose();
    assert.equal(material.onBeforeCompile, onBeforeCompile);
    reopened.update(f.renderer, f.scene, f.camera);
    const reopenedShader = shaderFor(f.scene, mesh);
    assert.equal(reopenedShader.fragmentShader.match(/uniform vec4 cabanePointShadows/g).length, 1);
    reopened.dispose();
  });

  test("point shadows preserve static toon buffers and compose the batching shader", () => {
    const shadows = new ScenePointShadows();
    const f = fixture((material) => shadows.prepareMaterial(material));
    let previous;
    f.renderer.render = (scene) => {
      const batch = scene.children.find((object) => object.isBatchedMesh);
      assert.ok(batch, "engine lighting hooks must not disable batching");
      if (previous) assert.equal(batch, previous);
      previous = batch;
      const shader = {
        uniforms: {},
        vertexShader: "#include <batching_vertex>",
        fragmentShader: "#include <lights_fragment_begin>",
      };
      batch.material.onBeforeCompile(shader, f.renderer);
      assert.match(shader.vertexShader, /batchingMatrix = mat4\(1.0\)/);
      assert.match(shader.fragmentShader, /directLight.color \*= cabaneSamplePointShadow/);
      const guard = shader.fragmentShader.indexOf("if (pointLight.color != vec3(0.0)");
      assert.ok(guard >= 0 && guard < shader.fragmentShader.indexOf("getPointLightInfo("));
    };
    for (let i = 0; i < 3; i++) {
      shadows.update(f.renderer, f.scene, f.camera);
      f.batcher.render(f.renderer, f.scene, f.camera, () => f.renderer.render(f.scene));
    }
    f.batcher.dispose();
    shadows.dispose();
  });
});
