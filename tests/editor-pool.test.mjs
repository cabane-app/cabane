import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { create } from "@react-three/test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { OrthographicCamera, Ray, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { advancePoolDrawing, emptyPoolDrawing } = await load(
    "/apps/web/src/editor-preview/construct/usePoolDrawing.ts",
  );
  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { ConstructionEditLayer } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionEditLayer.tsx",
  );
  const { ConstructionPoolLayer } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionPoolLayer.tsx",
  );
  const { PoolProperties } = await load(
    "/apps/web/src/editor-preview/construct/PoolProperties.tsx",
  );
  const { neutralDemoManifest, planPointToWorld } = await load("/packages/engine/src/index.ts");
  const floor = neutralDemoManifest.floors[0];
  const corners = [
    [10, 0],
    [14, 0],
    [14, 3],
    [10, 3],
  ];
  const point = (state, at) => advancePoolDrawing(state, { type: "point", point: at });
  const pointer = (x, z, options = {}) => ({
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
    nativeEvent: {
      altKey: false,
      pointerType: "mouse",
      clientX: x * 100,
      clientY: z * 100,
      ...options,
    },
    ray: new Ray(new Vector3(x, 10, z), new Vector3(0, -1, 0)),
  });

  test("pending corners support local undo/redo and only close at their own first corner", () => {
    let state = emptyPoolDrawing;
    for (const corner of corners) state = point(state, corner).state;
    assert.equal(point(state, corners[1]).completed, undefined);
    const undone = advancePoolDrawing(state, { type: "undo" }).state;
    assert.deepEqual(undone.points, corners.slice(0, 3));
    const redone = advancePoolDrawing(undone, { type: "redo" }).state;
    assert.deepEqual(redone.points, corners);
    const completed = point(redone, corners[0]);
    assert.deepEqual(completed.completed, corners);
    assert.equal(completed.state, emptyPoolDrawing);
    assert.equal(advancePoolDrawing(state, { type: "cancel" }).state, emptyPoolDrawing);
    let empty = state;
    for (let i = 0; i < corners.length; i++)
      empty = advancePoolDrawing(empty, { type: "undo" }).state;
    assert.equal(empty.points.length, 0);
    assert.equal(empty.future.length, 4, "the first point can be redone too");
  });

  test("invalid closure keeps the outline available for correction", () => {
    for (const polygon of [
      [
        [10, 0],
        [14, 3],
        [14, 0],
        [10, 3],
      ],
      [
        [10, 0],
        [12, 0],
        [14, 0],
      ],
    ]) {
      let state = emptyPoolDrawing;
      for (const corner of polygon) state = point(state, corner).state;
      const closed = point(state, polygon[0]);
      assert.equal(closed.completed, undefined);
      assert.match(closed.state.error, /crosses itself|no area/);
      assert.deepEqual(closed.state.points, polygon);
    }
  });

  test("Pool reuses wall pointer gestures and closure snapping across scales and pointer types", async () => {
    // Keep this closure fixture away from the demo walls’ new alignment guides.
    const drawingCorners = corners.map(([x, y]) => [x, y + 10]);
    for (const scale of [0.5, 1, 2]) {
      let editor;
      const source = {
        ...floor,
        coordinates: { origin: [2, -1], metersPerPlanUnit: scale, scaleBasis: "measured" },
      };
      function Harness() {
        editor = useConstructEditor(source);
        const drawing = editor.poolDrawing;
        return createElement(ConstructionEditLayer, {
          planMode: true,
          draft: editor.draft,
          coordinates: editor.draft.coordinates,
          rooms: editor.previewFloor.rooms,
          selection: editor.selection,
          tool: editor.tool,
          poolPoints: drawing.points,
          drawStart: drawing.points.at(-1) ?? null,
          drawPreview: drawing.preview,
          onBeginWall: drawing.place,
          onPreviewWall: drawing.previewPoint,
          onAddWall: drawing.place,
          onCancelWall: drawing.cancel,
          onSelectWall() {},
          onSelectOpening() {},
          onSelectRoom() {},
          onMoveEndpoint() {},
          onTranslateWall() {},
          onMoveOpening() {},
          onResizeOpening() {},
          onPlaceOpening() {},
        });
      }
      const camera = new OrthographicCamera(-500, 500, 400, -400, 0.1, 100);
      camera.zoom = 100;
      camera.updateProjectionMatrix();
      const renderer = await create(createElement(Harness), { camera, width: 1000, height: 800 });
      try {
        const original = editor.previewFloor;
        act(() => editor.setTool("pool"));
        const surface = () =>
          renderer.scene.findByProps({ name: "construction-placement-surface" });
        for (const [index, corner] of drawingCorners.entries()) {
          const [x, z] = planPointToWorld(corner, source.coordinates);
          const input = pointer(x, z, { pointerType: ["mouse", "pen", "touch", "mouse"][index] });
          await renderer.fireEvent(surface(), "pointerDown", input);
          await renderer.fireEvent(surface(), "pointerUp", input);
          assert.equal(editor.previewFloor.pools?.length ?? 0, 0);
        }
        const [x, z] = planPointToWorld(drawingCorners[0], source.coordinates);
        await renderer.fireEvent(surface(), "pointerMove", pointer(x + 0.1, z + 0.01));
        assert.deepEqual(editor.poolDrawing.preview, drawingCorners[0]);
        await renderer.fireEvent(surface(), "pointerUp", pointer(x + 0.1, z + 0.01));
        assert.deepEqual(editor.previewFloor.pools[0].polygon, drawingCorners);
        assert.equal(editor.poolDrawing.active, false);
        assert.equal(editor.history.past.length, 1);
        assert.equal(editor.tool, "pool");
        for (const key of ["walls", "rooms", "openings", "ceilings", "wallJunctions", "footprint"])
          assert.equal(editor.previewFloor[key], original[key], key);
        act(() => editor.undo());
        assert.equal(editor.previewFloor.pools?.length ?? 0, 0);
        act(() => editor.redo());
        assert.deepEqual(editor.previewFloor.pools[0].polygon, drawingCorners);
        act(() => editor.poolDrawing.place([20, 10]));
        act(() => editor.setTool("wall"));
        assert.equal(editor.poolDrawing.active, false);
      } finally {
        await renderer.unmount();
      }
    }
  });

  test("pool movement and corner gestures commit once, cancel safely, and support deletion history", async () => {
    let editor;
    const calls = [];
    function Harness() {
      editor = useConstructEditor({ ...floor, pools: [{ id: "pool-1", polygon: corners }] });
      return createElement(ConstructionPoolLayer, {
        draft: editor.draft,
        selection: editor.selection,
        tool: editor.tool,
        onSelect: editor.selectPool,
        onUpdate: (id, polygon) => {
          calls.push(polygon);
          editor.updatePool(id, polygon);
        },
      });
    }
    const renderer = await create(createElement(Harness));
    try {
      const surface = renderer.scene.findByProps({ name: "construction-pool-pool-1" });
      await renderer.fireEvent(surface, "pointerDown", pointer(12, 1.5));
      await renderer.fireEvent(surface, "pointerMove", pointer(12.04, 1.5));
      await renderer.fireEvent(surface, "pointerUp", pointer(12.04, 1.5));
      assert.equal(calls.length, 0, "sub-threshold pointer wobble only selects the pool");
      assert.deepEqual(editor.draft.pools[0].polygon, corners);
      await renderer.fireEvent(surface, "pointerDown", pointer(12, 1.5));
      await renderer.fireEvent(surface, "pointerMove", pointer(13, 1.5));
      assert.equal(calls.length, 0);
      await renderer.fireEvent(surface, "pointerUp", pointer(13, 1.5));
      assert.equal(calls.length, 1);
      assert.deepEqual(
        editor.draft.pools[0].polygon,
        corners.map(([x, z]) => [x + 1, z]),
      );
      const handle = renderer.scene.findByProps({ name: "construction-pool-corner-pool-1-0" });
      await renderer.fireEvent(handle, "pointerDown", pointer(11, 0));
      await renderer.fireEvent(handle, "pointerMove", pointer(11, -1));
      await renderer.fireEvent(handle, "pointerUp", pointer(11, -1));
      assert.equal(calls.length, 2);
      assert.deepEqual(editor.draft.pools[0].polygon[0], [11, -1]);
      await renderer.fireEvent(handle, "pointerDown", pointer(11, -1));
      await renderer.fireEvent(handle, "pointerMove", pointer(11, -2));
      await renderer.fireEvent(handle, "pointerCancel", pointer(11, -2));
      assert.equal(calls.length, 2);
      const markup = renderToStaticMarkup(
        createElement(PoolProperties, { pool: editor.draft.pools[0], editor }),
      );
      assert.match(markup, /Pool corner 1 X/);
      assert.match(markup, /Perimeter/);
      assert.match(markup, /Pool type/);
      assert.match(markup, /Pool depth/);
      act(() => editor.configurePool(editor.draft.pools[0].id, "above-ground-wood", 1.2));
      assert.equal(editor.previewFloor.pools[0].heightMeters, 1.2);
      assert.equal(editor.previewFloor.pools[0].type, "above-ground-wood");
      act(() => editor.undo());
      assert.equal(editor.previewFloor.pools[0].type, undefined);
      act(() => editor.redo());
      assert.equal(editor.previewFloor.pools[0].heightMeters, 1.2);
      act(() => editor.deleteSelected());
      assert.equal(editor.draft.pools.length, 0);
      act(() => editor.undo());
      assert.equal(editor.draft.pools.length, 1);
    } finally {
      await renderer.unmount();
    }
  });

  test("later wall and opening edits retain pools, including opening-orientation fast paths", async () => {
    let editor;
    function Harness() {
      editor = useConstructEditor({ ...floor, pools: [{ id: "pool-1", polygon: corners }] });
      return null;
    }
    const renderer = await create(createElement(Harness));
    try {
      const opening = editor.draft.openings.find((o) => o.kind === "door");
      act(() =>
        editor.dispatch({ type: "update-opening", opening: { ...opening, hingeSide: "right" } }),
      );
      assert.deepEqual(editor.previewFloor.pools[0].polygon, corners);
      act(() =>
        editor.dispatch({
          type: "update-wall-metadata",
          wallId: editor.draft.walls[0].id,
          changes: { heightMeters: 2.8 },
        }),
      );
      assert.deepEqual(editor.previewFloor.pools[0].polygon, corners);
    } finally {
      await renderer.unmount();
    }
  });
});
