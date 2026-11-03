import assert from "node:assert/strict";
import test from "node:test";
import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  MeshStandardMaterial,
  Group,
  PointLight,
  Raycaster,
  Vector3,
  Vector4,
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
  const { SceneLightWallMask } = await load("/packages/engine/src/scene-light-wall-mask.ts");
  function fixture() {
    const scene = new Scene(),
      camera = new PerspectiveCamera(),
      batcher = new SceneToonBatcher();
    const a = new Mesh(new BoxGeometry(), new MeshToonMaterial({ color: "red" }));
    const b = new Mesh(new BoxGeometry(), new MeshToonMaterial({ color: "blue" }));
    const child = new Mesh(
      new BoxGeometry(),
      new MeshToonMaterial({ transparent: true, opacity: 0.5 }),
    );
    a.add(child);
    scene.add(a, b);
    const renderer = {
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
        mesh.material.defines = flat ? { TOON: "", FLAT_SHADED: "" } : { TOON: "" };
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
    let previous;
    f.renderer.render = (scene) => {
      const batch = scene.children.find((object) => object.isBatchedMesh);
      assert.ok(batch);
      assert.equal(f.child.material.visible, true);
      const matrix = new Matrix4();
      batch.getMatrixAt(0, matrix);
      assert.deepEqual(matrix.elements, new Matrix4().elements);
      assert.equal(batch.geometry.attributes.position.getX(0), 2.5);
      assert.equal(batch.geometry.attributes.color.getX(0), 1);
      if (previous) {
        assert.equal(batch, previous);
        assert.equal(batch.getVisibleAt(0), false);
        assert.equal(f.a.material, original);
      } else assert.equal(f.a.material.visible, false);
      previous = batch;
    };
    f.batcher.render(f.renderer, f.scene, f.camera);
    f.a.position.x = 3;
    original.color.set("green");
    f.batcher.render(f.renderer, f.scene, f.camera);
    assert.equal(f.a.material, original);
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
  test("source picking rejects missed bounds before visiting triangles and retains real hits", () => {
    const f = fixture();
    f.batcher.render(f.renderer, f.scene, f.camera);
    const index = f.a.geometry.index;
    const original = index.getX;
    let visited = 0;
    index.getX = function (i) {
      visited++;
      return original.call(this, i);
    };
    try {
      const ray = new Raycaster(new Vector3(0.6, 0, 5), new Vector3(0, 0, -1));
      assert.equal(ray.intersectObject(f.a, false).length, 0);
      assert.equal(visited, 0, "a missed box must not scan its triangles");
      ray.ray.origin.x = 0;
      assert.ok(
        ray.intersectObject(f.a, false).length > 0,
        "picking keeps the original visible surface",
      );
    } finally {
      index.getX = original;
      f.batcher.dispose();
    }
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
    f.renderer.render = () => {
      throw new Error("render failed");
    };
    assert.throws(() => f.batcher.render(f.renderer, f.scene, f.camera), /render failed/);
    assert.equal(f.a.material, original);
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

  test("wall lighting masks follow floor and camera transforms and isolate shared previews", () => {
    const mask = new SceneLightWallMask(),
      otherMask = new SceneLightWallMask();
    const scene = new Scene(),
      floor = new Group(),
      camera = new PerspectiveCamera();
    floor.position.y = 2.6;
    floor.rotation.y = 0.7;
    const light = new PointLight();
    light.position.set(0.5, 1, 1);
    light.userData.cabaneLightWallPlane = [1, 0, 0, -0.05];
    floor.add(light);
    scene.add(floor);
    const material = new MeshStandardMaterial(),
      mesh = new Mesh(new BoxGeometry(), material);
    scene.add(mesh);
    const original = material.onBeforeCompile;
    let shader;
    const renderer = {
      info: { render: { frame: 0 } },
      render(currentScene, currentCamera) {
        currentScene.updateMatrixWorld(true);
        currentCamera.updateMatrixWorld(true);
        material.onBeforeRender(this, currentScene, currentCamera, mesh.geometry, mesh, null);
        shader = {
          uniforms: {},
          vertexShader: "",
          fragmentShader: "#include <lights_fragment_begin>",
        };
        material.onBeforeCompile(shader, this);
        this.info.render.frame++;
      },
    };
    for (const x of [0, 3]) {
      camera.position.set(x, 4, 5);
      camera.lookAt(0, 2.6, 0);
      mask.render(renderer, scene, camera);
      const plane = shader.uniforms.cabaneLightWallPlanes.value[0];
      const distance = (x) => {
        const point = new Vector3(x, 1, 1)
          .applyMatrix4(floor.matrixWorld)
          .applyMatrix4(camera.matrixWorldInverse);
        return plane.dot(new Vector4(point.x, point.y, point.z, 1));
      };
      assert.ok(distance(0.1) > 0, "wall-side shade remains illuminated");
      assert.ok(distance(-0.1) < 0, "receivers behind the wall are masked");
    }
    const preview = new Scene();
    preview.add(new Mesh(mesh.geometry, material), new PointLight());
    otherMask.render(renderer, preview, camera);
    assert.deepEqual(shader.uniforms.cabaneLightWallPlanes.value[0].toArray(), [0, 0, 0, 1]);
    mask.dispose();
    assert.notEqual(
      material.onBeforeCompile,
      original,
      "another canvas still owns the shared material",
    );
    otherMask.dispose();
    assert.equal(material.onBeforeCompile, original);
    const reopened = new SceneLightWallMask();
    reopened.render(renderer, scene, camera);
    material.dispose();
    assert.equal(material.onBeforeCompile, original, "disposed materials retain no lighting hooks");
    reopened.render(renderer, scene, camera);
    assert.equal(shader.fragmentShader.match(/uniform vec4 cabaneLightWallPlanes/g).length, 1);
    reopened.dispose();
  });

  test("wall lighting preserves static toon buffers and the existing batching shader", () => {
    const f = fixture(),
      mask = new SceneLightWallMask();
    mask.render(f.renderer, f.scene, f.camera);
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
      assert.match(shader.fragmentShader, /directLight.color \*= step/);
    };
    for (let i = 0; i < 3; i++)
      f.batcher.render(f.renderer, f.scene, f.camera, () =>
        mask.render(f.renderer, f.scene, f.camera),
      );
    f.batcher.dispose();
    mask.dispose();
  });
});
