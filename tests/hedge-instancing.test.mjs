import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { ClippedHedge } = await load("/packages/engine/src/hedges/ClippedHedge.tsx");
  const { HedgeModel } = await load("/packages/engine/src/hedges/HedgeModel.tsx");
  test("the natural clipped hedge fits the declared envelope as one continuous opaque canopy", async () => {
    const renderer = await create(
      createElement(HedgeModel, { style: "clipped", length: 18, height: 1.35, width: 0.65 }),
    );
    try {
      const meshes = renderer.scene.findAll((node) => node.instance.isMesh);
      assert.equal(meshes.length, 1);
      const mesh = meshes[0].instance;
      assert.equal(mesh.name, "boxwood-canopy");
      assert.equal(mesh.material.transparent, false);
      const box = new Box3().setFromObject(mesh);
      assert.ok(box.min.distanceTo(new Vector3(-9, 0, -0.325)) < 1e-6);
      assert.ok(box.max.distanceTo(new Vector3(9, 1.35, 0.325)) < 1e-6);
      const uv = mesh.geometry.getAttribute("uv");
      const u = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
      assert.equal(Math.max(...u) - Math.min(...u), 18, "leaf scale stays in world metres");
    } finally {
      await renderer.unmount();
    }
  });
  test("stylized clipped hedge cap owns the visible top and upper sides without coplanar body faces", async () => {
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
  for (const [style, expectedShoots] of [
    ["rounded", ["privet-sprays"]],
    ["bushy", ["hazel-sprays"]],
    ["mixed", ["laurel-sprays", "oleander-sprays", "blossom-sprays"]],
  ]) {
    test(`${style} hedges keep a continuous pickable canopy, fitted instanced shoots and a bounded long run`, async () => {
      const dimensions = { length: 5.5, width: 0.8, height: 1.6 };
      const renderer = await create(createElement(HedgeModel, { style, ...dimensions }));
      try {
        const original = renderer.scene
          .findAll((n) => n.instance.isInstancedMesh)
          .map((n) => n.instance);
        assert.deepEqual(
          original.map((mesh) => mesh.name),
          expectedShoots,
        );
        const sprig = original[0].geometry;
        for (const [length, height, width] of [
          [5.5, 1.6, 0.8],
          [0.1, 0.2, 3],
          [1.5, 5, 0.2],
          [80, 2.5, 1.3],
        ]) {
          await renderer.update(createElement(HedgeModel, { style, length, height, width }));
          const meshes = renderer.scene.findAll((n) => n.instance.isMesh).map((n) => n.instance);
          const canopy = meshes.find((mesh) => mesh.name === "continuous-foliage");
          canopy.updateMatrixWorld(true);
          assert.ok(
            meshes.every(
              (mesh) => mesh.castShadow && mesh.receiveShadow && !mesh.material.transparent,
            ),
          );
          const expected = new Box3(
            new Vector3(-length / 2, 0, -width / 2),
            new Vector3(length / 2, height, width / 2),
          ).expandByScalar(1e-5);
          for (const mesh of meshes) {
            assert.ok(
              expected.containsBox(new Box3().setFromObject(mesh)),
              `${mesh.name} fits ${length} × ${height} × ${width}`,
            );
          }
          for (const along of [-0.45, 0, 0.45]) {
            const hits = new Raycaster(
              new Vector3(length * along, height * 0.45, width / 2 + 1),
              new Vector3(0, 0, -1),
            ).intersectObject(canopy);
            assert.ok(hits.length, "solid leaf mass remains pickable between stems");
          }
          const batch = meshes.find((mesh) => mesh.name === expectedShoots[0]);
          if (batch) assert.equal(batch.geometry, sprig, "resizing reuses the sprig geometry");
          const triangles = meshes.reduce(
            (total, mesh) =>
              total + (mesh.geometry.index.count / 3) * (mesh.isInstancedMesh ? mesh.count : 1),
            0,
          );
          assert.ok(
            meshes.length <= 4 && triangles < 42000,
            `bounded running cost: ${meshes.length} meshes, ${triangles} triangles`,
          );
        }
      } finally {
        await renderer.unmount();
      }
    });
  }
});
