import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { ConstructionPlan } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionPlan.tsx",
  );
  const { ConstructionPlanWalls } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionPlanWalls.tsx",
  );
  const { ArrangePlanOpenings } = await load(
    "/apps/web/src/editor-preview/furnish/ArrangePlanOpenings.tsx",
  );
  const { ownerHomeProject, ownerEditorResolvedBindings, ownerProjectManifest } = await load(
    "/tests/fixtures/bundled-home.ts",
  );
  const { ownerDeviceModels } = await load("/apps/web/src/project-runtime.ts");
  const { stableArchitectureModelRegistry } = await load(
    "/packages/catalog/src/architecture/index.ts",
  );
  const {
    ArchitectureScene,
    createFloorEditorDraft,
    deriveFloorTopology,
    createFloorEditorHistory,
    floorEditorReducer,
  } = await load("/packages/engine/src/index.ts");
  const { createFurnishingEditorState, furnishingEditorReducer } = await load(
    "/apps/web/src/editor-preview/furnish/editor-state.ts",
  );
  const { FurnishingEditLayer } = await load(
    "/apps/web/src/editor-preview/furnish/FurnishingEditLayer.tsx",
  );
  const floor = ownerProjectManifest.floors[0];

  test("plan renders metadata-only, non-interactive footprints without detailed models or lights", async () => {
    let modelRenders = 0;
    const furnishingModels = Object.fromEntries(
      Object.entries(ownerProjectManifest.extensions.furnishingModels).map(([id, definition]) => [
        id,
        {
          ...definition,
          component: () => {
            modelRenders += 1;
            return null;
          },
        },
      ]),
    );
    const items = ownerHomeProject.sceneItems.filter((item) => item.floorId === floor.id);
    const renderer = await create(
      createElement(ConstructionPlan, {
        floor,
        items,
        furnishingModels,
        deviceModels: ownerDeviceModels,
      }),
    );
    try {
      const footprints = renderer.scene.findByProps({ name: "plan-footprints" });
      const vertexCount = footprints.children.reduce(
        (sum, node) => sum + node.instance.geometry.getAttribute("position").count,
        0,
      );
      assert.equal(vertexCount, items.length * 4 * 6);
      assert.equal(modelRenders, 0);
      assert.equal(renderer.scene.findAll((node) => node.instance?.isLight).length, 0);
      const ray = new Raycaster(new Vector3(5, 10, 3), new Vector3(0, -1, 0));
      assert.deepEqual(ray.intersectObject(renderer.scene.instance, true), []);
    } finally {
      await renderer.unmount();
    }
  });

  test("plan wall bands leave exact scaled opening gaps and retain incomplete walls", async () => {
    const draft = {
      ...createFloorEditorDraft(floor),
      coordinates: { origin: [10, 20], metersPerPlanUnit: 0.5, scaleBasis: "measured" },
      walls: [{ id: "unfinished", from: [10, 20], to: [20, 20], thicknessMeters: 0.2 }],
      openings: [
        {
          id: "window",
          wallId: "unfinished",
          kind: "window",
          offsetPlanUnits: 2,
          widthPlanUnits: 2,
          openingHeightMeters: 1.2,
          sillHeightMeters: 0.9,
          operation: "fixed",
          variant: "plain",
          glazing: "clear",
          panelCount: 1,
        },
      ],
    };
    const renderer = await create(createElement(ConstructionPlanWalls, { draft }));
    try {
      const group = renderer.scene.findByProps({ name: "wall-and-opening-strokes" });
      const wall = group.children.find((node) => {
        const attribute = node.instance?.geometry?.getAttribute("position");
        return (
          attribute &&
          Array.from({ length: attribute.count }, (_, index) => attribute.getX(index)).includes(5)
        );
      });
      assert.ok(wall);
      const positions = wall.instance.geometry.getAttribute("position");
      assert.ok(positions.count >= 12, "two wall bands remain around the opening");
      assert.deepEqual(
        [positions.getX(0), positions.getX(1), positions.getX(6), positions.getX(7)],
        [0, 1, 2, 5],
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("Arrange plan overlays door swing symbols above the 3D scene without intercepting input", async () => {
    const wall = {
      id: "wall",
      from: [0, 0],
      to: [8, 0],
      classification: "interior",
      thicknessMeters: 0.2,
    };
    const door = {
      id: "door",
      wallId: wall.id,
      kind: "door",
      offsetFromWallStartPlanUnits: 1,
      widthPlanUnits: 2,
      openingHeightMeters: 2.1,
      sillHeightMeters: 0,
      operation: "hinged",
      variant: "panel",
      finish: "wood",
      leafCount: 1,
    };
    const window = {
      id: "window",
      wallId: wall.id,
      kind: "window",
      offsetFromWallStartPlanUnits: 5,
      widthPlanUnits: 2,
      openingHeightMeters: 1.2,
      sillHeightMeters: 0.9,
      operation: "fixed",
      variant: "plain",
      glazing: "clear",
      panelCount: 1,
    };
    const renderer = await create(
      createElement(ArrangePlanOpenings, {
        floor: {
          ...floor,
          coordinates: { origin: [0, 0], metersPerPlanUnit: 0.5, scaleBasis: "measured" },
          walls: [wall],
          openings: [door, window],
        },
      }),
    );
    try {
      assert.equal(renderer.scene.findAllByProps({ name: "arrange-plan-opening-door" }).length, 1);
      assert.equal(
        renderer.scene.findAllByProps({ name: "arrange-plan-opening-window" }).length,
        0,
      );
      const strokes = renderer.scene.findByProps({ name: "arrange-plan-opening-door" }).children;
      assert.ok(strokes.length > 2, "hinged door includes jambs, leaf, and swing arc");
      assert.ok(strokes.every((stroke) => stroke.props.renderOrder === 30));
      assert.ok(strokes.every((stroke) => stroke.instance.material.depthTest === false));
      const ray = new Raycaster(new Vector3(0.75, 10, 0), new Vector3(0, -1, 0));
      assert.deepEqual(ray.intersectObject(renderer.scene.instance, true), []);
    } finally {
      await renderer.unmount();
    }
  });

  test("plan footprints retain rotation, scaled size, and asymmetric catalog offsets", async () => {
    const definition = {
      ...Object.values(ownerProjectManifest.extensions.furnishingModels)[0],
      bounds: { min: [1, -1, -3], max: [5, 1, -1] },
      defaultSize: [2, 1, 1],
    };
    const item = {
      id: "offset-probe",
      kind: "furnishing",
      modelId: "probe",
      size: [4, 1, 2],
      placement: { kind: "absolute", at: [3, 4], elevationMeters: 0, rotationYRadians: 0.7 },
    };
    const renderer = await create(
      createElement(ConstructionPlan, {
        floor,
        items: [item],
        furnishingModels: { probe: definition },
        deviceModels: {},
      }),
    );
    try {
      const batch = renderer.scene
        .findByProps({ name: "plan-footprints" })
        .children[0].instance.geometry.getAttribute("position");
      assert.equal(batch.count, 24);
      const endpoints = Array.from({ length: 4 }, (_, index) => {
        const start = index * 6;
        return [
          [
            (batch.getX(start) + batch.getX(start + 5)) / 2,
            (batch.getZ(start) + batch.getZ(start + 5)) / 2,
          ],
          [
            (batch.getX(start + 1) + batch.getX(start + 2)) / 2,
            (batch.getZ(start + 1) + batch.getZ(start + 2)) / 2,
          ],
        ];
      });
      const cos = Math.cos(0.7),
        sin = Math.sin(0.7);
      const world = ([x, z]) => [3 + cos * x + sin * z, 4 - sin * x + cos * z];
      const corners = [
        [2, -6],
        [10, -6],
        [10, -2],
        [2, -2],
      ].map(world);
      endpoints.forEach(([from, to], index) => {
        from.forEach((value, axis) => assert.ok(Math.abs(value - corners[index][axis]) < 1e-5));
        to.forEach((value, axis) =>
          assert.ok(Math.abs(value - corners[(index + 1) % 4][axis]) < 1e-5),
        );
      });
    } finally {
      await renderer.unmount();
    }
  });

  test("editor model picking is disabled deeply and runtime raycasting is restored", async () => {
    const props = {
      manifest: ownerProjectManifest,
      selectedRoomId: null,
      walkMode: false,
      wallFadeEnabled: false,
      reducedMotion: true,
      resolvedBindings: ownerEditorResolvedBindings,
      architectureModels: stableArchitectureModelRegistry,
      deviceModels: ownerDeviceModels,
      openingPositions: {},
      onInteract() {},
    };
    const renderer = await create(
      createElement(ArchitectureScene, { ...props, interactionMode: "editor" }),
    );
    try {
      const ray = new Raycaster(new Vector3(5, 10, 3), new Vector3(0, -1, 0));
      const visual = renderer.scene.findByProps({ name: "architecture-scene" }).instance;
      visual.updateMatrixWorld(true);
      assert.equal(ray.intersectObject(visual, true).length, 0);
      for (const object of renderer.scene.findAll((node) => node.instance?.isMesh))
        assert.equal(ray.intersectObject(object.instance, true).length, 0);
      await renderer.update(createElement(ArchitectureScene, props));
      visual.updateMatrixWorld(true);
      assert.ok(ray.intersectObject(visual, true).length > 0);
    } finally {
      await renderer.unmount();
    }
  });

  test("shared ceiling paint survives topology, reopening and undo without splitting its identity", () => {
    const source = structuredClone(floor);
    const shared = source.ceilings.find(
      (ceiling) => ceiling.kind === "flat" && ceiling.roomIds.length > 1,
    );
    shared.color = "#AAbbCC";
    let history = createFloorEditorHistory(createFloorEditorDraft(source));
    const room = history.present.rooms.find((room) => room.id === shared.roomIds[0]);
    assert.equal(room.ceilingColor, shared.color);
    const edit = (ceilingColor) => {
      history = floorEditorReducer(history, {
        type: "update-room-metadata",
        roomId: room.id,
        anchor: room.anchor,
        changes: { ceilingColor },
      });
    };
    edit("#123456");
    const result = deriveFloorTopology(history.present).floor;
    const ceiling = result.ceilings.find((c) => c.id === shared.id);
    assert.equal(ceiling.color, "#123456");
    assert.deepEqual([...ceiling.roomIds].sort(), [...shared.roomIds].sort());
    assert.equal(result.ceilings.length, source.ceilings.length);
    const reopened = deriveFloorTopology(
      createFloorEditorDraft(JSON.parse(JSON.stringify(result))),
    ).floor;
    assert.deepEqual(reopened.ceilings, result.ceilings);
    edit(undefined);
    assert.ok(
      !Object.hasOwn(
        deriveFloorTopology(history.present).floor.ceilings.find((c) => c.id === shared.id),
        "color",
      ),
    );
    history = floorEditorReducer(history, { type: "undo" });
    assert.equal(
      deriveFloorTopology(history.present).floor.ceilings.find((c) => c.id === shared.id).color,
      "#123456",
    );
    assert.deepEqual(
      result.ceilings.filter((c) => c.kind === "sloped"),
      source.ceilings.filter((c) => c.kind === "sloped"),
    );
  });

  test("a shared ceiling retains one ID after edits and splits safely for different heights", () => {
    const draft = createFloorEditorDraft(floor);
    const shared = floor.ceilings.find((ceiling) => ceiling.roomIds.length > 1);
    assert.ok(shared);
    const topology = deriveFloorTopology(draft);
    assert.equal(topology.floor.ceilings.filter((ceiling) => ceiling.id === shared.id).length, 1);
    assert.deepEqual(
      topology.floor.ceilings
        .find((ceiling) => ceiling.id === shared.id)
        .roomIds.slice()
        .sort(),
      shared.roomIds.slice().sort(),
    );
    const changed = deriveFloorTopology({
      ...draft,
      rooms: draft.rooms.map((room) =>
        room.id === shared.roomIds[0] ? { ...room, ceilingHeightMeters: 3.1 } : room,
      ),
    });
    assert.equal(
      new Set(changed.floor.ceilings.map((ceiling) => ceiling.id)).size,
      changed.floor.ceilings.length,
    );
    assert.equal(
      changed.floor.ceilings.find((ceiling) => ceiling.roomIds.includes(shared.roomIds[0]))
        .heightMeters,
      3.1,
    );
  });

  test("cancelled and unchanged furnishing drags preserve redo, completed drags commit once", async () => {
    const item = ownerHomeProject.sceneItems[0];
    let state = createFurnishingEditorState([item]);
    const dispatch = (action) => {
      state = furnishingEditorReducer(state, action);
    };
    dispatch({
      type: "update-placement",
      id: item.id,
      placement: { kind: "absolute", at: [3, 3], elevationMeters: 0, rotationYRadians: 0 },
    });
    dispatch({ type: "undo" });
    const redo = state.future;
    dispatch({ type: "begin-transaction" });
    dispatch({
      type: "update-placement",
      id: item.id,
      placement: { kind: "absolute", at: [4, 4], elevationMeters: 0, rotationYRadians: 0 },
    });
    dispatch({ type: "cancel-transaction" });
    assert.equal(state.future, redo);
    assert.equal(state.items[0], item);
    dispatch({ type: "begin-transaction" });
    dispatch({ type: "commit-transaction" });
    assert.equal(state.past.length, 0);
    const renderer = await create(
      createElement(FurnishingEditLayer, {
        floor,
        items: state.items,
        furnishingModels: ownerProjectManifest.extensions.furnishingModels,
        deviceModels: ownerDeviceModels,
        selectedId: null,
        onSelect(id) {
          dispatch({ type: "select", id });
        },
        onMovePlacement(id, placement) {
          dispatch({ type: "update-placement", id, placement });
        },
        onDragStart() {
          dispatch({ type: "begin-transaction" });
        },
        onDragEnd() {
          dispatch({ type: "commit-transaction" });
        },
        onDragCancel() {
          dispatch({ type: "cancel-transaction" });
        },
      }),
    );
    const event = {
      button: 0,
      pointerId: 1,
      stopPropagation() {},
      nativeEvent: { altKey: true, clientX: 100, clientY: 100 },
      target: { setPointerCapture() {}, releasePointerCapture() {} },
      ray: new Raycaster(new Vector3(4, 10, 4), new Vector3(0, -1, 0)).ray,
    };
    try {
      const target = renderer.scene.findByProps({ name: `furnishing-edit-target-${item.id}` })
        .children[0];
      await renderer.fireEvent(target, "pointerDown", event);
      await renderer.fireEvent(target, "pointerMove", {
        ...event,
        nativeEvent: { ...event.nativeEvent, clientX: 104, clientY: 104 },
        ray: new Raycaster(new Vector3(5, 10, 5), new Vector3(0, -1, 0)).ray,
      });
      await renderer.fireEvent(target, "pointerUp", event);
      assert.equal(state.transaction, null);
      assert.equal(state.items[0], item);
      assert.equal(state.future, redo);
      await renderer.fireEvent(target, "pointerDown", event);
      await renderer.fireEvent(target, "pointerMove", {
        ...event,
        nativeEvent: { ...event.nativeEvent, clientX: 110, clientY: 110 },
        ray: new Raycaster(new Vector3(5, 10, 5), new Vector3(0, -1, 0)).ray,
      });
      await renderer.fireEvent(target, "pointerCancel", event);
      assert.equal(state.transaction, null);
      assert.equal(state.items[0], item);
      await renderer.fireEvent(target, "pointerDown", event);
      await renderer.fireEvent(target, "pointerMove", {
        ...event,
        nativeEvent: { ...event.nativeEvent, clientX: 110, clientY: 110 },
        ray: new Raycaster(new Vector3(5, 10, 5), new Vector3(0, -1, 0)).ray,
      });
      await renderer.fireEvent(target, "pointerUp", event);
      assert.equal(state.past.length, 1);
      assert.equal(state.future.length, 0);
    } finally {
      await renderer.unmount();
    }
  });
});
