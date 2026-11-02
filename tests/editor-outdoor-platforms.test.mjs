import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { create } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const e = await load("/packages/engine/src/index.ts");
  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { FloorToolProperties } = await load(
    "/apps/web/src/editor-preview/construct/FloorToolProperties.tsx",
  );
  const floor = e.neutralDemoManifest.floors[0];
  test("Floor painting and outdoor space retain their controls in separate tools", () => {
    const labels = ["Whole room", "Custom area"];
    for (const target of ["room", "custom-area", "outdoor-platform"]) {
      const editor = {
        tool: target === "outdoor-platform" ? "platform" : "floor",
        platformSettings: {
          finish: { kind: "solid", color: "#ffffff" },
          defaultEdge: { kind: "railing", heightMeters: 1 },
        },
        poolDrawing: { error: null },
      };
      const panel = FloorToolProperties({
        editor,
        painting: { target, finish: editor.platformSettings.finish },
      });
      const [header, choices, hint, finish, edges] = panel.props.children;
      assert.equal(header.type, "header");
      if (target === "outdoor-platform") {
        assert.equal(header.props.children.props.children, "Outdoor space");
        assert.equal(choices, false);
      } else {
        assert.equal(choices.props["aria-label"], "Paint target");
        assert.deepEqual(
          choices.props.children.map((button) => button.props["aria-label"]),
          labels,
        );
        assert.equal(
          choices.props.children.filter((button) => button.props["aria-pressed"]).length,
          1,
        );
      }
      assert.equal(hint.type, "p");
      assert.equal(finish.props.children[0].props.children, "Floor finish");
      assert.equal(Boolean(edges), target === "outdoor-platform");
    }
  });
  test("Outdoor space drawing commits the creation style, selects the platform and retains it through wall edits", async () => {
    let editor;
    const renderer = await create(
      createElement(() => {
        editor = useConstructEditor(floor);
        return null;
      }),
    );
    try {
      act(() => editor.setTool("platform"));
      for (const point of [
        [10, 0],
        [14, 0],
        [14, 3],
        [10, 3],
        [10, 0],
      ])
        act(() => editor.poolDrawing.place(point));
      assert.equal(editor.draft.outdoorPlatforms?.length, 1);
      assert.equal(editor.selection.kind, "outdoor-platform");
      assert.equal(editor.tool, "select");
      const before = structuredClone(editor.draft.outdoorPlatforms[0]);
      act(() =>
        editor.dispatch({
          type: "update-outdoor-platform",
          id: before.id,
          changes: { defaultEdge: { kind: "low-wall", heightMeters: 0.3 } },
        }),
      );
      act(() => editor.undo());
      assert.deepEqual(editor.draft.outdoorPlatforms[0], before);
      act(() => editor.setTool("wall"));
      act(() => editor.beginWall([20, 20]));
      act(() => editor.addWall([22, 20]));
      assert.deepEqual(editor.previewFloor.outdoorPlatforms, [before]);
      act(() => editor.selectMany([{ kind: "outdoor-platform", id: before.id }]));
      act(() => editor.deleteSelected());
      assert.equal(editor.draft.outdoorPlatforms.length, 0);
      act(() => editor.undo());
      assert.deepEqual(editor.draft.outdoorPlatforms, [before]);
    } finally {
      await renderer.unmount();
    }
  });
  test("cancel ends the outdoor gesture and Floor returns to room painting", async () => {
    let editor;
    const renderer = await create(
      createElement(() => {
        editor = useConstructEditor(floor);
        return null;
      }),
    );
    try {
      act(() => editor.setFloorPaintTarget("outdoor-platform"));
      act(() => editor.poolDrawing.place([10, 0]));
      const panel = FloorToolProperties({
        editor,
        painting: { target: "outdoor-platform", finish: editor.platformSettings.finish },
      });
      const cancel = panel.props.children.find(
        (child) => child?.props?.children === "Cancel outdoor space",
      );
      act(() => cancel.props.onClick());
      assert.equal(editor.tool, "select");
      assert.equal(editor.poolDrawing.active, false);
      assert.equal(editor.draft.outdoorPlatforms?.length ?? 0, 0);
      act(() => editor.setTool("floor"));
      assert.equal(editor.tool, "floor");
      assert.equal(editor.floorPaintTarget, "room");
      act(() => editor.setTool("platform"));
      act(() => editor.poolDrawing.place([10, 0]));
      assert.equal(editor.poolDrawing.active, true);
    } finally {
      await renderer.unmount();
    }
  });
  test("Floor shortcut stays separate from outdoor space and target changes cancel the prior gesture", async () => {
    let editor;
    const renderer = await create(
      createElement(() => {
        editor = useConstructEditor(floor);
        return null;
      }),
    );
    try {
      act(() => editor.setFloorPaintTarget("outdoor-platform"));
      for (const point of [
        [10, 0],
        [14, 0],
        [14, 3],
        [10, 3],
        [10, 0],
      ])
        act(() => editor.poolDrawing.place(point));
      assert.equal(editor.tool, "select");
      act(() => editor.setTool("floor")); // The F shortcut and toolbar share this entry point.
      assert.equal(editor.tool, "floor");
      assert.equal(editor.floorPaintTarget, "room");
      act(() => editor.setTool("platform"));
      act(() => editor.poolDrawing.place([15, 0]));
      act(() => editor.setFloorPaintTarget("custom-area"));
      assert.equal(editor.tool, "floor");
      assert.equal(editor.floorPaintTarget, "custom-area");
      assert.equal(editor.poolDrawing.active, false);
      act(() => editor.setTool("select"));
      act(() => editor.setTool("floor"));
      assert.equal(editor.floorPaintTarget, "custom-area");
      act(() => editor.setFloorPaintTarget("room"));
      assert.equal(editor.tool, "floor");
      assert.equal(editor.floorPaintTarget, "room");
      act(() => editor.setFloorPaintTarget("outdoor-platform"));
      assert.equal(editor.tool, "platform");
      assert.equal(editor.floorPaintTarget, "outdoor-platform");
      assert.equal(editor.draft.outdoorPlatforms.length, 1);
    } finally {
      await renderer.unmount();
    }
  });
});
