import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { create } from "@react-three/test-renderer";
import { Box3, Ray, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

await withModules(async (load) => {
  const { useFurnishingEditor } = await load(
    "/apps/web/src/editor-preview/furnish/useFurnishingEditor.ts",
  );
  const { useHomeEditorShortcuts } = await load(
    "/apps/web/src/editor-workspace/useHomeEditorShortcuts.ts",
  );

  const {
    createFurnishingEditorState,
    furnishingEditorReducer,
    normalizeSizeForPolicy,
    placementForWorldDrag,
    planPointForWorldDrag,
    selectionBoxGeometry,
  } = await load("/apps/web/src/editor-preview/furnish/editor-state.ts");
  const { FurnishingEditLayer } = await load(
    "/apps/web/src/editor-preview/furnish/FurnishingEditLayer.tsx",
  );
  const { neutralDemoManifest, roomIdForItem, resolveItemTransform, SceneItemRenderer } =
    await load("/packages/engine/src/index.ts");
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const floor = neutralDemoManifest.floors[0];
  const { stableFurnishingRegistry } = await load("/packages/catalog/src/furnishing/index.ts");

  test("color overrides reach catalog surfaces without changing original palettes or hardware", async () => {
    const colors = ["#325a84", "#c03f68"];
    const cases = [
      ...Object.entries(stableFurnishingRegistry).map(([modelId, definition]) => ({
        modelId,
        definition,
        kind: "furnishing",
      })),
      ...Object.entries(stableDeviceRegistry).map(([modelId, definition]) => ({
        modelId,
        definition,
        kind: "device",
      })),
    ].filter(({ definition }) => definition.defaultColor);
    const hardwareNames = new Set([
      "wheel",
      "rear-handle",
      "blind-headbox",
      "blind-bottom-rail",
      "dining-chair-leg",
      "armchair-foot",
      "ottoman-foot",
      "pole",
      "finial",
      "wishbone-chair-joined-frame",
      "continuous-bentwood-back-and-arms",
      "swing-frame-leg",
      "office-chair-arm-bracket",
      "office-chair-height-lever",
      "office-chair-back-shell",
    ]);
    for (const [modelId, variant] of [
      ["single-bed", "rose"],
      ["double-bed", "cozy-sage"],
      ["neutral-area-rug", "persian"],
      ["neutral-area-rug", "fluffy"],
    ]) {
      cases.push({ ...cases.find((entry) => entry.modelId === modelId), variant });
    }
    for (const { modelId, definition, kind, variant: selectedVariant } of cases) {
      const variant =
        selectedVariant ??
        (modelId === "garden-bench"
          ? "sage"
          : modelId === "wooden-garden-swing"
            ? "cozy"
            : undefined);
      const item = {
        id: modelId,
        floorId: floor.id,
        modelId,
        size: definition.defaultSize,
        ...(variant ? { variant } : {}),
        placement: { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
        ...(kind === "device"
          ? {
              kind: "device",
              entitySlots: [
                {
                  id: "curtain-cover",
                  presentation: { label: "Curtain", dashboardRole: "primary" },
                  compatibleDomains: ["cover"],
                  deviceRole: "primary",
                  autoMap: "manual",
                },
              ],
            }
          : { kind: "furnishing" }),
      };
      const props = {
        item,
        floor,
        furnishingModels: stableFurnishingRegistry,
        deviceModels: stableDeviceRegistry,
        entityStatesBySlotId: {},
        liveMediaByEntityId: {},
        reducedMotion: true,
        walkMode: false,
        onInteract() {},
      };
      const renderer = await create(createElement(SceneItemRenderer, props));
      const meshColors = () => {
        const found = [];
        renderer.scene.instance.traverse((object) => {
          if (object.isMesh && object.material?.type === "MeshToonMaterial")
            found.push(object.material.color.getHexString());
        });
        return found.sort();
      };
      const surfaces = () => {
        const found = [];
        renderer.scene.instance.updateMatrixWorld(true);
        renderer.scene.instance.traverse((object) => {
          if (object.isMesh && object.material?.type === "MeshToonMaterial") {
            let hardware = hardwareNames.has(object.name);
            for (let parent = object.parent; parent; parent = parent.parent)
              hardware ||= hardwareNames.has(parent.name);
            found.push({
              name: object.name,
              hardware,
              color: object.material.color.getHexString(),
              vertices: object.geometry.getAttribute("position").count,
              transform: [...object.matrixWorld.elements],
            });
          }
        });
        return found;
      };
      const originalSurfaces = surfaces();
      const original = meshColors();
      if (modelId === "two-seat-loveseat") {
        assert.deepEqual(
          original,
          [
            ...Array(2).fill("64796b"),
            ...Array(2).fill("718775"),
            ...Array(4).fill("91a18b"),
            ...Array(4).fill("bd9367"),
          ].sort(),
          "loveseat without an override retains its original fabric and wood palette",
        );
      }
      for (const color of colors) {
        await renderer.update(
          createElement(SceneItemRenderer, { ...props, item: { ...item, color } }),
        );
        assert.ok(meshColors().includes(color.slice(1)), modelId);
        const changed = surfaces();
        assert.deepEqual(
          changed.map(({ color: _color, ...surface }) => surface),
          originalSurfaces.map(({ color: _color, ...surface }) => surface),
          `${modelId}: recoloring preserves geometry and transforms`,
        );
        assert.deepEqual(
          changed.filter((surface) => surface.hardware),
          originalSurfaces.filter((surface) => surface.hardware),
          `${modelId}: hardware keeps its original finish`,
        );
        if (modelId === "headboard-free-double-bed") {
          for (const finish of ["dfddd5", "e6e3da"])
            assert.equal(
              meshColors().filter((value) => value === finish).length,
              original.filter((value) => value === finish).length,
              "the bed's painted frame and feet are independent of its linen",
            );
        }
        if (modelId === "wheelie-bin") {
          assert.deepEqual(
            meshColors(),
            [...Array(3).fill(color.slice(1)), ...Array(3).fill("414e49")].sort(),
            "bin body, lid and molded foot recolor; wheels and handle stay dark",
          );
        }
        if (modelId === "two-seat-loveseat") {
          assert.deepEqual(
            meshColors(),
            [...Array(8).fill(color.slice(1)), ...Array(4).fill("bd9367")].sort(),
            "all loveseat fabric changes while the four oak feet keep their finish",
          );
        }
      }
      await renderer.update(createElement(SceneItemRenderer, props));
      assert.deepEqual(meshColors(), original, `${modelId}: reset restores exact palette`);
      await renderer.unmount();
    }
  });

  test("every built-in furnishing supports independent dimensions and height undo/redo", () => {
    for (const [modelId, definition] of Object.entries(stableFurnishingRegistry)) {
      const original = {
        id: modelId,
        modelId,
        kind: "furnishing",
        placement: { kind: "absolute", at: [0, 0], elevationMeters: 0, rotationYRadians: 0 },
        size: definition.defaultSize,
      };
      for (let axis = 0; axis < 3; axis++) {
        const size = [...original.size];
        size[axis] *= 1.3;
        const initial = createFurnishingEditorState([original]);
        const changed = furnishingEditorReducer(initial, {
          type: "update-size",
          id: modelId,
          size,
          definition,
        });
        assert.deepEqual(changed.items[0].size, size, `${modelId}: axis ${axis}`);
        const undone = furnishingEditorReducer(changed, { type: "undo" });
        assert.deepEqual(undone.items[0], original);
        assert.deepEqual(furnishingEditorReducer(undone, { type: "redo" }).items[0].size, size);
      }
    }
  });

  const definition = (policy = { kind: "fixed" }) => ({
    label: "Asymmetric cabinet",
    category: "Storage",
    defaultRoomType: "living-room",
    defaultSize: [2, 1, 0.5],
    bounds: { min: [-0.25, 0, -0.2], max: [1.75, 1, 0.3] },
    resizePolicy: policy,
    preferredPlacement: "absolute",
    outlineContact: false,
    complexity: { visibleMeshes: 1, triangles: 12 },
    component: () => null,
  });
  const item = (id = "cabinet") => ({
    id,
    kind: "furnishing",
    modelId: "cabinet",
    placement: { kind: "absolute", at: [1, 2], elevationMeters: 0, rotationYRadians: 0 },
    size: [2, 1, 0.5],
  });

  test("variants preserve item identity through undo, redo and duplication", () => {
    for (const kind of ["furnishing", "device"]) {
      const original = {
        ...item("variant-item"),
        kind,
        ...(kind === "device" ? { entitySlots: [] } : {}),
      };
      const initial = createFurnishingEditorState([original]);
      const definition = {
        variants: [
          { id: "default", label: "Classic" },
          { id: "cozy", label: "Cozy" },
        ],
      };
      const changed = furnishingEditorReducer(initial, {
        type: "update-variant",
        id: original.id,
        variant: "cozy",
        definition,
      });
      assert.deepEqual(changed.items[0], { ...original, variant: "cozy" });
      assert.equal(
        furnishingEditorReducer(changed, {
          type: "update-variant",
          id: original.id,
          variant: "missing",
          definition,
        }),
        changed,
      );
      const undone = furnishingEditorReducer(changed, { type: "undo" });
      assert.deepEqual(undone.items[0], original);
      const redone = furnishingEditorReducer(undone, { type: "redo" });
      assert.equal(redone.items[0].variant, "cozy");
      assert.equal(
        furnishingEditorReducer(redone, { type: "duplicate", id: original.id }).items[1].variant,
        "cozy",
      );
    }
  });

  test("light state persists through history and duplication", () => {
    const device = { ...item("light"), kind: "device", entitySlots: [] };
    const initial = createFurnishingEditorState([device]);
    const changed = furnishingEditorReducer(initial, {
      type: "update-light-state",
      id: "light",
      lightState: "always-on",
    });
    assert.equal(changed.items[0].lightState, "always-on");
    const undone = furnishingEditorReducer(changed, { type: "undo" });
    assert.equal(undone.items[0].lightState, undefined);
    const redone = furnishingEditorReducer(undone, { type: "redo" });
    assert.equal(redone.items[0].lightState, "always-on");
    const duplicated = furnishingEditorReducer(redone, { type: "duplicate", id: "light" });
    assert.equal(duplicated.items[1].lightState, "always-on");
  });

  const footprint = (placed, model, targetFloor = floor) => {
    const transform = resolveItemTransform(placed.placement, targetFloor);
    const minX = (model.bounds.min[0] * placed.size[0]) / model.defaultSize[0];
    const maxX = (model.bounds.max[0] * placed.size[0]) / model.defaultSize[0];
    const minZ = (model.bounds.min[2] * placed.size[2]) / model.defaultSize[2];
    const maxZ = (model.bounds.max[2] * placed.size[2]) / model.defaultSize[2];
    const cosine = Math.cos(transform.rotationYRadians);
    const sine = Math.sin(transform.rotationYRadians);
    return [minX, maxX].flatMap((x) =>
      [minZ, maxZ].map((z) => [
        transform.position[0] + x * cosine + z * sine,
        transform.position[2] - x * sine + z * cosine,
      ]),
    );
  };

  const angledFloor = (degrees, overrides = {}) => {
    const radians = (degrees * Math.PI) / 180;
    const end = [4 * Math.cos(radians), 4 * Math.sin(radians)];
    return {
      ...floor,
      footprint: [[0, 0], [4, 0], end],
      rooms: [
        {
          ...floor.rooms[0],
          polygon: [
            [0.1, 0.1],
            [3.8, 0.1],
            [end[0] * 0.9, end[1] * 0.9],
          ],
        },
      ],
      walls: [
        {
          id: "primary",
          from: [0, 0],
          to: [4, 0],
          classification: "interior",
          thicknessMeters: 0.2,
        },
        {
          id: "secondary",
          from: [0, 0],
          to: end,
          classification: "interior",
          thicknessMeters: 0.2,
        },
      ],
      wallJunctions: [{ id: "corner", at: [0, 0], wallIds: ["primary", "secondary"] }],
      openings: [],
      ...overrides,
    };
  };

  test("snaps world drag points to 10 cm unless Alt/Option requests raw movement", () => {
    const coordinates = { origin: [10, 20], metersPerPlanUnit: 0.5 };
    assert.deepEqual(planPointForWorldDrag({ x: 1.24, z: 2.26 }, coordinates, false), [12.4, 24.6]);
    assert.deepEqual(
      planPointForWorldDrag({ x: 1.24, z: 2.26 }, coordinates, true),
      [12.48, 24.52],
    );
  });

  test("normalizes requested dimensions for every built-in resize policy", () => {
    assert.deepEqual(
      normalizeSizeForPolicy([2, 1, 0.5], [3, 4, 5], { kind: "fixed" }),
      [2, 1, 0.5],
    );
    assert.deepEqual(
      normalizeSizeForPolicy([2, 1, 0.5], [4, 1, 0.5], { kind: "uniform" }),
      [4, 2, 1],
    );
    assert.deepEqual(normalizeSizeForPolicy([2, 1, 0.5], [3, 4, 2], { kind: "planar" }), [3, 1, 2]);
    assert.deepEqual(
      normalizeSizeForPolicy([2, 1, 0.5], [3, 4, 2], { kind: "axes", axes: ["height"] }),
      [2, 4, 0.5],
    );
  });

  test("drags every furnishing with magnetic wall support and Alt detachment", () => {
    const wallItem = {
      ...item("dresser"),
      placement: {
        kind: "wall",
        wallId: "north-wall",
        face: "right",
        offsetFromWallStartPlanUnits: 2,
        elevationMeters: 0,
        depthOffsetMeters: 0.2,
        rotationOffsetRadians: 0,
      },
    };
    const wallDefinition = { ...definition(), preferredPlacement: "wall" };
    const sticky = placementForWorldDrag({
      world: { x: 2.6, z: 0.3 },
      item: wallItem,
      definition: wallDefinition,
      floor,
      raw: false,
    });
    assert.equal(sticky.kind, "wall");
    assert.equal(sticky.wallId, "north-wall");
    assert.equal(sticky.face, "right");
    assert.equal(sticky.offsetFromWallStartPlanUnits, 2.6);

    const detached = placementForWorldDrag({
      world: { x: 2.63, z: 0.31 },
      item: wallItem,
      definition: wallDefinition,
      floor,
      raw: true,
    });
    assert.equal(detached.kind, "absolute");
    assert.deepEqual(detached.at, [2.63, 0.31]);

    const newlyAttached = placementForWorldDrag({
      world: { x: 1.4, z: 0.22 },
      item: item("cabinet"),
      definition: definition(),
      floor,
      raw: false,
    });
    assert.equal(newlyAttached.kind, "wall");
    assert.equal(newlyAttached.rotationOffsetRadians, 0);
  });

  test("snaps scaled asymmetric bounds to both wall faces only when their edge reaches the corner", () => {
    const model = definition();
    const snapped = placementForWorldDrag({
      world: { x: 0.5, z: 0.2 },
      item: item("corner-cabinet"),
      definition: model,
      floor,
      raw: false,
    });
    assert.equal(snapped.kind, "wall");
    assert.equal(snapped.wallId, "north-wall");
    assert.equal(snapped.offsetFromWallStartPlanUnits, 0.34);
    const points = footprint({ ...item(), placement: snapped }, model);
    assert.ok(Math.abs(Math.min(...points.map(([x]) => x)) - 0.09) < 1e-9);
    assert.ok(Math.abs(Math.min(...points.map(([, z]) => z)) - 0.09) < 1e-9);

    const resized = { ...item("wide-cabinet"), size: [4, 1, 1] };
    const scaled = placementForWorldDrag({
      world: { x: 0.2, z: 0.2 },
      item: resized,
      definition: model,
      floor,
      raw: false,
    });
    const scaledPoints = footprint({ ...resized, placement: scaled }, model);
    assert.ok(Math.abs(Math.min(...scaledPoints.map(([x]) => x)) - 0.09) < 1e-9);
    assert.ok(Math.abs(Math.min(...scaledPoints.map(([, z]) => z)) - 0.09) < 1e-9);

    const released = placementForWorldDrag({
      world: { x: 0.6, z: 0.2 },
      item: item("released"),
      definition: model,
      floor,
      raw: false,
    });
    assert.equal(released.offsetFromWallStartPlanUnits, 0.6);
    const raw = placementForWorldDrag({
      world: { x: 0.5, z: 0.2 },
      item: item("raw"),
      definition: model,
      floor,
      raw: true,
    });
    assert.equal(raw.kind, "absolute");
    assert.deepEqual(raw.at, [0.5, 0.2]);
  });

  test("supports acute and obtuse two-wall corners using the physical wall faces", () => {
    const model = {
      ...definition(),
      defaultSize: [1, 1, 0.4],
      bounds: { min: [-0.5, 0, -0.2], max: [0.5, 1, 0.2] },
    };
    const box = { ...item("angled-box"), size: [1, 1, 0.4] };
    for (const degrees of [60, 120]) {
      const targetFloor = angledFloor(degrees);
      const placement = placementForWorldDrag({
        world: { x: 0.3, z: 0.15 },
        item: box,
        definition: model,
        floor: targetFloor,
        raw: false,
      });
      assert.equal(placement.kind, "wall", `${degrees} degrees`);
      assert.equal(placement.wallId, "primary", `${degrees} degrees`);
      assert.notEqual(placement.offsetFromWallStartPlanUnits, 0.3, `${degrees} degrees`);
      const radians = (degrees * Math.PI) / 180;
      const rightNormal = [-Math.sin(radians), Math.cos(radians)];
      const position = resolveItemTransform(placement, targetFloor).position;
      const side = position[0] * rightNormal[0] + position[2] * rightNormal[1] < 0 ? -1 : 1;
      const normal = rightNormal.map((value) => value * side);
      const face = normal.map((value) => value * 0.1);
      const distances = footprint({ ...box, placement }, model, targetFloor).map(
        ([x, z]) => (x - face[0]) * normal[0] + (z - face[1]) * normal[1],
      );
      assert.ok(Math.abs(Math.min(...distances)) < 1e-4, `${degrees} degree contact`);
      assert.ok(
        distances.every((distance) => distance >= -1e-4),
        `${degrees} degree penetration`,
      );
    }
  });

  test("corner snapping is invariant to plan scale, translation, and reversed wall endpoints", () => {
    const model = definition();
    const cabinet = item("coordinate-cabinet");
    const original = placementForWorldDrag({
      world: { x: 0.5, z: 0.2 },
      item: cabinet,
      definition: model,
      floor,
      raw: false,
    });
    const originalTransform = resolveItemTransform(original, floor);
    const transformed = {
      ...floor,
      coordinates: { ...floor.coordinates, origin: [10, 20], metersPerPlanUnit: 0.5 },
      footprint: floor.footprint.map(([x, z]) => [10 + x * 2, 20 + z * 2]),
      rooms: floor.rooms.map((room) => ({
        ...room,
        polygon: room.polygon.map(([x, z]) => [10 + x * 2, 20 + z * 2]),
      })),
      walls: floor.walls.map((wall) => ({
        ...wall,
        from: [10 + wall.from[0] * 2, 20 + wall.from[1] * 2],
        to: [10 + wall.to[0] * 2, 20 + wall.to[1] * 2],
      })),
      wallJunctions: floor.wallJunctions.map((junction) => ({
        ...junction,
        at: [10 + junction.at[0] * 2, 20 + junction.at[1] * 2],
      })),
    };
    const scaled = placementForWorldDrag({
      world: { x: 0.5, z: 0.2 },
      item: cabinet,
      definition: model,
      floor: transformed,
      raw: false,
    });
    const scaledTransform = resolveItemTransform(scaled, transformed);
    originalTransform.position.forEach((value, axis) =>
      assert.ok(Math.abs(value - scaledTransform.position[axis]) < 1e-10),
    );
    assert.equal(scaledTransform.rotationYRadians, originalTransform.rotationYRadians);

    const reversed = {
      ...floor,
      walls: floor.walls.map((wall) => ({ ...wall, from: wall.to, to: wall.from })),
    };
    const reverse = placementForWorldDrag({
      world: { x: 0.5, z: 0.2 },
      item: cabinet,
      definition: model,
      floor: reversed,
      raw: false,
    });
    const reverseTransform = resolveItemTransform(reverse, reversed);
    originalTransform.position.forEach((value, axis) =>
      assert.ok(Math.abs(value - reverseTransform.position[axis]) < 1e-10),
    );
    assert.ok(
      Math.abs(
        Math.cos(originalTransform.rotationYRadians) - Math.cos(reverseTransform.rotationYRadians),
      ) < 1e-10,
    );
    assert.ok(
      Math.abs(
        Math.sin(originalTransform.rotationYRadians) - Math.sin(reverseTransform.rotationYRadians),
      ) < 1e-10,
    );
  });

  test("keeps the current support and custom wall rotation while snapping every item kind", () => {
    const model = {
      ...definition(),
      defaultSize: [0.6, 1, 0.4],
      bounds: { min: [-0.3, 0, -0.2], max: [0.3, 1, 0.2] },
    };
    const supported = {
      ...item("supported"),
      size: [0.6, 1, 0.4],
      placement: {
        kind: "wall",
        wallId: "west-wall",
        face: "right",
        offsetFromWallStartPlanUnits: 2,
        elevationMeters: 0.4,
        depthOffsetMeters: 0.24,
        rotationOffsetRadians: 0.08,
      },
    };
    const stable = placementForWorldDrag({
      world: { x: 0.2, z: 0.2 },
      item: supported,
      definition: model,
      floor,
      raw: false,
    });
    assert.equal(stable.wallId, "west-wall");
    assert.equal(stable.elevationMeters, 0.4);
    assert.equal(stable.depthOffsetMeters, 0.24);
    assert.equal(stable.rotationOffsetRadians, 0.08);

    for (const candidate of [
      { ...item("device"), kind: "device", entitySlots: [] },
      {
        ...item("ceiling"),
        placement: {
          kind: "ceiling",
          roomId: floor.rooms[0].id,
          at: [2, 2],
          dropMeters: 0.5,
          rotationYRadians: 0.3,
        },
      },
    ]) {
      const placement = placementForWorldDrag({
        world: { x: 0.5, z: 0.2 },
        item: candidate,
        definition: definition(),
        floor,
        raw: false,
      });
      assert.equal(placement.kind, "wall");
      assert.equal(placement.offsetFromWallStartPlanUnits, 0.34);
    }
  });

  test("falls back to one wall for non-corners, invalid sectors, and items that do not fit", () => {
    const model = {
      ...definition(),
      defaultSize: [1, 1, 0.4],
      bounds: { min: [-0.5, 0, -0.2], max: [0.5, 1, 0.2] },
    };
    const box = { ...item("fallback-box"), size: [1, 1, 0.4] };
    const base = angledFloor(90);
    const third = {
      id: "third",
      from: [0, 0],
      to: [-4, 0],
      classification: "interior",
      thicknessMeters: 0.2,
    };
    for (const targetFloor of [
      { ...base, wallJunctions: [] },
      {
        ...base,
        walls: [...base.walls, third],
        wallJunctions: [{ ...base.wallJunctions[0], wallIds: ["primary", "secondary", "third"] }],
      },
      angledFloor(180),
      {
        ...base,
        rooms: [
          {
            ...base.rooms[0],
            polygon: [
              [10, 10],
              [12, 10],
              [12, 12],
              [10, 12],
            ],
          },
        ],
      },
      {
        ...base,
        walls: base.walls.map((wall) => (wall.id === "primary" ? { ...wall, to: [0.6, 0] } : wall)),
      },
    ]) {
      const placement = placementForWorldDrag({
        world: { x: 0.3, z: 0.15 },
        item: box,
        definition: model,
        floor: targetFloor,
        raw: false,
      });
      assert.equal(placement.kind, "wall");
      assert.equal(placement.offsetFromWallStartPlanUnits, 0.3);
    }
  });

  test("derives a correctly offset selection box from asymmetric bounds", () => {
    const box = selectionBoxGeometry({ ...item(), size: [4, 2, 1] }, definition());
    assert.deepEqual(box.size, [4, 2, 1]);
    assert.ok(Math.abs(box.center[0] - 1.5) < 1e-12);
    assert.ok(Math.abs(box.center[1] - 1) < 1e-12);
    assert.ok(Math.abs(box.center[2] - 0.1) < 1e-12);
  });

  test("outdoor lanterns remain visible without a room binding and reject mismatched bindings", async () => {
    for (const modelId of ["low-garden-lantern", "garden-lantern-pole"]) {
      const definition = stableDeviceRegistry[modelId];
      const lantern = {
        id: `outside-${modelId}`,
        kind: "device",
        modelId,
        placement: {
          kind: "absolute",
          at: [-5, -5],
          elevationMeters: -0.05,
          rotationYRadians: 0.4,
        },
        size: definition.defaultSize,
        entitySlots: [],
      };
      assert.equal(roomIdForItem(lantern, floor), null);
      const props = {
        item: lantern,
        floor,
        furnishingModels: {},
        deviceModels: stableDeviceRegistry,
        entityStatesBySlotId: {},
        reducedMotion: true,
        walkMode: false,
        onInteract() {},
        liveMediaByEntityId: {},
      };
      const renderer = await create(createElement(SceneItemRenderer, props));
      const rendered = renderer.scene.findByProps({ name: `scene-item-${lantern.id}` });
      assert.equal(rendered.props.userData.visualState, "disconnected");
      assert.deepEqual(rendered.instance.position.toArray(), [
        ...resolveItemTransform(lantern.placement, floor).position,
      ]);
      assert.ok(renderer.scene.findAll((node) => node.type === "Mesh").length > 0);
      const size = new Box3().setFromObject(rendered.instance).getSize(new Vector3());
      assert.ok(Math.abs(size.y - lantern.size[1]) < 0.001);
      await renderer.update(
        createElement(SceneItemRenderer, {
          ...props,
          resolvedDevice: {
            slot: { id: "another-device", model: modelId },
            entities: [],
            issues: [],
          },
        }),
      );
      assert.equal(renderer.scene.findAll((node) => node.type === "Mesh").length, 0);
      await renderer.unmount();
    }
  });

  test("renders a box fallback when a furnishing model no longer exists", async () => {
    const missing = { ...item("retired-lamp"), modelId: "retired-lamp", size: [0.4, 0.8, 0.4] };
    const renderer = await create(
      createElement(SceneItemRenderer, {
        item: missing,
        floor,
        furnishingModels: {},
        deviceModels: {},
        entityStatesBySlotId: {},
        reducedMotion: true,
        walkMode: false,
        onInteract: () => undefined,
        liveMediaByEntityId: {},
      }),
    );
    const fallback = renderer.scene.findByProps({ name: "missing-model-retired-lamp" });
    assert.equal(fallback.instance.material.type, "MeshToonMaterial");
    assert.equal(fallback.props.userData.missingModelId, "retired-lamp");
    new Box3()
      .setFromObject(fallback.instance)
      .getSize(new Vector3())
      .toArray()
      .forEach((value, axis) => {
        assert.ok(Math.abs(value - missing.size[axis]) < 1e-6);
      });
    await renderer.unmount();
  });

  test("pointer cancellation restores the item and releases drag controls without committing history", async () => {
    let state = createFurnishingEditorState([item()]);
    const dispatch = (action) => {
      state = furnishingEditorReducer(state, action);
    };
    const dragging = [];
    const released = [];
    const renderer = await create(
      createElement(FurnishingEditLayer, {
        items: state.items,
        floor,
        furnishingModels: { cabinet: definition() },
        deviceModels: {},
        selectedId: null,
        onSelect: (id) => dispatch({ type: "select", id }),
        onDragStart: () => dispatch({ type: "begin-transaction" }),
        onMovePlacement: (id, placement) => dispatch({ type: "update-placement", id, placement }),
        onDragEnd: () => dispatch({ type: "commit-transaction" }),
        onDragCancel: () => dispatch({ type: "cancel-transaction" }),
        onDraggingChange: (value) => dragging.push(value),
      }),
    );
    try {
      const target = renderer.scene.findByProps({ name: "furnishing-edit-target-cabinet" })
        .children[0];
      assert.equal(
        target.instance.material.visible,
        false,
        "unselected targets must not submit draw calls",
      );
      target.instance.updateWorldMatrix(true, false);
      const center = new Box3().setFromObject(target.instance).getCenter(new Vector3());
      const pickingRay = new Raycaster(
        center.clone().add(new Vector3(0, 10, 0)),
        new Vector3(0, -1, 0),
      );
      assert.ok(
        pickingRay.intersectObject(target.instance).length > 0,
        "non-rendering targets must remain pickable",
      );
      const event = (x) => ({
        button: 0,
        pointerId: 1,
        stopPropagation() {},
        nativeEvent: { altKey: true },
        target: { setPointerCapture() {}, releasePointerCapture: (id) => released.push(id) },
        ray: new Ray(new Vector3(x, 5, 2), new Vector3(0, -1, 0)),
      });
      await renderer.fireEvent(target, "pointerDown", event(1));
      await renderer.fireEvent(target, "pointerMove", event(3));
      assert.notDeepEqual(state.items[0].placement, item().placement);
      await renderer.fireEvent(target, "pointerCancel", event(3));
      await renderer.fireEvent(target, "lostPointerCapture", event(3));
      await renderer.fireEvent(target, "pointerUp", event(3));
      assert.deepEqual(state.items[0].placement, item().placement);
      assert.equal(state.past.length, 0);
      assert.equal(state.transaction, null);
      assert.deepEqual(dragging, [true, false]);
      assert.deepEqual(released, [1]);
    } finally {
      await renderer.unmount();
    }
  });

  test("Cmd/Ctrl marquee selects anchors and group drag commits one undo step", async () => {
    const first = item();
    const second = { ...item(), id: "second", placement: { ...item().placement, at: [3, 2] } };
    let state = createFurnishingEditorState([first, second]);
    const initial = state.items;
    const dispatch = (action) => {
      state = furnishingEditorReducer(state, action);
    };
    let selected = [];
    const props = {
      items: state.items,
      floor,
      furnishingModels: { cabinet: definition() },
      deviceModels: {},
      selectedId: null,
      selectedIds: [],
      onSelect: () => {},
      onSelectMany: (ids) => {
        selected = ids;
      },
      onMovePlacements: (placements) => dispatch({ type: "update-placements", placements }),
      onDragStart: () => dispatch({ type: "begin-transaction" }),
      onMovePlacement: (id, placement) => dispatch({ type: "update-placement", id, placement }),
      onDragEnd: () => dispatch({ type: "commit-transaction" }),
      onDragCancel: () => dispatch({ type: "cancel-transaction" }),
    };
    const renderer = await create(createElement(FurnishingEditLayer, props));
    const event = (x, z, ctrlKey = false) => ({
      button: 0,
      pointerId: 1,
      stopPropagation() {},
      nativeEvent: { ctrlKey, clientX: x * 100, clientY: z * 100 },
      target: { setPointerCapture() {}, releasePointerCapture() {} },
      ray: new Ray(new Vector3(x, 10, z), new Vector3(0, -1, 0)),
    });
    try {
      const surface = renderer.scene.findByProps({ name: "arrange-marquee-surface" });
      const shiftDrag = {
        ...event(-100, -100),
        nativeEvent: { shiftKey: true, clientX: 0, clientY: 0 },
      };
      await renderer.fireEvent(surface, "pointerDown", shiftDrag);
      await renderer.fireEvent(surface, "pointerMove", event(100, 100));
      await renderer.fireEvent(surface, "pointerUp", event(100, 100));
      assert.deepEqual(selected, [], "Shift-drag is reserved for camera rotation");
      const itemTarget = renderer.scene.findByProps({ name: `furnishing-edit-target-${first.id}` })
        .children[0];
      await renderer.fireEvent(itemTarget, "pointerDown", shiftDrag);
      await renderer.fireEvent(itemTarget, "pointerMove", event(2, 3));
      await renderer.fireEvent(itemTarget, "pointerUp", event(2, 3));
      assert.deepEqual(state.items, initial, "Shift-drag over items must not move them");
      await renderer.fireEvent(surface, "pointerDown", event(-100, -100, true));
      await renderer.fireEvent(surface, "pointerMove", event(100, 100, true));
      await renderer.fireEvent(surface, "pointerUp", event(100, 100, true));
      assert.deepEqual(selected, [first.id, second.id]);
      await renderer.update(
        createElement(FurnishingEditLayer, { ...props, selectedIds: selected }),
      );
      const target = renderer.scene.findByProps({ name: `furnishing-edit-target-${first.id}` })
        .children[0];
      assert.equal(
        target.instance.material.visible,
        true,
        "selected targets retain their highlight",
      );
      await renderer.fireEvent(target, "pointerDown", event(1, 2));
      await renderer.fireEvent(target, "pointerMove", event(2, 3));
      await renderer.fireEvent(target, "pointerUp", event(2, 3));
      assert.equal(state.past.length, 1);
      assert.equal(state.selectedId, null, "group movement preserves multi-selection");
      for (let i = 0; i < 2; i++) {
        assert.deepEqual(
          state.items[i].placement.at,
          initial[i].placement.at.map((value) => value + 1 / floor.coordinates.metersPerPlanUnit),
        );
      }
      dispatch({ type: "undo" });
      assert.deepEqual(state.items, initial);
    } finally {
      await renderer.unmount();
    }
  });

  test("Arrange Delete and Backspace delete a marquee selection with one undo", async () => {
    const dom = new JSDOM('<div id="root"></div><input id="input" />');
    const keys = ["window", "document", "HTMLElement", "addEventListener", "removeEventListener"];
    const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      addEventListener: dom.window.addEventListener.bind(dom.window),
      removeEventListener: dom.window.removeEventListener.bind(dom.window),
    });
    const root = createRoot(document.getElementById("root"));
    let editor;
    function Harness() {
      editor = useFurnishingEditor([item(), item("second"), item("keep")]);
      useHomeEditorShortcuts({
        mode: "furnish",
        furnishingEditor: editor,
        clearFurnishingSelection: () => editor.select(null),
      });
      return null;
    }
    try {
      await act(async () => root.render(createElement(Harness)));
      for (const key of ["Delete", "Backspace"]) {
        await act(async () => editor.selectMany(["cabinet", "second"]));
        await act(async () =>
          document
            .getElementById("input")
            .dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true })),
        );
        assert.equal(editor.items.length, 3, "typing in fields must not delete scene items");
        await act(async () =>
          window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, cancelable: true })),
        );
        assert.deepEqual(
          editor.items.map((item) => item.id),
          ["keep"],
        );
        assert.deepEqual(editor.selectedIds, []);
        assert.equal(editor.past.length, 1);
        await act(async () => editor.undo());
        assert.equal(editor.items.length, 3);
      }
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, previous);
    }
  });

  test("bulk deletion removes only selected items and undo restores the group", () => {
    const items = [item(), { ...item(), id: "second" }, { ...item(), id: "keep" }];
    let state = createFurnishingEditorState(items);
    state = furnishingEditorReducer(state, { type: "delete-items", ids: ["cabinet", "second"] });
    assert.deepEqual(
      state.items.map((item) => item.id),
      ["keep"],
    );
    assert.equal(state.past.length, 1);
    state = furnishingEditorReducer(state, { type: "undo" });
    assert.deepEqual(state.items, items);
    state = furnishingEditorReducer(state, { type: "redo" });
    assert.deepEqual(
      state.items.map((item) => item.id),
      ["keep"],
    );
    assert.equal(furnishingEditorReducer(state, { type: "delete-items", ids: [] }), state);
  });

  test("other-floor targets select on click without starting a drag", async () => {
    const selected = [];
    const renderer = await create(
      createElement(FurnishingEditLayer, {
        items: [item()],
        floor,
        furnishingModels: { cabinet: definition() },
        deviceModels: {},
        selectedId: null,
        selectionOnly: true,
        onSelect: (id) => selected.push(id),
        onMovePlacement: () => assert.fail("Other-floor targets must not move items"),
        onDragStart: () => assert.fail("Other-floor targets must not start a transaction"),
      }),
    );
    try {
      const target = renderer.scene.findByProps({ name: "furnishing-edit-target-cabinet" })
        .children[0];
      await renderer.fireEvent(target, "pointerDown", { button: 0, stopPropagation() {} });
      await renderer.fireEvent(target, "pointerMove", { pointerId: 1 });
      assert.deepEqual(selected, []);
      await renderer.fireEvent(target, "click", { stopPropagation() {} });
      assert.deepEqual(selected, ["cabinet"]);
    } finally {
      await renderer.unmount();
    }
  });

  test("edits placement, rotation, size, duplicate, delete, add, undo and redo", () => {
    let state = createFurnishingEditorState([item()]);
    state = furnishingEditorReducer(state, { type: "begin-transaction" });
    state = furnishingEditorReducer(state, {
      type: "update-placement",
      id: "cabinet",
      placement: { ...item().placement, at: [3.2, 4.1] },
    });
    state = furnishingEditorReducer(state, { type: "commit-transaction" });
    assert.deepEqual(state.items[0].placement.at, [3.2, 4.1]);
    assert.equal(state.past.length, 1, "the drag is one undo step");

    state = furnishingEditorReducer(state, {
      type: "rotate",
      id: "cabinet",
      rotationYRadians: Math.PI / 2,
    });
    assert.equal(state.items[0].placement.rotationYRadians, Math.PI / 2);
    state = furnishingEditorReducer(state, {
      type: "update-size",
      id: "cabinet",
      size: [4, 9, 9],
      definition: definition({ kind: "uniform" }),
    });
    assert.deepEqual(state.items[0].size, [4, 2, 1]);

    state = furnishingEditorReducer(state, { type: "duplicate", id: "cabinet" });
    assert.equal(state.items.length, 2);
    const copiedId = state.selectedId;
    assert.match(copiedId, uuid);
    assert.deepEqual(state.items[1].placement.at, [3.45, 4.35]);

    state = furnishingEditorReducer(state, { type: "delete", id: copiedId });
    assert.deepEqual(
      state.items.map(({ id }) => id),
      ["cabinet"],
    );
    state = furnishingEditorReducer(state, {
      type: "add-preset",
      modelId: "cabinet",
      definition: definition(),
      planCenter: [8, 6],
    });
    const addedId = state.items[1].id;
    assert.match(addedId, uuid);
    assert.notEqual(addedId, copiedId);
    assert.deepEqual(state.items[1].placement.at, [8, 6]);
    assert.deepEqual(state.items[1].size, [2, 1, 0.5]);

    state = furnishingEditorReducer(state, { type: "undo" });
    assert.deepEqual(
      state.items.map(({ id }) => id),
      ["cabinet"],
    );
    state = furnishingEditorReducer(state, { type: "redo" });
    assert.deepEqual(
      state.items.map(({ id }) => id),
      ["cabinet", addedId],
    );
  });

  test("preserves wall and ceiling placement unions during numeric edits", () => {
    const wall = {
      ...item("mirror"),
      placement: {
        kind: "wall",
        wallId: "north",
        face: "right",
        offsetFromWallStartPlanUnits: 2,
        elevationMeters: 1,
        depthOffsetMeters: 0.02,
        rotationOffsetRadians: 0,
      },
    };
    const ceiling = {
      ...item("pendant"),
      placement: {
        kind: "ceiling",
        roomId: "living",
        at: [3, 4],
        dropMeters: 0.4,
        rotationYRadians: 0,
      },
    };
    let state = createFurnishingEditorState([wall, ceiling]);
    state = furnishingEditorReducer(state, { type: "rotate", id: "mirror", rotationYRadians: 0.3 });
    state = furnishingEditorReducer(state, {
      type: "rotate",
      id: "pendant",
      rotationYRadians: 0.7,
    });
    assert.equal(state.items[0].placement.kind, "wall");
    assert.equal(state.items[0].placement.rotationOffsetRadians, 0.3);
    assert.equal(state.items[1].placement.kind, "ceiling");
    assert.equal(state.items[1].placement.rotationYRadians, 0.7);
  });

  test("edits a connected device from its scene item without changing its model or bindings", async () => {
    const definition = stableDeviceRegistry.television;
    const entitySlots = [
      {
        id: "living-television-primary",
        compatibleDomains: ["media_player"],
        required: true,
        autoMap: "unique-compatible",
        deviceRole: "primary",
        presentation: { label: "Living television", dashboardRole: "primary" },
      },
    ];
    const device = {
      id: "living-television",
      kind: "device",
      modelId: "television",
      placement: {
        kind: "absolute",
        at: [1, 2],
        elevationMeters: 0.8,
        rotationYRadians: 0,
      },
      size: [...definition.defaultSize],
      entitySlots,
    };
    let state = createFurnishingEditorState([device]);
    state = furnishingEditorReducer(state, {
      type: "update-placement",
      id: device.id,
      placement: { ...device.placement, at: [3.2, 4.1] },
    });
    state = furnishingEditorReducer(state, {
      type: "rotate",
      id: device.id,
      rotationYRadians: 0.75,
    });
    state = furnishingEditorReducer(state, {
      type: "update-size",
      id: device.id,
      size: [definition.defaultSize[0] * 1.5, definition.defaultSize[1] * 1.2, 99],
      definition,
    });

    const edited = state.items[0];
    assert.equal(edited.kind, "device");
    assert.equal(edited.id, device.id);
    assert.equal(edited.modelId, device.modelId);
    assert.equal(edited.entitySlots, entitySlots);
    assert.deepEqual(edited.size, [
      definition.defaultSize[0] * 1.5,
      definition.defaultSize[1] * 1.2,
      definition.defaultSize[2],
    ]);

    const editLayer = await create(
      createElement(FurnishingEditLayer, {
        items: [edited],
        floor,
        furnishingModels: {},
        deviceModels: stableDeviceRegistry,
        selectedId: edited.id,
        onSelect: () => undefined,
        onMovePlacement: () => undefined,
      }),
    );
    assert.equal(
      editLayer.scene.findAllByProps({ name: `furnishing-edit-target-${device.id}` }).length,
      1,
    );
    await editLayer.unmount();

    const connectedState = {
      entityId: "media_player.living_television",
      state: "playing",
      attributes: {},
      available: true,
      stale: false,
    };
    const resolvedDevice = {
      slot: {
        id: device.id,
        model: device.modelId,
        entitySlots,
        placement: {
          at: device.placement.at,
          elevationMeters: device.placement.elevationMeters,
          rotationYRadians: device.placement.rotationYRadians,
          support: { kind: "surface" },
        },
      },
      entities: [
        {
          entityId: connectedState.entityId,
          domain: "media_player",
          path: "fixture",
          label: "Living television",
          roomId: floor.rooms[0].id,
          slotId: entitySlots[0].id,
          deviceSlotId: device.id,
          state: connectedState,
          areaId: "living",
          deviceId: "ha-television",
          issues: [],
        },
      ],
      issues: [],
    };
    const renderer = await create(
      createElement(SceneItemRenderer, {
        item: edited,
        floor,
        furnishingModels: {},
        deviceModels: stableDeviceRegistry,
        resolvedDevice,
        entityStatesBySlotId: { [entitySlots[0].id]: connectedState },
        reducedMotion: true,
        walkMode: false,
        onInteract: () => undefined,
        liveMediaByEntityId: {},
      }),
    );
    const rendered = renderer.scene.findByProps({ name: `scene-item-${device.id}` });
    const transform = resolveItemTransform(edited.placement, floor);
    assert.deepEqual(rendered.instance.position.toArray(), [...transform.position]);
    assert.deepEqual(rendered.instance.rotation.toArray().slice(0, 3), [0, 0.75, 0]);
    assert.deepEqual(rendered.instance.scale.toArray(), [1.5, 1.2, 1]);
    assert.equal(rendered.props.userData.visualState, "connected-active");
    await renderer.unmount();

    const duplicated = furnishingEditorReducer(state, { type: "duplicate", id: device.id });
    assert.equal(duplicated.items.length, 2);
    assert.notEqual(duplicated.items[1].id, device.id);
    assert.match(duplicated.items[1].id, uuid);
    assert.match(duplicated.items[1].entitySlots[0].id, uuid);
    assert.notEqual(duplicated.items[1].entitySlots[0].id, entitySlots[0].id);
    assert.deepEqual(duplicated.items[1].size, edited.size);
    assert.equal(duplicated.items[0], edited);
    const deleted = furnishingEditorReducer(state, { type: "delete", id: device.id });
    assert.deepEqual(deleted.items, []);
    assert.equal(deleted.selectedId, null);
    const restored = furnishingEditorReducer(deleted, { type: "undo" });
    assert.equal(restored.selectedId, device.id);
    assert.deepEqual(restored.items, [edited]);
    assert.deepEqual(furnishingEditorReducer(restored, { type: "redo" }).items, []);
  });

  test("catalog clicks create even support-oriented models as movable items", () => {
    let state = createFurnishingEditorState([]);
    state = furnishingEditorReducer(state, {
      type: "add-preset",
      modelId: "wall-dresser",
      definition: { ...definition(), preferredPlacement: "wall" },
      planCenter: [2.4, 1.8],
    });
    assert.equal(state.items[0].placement.kind, "absolute");
    assert.deepEqual(state.items[0].placement.at, [2.4, 1.8]);
  });
});
