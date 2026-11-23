import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Vector3 } from "three";
import { IDBFactory } from "fake-indexeddb";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { deriveWalkColliders, isWalkPointClear } = await load(
    "/packages/engine/src/navigation/walk-colliders.ts",
  );
  const { passableOpeningIds } = await load("/packages/engine/src/opening-pose.ts");

  const api = await load("/packages/engine/src/home-project/index.ts");
  const { stableArchitectureModelRegistry } = await load(
    "/packages/catalog/src/architecture/index.ts",
  );
  const { SceneOpeningRenderer } = await load("/packages/engine/src/SceneOpeningRenderer.tsx");
  const { floorWithOpeningOrientations } = await load(
    "/apps/web/src/editor-preview/construct/opening-orientation-floor.ts",
  );
  const { constructEditorHistoryReducer } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const { openingPlanSymbol } = await load(
    "/apps/web/src/editor-preview/construct/opening-plan-symbol.ts",
  );
  const floor = structuredClone(engine.neutralDemoManifest.floors[0]);
  const door = {
    ...floor.openings.find((o) => o.kind === "door"),
    operation: "bifold",
    variant: "panel",
    leafCount: 1,
  };
  const window = {
    ...floor.openings.find((o) => o.kind === "window"),
    operation: "sliding",
    panelCount: 3,
  };
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
  const render = (opening, wall, position, reducedMotion = true) =>
    createElement(SceneOpeningRenderer, {
      model: stableArchitectureModelRegistry[opening.kind],
      opening,
      wall,
      floor,
      position,
      reducedMotion,
    });

  test("bifold panels counter-rotate, clear jambs, and fold toward the selected face on rotated/reversed walls", async () => {
    for (const leafCount of [1, 2])
      for (const hingeSide of ["start", "end"])
        for (const openingSide of ["left", "right"]) {
          const opening = {
            ...door,
            leafCount,
            hingeSide,
            openingSide,
            widthPlanUnits: leafCount === 1 ? 0.9 : 1.8,
          };
          const wall = {
            ...floor.walls[0],
            from: hingeSide === "start" ? [1, 1] : [5, 4],
            to: hingeSide === "start" ? [5, 4] : [1, 1],
          };
          const renderer = await create(render(opening, wall, 0));
          try {
            const root = renderer.scene.findByProps({ name: "opening-model-bifold" }).instance;
            const outer = renderer.scene.findAllByProps({ name: "bifold-outer-motion" });
            const inner = renderer.scene.findAllByProps({ name: "bifold-inner-motion" });
            assert.equal(outer.length, leafCount);
            for (const position of [0, 0.25, 0.5, 0.75, 1, 0]) {
              await renderer.update(render(opening, wall, position));
              await renderer.advanceFrames(1, 0.1);
              root.updateWorldMatrix(true, true);
              for (let i = 0; i < leafCount; i++) {
                near(inner[i].instance.rotation.y, -2 * outer[i].instance.rotation.y);
                const outerPanel = outer[i].instance.getObjectByName("bifold-panel-0");
                const innerPanel = inner[i].instance.getObjectByName("bifold-panel-1");
                const a = root.worldToLocal(outerPanel.getWorldPosition(new Vector3()));
                const b = root.worldToLocal(innerPanel.getWorldPosition(new Vector3()));
                near(a.z, b.z); // Equal halves fold symmetrically, free edge remains on guide.
                if (position === 1)
                  assert.ok(Math.abs(a.x - b.x) > 0.039, "folded faces stay separated");
                for (const panel of [outerPanel, innerPanel]) {
                  const vertices = panel.geometry.getAttribute("position");
                  for (let v = 0; v < vertices.count; v++) {
                    const point = root.worldToLocal(
                      panel.localToWorld(new Vector3().fromBufferAttribute(vertices, v)),
                    );
                    assert.ok(
                      point.x > 0.035 && point.x < opening.widthPlanUnits - 0.035,
                      "panel stays clear of jambs",
                    );
                  }
                }
                if (position > 0) assert.equal(Math.sign(a.z), openingSide === "left" ? -1 : 1);
              }
            }
            const reversed = engine.changeOpeningOrientation(opening, "side");
            await renderer.update(render(reversed, wall, 1, false));
            await renderer.advanceFrames(100, 0.05);
            const orientation = engine.resolveOpeningOrientation(reversed);
            near(outer[0].instance.rotation.y, orientation.leaves[0].rotationSign * Math.PI * 0.48);
            assert.equal(
              openingPlanSymbol(opening, opening.widthPlanUnits, wall.thicknessMeters).length,
              2 + 2 * leafCount,
            );
          } finally {
            await renderer.unmount();
          }
        }
  });

  test("sliding windows telescope within the aperture on separate tracks in both directions and faces", async () => {
    for (const panelCount of [2, 3, 4])
      for (const slideDirection of ["start", "end"])
        for (const openingSide of ["left", "right"]) {
          const opening = {
            ...window,
            panelCount,
            slideDirection,
            openingSide,
            widthPlanUnits: 2.4,
          };
          const wall = { ...floor.walls[0], from: [5, 4], to: [1, 1] };
          const renderer = await create(render(opening, wall, 0));
          try {
            const tracks = renderer.scene.findAllByProps({ name: "window-panel-track" });
            const motions = renderer.scene.findAllByProps({ name: "opening-leaf-motion" });
            assert.equal(tracks.length, panelCount);
            for (const position of [0, 0.5, 1, 0]) {
              await renderer.update(render(opening, wall, position));
              await renderer.advanceFrames(1, 0.1);
              const target = slideDirection === "end" ? panelCount - 1 : 0;
              for (let i = 0; i < panelCount; i++) {
                const x = tracks[i].instance.position.x + motions[i].instance.position.x;
                near(x, ((i + (target - i) * position) * 2.4) / panelCount);
                near(motions[i].instance.rotation.y, 0);
                if (i)
                  near(
                    Math.abs(tracks[i].instance.position.z - tracks[i - 1].instance.position.z),
                    0.12,
                  );
              }
            }
            await renderer.update(
              render(engine.changeOpeningOrientation(opening, "slide"), wall, 1, false),
            );
            await renderer.advanceFrames(100, 0.05);
            const targetX = slideDirection === "start" ? (2.4 * (panelCount - 1)) / panelCount : 0;
            tracks.forEach((track, i) =>
              near(track.instance.position.x + motions[i].instance.position.x, targetX),
            );
          } finally {
            await renderer.unmount();
          }
        }
  });

  test("Walk clears an open bifold aperture but still blocks open sliding windows", async () => {
    for (const opening of [door, window]) {
      const sceneFloor = { ...floor, openings: [opening] };
      const wall = floor.walls.find((w) => w.id === opening.wallId);
      const placement = engine.openingWorldPlacement(wall, opening, floor.coordinates);
      const point = {
        x: (placement.start[0] + placement.end[0]) / 2,
        z: (placement.start[1] + placement.end[1]) / 2,
      };
      assert.equal(isWalkPointClear(point, deriveWalkColliders(sceneFloor)), false);
      const open = passableOpeningIds([sceneFloor], { [opening.id]: 1 });
      assert.equal(
        isWalkPointClear(point, deriveWalkColliders(sceneFloor, open)),
        opening.kind === "door",
      );
    }
  });

  test("new opening operations survive editor orientation history, topology, JSON and IndexedDB publication", async () => {
    const project = structuredClone(ownerHomeProject);
    const source = project.floors[0];
    const d = source.openings.find((o) => o.kind === "door" && o.operation === "hinged");
    Object.assign(d, { operation: "bifold", variant: "panel", leafCount: 1, hingeSide: "end" });
    const w = source.openings.find((o) => o.kind === "window");
    Object.assign(w, { operation: "sliding", panelCount: 4, slideDirection: "end" });
    assert.equal(engine.parseHomeProjectSchema(project).valid, true);
    assert.equal(engine.validateLayoutFloorSpec(source).valid, true);
    let draft = engine.createFloorEditorDraft(source);
    for (const [openingId, change] of [
      [d.id, "hinge"],
      [w.id, "slide"],
      [d.id, "side"],
      [w.id, "side"],
    ]) {
      const initial = draft;
      let history = engine.createFloorEditorHistory(initial);
      history = constructEditorHistoryReducer(history, {
        type: "reorient-opening",
        openingId,
        change,
      });
      const accepted = floorWithOpeningOrientations(initial, history.present, project.floors[0]);
      assert.ok(accepted);
      assert.equal(accepted.rooms, project.floors[0].rooms);
      project.floors[0] = accepted;
      draft = history.present;
      history = constructEditorHistoryReducer(history, { type: "undo" });
      assert.deepEqual(history.present, initial);
      history = constructEditorHistoryReducer(history, { type: "redo" });
      assert.deepEqual(history.present, draft);
    }
    const derived = engine.deriveFloorTopology(draft).floor;
    for (const id of [d.id, w.id]) {
      const expected = project.floors[0].openings.find((o) => o.id === id);
      const actual = derived.openings.find((o) => o.id === id);
      for (const field of [
        "operation",
        "panelCount",
        "leafCount",
        "hingeSide",
        "openingSide",
        "slideDirection",
      ])
        assert.equal(actual[field], expected[field]);
    }
    assert.equal(project.floors[0].openings.find((o) => o.id === d.id).hingeSide, "start");
    assert.equal(project.floors[0].openings.find((o) => o.id === w.id).slideDirection, "start");
    assert.deepEqual(
      engine.parseHomeProject(engine.serializeHomeProject(project)).project,
      project,
    );
    const repository = api.createHomeProjectRepository(
      api.createIndexedDbProjectRecordStore(new IDBFactory()),
      ownerProjectRegistries,
    );
    const record = api.createSeedProjectRecord(project, 1000);
    await repository.replace(record);
    assert.deepEqual(await repository.load(project.home.id), record);
    for (const [id, changes] of [
      [d.id, { variant: "plank" }],
      [d.id, { leafCount: 3 }],
      [d.id, { slideDirection: "end" }],
      [w.id, { panelCount: 1 }],
      [w.id, { panelCount: "3" }],
      [w.id, { operation: "casement" }],
      [w.id, { slideDirection: "middle" }],
    ]) {
      const invalid = structuredClone(project);
      Object.assign(
        invalid.floors[0].openings.find((o) => o.id === id),
        changes,
      );
      assert.equal(engine.parseHomeProjectSchema(invalid).valid, false, JSON.stringify(changes));
      assert.equal(
        engine.validateLayoutFloorSpec(invalid.floors[0]).valid,
        false,
        JSON.stringify(changes),
      );
    }
  });
});
