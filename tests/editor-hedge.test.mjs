import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3, Matrix4, OrthographicCamera, Ray, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { ConstructionEditLayer } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionEditLayer.tsx",
  );
  const { ConstructionHedgeLayer } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionHedgeLayer.tsx",
  );
  const { useConstructionOutlineDrag } = await load(
    "/apps/web/src/editor-preview/construct/useConstructionOutlineDrag.ts",
  );
  const { ArchitecturalHedges } = await load("/packages/engine/src/hedges/index.ts");
  const { exportFloorSpec, importFloorSpec } = await load(
    "/packages/engine/src/home-project/legacy-floor-storage.ts",
  );
  const { layoutFloorFromEditorFloor } = await load("/apps/web/src/editor-preview/project-sync.ts");
  const { TerrainSurfaceContext } = await load("/packages/engine/src/terrain/TerrainSurface.tsx");
  const { createTerrainSurface } = await load("/packages/engine/src/terrain/terrain-surface.ts");
  const { prepareBuildingWalk } = await load("/packages/engine/src/stairs/stair-navigation.ts");
  const base = engine.neutralDemoManifest.floors[0];
  const pointer = (x, z) => ({
    pointerId: 1,
    button: 0,
    target: {
      setPointerCapture() {},
      hasPointerCapture() {
        return true;
      },
      releasePointerCapture() {},
    },
    stopPropagation() {},
    nativeEvent: { altKey: true, pointerType: "mouse", clientX: x * 100, clientY: z * 100 },
    ray: new Ray(new Vector3(x, 10, z), new Vector3(0, -1, 0)),
  });
  test("Hedge uses segment pointer gestures and preserves architecture through edit, deletion and history", async () => {
    let editor;
    function Harness() {
      editor = useConstructEditor(base);
      return createElement(
        "group",
        {},
        createElement(ConstructionEditLayer, {
          planMode: true,
          draft: editor.draft,
          coordinates: editor.draft.coordinates,
          rooms: editor.previewFloor.rooms,
          selection: editor.selection,
          tool: editor.tool,
          drawStart: editor.drawStart,
          drawPreview: editor.drawPreview,
          onBeginWall: editor.beginWall,
          onPreviewWall: editor.previewWall,
          onAddWall: editor.addWall,
          onCancelWall: editor.cancelWall,
          onSelectWall() {},
          onSelectOpening() {},
          onSelectRoom() {},
          onMoveEndpoint() {},
          onTranslateWall() {},
          onMoveOpening() {},
          onResizeOpening() {},
          onPlaceOpening() {},
        }),
        createElement(ConstructionHedgeLayer, { editor, onDraggingChange() {} }),
      );
    }
    const camera = new OrthographicCamera(-500, 500, 400, -400, 0.1, 100);
    camera.zoom = 100;
    camera.updateProjectionMatrix();
    const renderer = await create(createElement(Harness), { camera, width: 1000, height: 800 });
    try {
      act(() => editor.setTool("hedge"));
      const surface = () => renderer.scene.findByProps({ name: "construction-placement-surface" });
      await renderer.fireEvent(surface(), "pointerDown", pointer(10, 0));
      await renderer.fireEvent(surface(), "pointerMove", pointer(14, 0));
      await renderer.fireEvent(surface(), "pointerUp", pointer(14, 0));
      assert.equal(editor.previewFloor.hedges.length, 1);
      assert.equal(editor.previewFloor.walls, base.walls);
      assert.equal(editor.previewFloor.rooms, base.rooms);
      const id = editor.previewFloor.hedges[0].id;
      act(() => editor.setTool("select"));
      const hit = () => renderer.scene.findByProps({ name: `construction-hedge-${id}` });
      await renderer.fireEvent(hit(), "pointerDown", pointer(12, 0));
      await renderer.fireEvent(hit(), "pointerMove", pointer(12, 2));
      await renderer.fireEvent(hit(), "pointerUp", pointer(12, 2));
      const hedge = editor.previewFloor.hedges[0];
      const [x, z] = engine.planPointToWorld(hedge.from, base.coordinates);
      assert.deepEqual([x, z], [10, 2]);
      const endpoint = () =>
        renderer.scene.findByProps({ name: `construction-hedge-endpoint-${id}-1` });
      await renderer.fireEvent(endpoint(), "pointerDown", pointer(14, 2));
      await renderer.fireEvent(endpoint(), "pointerMove", pointer(15, 3));
      await renderer.fireEvent(endpoint(), "pointerUp", pointer(15, 3));
      assert.deepEqual(
        engine.planPointToWorld(editor.previewFloor.hedges[0].to, base.coordinates),
        [15, 3],
      );
      act(() =>
        editor.dispatch({
          type: "update-hedge",
          id,
          changes: { style: "picket", heightMeters: 2 },
        }),
      );
      assert.equal(editor.previewFloor.hedges[0].style, "picket");
      const restored = importFloorSpec(exportFloorSpec(editor.previewFloor));
      assert.equal(restored.valid, true, JSON.stringify(restored.issues));
      assert.deepEqual(restored.floor.hedges, editor.previewFloor.hedges);
      act(() => editor.deleteSelected());
      assert.equal(editor.previewFloor.hedges.length, 0);
      act(() => editor.undo());
      assert.equal(editor.previewFloor.hedges.length, 1);
      act(() => editor.redo());
      assert.equal(editor.previewFloor.hedges.length, 0);
    } finally {
      await renderer.unmount();
    }
  });

  test("strict project schema preserves hedges and rejects invalid dimensions or unknown fields", async () => {
    const floor = {
      ...base,
      hedges: [
        {
          id: "schema-hedge",
          from: [10, 0],
          to: [14, 0],
          style: "rounded",
          heightMeters: 1.4,
          widthMeters: 0.7,
        },
      ],
    };
    const project = {
      schemaVersion: 1,
      seedRevision: "hedge-test",
      home: engine.neutralDemoManifest.home,
      floor: layoutFloorFromEditorFloor(floor),
      sceneItems: [],
      roomProfiles: {},
      openingProfiles: {},
      shortcuts: [],
      assumptions: [],
    };
    assert.equal(
      engine.validateHomeProject(project, { furnishingModels: {}, deviceModels: {} }).valid,
      true,
    );
    const invalid = structuredClone(project);
    invalid.floor.hedges[0].widthMeters = -1;
    assert.equal(engine.parseHomeProjectSchema(invalid).valid, false);
    const unknown = structuredClone(project);
    unknown.floor.hedges[0].texture = "external";
    assert.equal(engine.parseHomeProjectSchema(unknown).valid, false);
  });
  test("all hedge models render toon geometry and derive a matching walk obstacle", async () => {
    for (const style of engine.HEDGE_STYLES.map((entry) => entry.id)) {
      const floor = {
        ...base,
        hedges: [
          { id: "hedge", from: [10, 0], to: [14, 0], style, heightMeters: 1.4, widthMeters: 0.7 },
        ],
      };
      const renderer = await create(createElement(ArchitecturalHedges, { floor }));
      try {
        assert.ok(renderer.scene.findAll((node) => node.type === "Mesh").length > 0);
        const collider = engine
          .deriveWalkColliders(floor)
          .find((entry) => entry.id === "hedge-walk");
        assert.equal(collider.halfThickness, 0.35);
      } finally {
        await renderer.unmount();
      }
      assert.equal(engine.validateLayoutFloorSpec(floor).valid, true);
      const restored = importFloorSpec(exportFloorSpec(floor));
      assert.equal(restored.valid, true, JSON.stringify(restored.issues));
      assert.deepEqual(restored.floor.hedges, floor.hedges);
    }
    const floor = {
      ...base,
      hedges: [
        { id: "bad", from: [1, 1], to: [1, 1], style: "unknown", heightMeters: 0, widthMeters: -1 },
      ],
    };
    assert.equal(engine.validateLayoutFloorSpec(floor).valid, false);
  });
  test("ground boundaries follow varying terrain throughout their solids and Walk ranges", async () => {
    const floor = {
      ...base,
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      footprint: [
        [0, 0],
        [8, 0],
        [8, 8],
        [0, 8],
      ],
      hedges: [
        {
          id: "slope",
          from: [0, -1],
          to: [8, -1],
          style: "clipped",
          heightMeters: 1.4,
          widthMeters: 0.7,
        },
      ],
    };
    const home = {
      terrain: {
        topLeftMeters: 0,
        topRightMeters: -2,
        bottomLeftMeters: -1,
        bottomRightMeters: -3,
      },
    };
    const terrain = createTerrainSurface(home.terrain, [floor]);
    const matrix = new Matrix4();
    for (const style of engine.HEDGE_STYLES.map((entry) => entry.id)) {
      floor.hedges[0].style = style;
      const renderer = await create(
        createElement(
          TerrainSurfaceContext.Provider,
          { value: terrain },
          createElement(ArchitecturalHedges, { floor }),
        ),
      );
      try {
        renderer.scene.instance.updateMatrixWorld(true);
        const meshes = renderer.scene
          .findAll((node) => node.instance.isMesh)
          .map((node) => node.instance);
        const samples = [];
        for (const mesh of meshes) {
          const positions = mesh.geometry.attributes.position;
          for (let instance = 0; instance < (mesh.isInstancedMesh ? mesh.count : 1); instance++) {
            matrix.copy(mesh.matrixWorld);
            if (mesh.isInstancedMesh) {
              const local = new Matrix4();
              mesh.getMatrixAt(instance, local);
              matrix.multiply(local);
            }
            for (let i = 0; i < positions.count; i++) {
              const point = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix);
              samples.push({
                point,
                above: point.y - (-0.05 + terrain.offsetAt(point.x, point.z)),
              });
            }
          }
        }
        for (const x of [0.5, 2, 4, 6, 7.5]) {
          const local = samples.filter(
            ({ point }) => Math.abs(point.x - x) < (style === "post-rail" ? 0.9 : 0.55),
          );
          assert.ok(local.length, `${style}: geometry spans the full boundary`);
          assert.ok(
            Math.min(...local.map(({ above }) => above)) < 0.15,
            `${style} floats at x=${x}`,
          );
          assert.ok(
            Math.min(...local.map(({ above }) => above)) > -0.15,
            `${style} sinks at x=${x}`,
          );
        }
        if (style === "clipped" || style === "masonry" || style === "ivy-wall") {
          for (const x of [1, 3, 5, 7]) {
            const hits = new Raycaster(
              new Vector3(x, -0.05 + terrain.offsetAt(x, -1) + 0.3, 2),
              new Vector3(0, 0, -1),
            ).intersectObjects(meshes);
            assert.ok(hits.length > 0, `${style}: ray picking follows the grounded solid at ${x}`);
          }
        }
      } finally {
        await renderer.unmount();
      }
    }
    const building = {
      home,
      coordinates: floor.coordinates,
      floors: [floor],
      stairs: [],
      sceneItems: [],
    };
    const colliders = prepareBuildingWalk(building)
      .colliders.get(floor.id)(new Set(), [])
      .filter((entry) => entry.id.startsWith("slope-walk"));
    assert.ok(colliders.length > 4, "collision follows the grade in short continuous segments");
    for (const collider of colliders) {
      const heights = [collider.from, collider.to].map(
        ({ x, z }) => -0.05 + terrain.offsetAt(x, z),
      );
      assert.ok(Math.abs(collider.minY - Math.min(...heights)) < 0.015);
      assert.ok(Math.abs(collider.maxY - Math.max(...heights) - 1.4) < 0.015);
    }
    const platformFloor = {
      ...floor,
      outdoorPlatforms: [
        {
          id: "terrace",
          polygon: [
            [0, -2],
            [8, -2],
            [8, 0],
            [0, 0],
          ],
          finish: { kind: "preset", preset: "travertine" },
          defaultEdge: { kind: "open" },
          edges: [],
        },
      ],
    };
    const platformRenderer = await create(
      createElement(
        TerrainSurfaceContext.Provider,
        { value: terrain },
        createElement(ArchitecturalHedges, { floor: platformFloor }),
      ),
    );
    try {
      const collider = prepareBuildingWalk({ ...building, floors: [platformFloor] })
        .colliders.get(floor.id)(new Set(), [])
        .find((entry) => entry.id === "slope-walk");
      assert.equal(collider.minY, 0, "authored platform boundary retains its support height");
      assert.ok(
        Math.abs(new Box3().setFromObject(platformRenderer.scene.instance).min.y + 0.05) < 1e-6,
        "platform boundary solids retain their authored level",
      );
      assert.equal(
        platformRenderer.scene.findByProps({ name: "hedge-slope" }).instance.position.y,
        -0.05,
      );
    } finally {
      await platformRenderer.unmount();
    }
    const upper = { ...floor, id: "upper", elevationMeters: 2.8 };
    const renderer = await create(
      createElement(
        TerrainSurfaceContext.Provider,
        { value: terrain },
        createElement(ArchitecturalHedges, { floor: upper }),
      ),
    );
    try {
      assert.equal(renderer.scene.findByProps({ name: "hedge-slope" }).instance.position.y, -0.05);
      const upperCollider = prepareBuildingWalk({ ...building, floors: [floor, upper] })
        .colliders.get(upper.id)(new Set(), [])
        .find((entry) => entry.id === "slope-walk");
      assert.equal(upperCollider.minY, 2.8);
      assert.ok(
        Math.abs(new Box3().setFromObject(renderer.scene.instance).min.y + 0.05) < 1e-6,
        "upper boundary solids retain their authored local level",
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("terrain boundary resizing and resetting rebuild geometry from the authored model", async () => {
    const floor = {
      ...base,
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      footprint: [
        [0, 0],
        [8, 0],
        [8, 8],
        [0, 8],
      ],
      hedges: [
        {
          id: "edit",
          from: [0, -1],
          to: [8, -1],
          style: "clipped",
          heightMeters: 1,
          widthMeters: 0.5,
        },
      ],
    };
    const terrain = createTerrainSurface(
      { topLeftMeters: -1, topRightMeters: -1, bottomLeftMeters: -1, bottomRightMeters: -1 },
      [floor],
    );
    const render = (floor, terrain) =>
      createElement(
        TerrainSurfaceContext.Provider,
        { value: terrain },
        createElement(ArchitecturalHedges, { floor }),
      );
    const renderer = await create(render(floor, terrain));
    try {
      const edited = { ...floor, hedges: [{ ...floor.hedges[0], to: [4, -1], heightMeters: 2 }] };
      await renderer.update(render(edited, terrain));
      const solidBounds = () => {
        renderer.scene.instance.updateMatrixWorld(true);
        const bounds = new Box3();
        renderer.scene
          .findAll((node) => node.instance.isMesh && !node.instance.isInstancedMesh)
          .forEach((node) => bounds.expandByObject(node.instance));
        return bounds;
      };
      const bounds = solidBounds();
      assert.ok(Math.abs(bounds.min.y + 1.05) < 1e-6, JSON.stringify(bounds));
      assert.ok(
        bounds.max.x < 4.2 && bounds.max.y > 0.94,
        "resizing keeps the edited length and height",
      );
      await renderer.update(render(edited, null));
      assert.ok(
        Math.abs(solidBounds().min.y + 0.05) < 1e-6,
        "reset to flat restores the original model geometry",
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("hedge, pool, and floor corner drags use neighboring angles and clear alignment on Alt", async () => {
    const angle = 0.3;
    const at = (x, y) => [
      10 + x * Math.cos(angle) - y * Math.sin(angle),
      10 + x * Math.sin(angle) + y * Math.cos(angle),
    ];
    const original = [at(0, 0), at(4, 0), at(4, 2.9), at(0, 3)];
    for (const selectionKind of ["hedge", "pool", "floor-zone"]) {
      let controller;
      const commits = [];
      const draft = {
        ...engine.createFloorEditorDraft(base),
        coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
        walls: [],
        hedges:
          selectionKind === "hedge"
            ? original.map((from, i) => ({
                id: i === 1 ? "shape" : `edge-${i}`,
                from,
                to: original[(i + 1) % original.length],
                style: "clipped",
                heightMeters: 1.4,
                widthMeters: 0.65,
              }))
            : [],
      };
      const outline = selectionKind === "hedge" ? [original[1], original[2]] : original;
      const corner = selectionKind === "hedge" ? 1 : 2;
      const selection = { kind: selectionKind, id: "shape" };
      function Harness() {
        controller = useConstructionOutlineDrag({
          draft,
          selection,
          tool: "select",
          selectionKind,
          onSelect() {},
          onUpdate: (_id, points) => commits.push(points),
        });
        return createElement("mesh", {
          name: "corner",
          ...controller.handlers("shape", outline, corner),
        });
      }
      const camera = new OrthographicCamera(-500, 500, 400, -400, 0.1, 100);
      camera.zoom = 100;
      camera.updateProjectionMatrix();
      const renderer = await create(createElement(Harness), { camera, width: 1000, height: 800 });
      const event = (point, altKey = false) => {
        const result = pointer(...point);
        result.nativeEvent.altKey = altKey;
        return result;
      };
      try {
        const mesh = () => renderer.scene.findByProps({ name: "corner" });
        await renderer.fireEvent(mesh(), "pointerDown", event(original[2]));
        await renderer.fireEvent(mesh(), "pointerMove", event(at(4.04, 3.05)));
        controller.drag.polygon[corner].forEach((value, i) =>
          assert.ok(
            Math.abs(value - at(4, 3)[i]) < 1e-9,
            `${selectionKind}: ${controller.drag.polygon[corner]} expected ${at(4, 3)}`,
          ),
        );
        assert.equal(controller.snap.kind, "alignment");
        assert.equal(commits.length, 0);
        await renderer.fireEvent(mesh(), "pointerMove", event(at(4.04, 3.05), true));
        assert.equal(controller.snap, null);
        await renderer.fireEvent(mesh(), "pointerMove", event(at(4.04, 3.05)));
        const preview = controller.drag.polygon;
        await renderer.fireEvent(mesh(), "pointerUp", event(at(4.04, 3.05)));
        assert.deepEqual(commits, [preview]);
        assert.equal(controller.snap, null);
      } finally {
        await renderer.unmount();
      }
    }
  });
});
