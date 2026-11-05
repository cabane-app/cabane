import assert from "node:assert/strict";
import test from "node:test";
import {
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  PCFShadowMap,
  Mesh,
  MeshToonMaterial,
  OrthographicCamera,
  Scene,
  SphereGeometry,
} from "three";
import { withModules } from "./test-server.mjs";
await withModules(async (load) => {
  const { createGeometryLods } = await load("/packages/engine/src/scene-batching/geometry-lod.ts");
  const { SceneGeometryLod } = await load(
    "/packages/engine/src/scene-batching/SceneGeometryLod.ts",
  );
  const { ShadowMapCache } = await load("/packages/engine/src/shadow-map-cache.ts");
  const { markPreparedOrbitRenderRoot } = await load(
    "/packages/engine/src/scene-batching/prepared-orbit-render-root.ts",
  );
  const { SceneToonBatcher } = await load(
    "/packages/engine/src/scene-batching/SceneToonBatcher.ts",
  );
  const { geometryLodFamily } = await load(
    "/packages/engine/src/scene-batching/geometry-lod-family.ts",
  );
  const { roundedBoxGeometry } = await load(
    "/packages/engine/src/rounded-box/rounded-box-geometry.ts",
  );
  const { buildArchitecturalWallGeometries, buildWallJunctionGeometries } = await load(
    "/packages/engine/src/index.ts",
  );
  const { interactionFloor } = await load("/tests/fixtures/interaction-floor.ts");
  test("rounded procedural geometry simplifies across seams with bounded attribute error", async () => {
    const source = roundedBoxGeometry(1, 2, 0.1, 0.02, 1, 4, 4, 0.4);
    const levels = await createGeometryLods(source);
    assert.ok(levels.at(-1).geometry.index.count < source.attributes.position.count / 10);
    assert.ok(levels.at(-1).error < 0.08 * 2);
    levels.forEach((level) => level.geometry.dispose());
    source.dispose();
  });
  test("architectural wall and junction planes retain original buffers at every camera scale", async () => {
    const groups = [
      ...buildArchitecturalWallGeometries(interactionFloor),
      ...buildWallJunctionGeometries(interactionFloor.wallJunctions[0], interactionFloor),
    ];
    const scene = new Scene();
    let preparations = 0;
    const lod = new SceneGeometryLod(
      () => {},
      async (source) => {
        preparations++;
        return createGeometryLods(source);
      },
    );
    const meshes = groups.map(({ geometry }) => {
      assert.equal(geometry.userData.preservePlanarFaces, true);
      const mesh = new Mesh(geometry, new MeshToonMaterial());
      scene.add(mesh);
      return mesh;
    });
    const camera = new OrthographicCamera(-50, 50, 50, -50, 0.1, 100);
    camera.position.z = 20;
    try {
      for (const zoom of [0.01, 1, 10000]) {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
        lod.render(scene, camera, 100, () =>
          meshes.forEach((mesh, index) => assert.equal(mesh.geometry, groups[index].geometry)),
        );
        await lod.ready;
      }
      assert.equal(preparations, 0);
    } finally {
      lod.dispose();
      meshes.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
    }
  });
  test("meshoptimizer reduces dense geometry without modifying authored buffers", async () => {
    const source = new SphereGeometry(1, 48, 32),
      original = source.index.array.slice();
    const levels = await createGeometryLods(source);
    assert.ok(levels.length >= 2);
    assert.ok(levels.at(-1).geometry.index.count < original.length / 3);
    for (const { geometry, error } of levels) {
      assert.ok(error >= 0 && error <= 0.16);
      assert.ok(geometry.index.array.every((index) => index < geometry.attributes.position.count));
      assert.ok(geometry.attributes.position.count < source.attributes.position.count);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        assert.ok(
          Math.abs(Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i)) - 1) < 1e-5,
        );
      }
      geometry.dispose();
    }
    assert.deepEqual(source.index.array, original);
    source.dispose();
  });
  test("prepared roots leave LOD preparation to their owner while ordinary meshes still prepare", async () => {
    const scene = new Scene();
    const camera = new OrthographicCamera(-50, 50, 50, -50, 0.1, 100);
    const root = new Group();
    const material = new MeshToonMaterial();
    const preparedGeometry = new SphereGeometry(1, 12, 12);
    const ordinaryGeometry = new SphereGeometry(1, 12, 12);
    root.add(new Mesh(preparedGeometry, material));
    scene.add(root, new Mesh(ordinaryGeometry, material));
    markPreparedOrbitRenderRoot(root, 0);
    const requests = [];
    const lod = new SceneGeometryLod(
      () => {},
      async (geometry) => {
        requests.push(geometry);
        return [];
      },
    );
    try {
      lod.render(scene, camera, 100, () => {}, true);
      await lod.ready;
      assert.equal(requests.length, 1);
      assert.equal(requests[0], ordinaryGeometry);
      lod.render(scene, camera, 100, () => {});
      await lod.ready;
      assert.deepEqual(requests, [ordinaryGeometry, preparedGeometry]);
    } finally {
      lod.dispose();
      preparedGeometry.dispose();
      ordinaryGeometry.dispose();
      material.dispose();
    }
  });
  test("instanced LOD accounts for the largest instance and preserves instance data", async () => {
    const scene = new Scene(),
      camera = new OrthographicCamera(-50, 50, 50, -50, 0.1, 100);
    camera.position.z = 10;
    const source = new SphereGeometry(1, 48, 32),
      mesh = new InstancedMesh(source, new MeshToonMaterial(), 2);
    mesh.setMatrixAt(0, new Matrix4().makeScale(0.1, 0.1, 0.1));
    mesh.setMatrixAt(1, new Matrix4().makeScale(10000, 10000, 10000));
    scene.add(mesh);
    const matrices = mesh.instanceMatrix.array.slice(),
      lod = new SceneGeometryLod(() => {}, createGeometryLods);
    lod.render(scene, camera, 100, () => {});
    await lod.ready;
    lod.render(scene, camera, 100, () => assert.equal(mesh.geometry, source));
    mesh.setMatrixAt(1, new Matrix4());
    lod.render(scene, camera, 100, () => assert.notEqual(mesh.geometry, source));
    assert.equal(mesh.geometry, source);
    assert.equal(mesh.count, 2);
    assert.deepEqual(mesh.instanceMatrix.array.slice(0, 16), matrices.slice(0, 16));
    lod.dispose();
  });
  test("camera LOD changes keep cached shadows and reuse prepared families across fades", async () => {
    let preparations = 0;
    const lod = new SceneGeometryLod(
      () => {},
      (source) => {
        preparations++;
        return createGeometryLods(source);
      },
    );
    const cache = new ShadowMapCache(),
      scene = new Scene();
    const camera = new OrthographicCamera(-50, 50, 50, -50, 0.1, 100);
    camera.position.z = 10;
    const source = new SphereGeometry(1, 48, 32),
      material = new MeshToonMaterial(),
      mesh = new Mesh(source, material);
    mesh.castShadow = true;
    scene.add(mesh);
    const light = new DirectionalLight();
    light.castShadow = true;
    light.position.set(2, 4, 3);
    scene.add(light);
    lod.render(scene, camera, 100, () => {});
    await lod.ready;
    let shadowRefreshes = 0;
    const geometries = new Set();
    const renderer = {
      shadowMap: { enabled: true, autoUpdate: true, type: PCFShadowMap, needsUpdate: false },
      localClippingEnabled: false,
      clippingPlanes: [],
      render() {
        if (this.shadowMap.needsUpdate) {
          shadowRefreshes++;
          this.shadowMap.needsUpdate = false;
        }
        geometries.add(mesh.geometry);
      },
    };
    for (let frame = 0; frame < 30; frame++) {
      camera.zoom = frame % 2 ? 10000 : 1;
      camera.updateProjectionMatrix();
      cache.render(renderer, scene, camera, () =>
        lod.render(scene, camera, 100, () => renderer.render()),
      );
    }
    assert.equal(shadowRefreshes, 1);
    assert.ok(geometries.size > 1);
    assert.equal(mesh.geometry, source);
    material.userData.cameraFadeBaseOpacity = 1;
    material.userData.cameraFadeBaseTransparent = false;
    material.userData.cameraFadeBaseDepthWrite = true;
    mesh.userData.cameraFadeBaseCastShadow = true;
    for (let frame = 0; frame < 10; frame++) {
      material.transparent = !!(frame % 2);
      material.opacity = frame % 2 ? 0.5 : 1;
      material.depthWrite = !material.transparent;
      material.needsUpdate = true;
      lod.render(scene, camera, 100, () => {});
      await lod.ready;
    }
    assert.equal(preparations, 1);
    lod.dispose();
  });
  test("LOD prepares once, selects by projected error, restores geometry and cancels cleanly", async () => {
    let invalidations = 0;
    const lod = new SceneGeometryLod(() => invalidations++, createGeometryLods),
      scene = new Scene();
    const camera = new OrthographicCamera(-50, 50, 50, -50, 0.1, 100);
    camera.position.z = 10;
    const source = new SphereGeometry(1, 48, 32),
      mesh = new Mesh(source, new MeshToonMaterial());
    scene.add(mesh);
    lod.render(scene, camera, 100, () => assert.equal(mesh.geometry, source));
    await lod.ready;
    assert.equal(invalidations, 1);
    lod.render(scene, camera, 100, () =>
      assert.ok(mesh.geometry.index.count < source.index.count / 3),
    );
    assert.equal(mesh.geometry, source);
    assert.throws(
      () =>
        lod.render(scene, camera, 100, () => {
          throw new Error("draw");
        }),
      /draw/,
    );
    assert.equal(mesh.geometry, source);
    camera.zoom = 10000;
    camera.updateProjectionMatrix();
    lod.render(scene, camera, 100, () => assert.equal(mesh.geometry, source));
    assert.equal(invalidations, 1);
    lod.dispose();
    // React StrictMode retains the resource while replaying mount cleanup.
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    lod.render(scene, camera, 100, () => {});
    await lod.ready;
    lod.render(scene, camera, 100, () => assert.notEqual(mesh.geometry, source));
    assert.equal(invalidations, 2);
    lod.dispose();
  });
  test("repeated worker waves preserve stationary detail and GPU buffers of settled meshes", async () => {
    const source = new SphereGeometry(1, 48, 32);
    const low = new SphereGeometry(1, 8, 6);
    const sources = [source];
    const preparations = new Map();
    let finish, pending;
    const lod = new SceneGeometryLod(
      () => {},
      async (geometry) => {
        preparations.set(geometry, (preparations.get(geometry) ?? 0) + 1);
        return geometry === source ? [{ geometry: low, error: 0.001 }] : pending;
      },
    );
    const batcher = new SceneToonBatcher();
    const scene = new Scene();
    const meshes = [
      new Mesh(source, new MeshToonMaterial()),
      new Mesh(source, new MeshToonMaterial({ color: "blue" })),
    ];
    meshes[1].position.x = 3;
    scene.add(...meshes);
    const camera = new OrthographicCamera(-50, 50, 50, -50, 0.1, 100);
    camera.position.z = 10;
    let family, buffers;
    const renderer = {
      extensions: { has: () => true },
      localClippingEnabled: false,
      clippingPlanes: [],
      render() {
        if (!family) return;
        for (const mesh of meshes.slice(0, 2))
          assert.ok(mesh.geometry === low, "unrelated work must not restore full detail");
        const batch = scene.children.find((object) => object.isBatchedMesh);
        assert.ok(batch);
        if (buffers)
          assert.ok(batch.geometry === buffers, "unrelated work must not repack settled buffers");
        buffers = batch.geometry;
      },
    };
    const frame = () =>
      lod.render(scene, camera, 100, () => batcher.render(renderer, scene, camera));
    try {
      frame();
      await lod.ready;
      family = geometryLodFamily(source);
      frame();
      for (let wave = 0; wave < 3; wave++) {
        pending = new Promise((resolve) => {
          finish = resolve;
        });
        const added = new SphereGeometry(0.5, 24, 16);
        sources.push(added);
        // A separate material group leaves the settled batch membership unchanged.
        const mesh = new Mesh(added, new MeshToonMaterial({ emissiveIntensity: wave + 2 }));
        meshes.push(mesh);
        scene.add(mesh);
        for (let index = 0; index < 3; index++) frame();
        finish([]);
        await lod.ready;
        assert.ok(geometryLodFamily(source) === family, "settled LOD families retain identity");
        frame();
      }
      assert.equal(preparations.size, sources.length);
      for (const count of preparations.values()) assert.equal(count, 1);
      assert.ok(meshes.slice(0, 2).every((mesh) => mesh.geometry === source));
    } finally {
      finish?.([]);
      await lod.ready;
      batcher.dispose();
      lod.dispose();
      sources.forEach((geometry) => geometry.dispose());
      meshes.forEach((mesh) => mesh.material.dispose());
    }
  });
});
