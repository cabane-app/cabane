import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, useEffect, useState } from "react";
import { useStore } from "@react-three/fiber";
import { create } from "@react-three/test-renderer";
import { OrthographicCamera } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { FurnishingEditLayer } = await load(
    "/apps/web/src/editor-preview/furnish/FurnishingEditLayer.tsx",
  );
  const { useFurnishingEditor } = await load(
    "/apps/web/src/editor-preview/furnish/useFurnishingEditor.ts",
  );
  const { useEditorPanels } = await load("/apps/web/src/editor-workspace/useEditorPanels.ts");
  const { editorCanvasEvents } = await load(
    "/apps/web/src/editor-workspace/editor-canvas-events.ts",
  );
  const { neutralDemoManifest } = await load("/packages/engine/src/index.ts");
  const definition = {
    defaultSize: [0.6, 0.6, 0.6],
    bounds: { min: [-0.3, 0, -0.3], max: [0.3, 0.6, 0.3] },
  };

  async function withSelectionScene(kind, run) {
    let editor, panels, store;
    const camera = new OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
    camera.position.set(0, 10, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    const item = {
      id: "synthetic-item",
      kind,
      modelId: "synthetic-model",
      size: definition.defaultSize,
      placement: { kind: "absolute", at: [0, 0], elevationMeters: 0, rotationYRadians: 0 },
      ...(kind === "device" ? { entitySlots: [] } : {}),
    };
    function Harness() {
      store = useStore();
      editor = useFurnishingEditor([item]);
      const [dragging, setDragging] = useState(false);
      panels = useEditorPanels(editor.selectedId, dragging);
      // Model PreviewCamera's compact Properties drawer projection. A pointer-down
      // selection used to shift the item away before the same stationary click.
      useEffect(() => {
        if (panels.propertiesOpen) camera.setViewOffset(800, 600, 160, 0, 800, 600);
        else camera.clearViewOffset();
        camera.updateProjectionMatrix();
      }, [panels.propertiesOpen]);
      return createElement(FurnishingEditLayer, {
        items: editor.items,
        floor: neutralDemoManifest.floors[0],
        furnishingModels: { "synthetic-model": definition },
        deviceModels: { "synthetic-model": definition },
        selectedId: editor.selectedId,
        onSelect: editor.select,
        onSelectMany: editor.selectMany,
        onMovePlacement: editor.updatePlacement,
        onDragStart: editor.beginTransaction,
        onDragEnd: editor.commitTransaction,
        onDragCancel: editor.cancelTransaction,
        onDraggingChange: setDragging,
      });
    }
    const renderer = await create(createElement(Harness), { camera, width: 800, height: 600 });
    const manager = editorCanvasEvents(store);
    store.setState({
      events: manager,
      onPointerMissed: (event) => {
        if (event.type === "click" && event.button === 0) editor.select(null);
      },
    });
    const target = { setPointerCapture() {}, releasePointerCapture() {} };
    const send = async (name, type, x = 400, overrides = {}) => {
      renderer.scene.instance.updateMatrixWorld(true);
      await act(async () => {
        manager.handlers[name]({
          type,
          button: 0,
          pointerId: 1,
          offsetX: x,
          offsetY: 300,
          clientX: x,
          clientY: 300,
          target,
          ...overrides,
        });
      });
    };
    try {
      await run({ send, editor: () => editor, panels: () => panels, camera });
    } finally {
      await renderer.unmount();
    }
  }

  test("stationary Arrange clicks retain furniture and device selection when Properties reframes the scene", async () => {
    for (const kind of ["furnishing", "device"]) {
      await withSelectionScene(kind, async ({ send, editor, panels, camera }) => {
        await send("onPointerDown", "pointerdown");
        await send("onPointerUp", "pointerup");
        await send("onClick", "click");
        assert.equal(editor().selectedId, "synthetic-item", `${kind}: selection survives click`);
        assert.equal(panels().propertiesOpen, true);
        assert.equal(camera.view.enabled, true, "Properties still reframes after selection");
        assert.equal(editor().transaction, null);
        assert.equal(editor().past.length, 0, "clicking must not create drag history");

        await send("onPointerDown", "pointerdown", 700);
        await send("onPointerUp", "pointerup", 700);
        await send("onClick", "click", 700);
        assert.equal(editor().selectedId, null, "a separate empty-space click still clears");
      });
    }
  });

  test("drag activation selects the item, defers Properties and ignores the trailing background click", async () => {
    await withSelectionScene("furnishing", async ({ send, editor, panels }) => {
      const original = editor().items[0].placement;
      await send("onPointerDown", "pointerdown");
      assert.equal(editor().selectedId, null, "a pending tap must not reframe the scene");
      await send("onPointerMove", "pointermove", 420);
      assert.equal(editor().selectedId, "synthetic-item");
      assert.ok(editor().transaction, "drag activation starts its history transaction");
      assert.equal(panels().propertiesOpen, false, "active drags defer Properties reflow");
      assert.notDeepEqual(editor().items[0].placement, original);
      await send("onPointerUp", "pointerup", 420);
      assert.equal(panels().propertiesOpen, true);
      await send("onClick", "click", 420);
      assert.equal(editor().selectedId, "synthetic-item", "drag release must retain selection");
      assert.equal(editor().transaction, null);
      assert.equal(editor().past.length, 1);
      await act(async () => editor().undo());
      assert.deepEqual(editor().items[0].placement, original);
    });
  });
});
