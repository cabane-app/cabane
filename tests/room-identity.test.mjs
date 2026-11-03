import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { deriveFloorTopology, roomAnchorForPolygon } = await load(
    "/packages/engine/src/home-editor/construct/topology.ts",
  );
  const { centroid, pointOnSegment } = await load(
    "/packages/engine/src/home-editor/construct/topology-plan-math.ts",
  );
  const { pointInsidePolygon } = await load("/packages/engine/src/geometry.ts");
  const { createFloorEditorDraft, createFloorEditorHistory, floorEditorReducer } = await load(
    "/packages/engine/src/home-editor/construct/editor-state.ts",
  );
  const hallway = [
    [0, 0],
    [10, 0],
    [10, 10],
    [8, 10],
    [8, 2],
    [2, 2],
    [2, 10],
    [0, 10],
  ];
  const kitchen = [
    [2, 2],
    [8, 2],
    [8, 10],
    [2, 10],
  ];
  const walls = (polygon, prefix) =>
    polygon.map((from, index) => ({
      id: `${prefix}-${index}`,
      from,
      to: polygon[(index + 1) % polygon.length],
    }));
  const syntheticFloor = () =>
    deriveFloorTopology({
      floorId: "synthetic",
      floorName: "Floor",
      openings: [],
      walls: [
        ...walls(
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
          ],
          "shell",
        ),
        ...walls(kitchen, "inner").filter((_, index) => index !== 2),
      ],
      rooms: [
        {
          id: "hall",
          name: "Hallway",
          anchor: [1, 5],
          accent: "#c98164",
          floorFinish: { kind: "solid", color: "#ae9570" },
          floorZones: [
            {
              id: "entry-zone",
              polygon: [
                [0.2, 0.2],
                [1.2, 0.2],
                [1.2, 1.2],
                [0.2, 1.2],
              ],
              finish: { kind: "solid", color: "#b28e73" },
            },
          ],
          ceilingId: "hall-ceiling",
          ceilingHeightMeters: 2.7,
        },
        { id: "kitchen", name: "Kitchen", anchor: [5, 5], accent: "#92aa86" },
      ],
    }).floor;
  const derive = (draft) => deriveFloorTopology(draft);
  const strictlyInside = (anchor, polygon) =>
    pointInsidePolygon(anchor, polygon) &&
    !polygon.some((from, index) =>
      pointOnSegment(anchor, { from, to: polygon[(index + 1) % polygon.length] }),
    );

  test("room anchors retain safe centroids and avoid concave exteriors and boundaries", () => {
    const safeConcave = [
      [0, 0],
      [6, 0],
      [6, 6],
      [4, 6],
      [4, 3],
      [2, 3],
      [2, 6],
      [0, 6],
    ];
    for (const polygon of [kitchen, safeConcave]) {
      assert.ok(strictlyInside(centroid(polygon), polygon));
      assert.deepEqual(roomAnchorForPolygon(polygon), centroid(polygon));
    }
    // This U's centroid lies exactly on its bottom inner edge.
    const boundary = [
      [0, 0],
      [9, 0],
      [9, 4],
      [8.5, 4],
      [8.5, 1],
      [0.5, 1],
      [0.5, 4],
      [0, 4],
    ];
    assert.deepEqual(centroid(boundary), [4.5, 1]);
    assert.ok(!strictlyInside(centroid(boundary), boundary));
    assert.ok(pointInsidePolygon(centroid(hallway), kitchen));
    for (const polygon of [hallway, boundary]) {
      for (const angle of [0, 0.37, Math.PI / 2]) {
        const rotated = polygon.map(([x, y]) => [
          x * Math.cos(angle) - y * Math.sin(angle) + 0.037,
          x * Math.sin(angle) + y * Math.cos(angle) - 0.071,
        ]);
        const anchor = roomAnchorForPolygon(rotated);
        assert.ok(strictlyInside(anchor, rotated));
        assert.deepEqual(roomAnchorForPolygon(rotated), anchor);
        assert.deepEqual(roomAnchorForPolygon([...rotated].reverse()), anchor);
        assert.deepEqual(
          roomAnchorForPolygon([...rotated.slice(3), ...rotated.slice(0, 3)]),
          anchor,
        );
      }
    }
  });

  test("concave rooms retain identity and metadata through rename, history and JSON reopening", () => {
    const floor = syntheticFloor();
    let history = createFloorEditorHistory(createFloorEditorDraft(floor));
    const check = (expectedName) => {
      const result = derive(history.present);
      assert.deepEqual(result.issues, []);
      assert.deepEqual(
        result.floor.rooms.map(({ id, name, polygon, ...metadata }) => ({
          id,
          name,
          metadata,
        })),
        floor.rooms.map(({ id, name, polygon, ...metadata }) => ({
          id,
          name: id === "hall" ? expectedName : name,
          metadata,
        })),
      );
      assert.deepEqual(result.floor.ceilings, floor.ceilings);
      assert.deepEqual(result.floor.walls, floor.walls);
      return result.floor;
    };
    check("Hallway");
    const rename = (name) => {
      const room = derive(history.present).floor.rooms.find(({ id }) => id === "hall");
      history = floorEditorReducer(history, {
        type: "update-room-metadata",
        roomId: room.id,
        anchor: roomAnchorForPolygon(room.polygon),
        changes: { name },
      });
    };
    rename("Corridor");
    check("Corridor");
    history = floorEditorReducer(history, { type: "undo" });
    check("Hallway");
    history = floorEditorReducer(history, { type: "redo" });
    const saved = JSON.parse(JSON.stringify(check("Corridor")));
    history = createFloorEditorHistory(createFloorEditorDraft(saved));
    check("Corridor");
    rename("Passage");
    check("Passage");
  });

  test("Keep after a real merge into a concave room survives JSON reopening", () => {
    const floor = syntheticFloor();
    const divided = deriveFloorTopology({
      ...createFloorEditorDraft(floor),
      walls: [...floor.walls, { id: "divider", from: [0, 5], to: [2, 5] }],
      rooms: [
        { id: "hall", name: "Hallway", anchor: [1, 1], accent: "#c98164" },
        { id: "kitchen", name: "Kitchen", anchor: [5, 5], accent: "#92aa86" },
        { id: "entry", name: "Entry", anchor: [1, 8], accent: "#c98164" },
      ],
    });
    assert.deepEqual(divided.issues, []);
    let history = createFloorEditorHistory(createFloorEditorDraft(divided.floor));
    history = floorEditorReducer(history, {
      type: "select",
      selection: { kind: "wall", id: "divider" },
    });
    history = floorEditorReducer(history, { type: "delete-selection" });
    const merged = derive(history.present);
    assert.ok(merged.issues.some(({ code }) => code === "topology.room-merge"));
    const room = merged.floor.rooms.find(({ id }) => id === "hall");
    history = floorEditorReducer(history, {
      type: "resolve-room-merge",
      survivorId: "hall",
      mergedRoomIds: ["hall", "entry"],
      anchor: roomAnchorForPolygon(room.polygon),
    });
    const resolved = derive(history.present);
    assert.deepEqual(resolved.issues, []);
    const reopened = derive(createFloorEditorDraft(JSON.parse(JSON.stringify(resolved.floor))));
    assert.deepEqual(reopened.issues, []);
    assert.deepEqual(reopened.floor.rooms, resolved.floor.rooms);
    assert.deepEqual(reopened.floor.rooms.map(({ id }) => id).sort(), ["hall", "kitchen"]);
  });
});
