import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const BOUNDS_TOLERANCE_METERS = 0.001;

await withModules(async (load) => {
  const { ownerHomeProject, homeExtensions } = await load("/tests/fixtures/bundled-home.ts");
  const { stableFurnishingRegistry } = await load("/packages/catalog/src/furnishing/index.ts");
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const engine = await load("/packages/engine/src/index.ts");
  const { parseWorkspaceImport, exportWorkspaceBackup } = await load(
    "/apps/web/src/workspaces/workspace-transfer.ts",
  );
  const registries = {
    furnishingModels: homeExtensions.furnishingModels,
    deviceModels: { ...stableDeviceRegistry, ...homeExtensions.deviceModels },
  };

  test("the bundled home is assembled directly from portable project data", async () => {
    const [metadata, layout, sceneItems] = await Promise.all(
      ["project", "layout", "items"].map(async (name) =>
        JSON.parse(await readFile(`home/src/${name}.json`, "utf8")),
      ),
    );
    assert.deepEqual(ownerHomeProject, { ...metadata, ...layout, sceneItems });
    assert.equal(ownerHomeProject.floors.length, 2);
    assert.equal(ownerHomeProject.sceneItems.length, 165);
    assert.deepEqual(engine.validateHomeProject(ownerHomeProject, registries).issues, []);
    assert.deepEqual(homeExtensions.roomFurnishings, {});
    const files = await readdir("home/src");
    for (const retired of ["rooms", "project", "floors", "villa-definition.ts"])
      assert.ok(!files.includes(retired));
  });

  test("only the fitted kitchen and its cabinet light need home extensions", () => {
    const custom = new Set();
    for (const item of ownerHomeProject.sceneItems) {
      const registry = item.kind === "furnishing" ? stableFurnishingRegistry : stableDeviceRegistry;
      if (!registry[item.modelId]) custom.add(item.modelId);
    }
    assert.deepEqual([...custom].sort(), ["equipped-kitchen", "kitchen-cabinet-lighting"]);
    assert.deepEqual(Object.keys(homeExtensions.deviceModels), ["kitchen-cabinet-lighting"]);
    assert.deepEqual(
      Object.keys(homeExtensions.furnishingModels).filter((id) => !stableFurnishingRegistry[id]),
      ["equipped-kitchen"],
    );
    assert.ok(ownerHomeProject.sceneItems.some((item) => item.modelId === "counter-stool"));
    assert.ok(ownerHomeProject.sceneItems.some((item) => item.modelId === "woven-pendant"));
    assert.ok(ownerHomeProject.sceneItems.some((item) => item.modelId === "double-bed"));
  });

  test("portable import and full workspace backup use the same project without losing slots", () => {
    const portable = parseWorkspaceImport(
      execFileSync(process.execPath, ["scripts/export-bundled-home.mjs"], { encoding: "utf8" }),
      registries,
    );
    assert.deepEqual(portable.record.draft, ownerHomeProject);
    const record = engine.createSeedProjectRecord(ownerHomeProject);
    const backup = exportWorkspaceBackup(
      {
        name: record.draft.home.name,
        homeAssistantUrl: null,
        hasPublished: record.publishedAt !== 0,
      },
      record,
    );
    const imported = parseWorkspaceImport(backup, registries);
    assert.deepEqual(imported.record.draft, record.draft);
    assert.deepEqual(imported.record.published, record.published);
    assert.deepEqual(imported.record.bindings, record.bindings);
  });

  test("an import without the custom kitchen definitions keeps missing models as warnings", () => {
    const registriesWithoutExtensions = {
      furnishingModels: stableFurnishingRegistry,
      deviceModels: stableDeviceRegistry,
    };
    const parsed = engine.parseHomeProject(engine.serializeHomeProject(ownerHomeProject));
    assert.equal(parsed.valid, true);
    const validation = engine.validateHomeProject(parsed.project, registriesWithoutExtensions);
    assert.equal(validation.valid, true);
    assert.ok(validation.issues.some((issue) => issue.code === "project.model-missing"));
    assert.doesNotThrow(() =>
      parseWorkspaceImport(
        engine.serializeHomeProject(ownerHomeProject),
        registriesWithoutExtensions,
      ),
    );
  });

  test("the furnishing registry has no inherited model IDs", () => {
    for (const registry of [stableFurnishingRegistry]) {
      assert.equal(Object.getPrototypeOf(registry), null);
      assert.equal(registry.constructor, undefined);
    }
  });
  test("garden swing A-frame legs connect the spread feet to the top crossbeam", async () => {
    const definition = stableFurnishingRegistry["wooden-garden-swing"];
    for (const factor of [1, 0.5, 1.75]) {
      const renderer = await create(
        createElement(definition.component, {
          size: definition.defaultSize.map((value) => value * factor),
        }),
      );
      try {
        const scene = renderer.scene.instance;
        scene.updateMatrixWorld(true);
        const legs = [];
        const feet = [];
        scene.traverse((object) => {
          if (object.name === "swing-frame-leg") legs.push(object);
          if (object.name === "swing-foot") feet.push(new Box3().setFromObject(object));
        });
        const crossbeam = new Box3().setFromObject(scene.getObjectByName("swing-crossbeam"));
        assert.equal(legs.length, 4);
        assert.equal(feet.length, 2);
        for (const leg of legs) {
          const halfLength = leg.geometry.parameters.height / 2;
          const bottom = leg.localToWorld(new Vector3(0, -halfLength, 0));
          const top = leg.localToWorld(new Vector3(0, halfLength, 0));
          assert.ok(crossbeam.containsPoint(top), "leg top must meet the crossbeam");
          assert.ok(
            feet.some((foot) => foot.containsPoint(bottom)),
            "leg bottom must meet a foot",
          );
          assert.ok(Math.abs(top.z) < Math.abs(bottom.z), "legs must converge upward");
        }
      } finally {
        await renderer.unmount();
      }
    }
  });

  test("keeps the garden olive grounded and proportional while allowing passage below its crown", async () => {
    const definition = stableFurnishingRegistry["olive-tree"];
    const measureDefinition = async (size) => {
      const renderer = await create(
        createElement(definition.component, {
          size,
          entityStatesBySlotId: {},
          reducedMotion: true,
          walkMode: false,
          onInteract: () => undefined,
        }),
      );
      const measured = new Box3().setFromObject(renderer.scene.instance);
      const min = measured.min.toArray();
      const max = measured.max.toArray();
      await renderer.unmount();
      return { min, extents: max.map((value, axis) => value - min[axis]) };
    };
    for (const factor of [0.5, 1.75]) {
      const measured = await measureDefinition(
        definition.defaultSize.map((value) => value * factor),
      );
      measured.extents.forEach((extent, axis) => {
        assert.ok(
          Math.abs(extent - definition.defaultSize[axis] * factor) < BOUNDS_TOLERANCE_METERS,
        );
      });
      assert.ok(Math.abs(measured.min[1]) < BOUNDS_TOLERANCE_METERS);
    }
    // Public components must also support code-native use without SceneModelProps.
    const renderer = await create(createElement(definition.component));
    try {
      const scene = renderer.scene.instance;
      const bounds = new Box3().setFromObject(scene);
      const colliders = [];
      scene.traverse((object) => {
        if (object.userData.walkCollider) colliders.push(new Box3().setFromObject(object));
        if (!object.isMesh || !object.material.isMeshToonMaterial) return;
        for (const name of ["position", "normal", "color"]) {
          assert.ok(
            object.geometry.getAttribute(name).array.every(Number.isFinite),
            `finite ${name}`,
          );
        }
      });
      assert.equal(colliders.length, 1);
      assert.ok(Math.abs(colliders[0].min.y) < BOUNDS_TOLERANCE_METERS);
      assert.ok(colliders[0].getSize(new Vector3()).x < bounds.getSize(new Vector3()).x / 2);
      assert.ok(colliders[0].getSize(new Vector3()).z < bounds.getSize(new Vector3()).z / 2);
    } finally {
      await renderer.unmount();
    }
  });

  test("keeps stools and pendants outside the equipped-kitchen assembly", async () => {
    const definition = homeExtensions.furnishingModels["equipped-kitchen"];
    const renderer = await create(
      createElement(definition.component, {
        size: definition.defaultSize,
        entityStatesBySlotId: {},
        reducedMotion: true,
        walkMode: false,
        onInteract: () => undefined,
      }),
    );
    assert.equal(
      renderer.scene.findAll((node) => /tabouret|suspension-rotin/.test(node.props.name ?? ""))
        .length,
      0,
    );
    assert.ok(
      renderer.scene.findAll((node) => node.props.name === "equipped-kitchen-model").length === 1,
    );
    await renderer.unmount();
  });
});
