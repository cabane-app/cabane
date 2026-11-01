import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { homeManifest, ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  const { SceneItemRenderer, validateHomeProject } = await load("/packages/engine/src/index.ts");
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const { stableFurnishingRegistry } = await load("/packages/catalog/src/furnishing/index.ts");

  test("every built-in furnishing renders independent height changes", async () => {
    for (const [modelId, definition] of Object.entries(stableFurnishingRegistry)) {
      const boxes = [];
      for (const factor of [1, 1.3]) {
        const size = [...definition.defaultSize];
        size[1] *= factor;
        const renderer = await create(
          createElement(definition.component, {
            size,
            entityStatesBySlotId: {},
            reducedMotion: true,
            walkMode: false,
            onInteract() {},
          }),
        );
        try {
          renderer.scene.instance.updateMatrixWorld(true);
          boxes.push(new Box3().setFromObject(renderer.scene.instance));
        } finally {
          await renderer.unmount();
        }
      }
      for (let axis = 0; axis < 3; axis++) {
        const key = ["x", "y", "z"][axis];
        const before = boxes[0].max[key] - boxes[0].min[key];
        const after = boxes[1].max[key] - boxes[1].min[key];
        assert.ok(
          before > 0 && Math.abs(after - before * (axis === 1 ? 1.3 : 1)) < 0.003,
          `${modelId}: ${key} extent ${before} -> ${after}`,
        );
      }
    }
  });

  test("outdoor ground contact validates without allowing furniture below indoor floors or terrain", () => {
    assert.deepEqual(validateHomeProject(ownerHomeProject, ownerProjectRegistries).issues, []);
    const item = ownerHomeProject.sceneItems.find((item) => item.modelId === "pool-chaise-longue");
    for (const [floorId, at, elevationMeters] of [
      ["ground-floor", [4.7, 23.5], -0.051],
      ["ground-floor", [3, 4], -0.001],
      ["first-floor", [18, 4], -0.001],
    ]) {
      const invalid = { ...item, floorId, placement: { ...item.placement, at, elevationMeters } };
      assert.ok(
        validateHomeProject(
          { ...ownerHomeProject, sceneItems: [invalid] },
          ownerProjectRegistries,
        ).issues.some((issue) => issue.code === "project.item-elevation"),
      );
    }
  });

  test("the villa renders every furnishing with its real model on its owning floor", async () => {
    const items = homeManifest.sceneItems.filter((item) => item.kind === "furnishing");
    const renderer = await create(
      createElement(
        "group",
        {},
        ...items.map((item) =>
          createElement(SceneItemRenderer, {
            key: item.id,
            item,
            floor: homeManifest.floors.find((floor) => floor.id === item.floorId),
            furnishingModels: homeManifest.extensions.furnishingModels,
            deviceModels: {},
            entityStatesBySlotId: {},
            reducedMotion: true,
            walkMode: false,
            onInteract() {},
            liveMediaByEntityId: {},
          }),
        ),
      ),
    );
    try {
      assert.deepEqual(
        renderer.scene.findAll((node) =>
          String(node.props.name ?? "").startsWith("missing-model-"),
        ),
        [],
      );
      assert.equal(
        renderer.scene.findAll((node) => String(node.props.name ?? "").startsWith("scene-item-"))
          .length,
        items.length,
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("rug finishes change their palettes while preserving the envelope at supported sizes", async () => {
    const definition = stableFurnishingRegistry["neutral-area-rug"];
    const palettes = new Set();
    for (const { id: variant } of definition.variants) {
      for (const size of [definition.defaultSize, [4.4, 0.015, 3.3]]) {
        const renderer = await create(createElement(definition.component, { size, variant }));
        try {
          const scene = renderer.scene.instance;
          scene.updateMatrixWorld(true);
          const box = new Box3().setFromObject(scene);
          const extent = box.max.clone().sub(box.min).toArray();
          extent.forEach((value, axis) => assert.ok(Math.abs(value - size[axis]) < 0.001));
          const colors = new Set();
          scene.traverse((node) => {
            if (node.material?.isMeshToonMaterial) colors.add(node.material.color.getHexString());
          });
          palettes.add([...colors].sort().join(","));
        } finally {
          await renderer.unmount();
        }
      }
    }
    assert.equal(palettes.size, definition.variants.length);
  });

  test("countertop finishes preserve resized slabs, appliance clearance and the open L corner", async () => {
    const ids = ["countertop", "corner-countertop"];
    for (const modelId of ids) {
      const definition = stableFurnishingRegistry[modelId];
      const palettes = new Set();
      for (const { id: variant } of definition.variants) {
        for (const factor of [
          [1, 1, 1],
          [1.6, 0.5, 0.8],
        ]) {
          const size = definition.defaultSize.map((value, axis) => value * factor[axis]);
          const renderer = await create(createElement(definition.component, { size, variant }));
          try {
            const scene = renderer.scene.instance;
            scene.position.y = 0.87;
            scene.updateMatrixWorld(true);
            const box = new Box3().setFromObject(scene);
            assert.ok(Math.abs(box.min.y - 0.87) < 0.001, "underside leaves room for appliances");
            box
              .getSize(new Vector3())
              .toArray()
              .forEach((value, axis) => {
                assert.ok(Math.abs(value - size[axis]) < 0.001, `${modelId}: resized axis ${axis}`);
              });
            const colors = new Set();
            let triangles = 0,
              meshes = 0;
            scene.traverse((node) => {
              assert.notEqual(
                node.userData.walkCollider,
                true,
                "suspended slab is not a floor obstacle",
              );
              if (!node.material?.isMeshToonMaterial) return;
              colors.add(node.material.color.getHexString());
              meshes++;
              triangles +=
                (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
            });
            assert.ok(meshes <= definition.complexity.visibleMeshes);
            assert.ok(triangles <= definition.complexity.triangles);
            palettes.add([...colors].sort().join(","));
            assert.equal(scene.getObjectByName("countertop-surface").receiveShadow, true);
            const hit = (x, z) =>
              new Raycaster(new Vector3(x, 0, z), new Vector3(0, 1, 0)).intersectObject(
                scene,
                true,
              );
            assert.ok(hit(-size[0] / 4, -size[2] / 4).length, "return arm is solid");
            assert.ok(hit(size[0] / 4, size[2] / 4).length, "front arm is solid");
            if (modelId === "corner-countertop") {
              assert.equal(hit(size[0] / 4, -size[2] / 4).length, 0, "inner corner stays open");
            }
          } finally {
            await renderer.unmount();
          }
        }
      }
      assert.equal(palettes.size, 6, "six distinct material palettes");
    }
  });
});
