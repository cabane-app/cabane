import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const baseFloor = () => structuredClone(engine.neutralDemoManifest.floors[0]);
  const { advanceFloorZoneDrawing, emptyFloorZoneDrawing } = await load(
    "/apps/web/src/editor-preview/construct/useFloorZoneDrawing.ts",
  );
  const { ConstructionFloorLayer, moveFloorZoneCorner, translateFloorZone } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionFloorLayer.tsx",
  );
  const derive = (draft) =>
    engine.deriveFloorTopology({
      floorId: draft.floorId,
      floorName: draft.floorName,
      coordinates: draft.coordinates,
      walls: draft.walls,
      openings: draft.openings,
      rooms: draft.rooms,
      junctions: draft.junctions,
      pools: draft.pools,
      groundZones: draft.groundZones,
      defaultWallHeightMeters: draft.defaultWallHeightMeters,
      defaultCeilingHeightMeters: draft.defaultCeilingHeightMeters,
      exteriorWallThicknessMeters: draft.exteriorWallThicknessMeters,
      interiorWallThicknessMeters: draft.interiorWallThicknessMeters,
    });

  test("room finishes and zones survive topology derivation", () => {
    const base = baseFloor();
    base.rooms[0].floorFinish = { kind: "preset", preset: "light-oak" };
    base.rooms[0].floorZones = [
      {
        id: "floor-zone-1",
        polygon: [
          [0.5, 0.5],
          [2, 0.5],
          [2, 1.5],
          [0.5, 1.5],
        ],
        finish: { kind: "preset", preset: "travertine" },
      },
    ];
    const draft = engine.createFloorEditorDraft(base);
    const floor = derive(draft).floor;
    assert.deepEqual(floor.rooms[0].floorFinish, base.rooms[0].floorFinish);
    assert.deepEqual(floor.rooms[0].floorZones, base.rooms[0].floorZones);
  });

  test("outdoor ground zones survive topology derivation", () => {
    const base = baseFloor();
    base.groundZones = [
      {
        id: "garden-path",
        polygon: [
          [-2, 0.5],
          [-0.2, 0.5],
          [-0.2, 1.2],
          [-2, 1.2],
        ],
        finish: { kind: "preset", preset: "gravel" },
      },
    ];
    const floor = derive(engine.createFloorEditorDraft(base)).floor;
    assert.deepEqual(floor.groundZones, base.groundZones);
  });

  test("paint, zone CRUD, delete, undo, and redo are semantic commands", () => {
    const base = baseFloor();
    let history = engine.createFloorEditorHistory(engine.createFloorEditorDraft(base));
    const room = history.present.rooms[0];
    history = engine.floorEditorReducer(history, {
      type: "update-room-metadata",
      roomId: room.id,
      anchor: room.anchor,
      changes: {
        floorFinish: { kind: "preset", preset: "dark-walnut" },
        floorZones: [],
      },
    });
    history = engine.floorEditorReducer(history, {
      type: "add-floor-zone",
      room: {
        id: room.id,
        name: room.name,
        accent: room.accent,
        anchor: room.anchor,
      },
      polygon: [
        [0.5, 0.5],
        [2, 0.5],
        [2, 1.5],
        [0.5, 1.5],
      ],
      finish: { kind: "preset", preset: "travertine" },
    });
    const zoneId = history.present.rooms[0].floorZones[0].id;
    assert.match(zoneId, /^demo-floor:floor-zone-/);
    assert.deepEqual(history.present.selection, {
      kind: "floor-zone",
      id: zoneId,
    });

    history = engine.floorEditorReducer(history, {
      type: "update-floor-zone",
      zoneId,
      changes: { finish: { kind: "solid", color: "#bca98c" } },
    });
    assert.equal(history.present.rooms[0].floorZones[0].finish.kind, "solid");
    history = engine.floorEditorReducer(history, {
      type: "delete-elements",
      targets: [{ kind: "floor-zone", id: zoneId }],
    });
    assert.deepEqual(history.present.rooms[0].floorZones, []);
    history = engine.floorEditorReducer(history, { type: "undo" });
    assert.equal(history.present.rooms[0].floorZones.length, 1);
    history = engine.floorEditorReducer(history, { type: "redo" });
    assert.deepEqual(history.present.rooms[0].floorZones, []);

    const unchanged = history;
    history = engine.floorEditorReducer(history, {
      type: "delete-elements",
      targets: [{ kind: "floor-zone", id: "missing-zone" }],
    });
    assert.equal(history, unchanged);
  });

  test("outdoor ground-zone CRUD shares floor-area selection and history", () => {
    let history = engine.createFloorEditorHistory(engine.createFloorEditorDraft(baseFloor()));
    history = engine.floorEditorReducer(history, {
      type: "add-ground-zone",
      polygon: [
        [-2, 0.5],
        [-0.2, 0.5],
        [-0.2, 1.2],
        [-2, 1.2],
      ],
      finish: { kind: "preset", preset: "sand" },
    });
    const zoneId = history.present.groundZones[0].id;
    assert.match(zoneId, /^demo-floor:ground-zone-/);
    assert.deepEqual(history.present.selection, { kind: "floor-zone", id: zoneId });
    history = engine.floorEditorReducer(history, {
      type: "update-floor-zone",
      zoneId,
      changes: { finish: { kind: "preset", preset: "gravel" } },
    });
    assert.equal(history.present.groundZones[0].finish.preset, "gravel");
    history = engine.floorEditorReducer(history, {
      type: "delete-elements",
      targets: [{ kind: "floor-zone", id: zoneId }],
    });
    assert.deepEqual(history.present.groundZones, []);
    history = engine.floorEditorReducer(history, { type: "undo" });
    assert.equal(history.present.groundZones[0].id, zoneId);
  });

  test("custom-area drawing locks to one room and closes at its first point", () => {
    const floor = baseFloor();
    const rooms = floor.rooms;
    let state = emptyFloorZoneDrawing;
    for (const point of [
      [0.5, 0.5],
      [3, 0.5],
      [3, 2],
      [0.5, 2],
    ]) {
      state = advanceFloorZoneDrawing(state, { type: "point", point }, floor).state;
    }
    const closed = advanceFloorZoneDrawing(state, { type: "point", point: [0.5, 0.5] }, floor);
    assert.equal(closed.completed.roomId, rooms[0].id);
    assert.equal(closed.completed.polygon.length, 4);
    assert.deepEqual(closed.state, emptyFloorZoneDrawing);
  });

  test("wall starts defer area ownership, including undo and shared room boundaries", () => {
    const floor = {
      footprint: [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ],
      rooms: [
        {
          id: "left",
          name: "Left",
          polygon: [
            [0, 0],
            [2, 0],
            [2, 4],
            [0, 4],
          ],
        },
        {
          id: "right",
          name: "Right",
          polygon: [
            [2, 0],
            [4, 0],
            [4, 4],
            [2, 4],
          ],
        },
      ],
    };
    const place = (state, point) => advanceFloorZoneDrawing(state, { type: "point", point }, floor);
    for (const [start, next, third, owner] of [
      [[0, 1], [1, 1], [1, 2], "left"],
      [[0, 1], [-1, 1], [-1, 2], null],
      [[2, 1], [1, 1], [1, 2], "left"],
      [[2, 1], [3, 1], [3, 2], "right"],
    ]) {
      let state = place(emptyFloorZoneDrawing, start).state;
      assert.equal(state.roomId, null);
      state = place(state, next).state;
      assert.equal(state.error, null);
      state = place(state, third).state;
      assert.equal(place(state, start).completed.roomId, owner);
    }
    let state = place(emptyFloorZoneDrawing, [0, 1]).state;
    state = place(state, [0, 2]).state;
    assert.equal(state.roomId, null);
    state = place(state, [1, 2]).state;
    assert.equal(state.roomId, "left");
    state = advanceFloorZoneDrawing(state, { type: "undo" }, floor).state;
    assert.equal(state.roomId, null);
    const redone = advanceFloorZoneDrawing(state, { type: "redo" }, floor).state;
    assert.equal(redone.roomId, "left");
    state = place(state, [-1, 2]).state;
    assert.equal(state.error, null);
    assert.equal(place(state, [0, 1]).completed.roomId, null);
  });

  test("custom-area drawing keeps invalid outlines recoverable", () => {
    const floor = baseFloor();
    let state = advanceFloorZoneDrawing(
      emptyFloorZoneDrawing,
      { type: "point", point: [0.5, 0.5] },
      floor,
    ).state;
    state = advanceFloorZoneDrawing(state, { type: "point", point: [5, 0.5] }, floor).state;
    assert.match(state.error, /inside Demo room/);
    assert.equal(state.points.length, 1);
    for (const point of [
      [3, 2],
      [0.5, 2],
      [3, 0.5],
    ]) {
      state = advanceFloorZoneDrawing(state, { type: "point", point }, floor).state;
    }
    const closed = advanceFloorZoneDrawing(state, { type: "point", point: [0.5, 0.5] }, floor);
    assert.equal(closed.completed, undefined);
    assert.match(closed.state.error, /crosses itself|no area/);
  });

  test("custom-area drawing creates outdoor ground zones without a room", () => {
    const floor = baseFloor();
    let state = emptyFloorZoneDrawing;
    for (const point of [
      [-2, 0.5],
      [-0.2, 0.5],
      [-0.2, 1.2],
      [-2, 1.2],
    ]) {
      state = advanceFloorZoneDrawing(state, { type: "point", point }, floor).state;
    }
    const closed = advanceFloorZoneDrawing(state, { type: "point", point: [-2, 0.5] }, floor);
    assert.equal(closed.completed.roomId, null);
    assert.equal(closed.completed.polygon.length, 4);

    const started = advanceFloorZoneDrawing(
      emptyFloorZoneDrawing,
      { type: "point", point: [-1, 0.5] },
      floor,
    ).state;
    const crossed = advanceFloorZoneDrawing(started, { type: "point", point: [1, 1] }, floor);
    assert.match(crossed.state.error, /outside the building/);
    assert.equal(crossed.state.points.length, 1);
  });

  test("zone translation and corner reshaping are immutable", () => {
    const polygon = [
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
    ];
    assert.deepEqual(translateFloorZone(polygon, [1, 1], [2.5, 3]), [
      [1.5, 2],
      [3.5, 2],
      [3.5, 3],
      [1.5, 3],
    ]);
    assert.deepEqual(moveFloorZoneCorner(polygon, 2, [3, 2]), [
      [0, 0],
      [2, 0],
      [3, 2],
      [0, 1],
    ]);
    assert.deepEqual(polygon, [
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
    ]);
  });

  test("floor layer paints rooms and commits one zone translation", async () => {
    const floor = baseFloor();
    floor.rooms[0].floorZones = [
      {
        id: "floor-zone-1",
        polygon: [
          [0.5, 0.5],
          [2, 0.5],
          [2, 1.5],
          [0.5, 1.5],
        ],
        finish: { kind: "preset", preset: "travertine" },
      },
    ];
    const draft = engine.createFloorEditorDraft(floor);
    const painted = [];
    const updated = [];
    const props = {
      draft,
      floor,
      selection: null,
      tool: "floor",
      paintTarget: "room",
      drawingPoints: [],
      drawingPreview: null,
      drawingRoomId: null,
      onPaintRoom: (id) => painted.push(id),
      onSelectZone() {},
      onUpdateZone: (id, polygon) => updated.push([id, polygon]),
    };
    const renderer = await create(createElement(ConstructionFloorLayer, props));
    const pointer = (x, z) => ({
      button: 0,
      pointerId: 1,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      nativeEvent: { altKey: false, pointerType: "mouse" },
      ray: new Raycaster(new Vector3(x, 10, z), new Vector3(0, -1, 0)).ray,
      target: {
        setPointerCapture() {},
        releasePointerCapture() {},
        hasPointerCapture: () => true,
      },
      stopPropagation() {},
    });
    try {
      await renderer.fireEvent(
        renderer.scene.findByProps({ name: "construction-floor-room-demo-room" }),
        "pointerDown",
        pointer(1, 1),
      );
      assert.deepEqual(painted, ["demo-room"]);
      await renderer.update(
        createElement(ConstructionFloorLayer, {
          ...props,
          tool: "select",
          selection: { kind: "floor-zone", id: "floor-zone-1" },
        }),
      );
      const hit = renderer.scene.findByProps({ name: "floor-zone-hit-floor-zone-1" });
      await renderer.fireEvent(hit, "pointerDown", pointer(1, 1));
      await renderer.fireEvent(hit, "pointerMove", pointer(2, 1));
      await renderer.fireEvent(hit, "pointerUp", pointer(2, 1));
      assert.equal(updated.length, 1);
      assert.deepEqual(updated[0], [
        "floor-zone-1",
        [
          [1.5, 0.5],
          [3, 0.5],
          [3, 1.5],
          [1.5, 1.5],
        ],
      ]);
    } finally {
      await renderer.unmount();
    }
  });
});
