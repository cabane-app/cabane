import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { ArchitectureScene } = await load("/packages/engine/src/ArchitectureScene.tsx");
  const { makeStairProject } = await load("/tests/fixtures/multiple-floors.ts");
  const { useEditorSceneProjection } = await load(
    "/apps/web/src/editor-workspace/useEditorSceneProjection.ts",
  );
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const { composeHomeManifest } = await load("/packages/engine/src/index.ts");
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
    const architecturalMeshes = () =>
      renderer.scene.findAll((node) => {
        if (!node.instance?.isMesh || node.props.name?.startsWith("scene-item")) return false;
        for (let object = node.instance; object; object = object.parent)
          if (!object.visible) return false;
        return true;
      });
    const geometries = () => [
      ...new Set(architecturalMeshes().map((node) => node.instance.geometry.uuid)),
    ];
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
      const changed = architecturalMeshes()
        .filter((node) => !before.includes(node.instance.geometry.uuid))
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

  test("floor selection preserves projected items until their editor floor has restored", async () => {
    const project = makeStairProject();
    const baseItem = ownerHomeProject.sceneItems.find((item) => item.kind === "furnishing");
    project.sceneItems = project.floors.map((floor) => ({
      ...baseItem,
      id: `projection-${floor.id}`,
      floorId: floor.id,
      placement: { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
    }));
    const previewFloor = { ...project.floors[0], defaultWallHeightMeters: 2.9 };
    const items = [
      { ...project.sceneItems[0], placement: { ...project.sceneItems[0].placement, at: [2.5, 2] } },
    ];
    const wallRuns = [];
    let projection;
    function Probe({ project, activeFloorId, floor, items }) {
      projection = useEditorSceneProjection({
        project,
        activeFloorId,
        registries: ownerProjectRegistries,
        constructEditor: { previewFloor: floor, wallRuns },
        furnishingEditor: {
          items,
          transaction: null,
          selectedId: null,
          selectedIds: [],
          selectedGroup: null,
          replaceItems() {},
        },
      });
      return null;
    }
    const props = { project, activeFloorId: "ground", floor: previewFloor, items };
    const renderer = await create(createElement(Probe, props));
    const ids = () => projection.visualManifest.sceneItems.map((item) => item.id).sort();
    const expectedIds = project.sceneItems.map((item) => item.id).sort();
    try {
      const before = projection.visualManifest;
      assert.deepEqual(ids(), expectedIds);
      // Floor navigation updates first; the existing editors restore in an effect.
      await renderer.update(createElement(Probe, { ...props, activeFloorId: "first" }));
      assert.deepEqual(
        ids(),
        expectedIds,
        "the pending selection must not remove destination items or duplicate outgoing items",
      );
      assert.equal(
        projection.visualManifest,
        before,
        "the intermediate floor render must preserve the projected scene identity",
      );
      assert.equal(
        projection.editorProject.floors[0].defaultWallHeightMeters,
        2.9,
        "pending navigation must preserve unsaved architecture",
      );
      assert.deepEqual(
        projection.visualManifest.sceneItems.find((item) => item.id === "projection-ground")
          .placement.at,
        [2.5, 2],
        "pending navigation must preserve the current item edit",
      );
      const savedProject = projection.editorProject;
      const restored = {
        project: savedProject,
        activeFloorId: "first",
        floor: savedProject.floors[1],
        items: savedProject.sceneItems.filter((item) => item.floorId === "first"),
      };
      await renderer.update(createElement(Probe, restored));
      assert.deepEqual(
        ids(),
        expectedIds,
        "restoring the destination editors keeps every floor's items",
      );
      assert.deepEqual(
        projection.editorProject,
        savedProject,
        "floor navigation must not author a project change",
      );
      const restoredManifest = projection.visualManifest;
      const moved = [
        { ...restored.items[0], placement: { ...restored.items[0].placement, at: [3, 2] } },
      ];
      await renderer.update(createElement(Probe, { ...restored, items: moved }));
      assert.notEqual(
        projection.visualManifest,
        restoredManifest,
        "subsequent destination edits must invalidate the projection",
      );
      assert.deepEqual(
        projection.visualManifest.sceneItems.find((item) => item.id === "projection-first")
          .placement.at,
        [3, 2],
      );
      assert.deepEqual(
        projection.visualManifest.sceneItems.find((item) => item.id === "projection-ground")
          .placement.at,
        [2.5, 2],
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("3D editor floor selection retains prepared models while preserving visible floors", async () => {
    const project = makeStairProject();
    const renders = Object.fromEntries(project.floors.map((floor) => [floor.id, 0]));
    const baseModel = Object.values(
      composeOwnerProjectManifest(ownerHomeProject).extensions.furnishingModels,
    )[0];
    const models = Object.fromEntries(
      project.floors.map((floor) => [
        floor.id,
        {
          ...baseModel,
          defaultSize: [0.3, 0.3, 0.3],
          bounds: { min: [-0.15, 0, -0.15], max: [0.15, 0.3, 0.15] },
          component: () => {
            renders[floor.id]++;
            return createElement(
              "mesh",
              { name: `retention-probe-${floor.id}` },
              createElement("boxGeometry", { args: [0.3, 0.3, 0.3] }),
              createElement("meshBasicMaterial"),
            );
          },
        },
      ]),
    );
    project.sceneItems = project.floors.map((floor) => ({
      id: `probe-${floor.id}`,
      floorId: floor.id,
      kind: "furnishing",
      modelId: floor.id,
      size: [0.3, 0.3, 0.3],
      placement: { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
    }));
    const manifest = composeHomeManifest(project, {
      furnishingModels: models,
      deviceModels: {},
      openingModels: {},
    });
    const props = {
      manifest,
      activeFloorId: "ground",
      floorView: "cutaway",
      interactionMode: "editor",
      selectedRoomId: null,
      walkMode: false,
      wallFadeEnabled: false,
      reducedMotion: true,
      resolvedBindings: { rooms: {}, openings: {} },
      architectureModels: stableArchitectureModelRegistry,
      deviceModels: {},
      openingPositions: {},
      onInteract() {},
    };
    const renderer = await create(createElement(ArchitectureScene, props));
    const floors = () =>
      renderer.scene.findAll((node) => node.props.name?.startsWith("building-floor-"));
    const visible = () =>
      floors()
        .filter((node) => node.instance.visible)
        .map((node) => node.props.name.replace("building-floor-", ""));
    try {
      assert.equal(floors().length, 3, "first selection must reuse floors prepared at scene entry");
      const objects = floors().map((node) => node.instance);
      const probes = () =>
        project.floors.map(
          (floor) => renderer.scene.findByProps({ name: `retention-probe-${floor.id}` }).instance,
        );
      const initialProbes = probes();
      const initialRenders = { ...renders };
      assert.deepEqual(visible(), ["ground"]);
      for (const activeFloorId of ["first", "ground", "second", "first", "ground"]) {
        await renderer.update(createElement(ArchitectureScene, { ...props, activeFloorId }));
        assert.deepEqual(
          visible(),
          project.floors
            .slice(0, project.floors.findIndex((floor) => floor.id === activeFloorId) + 1)
            .map((floor) => floor.id),
        );
        assert.deepEqual(
          floors().map((node) => node.instance),
          objects,
          "switching floors retains the original floor objects",
        );
        assert.deepEqual(
          probes(),
          initialProbes,
          "switching floors retains model meshes and resources",
        );
        assert.deepEqual(
          renders,
          initialRenders,
          "switching floors must not reconstruct unchanged models",
        );
      }
      await renderer.update(
        createElement(ArchitectureScene, { ...props, activeFloorId: "first", floorView: "plan" }),
      );
      assert.equal(floors().length, 1, "plan view only mounts its selected floor");
      assert.deepEqual(visible(), ["first"]);
    } finally {
      await renderer.unmount();
    }
  });

  test("item-only multi-floor recomposition reuses walls but neighbor edits invalidate their caps", async () => {
    const project = makeStairProject();
    const baseItem = ownerHomeProject.sceneItems.find((item) => item.kind === "furnishing");
    project.sceneItems = project.floors.map((floor) => ({
      ...baseItem,
      id: `neighbor-probe-${floor.id}`,
      floorId: floor.id,
      placement: { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
    }));
    const baseModel =
      composeOwnerProjectManifest(ownerHomeProject).extensions.furnishingModels[baseItem.modelId];
    const manifest = composeHomeManifest(project, {
      furnishingModels: {
        [baseItem.modelId]: { ...baseModel, component: () => createElement("group") },
      },
      deviceModels: {},
      openingModels: {},
    });
    const props = {
      manifest,
      activeFloorId: "first",
      interactionMode: "editor",
      selectedRoomId: null,
      walkMode: false,
      wallFadeEnabled: false,
      reducedMotion: true,
      resolvedBindings: { rooms: {}, openings: {} },
      architectureModels: stableArchitectureModelRegistry,
      deviceModels: {},
      openingPositions: {},
      onInteract() {},
    };
    const renderer = await create(createElement(ArchitectureScene, props));
    const walls = () =>
      new Map(
        manifest.floors.map((floor) => [
          floor.id,
          renderer.scene
            .findByProps({ name: `building-floor-${floor.id}` })
            .findAll((node) => node.instance?.isMesh && node.instance.material?.vertexColors)
            .map((node) => node.instance.geometry.uuid),
        ]),
      );
    try {
      const before = walls();
      assert.ok([...before.values()].every((geometries) => geometries.length > 0));
      const recomposed = {
        ...manifest,
        floors: manifest.floors.map((floor) => ({
          ...floor,
          rooms: floor.rooms.map((room) => ({ ...room })),
        })),
        sceneItems: manifest.sceneItems.map((item, index) =>
          index === 0
            ? {
                ...item,
                placement: { ...item.placement, at: [3, 2] },
              }
            : item,
        ),
      };
      await renderer.update(createElement(ArchitectureScene, { ...props, manifest: recomposed }));
      assert.deepEqual(
        walls(),
        before,
        "an item move must reuse every unchanged floor's wall cuts and shared caps",
      );
      const changedNeighbor = {
        ...recomposed,
        floors: recomposed.floors.map((floor) =>
          floor.id === "ground"
            ? {
                ...floor,
                defaultWallHeightMeters: 3.1,
                floorToFloorHeightMeters: 3.2,
              }
            : floor,
        ),
      };
      await renderer.update(
        createElement(ArchitectureScene, { ...props, manifest: changedNeighbor }),
      );
      const changed = walls();
      assert.notDeepEqual(
        changed.get("first"),
        before.get("first"),
        "a changed lower floor must update the adjoining wall caps",
      );
      changedNeighbor.floors[0].defaultWallHeightMeters = 3.3;
      await renderer.update(
        createElement(ArchitectureScene, { ...props, manifest: { ...changedNeighbor } }),
      );
      assert.notDeepEqual(
        walls().get("first"),
        changed.get("first"),
        "an in-place neighbor edit must also invalidate the cap geometry",
      );
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
        .findAll((node) => node.instance?.isMesh && node.instance.material?.vertexColors)
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
          .intersectObjects(wallMeshes())
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
      assert.deepEqual(wallHitsAcrossOpening(), [], "walk mode sees the complete window cut");
    } finally {
      await renderer.unmount();
    }
  });
});
