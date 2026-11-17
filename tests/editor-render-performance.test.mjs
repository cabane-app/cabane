import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { ArchitectureScene } = await load("/packages/engine/src/ArchitectureScene.tsx");
  const { ownerHomeProject, ownerEditorResolvedBindings } = await load(
    "/tests/fixtures/bundled-home.ts",
  );
  const { composeOwnerProjectManifest, ownerDeviceModels } = await load(
    "/apps/web/src/project-runtime.ts",
  );
  const { stableArchitectureModelRegistry } = await load(
    "/packages/catalog/src/architecture/index.ts",
  );
  const { projectFromEditorState } = await load("/apps/web/src/editor-preview/project-sync.ts");
  const { createFurnishingEditorState, furnishingEditorReducer } = await load(
    "/apps/web/src/editor-preview/furnish/editor-state.ts",
  );

  test("project synchronization preserves unchanged architecture and no-op snapshots", () => {
    const floor = composeOwnerProjectManifest(ownerHomeProject).floors[0];
    const first = projectFromEditorState(ownerHomeProject, floor, ownerHomeProject.sceneItems);
    const unchanged = projectFromEditorState(first, floor, first.sceneItems);
    assert.equal(unchanged, first);
    const moved = [
      {
        ...first.sceneItems[0],
        placement: { kind: "absolute", at: [1, 2], elevationMeters: 0, rotationYRadians: 0 },
      },
      ...first.sceneItems.slice(1),
    ];
    const next = projectFromEditorState(first, floor, moved);
    assert.equal(next.floors, first.floors);
    assert.equal(next.roomProfiles, first.roomProfiles);
    assert.equal(next.openingProfiles, first.openingProfiles);
    assert.equal(next.sceneItems, moved);
  });

  test("repeated selection and unchanged placements create no state or history changes", () => {
    const initial = createFurnishingEditorState(ownerHomeProject.sceneItems);
    const selected = furnishingEditorReducer(initial, { type: "select", id: initial.items[0].id });
    assert.equal(
      furnishingEditorReducer(selected, { type: "select", id: selected.selectedId }),
      selected,
    );
    assert.equal(
      furnishingEditorReducer(selected, {
        type: "update-placement",
        id: selected.selectedId,
        placement: { ...selected.items[0].placement },
      }),
      selected,
    );
  });

  test("furnishing movement reuses architectural geometry and unchanged model renders", async () => {
    let renders = 0;
    const original = composeOwnerProjectManifest(ownerHomeProject);
    const model = Object.values(original.extensions.furnishingModels)[0];
    const extensions = {
      ...original.extensions,
      furnishingModels: {
        ...original.extensions.furnishingModels,
        "render-probe": {
          ...model,
          component: () => {
            renders += 1;
            return createElement("group");
          },
        },
      },
    };
    const probe = {
      ...ownerHomeProject.sceneItems.find((item) => item.kind === "furnishing"),
      id: "render-probe",
      modelId: "render-probe",
    };
    const sceneItems = [...ownerHomeProject.sceneItems, probe];
    const manifest = {
      ...composeOwnerProjectManifest({ ...ownerHomeProject, sceneItems }),
      extensions,
    };
    const props = {
      manifest,
      selectedRoomId: null,
      walkMode: false,
      wallFadeEnabled: true,
      reducedMotion: true,
      resolvedBindings: ownerEditorResolvedBindings,
      architectureModels: stableArchitectureModelRegistry,
      deviceModels: ownerDeviceModels,
      openingPositions: {},
      onInteract() {},
      interactionMode: "editor",
    };
    const renderer = await create(createElement(ArchitectureScene, props));
    const geometries = () =>
      renderer.scene
        .findAll((node) => node.instance?.isMesh && !node.props.name?.startsWith("scene-item"))
        .map((node) => node.instance.geometry.uuid);
    try {
      const before = geometries();
      const initialRenders = renders;
      // Editor selection is outside the scene and keeps all visual props stable.
      await renderer.update(createElement(ArchitectureScene, { ...props }));
      assert.deepEqual(geometries(), before, "selection updates must not rebuild architecture");
      assert.equal(
        renders,
        initialRenders,
        "selection must not rerender unchanged procedural models",
      );
      await renderer.update(
        createElement(ArchitectureScene, {
          ...props,
          interactionMode: "runtime",
          selectedRoomId: manifest.floors[0].rooms[0].id,
        }),
      );
      assert.deepEqual(geometries(), before, "opening room details must reuse geometry");
      assert.equal(
        renders,
        initialRenders,
        "opening room details must not rerender unchanged models",
      );
      const moved = sceneItems.map((item, index) =>
        index === 0
          ? {
              ...item,
              placement: { kind: "absolute", at: [3, 3], elevationMeters: 0, rotationYRadians: 0 },
            }
          : item,
      );
      await renderer.update(
        createElement(ArchitectureScene, {
          ...props,
          manifest: {
            ...composeOwnerProjectManifest({ ...ownerHomeProject, sceneItems: moved }),
            extensions,
          },
        }),
      );
      assert.equal(renders, initialRenders, "unaffected procedural models must not rerender");
      const after = geometries();
      assert.equal(after.length, before.length);
      const changed = renderer.scene
        .findAll((node) => node.instance?.isMesh && !node.props.name?.startsWith("scene-item"))
        .filter((node, index) => after[index] !== before[index])
        .map((node) => {
          const names = [];
          let object = node.instance;
          while (object) {
            if (object.name) names.push(object.name);
            object = object.parent;
          }
          return names.join("/");
        });
      assert.deepEqual(changed, [], "moving an item must reuse existing geometry");
    } finally {
      await renderer.unmount();
    }
  });

  test("an in-place window addition rebuilds the wall cut before entering walk mode", async () => {
    const sourceManifest = composeOwnerProjectManifest(ownerHomeProject);
    const manifest = { ...sourceManifest, floors: [structuredClone(sourceManifest.floors[0])] };
    const floor = manifest.floors[0];
    const addedWindow = floor.openings.find((opening) => opening.kind === "window");
    assert.ok(addedWindow);
    floor.openings = floor.openings.filter((opening) => opening !== addedWindow);
    const props = {
      manifest,
      selectedRoomId: null,
      walkMode: false,
      wallFadeEnabled: true,
      reducedMotion: true,
      resolvedBindings: ownerEditorResolvedBindings,
      architectureModels: stableArchitectureModelRegistry,
      deviceModels: ownerDeviceModels,
      openingPositions: {},
      onInteract() {},
    };
    const renderer = await create(createElement(ArchitectureScene, props));
    const wallMeshes = () =>
      renderer.scene
        .findAllByProps({ name: "structural-wall-surface" })
        .map((node) => node.instance);
    const wall = floor.walls.find((candidate) => candidate.id === addedWindow.wallId);
    assert.ok(wall);
    const scale = floor.coordinates.metersPerPlanUnit;
    const wallLength = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
    const direction = [
      (wall.to[0] - wall.from[0]) / wallLength,
      (wall.to[1] - wall.from[1]) / wallLength,
    ];
    const normal = [-direction[1], direction[0]];
    const distance =
      (addedWindow.offsetFromWallStartPlanUnits + addedWindow.widthPlanUnits / 2) * scale;
    const center = [
      (wall.from[0] - floor.coordinates.origin[0]) * scale + direction[0] * distance,
      (wall.from[1] - floor.coordinates.origin[1]) * scale + direction[1] * distance,
    ];
    const elevation = addedWindow.sillHeightMeters + addedWindow.openingHeightMeters / 2;
    const wallHitsAcrossOpening = () =>
      [-1, 1].flatMap((side) =>
        new Raycaster(
          new Vector3(
            center[0] + normal[0] * 0.5 * side,
            elevation,
            center[1] + normal[1] * 0.5 * side,
          ),
          new Vector3(-normal[0] * side, 0, -normal[1] * side),
        )
          .intersectObjects(wallMeshes(), false)
          .filter((hit) => hit.distance < 1),
      );
    try {
      renderer.scene.instance.updateMatrixWorld(true);
      assert.ok(wallHitsAcrossOpening().length > 0, "the uncut wall starts solid");
      const before = wallMeshes().map((mesh) => mesh.geometry.uuid);

      floor.openings.push(addedWindow);
      await renderer.update(createElement(ArchitectureScene, { ...props, walkMode: true }));
      renderer.scene.instance.updateMatrixWorld(true);

      assert.notDeepEqual(
        wallMeshes().map((mesh) => mesh.geometry.uuid),
        before,
      );
      assert.equal(wallHitsAcrossOpening().length, 0, "walk mode sees the complete window cut");
    } finally {
      await renderer.unmount();
    }
  });
});
