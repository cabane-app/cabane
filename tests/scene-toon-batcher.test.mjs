import assert from "node:assert/strict";
import test from "node:test";
import {
  BoxGeometry,
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  MeshStandardMaterial,
  Group,
  PointLight,
  Vector3,
  Vector4,
  PerspectiveCamera,
  Scene,
  Sphere,
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
  test("ordered ancestors exclude nested batch roots without disturbing siblings", () => {
    const f = fixture();
    const ordered = new Group(),
      root = new Group();
    root.userData.toonBatchRoot = true;
    const sources = [f.a, f.b].map((mesh) => new Mesh(mesh.geometry, mesh.material.clone()));
    const materials = sources.map((mesh) => mesh.material);
    root.add(...sources);
    ordered.add(root);
    f.scene.add(ordered);
    let siblingBatch;
    const render = (expectedCount, expectedMask) => {
      f.batcher.render(f.renderer, f.scene, f.camera, () => {
        const batches = f.scene.children.filter((object) => object.isBatchedMesh);
        assert.equal(batches.length, expectedCount);
        if (expectedCount) {
          if (siblingBatch) assert.equal(batches[0], siblingBatch);
          siblingBatch = batches[0];
        }
        assert.deepEqual(
          sources.map((mesh) => mesh.layers.mask),
          [expectedMask, expectedMask],
        );
      });
      assert.deepEqual(
        sources.map((mesh) => mesh.material),
        materials,
      );
    };
    try {
      render(2, 0);
      ordered.renderOrder = 2;
      render(1, 1);
      ordered.renderOrder = 0;
      render(2, 0);

      const parent = new Group();
      parent.renderOrder = 3;
      parent.add(f.scene);
      render(0, 1);
    } finally {
      f.batcher.dispose();
      materials.forEach((material) => material.dispose());
    }
  });
  test("nonstandard depth batches retain exact native sort centers for rotated asymmetric meshes", () => {
    const f = fixture();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 4, 0, 0, 0, 0, 1], 3));
    geometry.computeVertexNormals();
    for (const mesh of [f.a, f.b]) {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      mesh.material.depthWrite = false;
      mesh.rotation.y = Math.PI / 4;
    }
    f.renderer.render = (scene) => {
      const batch = scene.children.find((object) => object.isBatchedMesh);
      const packed = geometry.clone().applyMatrix4(f.a.matrixWorld);
      const expected = new Box3()
        .setFromBufferAttribute(packed.attributes.position)
        .getCenter(new Vector3());
      const actual = batch.getBoundingSphereAt(0, new Sphere()).center;
      assert.ok(
        actual.distanceTo(expected) < 1e-6,
        "sorting must retain the native packed-vertex center",
      );
      packed.dispose();
    };
    try {
      f.batcher.render(f.renderer, f.scene, f.camera);
    } finally {
      f.batcher.dispose();
      geometry.dispose();
    }
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
  test("late LOD packing shares one frame budget and retains full-detail draws until ready", async (t) => {
    const f = fixture();
    const c = new Mesh(new BoxGeometry(), new MeshToonMaterial({ emissive: "green" }));
    const d = new Mesh(new BoxGeometry(), new MeshToonMaterial({ emissive: "green" }));
    f.scene.add(c, d);
    const levels = [new BoxGeometry(0.8, 0.8, 0.8), new BoxGeometry(0.6, 0.6, 0.6)];
    let batches;
    let now = 0;
    let uploads = 0;
    t.mock.method(performance, "now", () => now);
    f.renderer.render = (scene) => {
      batches = scene.children.filter((object) => object.isBatchedMesh);
      assert.equal(batches.length, 2);
    };
    try {
      f.batcher.render(f.renderer, f.scene, f.camera);
      const originalIds = batches.map((batch) => batch.getGeometryIdAt(0));
      const originalBuffers = batches.map((batch) => batch.geometry);
      for (const batch of batches) {
        const add = batch.addGeometry;
        t.mock.method(batch, "addGeometry", function (...args) {
          uploads++;
          now += 7;
          return add.apply(this, args);
        });
      }
      for (const [index, source] of [f.a, c].entries()) {
        registerGeometryLods(source.geometry, [levels[index]]);
        source.geometry = levels[index];
      }
      const pending = f.batcher.render(f.renderer, f.scene, f.camera);
      assert.equal(uploads, 1, "the budget is shared across material batches");
      assert.equal(pending, true);
      assert.notEqual(batches[0].getGeometryIdAt(0), originalIds[0]);
      assert.equal(batches[1].getGeometryIdAt(0), originalIds[1], "pending LOD keeps full detail");
      assert.equal(batches[1].geometry, originalBuffers[1], "unprocessed jobs do not resize");
      const ready = f.batcher.ready;
      let settled = false;
      void ready.then(() => (settled = true));
      await Promise.resolve();
      assert.equal(settled, false);
      now = 0;
      assert.equal(f.batcher.render(f.renderer, f.scene, f.camera), false);
      await ready;
      assert.equal(settled, true);
      assert.equal(uploads, 2);
      assert.notEqual(batches[1].getGeometryIdAt(0), originalIds[1]);
      const buffers = batches.map((batch) => batch.geometry);
      for (let frame = 0; frame < 3; frame++) {
        f.camera.position.x++;
        assert.equal(f.batcher.render(f.renderer, f.scene, f.camera), false);
        assert.deepEqual(
          batches.map((batch) => batch.geometry),
          buffers,
        );
      }
      assert.equal(uploads, 2, "settled camera frames do not enqueue or request more work");
    } finally {
      f.batcher.dispose();
      for (const geometry of levels) geometry.dispose();
    }
  });
  test("queued LOD uploads cancel on disposal or family revision changes before processing", async (t) => {
    for (const change of ["dispose", "revision"]) {
      const f = fixture();
      const c = new Mesh(new BoxGeometry(), new MeshToonMaterial({ emissive: "green" }));
      const d = new Mesh(new BoxGeometry(), new MeshToonMaterial({ emissive: "green" }));
      f.scene.add(c, d);
      const levels = [new BoxGeometry(0.8, 0.8, 0.8), new BoxGeometry(0.6, 0.6, 0.6)];
      let batches;
      let now = 0;
      let uploads = 0;
      t.mock.method(performance, "now", () => now);
      f.renderer.render = (scene) => {
        batches = scene.children.filter((object) => object.isBatchedMesh);
      };
      try {
        f.batcher.render(f.renderer, f.scene, f.camera);
        const previous = batches[1];
        for (const batch of batches) {
          const add = batch.addGeometry;
          t.mock.method(batch, "addGeometry", function (...args) {
            uploads++;
            now += 7;
            return add.apply(this, args);
          });
        }
        for (const [index, source] of [f.a, c].entries()) {
          registerGeometryLods(source.geometry, [levels[index]]);
          source.geometry = levels[index];
        }
        const pending = f.batcher.render(f.renderer, f.scene, f.camera);
        const ready = f.batcher.ready;
        assert.equal(uploads, 1);
        assert.equal(pending, true);
        if (change === "dispose") f.batcher.dispose();
        else {
          levels[1].attributes.position.needsUpdate = true;
          now = 0;
          assert.equal(f.batcher.render(f.renderer, f.scene, f.camera), false);
          assert.notEqual(batches[1], previous, "all batches validate before queued packing");
        }
        await ready;
        assert.equal(uploads, 1, "cancelled jobs never commit into the stale batch");
      } finally {
        f.batcher.dispose();
        for (const geometry of levels) geometry.dispose();
        t.mock.restoreAll();
      }
    }
  });
  test("suspended LOD uploads settle readiness and resume with the same packed buffers", async (t) => {
    const f = fixture();
    const source = f.a.geometry;
    const levels = [0.8, 0.7, 0.6].map((size) => new BoxGeometry(size, size, size));
    let batch;
    let now = 0;
    let uploads = 0;
    t.mock.method(performance, "now", () => now);
    f.renderer.render = (scene) => {
      batch = scene.children.find((object) => object.isBatchedMesh);
    };
    try {
      f.batcher.render(f.renderer, f.scene, f.camera);
      const originalBatch = batch;
      const add = batch.addGeometry;
      t.mock.method(batch, "addGeometry", function (...args) {
        uploads++;
        now += 7;
        return add.apply(this, args);
      });
      registerGeometryLods(source, levels);
      f.a.geometry = levels[2];
      assert.equal(f.batcher.render(f.renderer, f.scene, f.camera), true);
      const suspended = f.batcher.ready;
      const buffers = batch.geometry;
      f.scene.overrideMaterial = f.a.material;
      assert.equal(f.batcher.render(f.renderer, f.scene, f.camera), false);
      await suspended;
      assert.equal(uploads, 1);
      f.scene.overrideMaterial = null;
      now = 0;
      assert.equal(f.batcher.render(f.renderer, f.scene, f.camera), true);
      assert.equal(batch, originalBatch);
      assert.equal(batch.geometry, buffers);
      const resumed = f.batcher.ready;
      assert.notEqual(resumed, suspended);
      assert.equal(uploads, 2);
      now = 0;
      assert.equal(f.batcher.render(f.renderer, f.scene, f.camera), false);
      await resumed;
      assert.equal(uploads, 3);
    } finally {
      f.batcher.dispose();
      for (const geometry of levels) geometry.dispose();
    }
  });
  test("a failed queued LOD upload settles readiness and discards its incomplete batch", async (t) => {
    const f = fixture();
    const source = f.a.geometry;
    const material = f.a.material;
    const levels = [new BoxGeometry(0.8, 0.8, 0.8), new BoxGeometry(0.6, 0.6, 0.6)];
    let batch;
    let now = 0;
    t.mock.method(performance, "now", () => now);
    f.renderer.render = (scene) => {
      batch = scene.children.find((object) => object.isBatchedMesh);
    };
    try {
      f.batcher.render(f.renderer, f.scene, f.camera);
      const previous = batch;
      const add = batch.addGeometry;
      let uploads = 0;
      t.mock.method(batch, "addGeometry", function (...args) {
        if (++uploads === 2) throw new Error("upload failed");
        now += 7;
        return add.apply(this, args);
      });
      registerGeometryLods(source, levels);
      f.a.geometry = levels[1];
      assert.equal(f.batcher.render(f.renderer, f.scene, f.camera), true);
      const ready = f.batcher.ready;
      now = 0;
      assert.throws(() => f.batcher.render(f.renderer, f.scene, f.camera), /upload failed/);
      await ready;
      assert.equal(f.a.material, material);
      assert.equal(f.a.layers.mask, 1);
      assert.equal(f.scene.children.length, 2);
      assert.equal(f.batcher.render(f.renderer, f.scene, f.camera), false);
      assert.notEqual(batch, previous);
    } finally {
      f.batcher.dispose();
      for (const geometry of levels) geometry.dispose();
    }
  });
  test("late LOD families append without repacking existing source geometry or changing IDs", () => {
    const f = fixture();
    const sources = [f.a.geometry, f.b.geometry];
    const levels = [new BoxGeometry(0.8, 0.8, 0.8), new BoxGeometry(0.6, 0.6, 0.6)];
    const packing = { position: 0, normal: 0, positionTransform: 0, normalTransform: 0 };
    let componentReads = 0;
    for (const geometry of sources) {
      for (const name of ["position", "normal"]) {
        const attribute = geometry.attributes[name];
        attribute.array = new Proxy(attribute.array, {
          get(array, key) {
            if (typeof key === "string" && /^\d+$/.test(key)) componentReads++;
            const value = Reflect.get(array, key, array);
            return typeof value === "function" ? value.bind(array) : value;
          },
        });
        const clone = attribute.clone;
        attribute.clone = function () {
          packing[name]++;
          const copy = clone.call(this);
          const method = name === "position" ? "applyMatrix4" : "applyNormalMatrix";
          const transform = copy[method];
          copy[method] = function (...args) {
            packing[`${name}Transform`]++;
            return transform.apply(this, args);
          };
          return copy;
        };
      }
    }
    let batch;
    f.renderer.render = (scene) => {
      const current = scene.children.find((object) => object.isBatchedMesh);
      assert.ok(current);
      if (batch) assert.ok(current === batch, "late levels retain the existing BatchedMesh");
      batch = current;
    };
    try {
      f.batcher.render(f.renderer, f.scene, f.camera);
      const originalIds = [0, 1].map((instance) => batch.getGeometryIdAt(instance));
      const originalRanges = originalIds.map((id) => batch.getGeometryRangeAt(id));
      const initialPacking = { ...packing };
      const initialReads = componentReads;
      assert.ok(initialReads > 0, "initial packing reads original Float32 vertices");
      for (const [index, source] of sources.entries()) {
        registerGeometryLods(source, [levels[index]]);
      }
      f.a.geometry = levels[0];
      f.b.geometry = levels[1];
      f.batcher.render(f.renderer, f.scene, f.camera);
      assert.deepEqual(packing, initialPacking, "only newly published levels are cloned and baked");
      assert.equal(
        componentReads,
        initialReads,
        "late levels never reread original vertex buffers",
      );
      for (const [instance, id] of originalIds.entries()) {
        assert.deepEqual(batch.getGeometryRangeAt(id), originalRanges[instance]);
        assert.notEqual(batch.getGeometryIdAt(instance), id);
      }
      f.a.geometry = sources[0];
      f.b.geometry = sources[1];
      f.batcher.render(f.renderer, f.scene, f.camera);
      assert.deepEqual(
        [0, 1].map((instance) => batch.getGeometryIdAt(instance)),
        originalIds,
      );
      assert.deepEqual(packing, initialPacking);
    } finally {
      f.batcher.dispose();
      for (const geometry of levels) geometry.dispose();
    }
  });
  test("late LOD packing retains the baked tint and transform while animated sources draw normally", () => {
    const f = fixture();
    const source = f.a.geometry;
    const low = new BoxGeometry(0.8, 0.8, 0.8);
    const material = f.a.material;
    f.a.position.x = 2;
    let batch;
    let animated = false;
    f.renderer.render = (scene) => {
      const current = scene.children.find((object) => object.isBatchedMesh);
      assert.ok(current);
      if (batch) assert.ok(current === batch, "animation during publication does not rebuild");
      batch = current;
      assert.equal(batch.getVisibleAt(0), !animated);
      assert.equal(f.a.layers.test(f.camera.layers), animated);
      if (animated) assert.equal(f.a.material, material);
    };
    try {
      f.batcher.render(f.renderer, f.scene, f.camera);
      const originalId = batch.getGeometryIdAt(0);
      animated = true;
      f.a.position.x = 7;
      material.color.set("green");
      registerGeometryLods(source, [low]);
      f.a.geometry = low;
      f.batcher.render(f.renderer, f.scene, f.camera);
      assert.equal(batch.getGeometryIdAt(0), originalId, "native fallback retains its selection");
      animated = false;
      f.a.position.x = 2;
      material.color.set("red");
      f.batcher.render(f.renderer, f.scene, f.camera);
      const lowId = batch.getGeometryIdAt(0);
      assert.notEqual(lowId, originalId);
      const vertex = batch.getGeometryRangeAt(lowId).vertexStart;
      assert.equal(
        batch.geometry.attributes.position.getX(vertex),
        Math.fround(low.attributes.position.getX(0) + 2),
        "late geometry uses the original baked matrix",
      );
      assert.deepEqual(
        ["getX", "getY", "getZ"].map((method) => batch.geometry.attributes.color[method](vertex)),
        [1, 0, 0],
        "late geometry uses the original baked tint",
      );
      assert.equal(f.a.material, material);
      assert.equal(f.a.layers.mask, 1);
    } finally {
      f.batcher.dispose();
      low.dispose();
    }
  });
  test("LOD replacement, removal and mutation still invalidate packed geometry", () => {
    for (const change of ["replace", "remove", "mutate", "mutate-and-append"]) {
      const f = fixture();
      const source = f.a.geometry;
      const low = new BoxGeometry(0.8, 0.8, 0.8);
      const next = new BoxGeometry(0.6, 0.6, 0.6);
      registerGeometryLods(source, [low]);
      let batch;
      f.renderer.render = (scene) => {
        const current = scene.children.find((object) => object.isBatchedMesh);
        assert.ok(current);
        if (batch) assert.notEqual(current, batch, `${change} rebuilds stale packed data`);
        batch = current;
      };
      try {
        f.batcher.render(f.renderer, f.scene, f.camera);
        if (change === "replace") registerGeometryLods(source, [next]);
        else if (change === "remove") registerGeometryLods(source, []);
        else {
          low.attributes.position.setX(0, low.attributes.position.getX(0) + 0.5);
          low.attributes.position.needsUpdate = true;
          if (change === "mutate-and-append") registerGeometryLods(source, [low, next]);
        }
        f.batcher.render(f.renderer, f.scene, f.camera);
      } finally {
        f.batcher.dispose();
        low.dispose();
        next.dispose();
      }
    }
  });
  test("late LOD capacity growth retains IDs when packed indices need 32 bits", () => {
    const f = fixture();
    const source = f.a.geometry;
    const low = new BufferGeometry();
    const vertices = 65520;
    low.setAttribute("position", new Float32BufferAttribute(new Float32Array(vertices * 3), 3));
    low.attributes.position.setX(vertices - 1, 1);
    low.setAttribute("normal", new Float32BufferAttribute(new Float32Array(vertices * 3), 3));
    low.setIndex([0, 1, vertices - 1]);
    let batch;
    f.renderer.render = (scene) => {
      const current = scene.children.find((object) => object.isBatchedMesh);
      assert.ok(current);
      if (batch) assert.ok(current === batch, "capacity growth retains the batch");
      batch = current;
    };
    try {
      f.batcher.render(f.renderer, f.scene, f.camera);
      const originalId = batch.getGeometryIdAt(0);
      assert.ok(batch.geometry.index.array instanceof Uint16Array);
      registerGeometryLods(source, [low]);
      f.a.geometry = low;
      f.batcher.render(f.renderer, f.scene, f.camera);
      assert.ok(batch.geometry.index.array instanceof Uint32Array);
      const range = batch.getGeometryRangeAt(batch.getGeometryIdAt(0));
      assert.equal(batch.geometry.index.getX(range.start + 2), range.vertexStart + vertices - 1);
      f.a.geometry = source;
      f.batcher.render(f.renderer, f.scene, f.camera);
      assert.equal(batch.getGeometryIdAt(0), originalId);
    } finally {
      f.batcher.dispose();
      low.dispose();
    }
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

  test("camera motion reuses serialized group keys while in-place grouping changes take effect", () => {
    const f = fixture();
    const calls = [0, 0];
    for (const [index, mesh] of [f.a, f.b].entries()) {
      const color = mesh.material.emissive;
      const getHexString = color.getHexString;
      color.getHexString = function (...args) {
        calls[index]++;
        return getHexString.apply(this, args);
      };
    }
    let grouped = true;
    f.renderer.render = (scene) => {
      assert.equal(
        scene.children.some((object) => object.isBatchedMesh),
        grouped,
      );
    };
    try {
      for (let frame = 0; frame < 20; frame++) {
        f.camera.position.x = frame / 10;
        f.a.position.x = frame / 10;
        f.batcher.render(f.renderer, f.scene, f.camera);
      }
      assert.deepEqual(calls, [1, 1], "unchanged group fields must not be serialized per frame");
      for (const mutate of [
        (mesh) => {
          mesh.material.defines.CABANE_GROUP_TEST = true;
        },
        (mesh) => mesh.material.emissive.setRGB(0.2, 0.4, 0.6),
        (mesh) => {
          mesh.material.emissiveIntensity = 0.7;
        },
        (mesh) => {
          mesh.receiveShadow = true;
        },
        (mesh) => {
          mesh.layers.mask = 3;
        },
      ]) {
        mutate(f.a);
        grouped = false;
        f.batcher.render(f.renderer, f.scene, f.camera);
        mutate(f.b);
        grouped = true;
        f.batcher.render(f.renderer, f.scene, f.camera);
      }
      assert.deepEqual(calls, [6, 6], "each source serializes only when its group fields change");
    } finally {
      f.batcher.dispose();
    }
  });

  test("baked transforms retain their batchability check across camera frames and fallback draws", () => {
    const f = fixture();
    let checks = 0;
    const determinant = f.a.matrixWorld.determinant;
    f.a.matrixWorld.determinant = function () {
      checks++;
      return determinant.call(this);
    };
    let visible = true;
    f.renderer.render = (scene) => {
      const batch = scene.children.find((object) => object.isBatchedMesh);
      assert.equal(batch.getVisibleAt(0), visible);
      if (!visible) assert.equal(f.a.material.visible, true);
    };
    try {
      for (let frame = 0; frame < 20; frame++) {
        f.camera.position.x = frame / 10;
        f.batcher.render(f.renderer, f.scene, f.camera);
      }
      assert.equal(checks, 1, "an unchanged baked transform is validated once");
      f.a.scale.x = -1;
      visible = false;
      f.batcher.render(f.renderer, f.scene, f.camera);
      f.a.scale.x = 1;
      visible = true;
      f.batcher.render(f.renderer, f.scene, f.camera);
      f.a.matrixAutoUpdate = false;
      f.a.matrix.makeShear(0.2, 0, 0, 0, 0, 0);
      visible = false;
      f.batcher.render(f.renderer, f.scene, f.camera);
      f.a.matrix.identity();
      visible = true;
      f.batcher.render(f.renderer, f.scene, f.camera);
      assert.equal(
        checks,
        1,
        "changed transforms fallback until the original baked matrix returns",
      );
      // A scene-root transform cancels out of the batch's local matrix while
      // still changing world-space reflection/shear eligibility.
      f.scene.scale.x = -1;
      visible = false;
      f.batcher.render(f.renderer, f.scene, f.camera);
      f.scene.scale.x = 1;
      visible = true;
      f.batcher.render(f.renderer, f.scene, f.camera);
      assert.equal(checks, 2, "changed scene transforms must validate world-space eligibility");
    } finally {
      f.batcher.dispose();
    }
  });
  test("editing one mesh in a large scene preserves unrelated packed buffers", () => {
    const f = fixture();
    f.batcher.dispose();
    f.batcher = new SceneToonBatcher(true);
    f.scene.remove(f.a, f.b);
    const meshes = Array.from({ length: 320 }, (_, index) => {
      const mesh = new Mesh(new BoxGeometry(), new MeshToonMaterial());
      mesh.position.x = index;
      f.scene.add(mesh);
      return mesh;
    });
    let expectedCount = meshes.length;
    let packed;
    f.renderer.render = (scene) => {
      packed = scene.children.filter((object) => object.isBatchedMesh);
      assert.equal(
        packed.reduce((count, batch) => count + batch.instanceCount, 0),
        expectedCount,
      );
    };
    try {
      f.batcher.render(f.renderer, f.scene, f.camera);
      const before = new Set(packed.map((batch) => batch.geometry));
      f.scene.remove(meshes[0]);
      expectedCount--;
      f.batcher.render(f.renderer, f.scene, f.camera);
      assert.ok(
        packed.filter((batch) => before.has(batch.geometry)).length >= 14,
        "a local edit must retain the other scene partitions' GPU buffers",
      );
      f.scene.remove(...meshes.slice(1, 64));
      expectedCount = 256;
      f.batcher.render(f.renderer, f.scene, f.camera);
      assert.equal(packed.length, 1, "crossing the partition threshold keeps every source");
      f.scene.add(...meshes.slice(1, 64));
      expectedCount = 319;
      f.batcher.render(f.renderer, f.scene, f.camera);
      const restored = new Set(packed.map((batch) => batch.geometry));
      const nested = new Group();
      const parts = meshes.slice(64, 72);
      nested.add(...parts);
      f.scene.add(nested);
      f.batcher.render(f.renderer, f.scene, f.camera);
      assert.ok(
        packed.some((batch) => restored.has(batch.geometry)),
        "reparenting model parts retains unrelated partitions and renders every source",
      );
    } finally {
      f.batcher.dispose();
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  });
  test("an explicit batch root moves preserved buffers while local edits and unsafe transforms fallback", () => {
    const f = fixture();
    const root = new Group();
    root.userData.toonBatchRoot = true;
    root.add(f.a, f.b);
    f.scene.add(root);
    f.a.position.set(0.2, 0.1, 0.4);
    f.b.position.set(2, 0.3, 1);
    f.scene.position.set(2, 1, 3);
    f.scene.rotation.y = 0.35;
    f.scene.scale.setScalar(1.2);
    let previous;
    let moved = false;
    let visible = [true, true];
    f.renderer.render = (scene) => {
      const batch = scene.children.find((object) => object.isBatchedMesh);
      // A real renderer can refresh matrices after the temporary mesh attaches.
      scene.updateMatrixWorld(true);
      if (previous) assert.equal(batch.geometry, previous, "root motion reuses packed buffers");
      previous = batch.geometry;
      assert.deepEqual([batch.getVisibleAt(0), batch.getVisibleAt(1)], visible);
      assert.ok(
        batch.matrixWorld.elements.every(
          (value, index) => Math.abs(value - root.matrixWorld.elements[index]) < 1e-12,
        ),
      );
      if (moved)
        assert.equal(
          batch.matrixAutoUpdate,
          false,
          "the renderer retains the explicit local matrix",
        );
      if (visible[0]) {
        const packed = new Vector3()
          .fromBufferAttribute(batch.geometry.attributes.position, 0)
          .applyMatrix4(batch.matrixWorld);
        const authored = new Vector3()
          .fromBufferAttribute(f.a.geometry.attributes.position, 0)
          .applyMatrix4(f.a.matrixWorld);
        assert.ok(
          packed.distanceTo(authored) < 1e-6,
          "local baking preserves the authored world pose",
        );
      } else assert.equal(f.a.layers.mask, 1, "local motion/unsafe roots retain original draws");
    };
    try {
      f.batcher.render(f.renderer, f.scene, f.camera);
      root.position.y = -2.6;
      moved = true;
      f.batcher.render(f.renderer, f.scene, f.camera);
      f.a.position.x += 0.4;
      visible = [false, true];
      f.batcher.render(f.renderer, f.scene, f.camera);
      f.a.position.x = 0.2;
      visible = [true, true];
      f.batcher.render(f.renderer, f.scene, f.camera);
      root.scale.x = -1;
      visible = [false, false];
      f.batcher.render(f.renderer, f.scene, f.camera);
      root.scale.x = 1;
      root.matrixAutoUpdate = false;
      root.matrix.makeShear(0.2, 0, 0, 0, 0, 0).setPosition(0, -2.6, 0);
      f.batcher.render(f.renderer, f.scene, f.camera);
      root.matrix.makeTranslation(0, -2.6, 0);
      visible = [true, true];
      f.batcher.render(f.renderer, f.scene, f.camera);
    } finally {
      f.batcher.dispose();
    }
  });
  test("identity batch roots preserve fractional nested transforms across floor offsets", () => {
    const f = fixture();
    const root = new Group(),
      nested = new Group();
    root.userData.toonBatchRoot = true;
    nested.position.set(0.31, 0.1, 0.7);
    nested.rotation.set(0.1, 0.2, 0.3);
    nested.scale.set(1.1, 0.9, 1.2);
    nested.add(f.a, f.b);
    root.add(nested);
    f.scene.add(root);
    f.a.position.y = 0.1;
    f.b.position.y = 2.4;
    let previous;
    f.renderer.render = (scene) => {
      const batch = scene.children.find((object) => object.isBatchedMesh);
      if (previous) assert.equal(batch.geometry, previous);
      previous = batch.geometry;
      assert.deepEqual([batch.getVisibleAt(0), batch.getVisibleAt(1)], [true, true]);
    };
    try {
      for (const height of [0, -3.2, 0]) {
        root.position.y = height;
        f.batcher.render(f.renderer, f.scene, f.camera);
      }
    } finally {
      f.batcher.dispose();
    }
  });
  test("reflected or sheared root-local geometry falls back even when world transforms cancel", () => {
    for (const reflected of [true, false]) {
      const f = fixture(),
        root = new Group();
      root.userData.toonBatchRoot = true;
      root.add(f.a, f.b);
      f.scene.add(root);
      if (reflected) {
        root.scale.x = -1;
        f.a.scale.x = f.b.scale.x = -1;
      } else {
        root.matrixAutoUpdate = f.a.matrixAutoUpdate = f.b.matrixAutoUpdate = false;
        root.matrix.makeShear(0.2, 0, 0, 0, 0, 0);
        f.a.matrix.makeShear(-0.2, 0, 0, 0, 0, 0);
        f.b.matrix.copy(f.a.matrix);
      }
      f.renderer.render = (scene) => {
        assert.ok(f.a.matrixWorld.determinant() > 0);
        const batch = scene.children.find((object) => object.isBatchedMesh);
        assert.deepEqual([batch.getVisibleAt(0), batch.getVisibleAt(1)], [false, false]);
        assert.equal(f.a.layers.mask, 1);
      };
      try {
        f.batcher.render(f.renderer, f.scene, f.camera);
      } finally {
        f.batcher.dispose();
      }
    }
  });
  test("explicit batch roots preserve custom world matrices on meshes and ancestors", () => {
    for (const manualAncestor of [false, true]) {
      const f = fixture(),
        root = new Group();
      root.userData.toonBatchRoot = true;
      root.position.y = -3.2;
      const manual = manualAncestor ? new Group() : f.a;
      manual.matrixWorldAutoUpdate = false;
      manual.matrixWorld.makeTranslation(1, 4, 2);
      if (manualAncestor) manual.add(f.a);
      root.add(manual, f.b);
      f.scene.add(root);
      let moved = false,
        previous;
      f.renderer.render = (scene) => {
        const batch = scene.children.find((object) => object.isBatchedMesh);
        scene.updateMatrixWorld(true);
        if (previous) assert.equal(batch.geometry, previous);
        previous = batch.geometry;
        assert.equal(
          f.a.matrixWorld.elements[13],
          4,
          "the custom world pose remains authoritative",
        );
        assert.equal(batch.getVisibleAt(0), !moved);
        if (!moved) {
          const packed = new Vector3()
            .fromBufferAttribute(batch.geometry.attributes.position, 0)
            .applyMatrix4(batch.matrixWorld);
          const authored = new Vector3()
            .fromBufferAttribute(f.a.geometry.attributes.position, 0)
            .applyMatrix4(f.a.matrixWorld);
          assert.ok(packed.distanceTo(authored) < 1e-6);
        } else
          assert.equal(
            f.a.layers.mask,
            1,
            "root motion leaves custom-world meshes on their native draw",
          );
      };
      try {
        f.batcher.render(f.renderer, f.scene, f.camera);
        root.position.y = -4.8;
        moved = true;
        f.batcher.render(f.renderer, f.scene, f.camera);
      } finally {
        f.batcher.dispose();
      }
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

  test("packed geometry carries conservative bounds without reading vertex buffers during draw", () => {
    const f = fixture();
    const source = f.a.geometry;
    const low = new BoxGeometry(0.8, 0.8, 0.8);
    registerGeometryLods(source, [low]);
    // Authored bounds can be stale; packing follows the actual revision's vertices.
    source.boundingBox = new Box3(new Vector3(-0.1, -0.1, -0.1), new Vector3(0.1, 0.1, 0.1));
    f.a.position.set(10000.15, 2.3, -4.1);
    f.a.rotation.y = 0.43;
    f.a.scale.set(1.3, 2.1, 0.7);
    f.scene.position.y = 3;
    f.scene.rotation.y = 0.17;
    let previous;
    let reused = false;
    f.renderer.render = (scene) => {
      const batch = scene.children.find((object) => object.isBatchedMesh);
      if (reused) assert.equal(batch.geometry, previous);
      else if (previous) assert.notEqual(batch.geometry, previous);
      previous = batch.geometry;
      const position = batch.geometry.attributes.position;
      const getX = position.getX;
      let reads = 0;
      position.getX = function (index) {
        reads++;
        return getX.call(this, index);
      };
      const entries = [0, 1].map((instance) => {
        const id = batch.getGeometryIdAt(instance);
        return {
          id,
          sphere: batch.getBoundingSphereAt(id, new Sphere()),
          box: batch.getBoundingBoxAt(id, new Box3()),
        };
      });
      position.getX = getX;
      assert.equal(
        reads,
        0,
        "first render and LOD switches must not scan packed vertices for bounds",
      );
      for (const { id, sphere, box } of entries) {
        const range = batch.getGeometryRangeAt(id);
        for (let i = range.start; i < range.start + range.count; i++) {
          const vertex = new Vector3().fromBufferAttribute(position, batch.geometry.index.getX(i));
          assert.ok(box.containsPoint(vertex), "packed box contains transformed Float32 vertices");
          assert.ok(
            sphere.containsPoint(vertex),
            "packed sphere contains every transformed vertex",
          );
        }
      }
    };
    try {
      f.batcher.render(f.renderer, f.scene, f.camera);
      reused = true;
      f.a.geometry = low;
      f.batcher.render(f.renderer, f.scene, f.camera);
      f.a.geometry = source;
      const position = source.attributes.position;
      position.setX(0, position.getX(0) + 3);
      position.needsUpdate = true;
      reused = false;
      f.batcher.render(f.renderer, f.scene, f.camera);
    } finally {
      f.batcher.dispose();
      low.dispose();
    }
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
