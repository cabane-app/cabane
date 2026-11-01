import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { create as createScene } from "@react-three/test-renderer";
import { Ray, Vector3 } from "three";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { createFurnishingEditorState, furnishingEditorReducer: reduce } = await load(
    "/apps/web/src/editor-preview/furnish/editor-state.ts",
  );
  const { guardedFurnishingEditorReducer: guarded } = await load(
    "/apps/web/src/editor-preview/furnish/placement/guarded-editor-state.ts",
  );
  const { expandItemSelection } = await load("/apps/web/src/editor-preview/furnish/item-groups.ts");
  const { groupPlacement } = await load("/apps/web/src/editor-preview/furnish/group-transforms.ts");
  const { furnishingSelectionTarget } = await load(
    "/apps/web/src/editor-preview/furnish/selection-target.ts",
  );
  const { layoutFloorFromEditorFloor } = await load("/apps/web/src/editor-preview/project-sync.ts");
  const { useFurnishingEditor } = await load(
    "/apps/web/src/editor-preview/furnish/useFurnishingEditor.ts",
  );
  const { ArrangePlacedItems } = await load(
    "/apps/web/src/editor-preview/furnish/ArrangePlacedItems.tsx",
  );
  const { FurnishingEditLayer } = await load(
    "/apps/web/src/editor-preview/furnish/FurnishingEditLayer.tsx",
  );
  const { SelectedItemsProperties } = await load(
    "/apps/web/src/editor-preview/furnish/SelectedItemsProperties.tsx",
  );
  const { FurnishingInspector } = await load(
    "/apps/web/src/editor-preview/furnish/FurnishingInspector.tsx",
  );
  const floor = {
    ...api.neutralDemoManifest.floors[0],
    coordinates: { origin: [10, 20], metersPerPlanUnit: 0.5, scaleBasis: "measured" },
  };
  const descriptor = {
    label: "Shelf",
    category: "Storage",
    defaultRoomType: "living-room",
    defaultSize: [1, 1, 1],
    bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    outlineContact: false,
    complexity: { visibleMeshes: 1, triangles: 12 },
    component: () => null,
  };
  const registries = {
    furnishingModels: { shelf: descriptor },
    deviceModels: { lamp: { ...descriptor, label: "Table lamp" } },
  };
  const items = [
    {
      id: "shelf",
      kind: "furnishing",
      floorId: floor.id,
      modelId: "shelf",
      size: [2, 1, 0.4],
      placement: { kind: "absolute", at: [12, 22], elevationMeters: 0, rotationYRadians: 0.3 },
    },
    {
      id: "lamp",
      kind: "device",
      floorId: floor.id,
      modelId: "lamp",
      size: [0.2, 0.3, 0.2],
      entitySlots: [
        {
          id: "lamp-control",
          compatibleDomains: ["light"],
          required: true,
          deviceRole: "primary",
          autoMap: "manual",
          presentation: { label: "Lamp", dashboardRole: "primary" },
        },
      ],
      lightState: "connected",
      placement: { kind: "absolute", at: [13, 22], elevationMeters: 1.2, rotationYRadians: -0.2 },
    },
  ];
  const group = (sources = items) =>
    reduce(createFurnishingEditorState(sources), {
      type: "group-items",
      ids: sources.map((item) => item.id),
      reservedIds: ["reserved-group-id"],
    });
  const pose = (state) => groupPlacement(state.items, floor);
  const close = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
  const projectFor = (sceneItems) => ({
    ...api.createEmptyHomeProject("group-fixture", "Group fixture"),
    coordinates: floor.coordinates,
    floors: [layoutFloorFromEditorFloor(floor)],
    sceneItems,
  });

  test("groups select as one unit, lock individual edits, and split without changing item data", () => {
    let state = group();
    assert.equal(state.past.length, 1);
    assert.equal(state.items[0].group.id, state.items[1].group.id);
    assert.notEqual(state.items[0].group.id, "reserved-group-id");
    assert.deepEqual(expandItemSelection(state.items, ["lamp"]), ["shelf", "lamp"]);
    assert.deepEqual(
      reduce(state, {
        type: "update-placement",
        id: "lamp",
        placement: { ...items[1].placement, at: [90, 90] },
      }),
      state,
    );
    assert.equal(
      reduce(state, {
        type: "update-placements",
        placements: { lamp: { ...items[1].placement, at: [90, 90] } },
      }),
      state,
    );
    state = reduce(state, {
      type: "rename-group",
      id: state.items[0].group.id,
      name: "Shelf assembly",
    });
    assert.ok(state.items.every((item) => item.group.name === "Shelf assembly"));
    const grouped = state;
    state = reduce(state, { type: "ungroup-items", ids: ["shelf"] });
    assert.deepEqual(state.items, items);
    assert.deepEqual(reduce(state, { type: "undo" }).items, grouped.items);
    assert.deepEqual(reduce(reduce(state, { type: "undo" }), { type: "redo" }).items, items);
    const differentFloor = { ...items[1], floorId: "other-floor" };
    assert.ok(group([items[0], differentFloor]).items.every((item) => !item.group));
  });

  test("group transformations preserve spacing, relative yaw and elevation through transaction undo and cancellation", () => {
    const original = group();
    let state = reduce(original, { type: "begin-transaction" });
    const id = original.items[0].group.id;
    const initial = pose(original);
    for (const angle of [0.2, 0.5, Math.PI / 2]) {
      state = reduce(state, {
        type: "transform-group",
        id,
        floor,
        placement: { ...pose(state), rotationYRadians: initial.rotationYRadians + angle },
      });
    }
    const rotated = state.items.map((item) => api.resolveItemTransform(item.placement, floor));
    close(rotated[0].position[0], 1.25);
    close(rotated[0].position[2], 1.25);
    close(rotated[1].position[0], 1.25);
    close(rotated[1].position[2], 0.75);
    close(rotated[1].position[1] - rotated[0].position[1], 1.2);
    close(rotated[1].rotationYRadians - rotated[0].rotationYRadians, -0.5);
    state = reduce(state, {
      type: "transform-group",
      id,
      floor,
      placement: { ...pose(state), at: [15, 25], elevationMeters: 0.4 },
    });
    close(pose(state).at[0], 15);
    close(pose(state).elevationMeters, 0.4);
    assert.equal(state.past.length, 1);
    assert.deepEqual(reduce(state, { type: "cancel-transaction" }).items, original.items);
    state = reduce(state, { type: "commit-transaction" });
    assert.equal(state.past.length, 2);
    assert.deepEqual(reduce(state, { type: "undo" }).items, original.items);
    assert.deepEqual(reduce(reduce(state, { type: "undo" }), { type: "redo" }).items, state.items);
    const invalid = guarded(
      original,
      { type: "transform-group", id, floor, placement: { ...initial, elevationMeters: -3 } },
      { project: { floors: [floor] }, registries },
    );
    assert.equal(invalid.items, original.items);
    assert.equal(invalid.past, original.past);
    assert.match(invalid.placementError, /refused/i);
  });

  test("group duplication allocates independent groups and slots and applies one shared offset", () => {
    const original = group();
    const copied = reduce(original, {
      type: "duplicate-items",
      ids: ["lamp"],
      floor,
      reservedIds: ["other-floor-id"],
    });
    const copies = copied.items.slice(2);
    assert.equal(copies.length, 2);
    assert.notEqual(copies[0].group.id, original.items[0].group.id);
    assert.equal(copies[0].group.id, copies[1].group.id);
    assert.notEqual(copies[1].entitySlots[0].id, "lamp-control");
    assert.deepEqual(copies[1].entitySlots[0].presentation, items[1].entitySlots[0].presentation);
    for (let index = 0; index < 2; index++) {
      close(copies[index].placement.at[0] - items[index].placement.at[0], 0.5);
      close(copies[index].placement.at[1] - items[index].placement.at[1], 0.5);
      assert.equal(copies[index].placement.elevationMeters, items[index].placement.elevationMeters);
      assert.deepEqual(copies[index].size, items[index].size);
    }
    assert.deepEqual(copied.items.slice(0, 2), original.items);
    assert.deepEqual(reduce(copied, { type: "undo" }).items, original.items);
    assert.deepEqual(reduce(original, { type: "delete", id: "lamp" }).items, []);
  });

  test("saved group metadata survives project and repository round trips and rejects invalid membership", async () => {
    const project = projectFor(group().items);
    const encoded = api.serializeHomeProject(project);
    assert.deepEqual(api.parseHomeProject(encoded).project, project);
    const emptyRegistries = { furnishingModels: {}, deviceModels: {} };
    const repository = api.createHomeProjectRepository(
      api.createMemoryProjectRecordStore(),
      emptyRegistries,
    );
    await repository.replace(api.createSeedProjectRecord(project));
    assert.deepEqual((await repository.load(project.home.id)).draft.sceneItems, project.sceneItems);
    assert.ok(api.collectProjectIds(project).includes(project.sceneItems[0].group.id));
    assert.ok(api.validateHomeProject(project, emptyRegistries).valid);
    for (const bad of [
      {
        ...project,
        sceneItems: project.sceneItems.map((item, index) =>
          index ? { ...item, group: { ...item.group, name: "Different name" } } : item,
        ),
      },
      {
        ...project,
        sceneItems: project.sceneItems.map((item) => ({
          ...item,
          group: { ...item.group, id: "shelf" },
        })),
      },
    ])
      assert.equal(api.validateHomeProject(bad, emptyRegistries).valid, false);
    assert.equal(
      api.parseHomeProject(
        JSON.stringify({
          ...project,
          sceneItems: [{ ...project.sceneItems[0], group: { id: "x", name: " " } }],
        }),
      ).valid,
      false,
    );
  });

  test("selection controls enclose asymmetric model bounds without allowing group resize", () => {
    const state = group();
    const target = furnishingSelectionTarget(
      state.items.map((item) => ({
        ...item,
        placement: { ...item.placement, rotationYRadians: 0 },
      })),
      floor,
      {
        ...registries,
        furnishingModels: {
          shelf: { ...descriptor, bounds: { min: [-0.2, 0, -0.5], max: [0.8, 1, 0.5] } },
        },
      },
      "Group",
    );
    assert.equal(target.definition.resizePolicy.kind, "fixed");
    assert.ok(target.box.size[0] >= 2);
    close(target.definition.bounds.min[0], -0.65);
    close(target.definition.bounds.max[0], 1.35);
    close(target.box.size[1], 1.5);
    close(target.position[0], 1.25);
    close(target.position[2], 1);
  });

  test("Cmd-click toggles individual items and whole groups without a zero-size marquee clearing selection", async () => {
    let editor;
    function Harness() {
      editor = useFurnishingEditor(items);
      return React.createElement(FurnishingEditLayer, {
        ...registries,
        items: editor.items,
        floor,
        selectedId: editor.selectedId,
        selectedIds: editor.selectedIds,
        onSelect: editor.select,
        onSelectMany: editor.selectMany,
        onMovePlacement() {},
      });
    }
    const renderer = await createScene(React.createElement(Harness));
    try {
      const target = (id) =>
        renderer.scene.findByProps({ name: `furnishing-edit-target-${id}` }).children[0];
      const surface = renderer.scene.findByProps({ name: "arrange-marquee-surface" });
      const event = (x, z, clientX = 100) => ({
        button: 0,
        pointerId: 1,
        stopPropagation() {},
        nativeEvent: { metaKey: true, clientX, clientY: 100 },
        target: { setPointerCapture() {}, releasePointerCapture() {} },
        ray: new Ray(new Vector3(x, 5, z), new Vector3(0, -1, 0)),
      });
      const cmdClick = async (id) => {
        const input = event(1.5, 1);
        await renderer.fireEvent(target(id), "pointerDown", input);
        // The transparent marquee plane also receives the unconsumed modifier gesture.
        await renderer.fireEvent(surface, "pointerDown", input);
        await renderer.fireEvent(surface, "pointerUp", input);
        await renderer.fireEvent(target(id), "click", input);
      };
      await act(async () => editor.select("shelf"));
      await cmdClick("lamp");
      assert.deepEqual(editor.selectedIds, ["shelf", "lamp"]);
      await cmdClick("shelf");
      assert.deepEqual(editor.selectedIds, ["lamp"]);
      await renderer.fireEvent(surface, "pointerDown", event(0.5, 0.5));
      await renderer.fireEvent(surface, "pointerMove", event(2, 1.5, 140));
      await renderer.fireEvent(surface, "pointerUp", event(2, 1.5, 140));
      assert.deepEqual(editor.selectedIds, ["shelf", "lamp"]);
      await act(async () => editor.groupSelection());
      await cmdClick("lamp");
      assert.deepEqual(editor.selectedIds, []);
      await cmdClick("shelf");
      assert.deepEqual(editor.selectedIds, ["shelf", "lamp"]);
    } finally {
      await renderer.unmount();
    }
  });

  test("dragging an unselected saved group moves every member from the first gesture", async () => {
    let state = group();
    const original = state.items;
    const dispatch = (action) => {
      state = reduce(state, action);
    };
    const renderer = await createScene(
      React.createElement(FurnishingEditLayer, {
        ...registries,
        items: state.items,
        floor,
        selectedId: null,
        selectedIds: [],
        onSelect: (id) => dispatch({ type: "select", id }),
        onMovePlacement: (id, placement) => dispatch({ type: "update-placement", id, placement }),
        onMovePlacements: (placements) => dispatch({ type: "update-placements", placements }),
        onDragStart: () => dispatch({ type: "begin-transaction" }),
        onDragEnd: () => dispatch({ type: "commit-transaction" }),
      }),
    );
    try {
      const target = renderer.scene.findByProps({ name: "furnishing-edit-target-lamp" })
        .children[0];
      const event = (x, clientX) => ({
        button: 0,
        pointerId: 1,
        stopPropagation() {},
        nativeEvent: { altKey: true, clientX, clientY: 100 },
        target: { setPointerCapture() {}, releasePointerCapture() {} },
        ray: new Ray(new Vector3(x, 5, 1), new Vector3(0, -1, 0)),
      });
      await renderer.fireEvent(target, "pointerDown", event(1.5, 100));
      await renderer.fireEvent(target, "pointerMove", event(2.5, 130));
      await renderer.fireEvent(target, "pointerUp", event(2.5, 130));
      for (let index = 0; index < 2; index++) {
        close(state.items[index].placement.at[0] - original[index].placement.at[0], 2);
        assert.equal(
          state.items[index].placement.elevationMeters,
          original[index].placement.elevationMeters,
        );
      }
      assert.equal(state.past.length, 2);
      assert.deepEqual(reduce(state, { type: "undo" }).items, original);
    } finally {
      await renderer.unmount();
    }
  });

  test("checkbox selection creates a group, member rows never enter individual editing, and Ungroup restores normal item editing", async () => {
    await withStorageDom(async ({ document, click }) => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      let editor;
      function Harness() {
        editor = useFurnishingEditor(items);
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(ArrangePlacedItems, {
            ...registries,
            floor,
            items: editor.items,
            selectedIds: editor.selectedIds,
            disabled: false,
            onSelect: editor.select,
            onSelectMany: editor.selectMany,
          }),
          editor.selectedGroup || editor.selectedIds.length > 1
            ? React.createElement(SelectedItemsProperties, {
                ...registries,
                editor,
                floor,
                onClose() {},
              })
            : React.createElement(FurnishingInspector, {
                ...registries,
                floor,
                items: editor.items,
                selectedId: editor.selectedId,
                onPlacementChange: editor.updatePlacement,
                onSizeChange: editor.updateSize,
                onClose() {},
              }),
        );
      }
      try {
        await act(async () => root.render(React.createElement(Harness)));
        document.querySelector("details").open = true;
        await click("Select items");
        for (const checkbox of document.querySelectorAll('input[type="checkbox"]'))
          await act(async () => checkbox.click());
        assert.deepEqual(editor.selectedIds, ["shelf", "lamp"]);
        await click("Group");
        assert.equal(document.querySelectorAll('input[type="checkbox"]').length, 1);
        assert.equal(document.querySelectorAll(".arrange-placed-items__members button").length, 0);
        assert.equal(document.querySelectorAll(".arrange-placed-items__members li").length, 2);
        await act(async () => editor.select("lamp"));
        assert.deepEqual(editor.selectedIds, ["shelf", "lamp"]);
        assert.equal(editor.selectedItem, null);
        assert.equal(
          document.querySelector('aside[aria-label="Selected group"] h2').textContent,
          "Group 1",
        );
        assert.doesNotMatch(
          document.querySelector("aside").textContent,
          /Edit group|Dimensions|Connect device/,
        );
        await click("Ungroup");
        assert.deepEqual(editor.items, items);
        await click("Done selecting");
        await click("Table lamp");
        assert.deepEqual(editor.selectedIds, ["lamp"]);
        assert.match(document.querySelector("aside").textContent, /Dimensions/);
      } finally {
        await act(async () => root.unmount());
      }
    });
  });
});
