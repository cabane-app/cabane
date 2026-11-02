import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import {
  Box3,
  CylinderGeometry,
  IcosahedronGeometry,
  Matrix4,
  Object3D,
  Raycaster,
  SphereGeometry,
  Vector3,
} from "three";
import { withModules } from "./test-server.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { ClippedHedge } = await load("/packages/engine/src/hedges/ClippedHedge.tsx");
  const { BushyHedge } = await load("/packages/engine/src/hedges/BushyHedge.tsx");
  const { RoundedHedge } = await load("/packages/engine/src/hedges/RoundedHedge.tsx");
  const compare = (mesh, index, geometry, transform) => {
    for (const attribute of ["position", "normal", "uv"])
      assert.deepEqual(
        mesh.geometry.attributes[attribute].array,
        geometry.attributes[attribute].array,
      );
    assert.deepEqual(mesh.geometry.index?.array, geometry.index?.array);
    const matrix = new Matrix4();
    mesh.getMatrixAt(index, matrix);
    transform.updateMatrix();
    matrix.elements.forEach((v, i) =>
      assert.ok(
        Math.abs(v - transform.matrix.elements[i]) < 1e-6,
        "instance preserves local transform within float32 precision",
      ),
    );
    const bounds = new Box3()
      .setFromBufferAttribute(geometry.attributes.position)
      .applyMatrix4(matrix);
    assert.ok(
      mesh.boundingBox.clone().expandByScalar(1e-6).containsBox(bounds),
      "batch bounds cover every instance",
    );
  };
  test("clipped hedge cap owns the visible top and upper sides without coplanar body faces", async () => {
    const renderer = await create(
      createElement(ClippedHedge, { length: 6, height: 1.4, width: 0.65 }),
    );
    try {
      for (const [length, height, width] of [
        [6, 1.4, 0.65],
        [0.1, 0.2, 0.2],
        [12, 5, 3],
      ]) {
        await renderer.update(createElement(ClippedHedge, { length, height, width }));
        const solids = renderer.scene
          .findAll((node) => node.instance.geometry?.type === "BoxGeometry")
          .map((node) => node.instance);
        solids.forEach((mesh) => mesh.updateMatrixWorld(true));
        const topHits = new Raycaster(
          new Vector3(length * 0.2, height + 1, 0),
          new Vector3(0, -1, 0),
        ).intersectObjects(solids);
        assert.equal(topHits[0].object.material.color.getHexString(), "668847");
        assert.ok(Math.abs(topHits[0].point.y - height) < 1e-6, "height stays unchanged");
        assert.ok(
          topHits[1].distance - topHits[0].distance > 0.049,
          "body top stays below the cap instead of fighting for the same depth",
        );
        const sideHits = new Raycaster(
          new Vector3(length * 0.2, height - 0.025, width / 2 + 1),
          new Vector3(0, 0, -1),
        ).intersectObjects(solids);
        assert.equal(sideHits.length, 1, "only the cap covers the upper side band");
        assert.equal(sideHits[0].object.material.color.getHexString(), "668847");
        const bounds = new Box3();
        solids.forEach((mesh) => bounds.expandByObject(mesh));
        assert.ok(Math.abs(bounds.min.y) < 1e-6, "body still reaches the ground");
      }
    } finally {
      await renderer.unmount();
    }
  });
  test("bushy hedges preserve all original solids, colors, transforms and shadows, including resizing", async () => {
    const renderer = await create(
      createElement(BushyHedge, { length: 3, height: 1.4, width: 0.6 }),
    );
    try {
      for (const [length, height, width] of [
        [3, 1.4, 0.6],
        [0.1, 0.8, 1],
        [8, 2.2, 0.4],
      ]) {
        await renderer.update(createElement(BushyHedge, { length, height, width }));
        const meshes = renderer.scene
          .findAll((n) => n.instance.isInstancedMesh)
          .map((n) => n.instance);
        const count = Math.min(180, Math.max(2, Math.ceil(length / (width * 0.3))));
        assert.equal(meshes.length, 4);
        assert.equal(
          meshes.reduce((sum, m) => sum + m.count, 0),
          count * 2,
        );
        for (let i = 0; i < count; i++) {
          const t = new Object3D(),
            x = -length / 2 + ((i + 0.5) * length) / count;
          t.position.set(x, height * 0.22, 0);
          compare(meshes[0], i, new CylinderGeometry(0.025, 0.045, height * 0.44, 5), t);
          t.position.set(x, height * 0.52, Math.sin(i * 2.4) * width * 0.08);
          t.rotation.y = i * 1.7;
          t.scale.set(
            Math.min(width * 0.6, length / 2),
            height * 0.48 * (0.86 + Math.sin(i * 7.31) * 0.12),
            width * 0.42,
          );
          const leaf = meshes[1 + (i % 3)];
          compare(leaf, Math.floor(i / 3), new IcosahedronGeometry(1, 1), t);
          assert.equal(leaf.material.color.getHexString(), ["76934a", "4f773e", "628443"][i % 3]);
          assert.equal(leaf.receiveShadow, true);
        }
        assert.ok(meshes.every((m) => m.castShadow));
      }
    } finally {
      await renderer.unmount();
    }
  });
  test("rounded hedge retains sphere detail and raycast occlusion after batching", async () => {
    const length = 3,
      height = 1.4,
      width = 0.6;
    const renderer = await create(createElement(RoundedHedge, { length, height, width }));
    try {
      const mesh = renderer.scene.find((n) => n.instance.isInstancedMesh).instance;
      const count = Math.min(160, Math.max(1, Math.ceil(length / (width * 0.45))));
      assert.equal(mesh.count, count);
      for (let i = 0; i < count; i++) {
        const t = new Object3D();
        t.position.set(-length / 2 + ((i + 0.5) * length) / count, height / 2, 0);
        t.scale.set(Math.min(width * 0.65, length / 2), height / 2, width / 2);
        compare(mesh, i, new SphereGeometry(1, 10, 8), t);
      }
      mesh.updateMatrixWorld(true);
      assert.ok(
        new Raycaster(new Vector3(0, height / 2, 3), new Vector3(0, 0, -1)).intersectObject(mesh)
          .length > 0,
      );
    } finally {
      await renderer.unmount();
    }
  });
});
