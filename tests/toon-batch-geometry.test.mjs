import assert from "node:assert/strict";
import test from "node:test";
import {
  BatchedMesh,
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Sphere,
  Vector3,
} from "three";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { ToonBatchGeometryPacker } = await load(
    "/packages/engine/src/scene-batching/toon-batch-geometry.ts",
  );
  const { SceneGeometryLod } = await load(
    "/packages/engine/src/scene-batching/SceneGeometryLod.ts",
  );
  const geometry = (indexed = true) => {
    const value = new BufferGeometry();
    value.setAttribute(
      "position",
      new Float32BufferAttribute(
        [
          -0.8, 0.1, 0.2, 1.4, -0.2, 0.3, 0.5, 1.2, -0.6, -0.4, 0.7, 0.9, 0.2, -1.1, 0.4, 2.3, 0.8,
          -1.4,
        ],
        3,
      ),
    );
    value.setAttribute(
      "normal",
      new Float32BufferAttribute([0, 0, 0, 0, 2, 1, 0.3, -0.4, 0.5, -1, 1, 0, 0, 1, 0, 1, 2, 3], 3),
    );
    value.setAttribute(
      "color",
      new Float32BufferAttribute(
        [0, 0.3, 1, 0.2, 0.4, 0.6, 1, 0.8, 0.1, 0.5, 0.2, 0.7, 0.1, 0.9, 0.2, 0.7, 0.4, 0.3],
        3,
      ),
    );
    if (indexed) value.setIndex([0, 1, 2]);
    return value;
  };
  const input = (matrix = new Matrix4(), ordinaryDepth = true, vertexColors = true) => ({
    matrix,
    ordinaryDepth,
    vertexColors,
    transformEligible: false,
    color: new Color(0.3, 0.6, 0.8),
  });
  const batch = (source) =>
    new BatchedMesh(
      1,
      source.attributes.position.count,
      source.index?.count ?? source.attributes.position.count,
      new MeshToonMaterial(),
    );
  const nativePacking = (source, options) => {
    const expected = source.clone();
    if (!expected.index)
      expected.setIndex(Array.from({ length: source.attributes.position.count }, (_, i) => i));
    expected.applyMatrix4(options.matrix);
    const values = [];
    for (let i = 0; i < source.attributes.position.count; i++)
      for (const [channel, method] of [
        ["r", "getX"],
        ["g", "getY"],
        ["b", "getZ"],
      ])
        values.push(
          options.color[channel] * (options.vertexColors ? source.attributes.color[method](i) : 1),
        );
    expected.setAttribute("color", new Float32BufferAttribute(values, 3));
    return expected;
  };

  test("typed toon packing matches native Three transforms, normals, colors and depth bounds", () => {
    const transformed = new Matrix4().compose(
      new Vector3(10000.15, 2.3, -4.1),
      new Quaternion().setFromEuler(new Euler(0.2, 0.43, -0.1)),
      new Vector3(1.3, 2.1, 0.7),
    );
    const perspective = new Matrix4().makeRotationY(0.4);
    perspective.elements[3] = 0.08;
    perspective.elements[7] = -0.04;
    perspective.elements[11] = 0.03;
    for (const matrix of [
      new Matrix4(),
      transformed,
      new Matrix4().makeShear(0.2, -0.1, 0.1, 0, 0, 0),
      new Matrix4().makeScale(-1, 2, 0.5),
      new Matrix4().makeScale(0, 1, 1),
      perspective,
    ])
      for (const indexed of [false, true])
        for (const vertexColors of [false, true])
          for (const ordinaryDepth of [false, true]) {
            const source = geometry(indexed),
              options = input(matrix, ordinaryDepth, vertexColors);
            const original = source.attributes.position.array.slice();
            const expected = nativePacking(source, options),
              actualBatch = batch(source),
              referenceBatch = batch(source);
            const packer = new ToonBatchGeometryPacker();
            try {
              const actual = packer.add(actualBatch, source, "initial", options);
              const reference = referenceBatch.addGeometry(expected);
              for (const name of ["position", "normal", "color"])
                assert.deepEqual(
                  actualBatch.geometry.attributes[name].array,
                  referenceBatch.geometry.attributes[name].array,
                  name,
                );
              assert.deepEqual(
                actualBatch.geometry.index.array,
                referenceBatch.geometry.index.array,
              );
              assert.deepEqual(
                source.attributes.position.array,
                original,
                "packing retains authored vertices",
              );
              if (!ordinaryDepth) {
                assert.deepEqual(
                  actualBatch.getBoundingBoxAt(actual, new Box3()),
                  referenceBatch.getBoundingBoxAt(reference, new Box3()),
                );
                assert.deepEqual(
                  actualBatch.getBoundingSphereAt(actual, new Sphere()),
                  referenceBatch.getBoundingSphereAt(reference, new Sphere()),
                );
              }
            } finally {
              actualBatch.dispose();
              referenceBatch.dispose();
              actualBatch.material.dispose();
              referenceBatch.material.dispose();
              expected.dispose();
              source.dispose();
              packer.clear();
            }
          }
  });

  test("packing avoids per-component attribute access and prepares missing source spheres for LOD", () => {
    const source = geometry(),
      mesh = batch(source),
      packer = new ToonBatchGeometryPacker();
    const expected = source.clone();
    expected.computeBoundingSphere();
    let reads = 0;
    for (const attribute of Object.values(source.attributes))
      for (const method of ["getX", "getY", "getZ"]) {
        const original = attribute[method];
        attribute[method] = function (...args) {
          reads++;
          return original.apply(this, args);
        };
      }
    try {
      packer.add(mesh, source, "initial", input());
      assert.equal(
        reads,
        0,
        "Float32 inputs are transformed and bounded directly in one packing pass",
      );
      assert.deepEqual(
        source.boundingSphere,
        expected.boundingSphere,
        "LOD receives the exact native source sphere",
      );
    } finally {
      source.dispose();
      expected.dispose();
      mesh.dispose();
      mesh.material.dispose();
      packer.clear();
    }
  });

  test("prepared source spheres refresh on vertex revisions while authored spheres retain ownership", () => {
    const source = geometry(),
      packer = new ToonBatchGeometryPacker();
    const pack = (revision) => {
      const mesh = batch(source);
      try {
        packer.add(mesh, source, revision, input());
      } finally {
        mesh.dispose();
        mesh.material.dispose();
      }
    };
    try {
      pack("first");
      assert.ok(source.boundingSphere, "first packing prepares the source's missing sphere");
      source.attributes.position.setX(0, -7);
      source.attributes.position.needsUpdate = true;
      const expected = source.clone();
      expected.computeBoundingSphere();
      pack("moved");
      assert.deepEqual(source.boundingSphere, expected.boundingSphere);
      expected.dispose();
      const edited = source.boundingSphere;
      edited.center.set(6, 7, 8);
      edited.radius = 99;
      source.attributes.position.setX(0, -8);
      source.attributes.position.needsUpdate = true;
      pack("edited-in-place");
      assert.equal(source.boundingSphere, edited);
      assert.equal(edited.radius, 99, "in-place authored edits relinquish helper ownership");
      const authored = new Sphere(new Vector3(10, 20, 30), 80);
      source.boundingSphere = authored;
      source.attributes.position.setX(0, -9);
      source.attributes.position.needsUpdate = true;
      pack("authored");
      assert.equal(source.boundingSphere, authored);
      assert.equal(authored.radius, 80);
      assert.deepEqual(authored.center.toArray(), [10, 20, 30]);
    } finally {
      source.dispose();
      packer.clear();
    }
  });

  test("prepared source sphere ownership survives active packers, clear and recreation", () => {
    const source = geometry();
    const first = new ToonBatchGeometryPacker(),
      second = new ToonBatchGeometryPacker(),
      recreated = new ToonBatchGeometryPacker();
    const pack = (packer) => {
      const mesh = batch(source);
      try {
        packer.add(mesh, source, String(source.attributes.position.version), input());
      } finally {
        mesh.dispose();
        mesh.material.dispose();
      }
    };
    try {
      pack(first);
      pack(second);
      for (const [index, packer] of [second, first, first, recreated, second].entries()) {
        if (index === 2) first.clear();
        source.attributes.position.setX(0, 100 * (index + 1));
        source.attributes.position.needsUpdate = true;
        const expected = source.clone();
        try {
          expected.computeBoundingSphere();
          pack(packer);
          assert.deepEqual(
            source.boundingSphere,
            expected.boundingSphere,
            "the current vertex revision refreshes a helper-owned sphere across packer lifetimes",
          );
        } finally {
          expected.dispose();
        }
      }
      const authored = source.boundingSphere;
      authored.center.set(4, 5, 6);
      authored.radius = 800;
      source.attributes.position.setX(0, 600);
      source.attributes.position.needsUpdate = true;
      pack(recreated);
      assert.equal(source.boundingSphere, authored);
      assert.equal(authored.radius, 800, "another packer preserves in-place authored bounds");
      assert.deepEqual(authored.center.toArray(), [4, 5, 6]);
      source.boundingSphere = new Sphere(new Vector3(7, 8, 9), 900);
      source.attributes.position.setX(0, 700);
      source.attributes.position.needsUpdate = true;
      pack(first);
      assert.equal(
        source.boundingSphere.radius,
        900,
        "a cleared packer preserves replacement bounds",
      );
      assert.deepEqual(source.boundingSphere.center.toArray(), [7, 8, 9]);
    } finally {
      source.dispose();
      first.clear();
      second.clear();
      recreated.clear();
    }
  });

  test("late LOD selection reuses packed source spheres without native vertex rescans", async () => {
    const source = new BoxGeometry(1, 1, 1, 8, 8, 8);
    const material = new MeshToonMaterial();
    const scene = new Scene();
    scene.add(new Mesh(source, material));
    const camera = new PerspectiveCamera();
    camera.position.z = 5;
    const mesh = batch(source),
      packer = new ToonBatchGeometryPacker();
    let scans = 0;
    const compute = source.computeBoundingSphere;
    source.computeBoundingSphere = function () {
      scans++;
      return compute.call(this);
    };
    const lod = new SceneGeometryLod(
      () => {},
      async () => [{ geometry: source.clone(), error: 0.01 }],
    );
    try {
      packer.add(mesh, source, "source", input(new Matrix4(), true, false));
      lod.render(scene, camera, 800, () => {});
      await lod.ready;
      lod.render(scene, camera, 800, () => {});
      assert.equal(scans, 0, "publishing LODs must not rescan already packed original geometry");
    } finally {
      lod.dispose();
      source.dispose();
      material.dispose();
      mesh.dispose();
      mesh.material.dispose();
      packer.clear();
    }
  });
});
