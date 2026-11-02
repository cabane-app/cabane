import assert from "node:assert/strict";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Matrix4 } from "three";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { ApartmentFloors } = await load("/packages/engine/src/building/ApartmentFloors.tsx");

  const { composeHomeManifest, composeHomeProjectPreview } = await load(
    "/packages/engine/src/home-project/runtime.ts",
  );
  const { validateHomeProject } = await load("/packages/engine/src/home-project/validation.ts");
  const { makeThreeFloorProject, emptyExtensions, emptyRegistries } = await load(
    "/tests/fixtures/multiple-floors.ts",
  );
  test("decorative shell instances stay below the home and cannot be picked", async () => {
    const floor = makeThreeFloorProject().floors[0];
    const renderer = await create(createElement(ApartmentFloors, { floor, count: 3, base: 0 }));
    try {
      const meshes = renderer.scene.findAll((node) => node.instance.isInstancedMesh === true);
      assert.equal(meshes.length, 3);
      for (const mesh of meshes) {
        assert.equal(mesh.instance.count, 3);
        assert.equal(mesh.instance.raycast(), undefined);
        const matrix = new Matrix4();
        mesh.instance.getMatrixAt(2, matrix);
        assert.ok(Math.abs(matrix.elements[13] + 3 * floor.floorToFloorHeightMeters) < 0.00001);
      }
    } finally {
      await renderer.unmount();
    }
  });
  test("decorative storeys do not create actual floors or alter their elevations", () => {
    const project = makeThreeFloorProject();
    const before = composeHomeManifest(project, emptyExtensions);
    project.home.apartmentFloor = 15;
    const after = composeHomeManifest(project, emptyExtensions);
    assert.equal(after.home.apartmentFloor, 15);
    assert.deepEqual(after.floors, before.floors);
    assert.deepEqual(after.sceneItems, before.sceneItems);
    assert.deepEqual(after.stairs, before.stairs);
  });
  test("retains all floors and derives room membership only within item ownership", () => {
    const project = makeThreeFloorProject();
    project.sceneItems = project.floors.map((floor) => ({
      id: `${floor.id}-sensor`,
      floorId: floor.id,
      kind: "device",
      modelId: "thermometer",
      entitySlots: [],
      size: [0.1, 0.1, 0.1],
      placement: { kind: "absolute", at: [2, 2], elevationMeters: 1, rotationYRadians: 0 },
    }));
    const manifest = composeHomeManifest(project, emptyExtensions);
    assert.deepEqual(
      manifest.floors.map((floor) => floor.id),
      ["ground", "first", "second"],
    );
    for (const floor of manifest.floors)
      assert.deepEqual(
        floor.rooms[0].devices.map((x) => x.id),
        [`${floor.id}-sensor`],
      );
  });
  test("complete synthetic floors validate together; empty drafts remain previewable", () => {
    const project = makeThreeFloorProject();
    const validation = validateHomeProject(project, emptyRegistries);
    assert.equal(validation.valid, true, JSON.stringify(validation.issues));
    project.floors[2].footprint = [];
    project.floors[2].rooms = [];
    const preview = composeHomeProjectPreview(project, emptyExtensions);
    assert.equal(preview.manifest.floors.length, 2);
    assert.equal(preview.issues[0].path, "floors[2].footprint");
    assert.equal(validateHomeProject(project, emptyRegistries).valid, false);
  });
  test("preview omissions preserve the elevation of complete upper floors", () => {
    const project = makeThreeFloorProject();
    project.floors[0].footprint = [];
    project.floors[1].footprint = [];
    const preview = composeHomeProjectPreview(project, emptyExtensions);
    assert.equal(preview.manifest.floors[0].id, "second");
    assert.equal(preview.manifest.floors[0].elevationMeters, 5.2);
  });
});
