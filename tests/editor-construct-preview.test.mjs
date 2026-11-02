import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const {
    constructEditorReducer,
    createConstructEditorState,
    availableOpeningOffsetRanges,
    nearestAvailableOpeningOffset,
  } = await load("/apps/web/src/editor-preview/construct/useConstructEditor.ts");
  const {
    constructPlanToWorld,
    openingPlacementIsValid,
    openingPlacementForPlanPoint,
    openingOffsetForWorldPoint,
    resizeOpeningSpan,
    resizeWallAttachmentAtPoint,
    snapConstructPlanPoint,
    wallMeasurement,
    wallOverlayTransform,
    worldDragToConstructPlan,
    worldDragToSnappedConstructPlan,
    worldToConstructPlan,
  } = await load("/apps/web/src/editor-preview/construct/drag-geometry.ts");
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { buildArchitecturalWallGeometries } = await load(
    "/packages/engine/src/architecture-geometry.ts",
  );
  const { ownerProjectManifest } = await load("/tests/fixtures/bundled-home.ts");
  const {
    detachSceneItemsFromMissingWalls,
    reconcileSceneItemCeilingDependencies,
    reconcileSceneItemWallDependencies,
  } = await load("/apps/web/src/editor-preview/construct/scene-item-dependencies.ts");
  const { resolveItemTransform } = await load("/packages/engine/src/home-project/placements.ts");
  const { deriveFloorTopology } = await load(
    "/packages/engine/src/home-editor/construct/topology.ts",
  );

  const floor = neutralDemoManifest.floors[0];
  const reduce = (state, action) => constructEditorReducer(state, action);

  test("plan resizing gives niches a 5 cm minimum at different plan scales", () => {
    for (const scale of [1, 2]) {
      const draft = createConstructEditorState(floor).history.present;
      draft.coordinates = { ...draft.coordinates, metersPerPlanUnit: scale };
      const wall = draft.walls.find((wall) => wall.id === "north-wall");
      wall.niches = [
        {
          id: "narrow-niche",
          side: "left",
          offsetFromWallStartPlanUnits: 1,
          widthPlanUnits: 0.6,
          bottomMeters: 0.1,
          heightMeters: 0.8,
          depthMeters: 0.03,
        },
      ];
      const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
      const point = wall.from.map(
        (value, axis) => value + ((wall.to[axis] - value) * 1.001) / length,
      );
      const resize = {
        openingId: "narrow-niche",
        wallId: wall.id,
        edge: "end",
        originalOffsetPlanUnits: 1,
        originalWidthPlanUnits: 0.6,
      };
      assert.ok(
        Math.abs(
          resizeWallAttachmentAtPoint(draft, resize, point, true).widthPlanUnits * scale - 0.05,
        ) < 1e-6,
      );
      assert.ok(
        Math.abs(
          resizeWallAttachmentAtPoint(
            draft,
            { ...resize, openingId: "ordinary-opening" },
            point,
            true,
          ).widthPlanUnits *
            scale -
            0.3,
        ) < 1e-6,
      );
    }
  });

  test("detaches wall items before their deleted support reaches the renderer", () => {
    const attached = ownerProjectManifest.sceneItems.filter(
      (item) =>
        item.placement.kind === "wall" && item.placement.wallId === "ground-service-divider",
    );
    assert.ok(attached.length > 0);
    const ownerFloor = ownerProjectManifest.floors[0];
    const rememberedWalls = new Map(ownerFloor.walls.map((wall) => [wall.id, wall]));
    const nextFloor = {
      ...ownerFloor,
      walls: ownerFloor.walls.filter((wall) => wall.id !== "ground-service-divider"),
    };
    const detached = detachSceneItemsFromMissingWalls(attached, nextFloor, rememberedWalls);
    assert.equal(detached.length, attached.length);
    assert.ok(detached.every((item) => item.placement.kind === "absolute"));
    assert.deepEqual(
      detached.map((item) => item.id),
      attached.map((item) => item.id),
    );
  });

  test("shortening an upper-floor wall rebases a retained blind or deletes an unsupported blind", () => {
    const previousFloor = ownerProjectManifest.floors[1];
    const previousWall = previousFloor.walls.find((wall) => wall.id === "first-west-wall");
    const blind = ownerProjectManifest.sceneItems.find(
      (item) => item.id === "bedroom-four-west-blind",
    );
    const remembered = new Map([[previousWall.id, previousWall]]);
    const shorten = (from, to) => ({
      ...previousFloor,
      walls: previousFloor.walls.map((wall) =>
        wall.id === previousWall.id ? { ...wall, from, to } : wall,
      ),
    });
    const retainedFloor = shorten([2, 15], [2, 0]);
    const [retained] = reconcileSceneItemWallDependencies([blind], retainedFloor, remembered, []);
    assert.equal(retained.placement.kind, "wall");
    assert.ok(Math.abs(retained.placement.offsetFromWallStartPlanUnits - 1.4) < 1e-9);
    assert.deepEqual(
      resolveItemTransform(retained.placement, retainedFloor),
      resolveItemTransform(blind.placement, previousFloor),
    );
    assert.deepEqual(
      reconcileSceneItemWallDependencies([blind], shorten([2, 14], [2, 0]), remembered, []),
      [],
    );
    const removedFloor = shorten([2, 12], [2, 0]);
    assert.deepEqual(reconcileSceneItemWallDependencies([blind], removedFloor, remembered, []), []);
  });

  test("resizing a wall removes doors and windows that no longer fit, and undo restores them", () => {
    let state = createConstructEditorState(floor);
    const wall = state.history.present.walls[0];
    state = reduce(state, {
      type: "add-opening",
      wallId: wall.id,
      kind: "window",
      offsetPlanUnits: 2,
    });
    state = reduce(state, {
      type: "add-opening",
      wallId: wall.id,
      kind: "door",
      offsetPlanUnits: 4,
    });
    const before = state.history.present.openings;
    const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
    state = reduce(state, {
      type: "move-endpoint",
      from: wall.to,
      to: [
        wall.from[0] + (wall.to[0] - wall.from[0]) / length,
        wall.from[1] + (wall.to[1] - wall.from[1]) / length,
      ],
    });
    assert.equal(
      state.history.present.openings.filter((opening) => opening.wallId === wall.id).length,
      0,
    );
    state = reduce(state, { type: "undo" });
    assert.deepEqual(state.history.present.openings, before);
  });

  test("rebinds wall items to the homogeneous run created by topology splitting", () => {
    const topology = deriveFloorTopology({
      floorId: "split-floor",
      floorName: "Split floor",
      walls: [
        { id: "north", from: [0, 0], to: [4, 0] },
        { id: "east", from: [4, 0], to: [4, 3] },
        { id: "south", from: [4, 3], to: [0, 3] },
        { id: "west", from: [0, 3], to: [0, 0] },
        { id: "annex-west", from: [1, 0], to: [1, -2] },
        { id: "annex-north", from: [1, -2], to: [3, -2] },
        { id: "annex-east", from: [3, -2], to: [3, 0] },
      ],
      openings: [],
      rooms: [
        { id: "main", name: "Main", accent: "#c98164", anchor: [2, 1.5] },
        { id: "annex", name: "Annex", accent: "#92aa86", anchor: [2, -1] },
      ],
    });
    assert.ok(topology.floor);
    const [item] = reconcileSceneItemWallDependencies(
      [
        {
          id: "wall-display",
          kind: "furnishing",
          modelId: "wall-display",
          size: [1, 0.6, 0.08],
          placement: {
            kind: "wall",
            wallId: "north",
            face: "right",
            offsetFromWallStartPlanUnits: 3.5,
            elevationMeters: 1,
            depthOffsetMeters: 0,
            rotationOffsetRadians: 0,
          },
        },
      ],
      topology.floor,
      new Map(),
      topology.wallRuns,
    );

    assert.equal(item.placement.kind, "wall");
    assert.equal(item.placement.wallId, "north--split-3");
    assert.equal(item.placement.offsetFromWallStartPlanUnits, 0.5);
  });

  test("keeps a stable ceiling room identity and follows its derived height", () => {
    const item = {
      id: "pendant",
      kind: "furnishing",
      modelId: "pendant-light",
      size: [0.4, 0.5, 0.4],
      placement: {
        kind: "ceiling",
        roomId: "room",
        at: [2, 1.5],
        dropMeters: 0.35,
        rotationYRadians: 0.2,
      },
    };
    const floorAt = (heightMeters) => ({
      ...floor,
      rooms: [
        {
          id: "room",
          name: "Room",
          polygon: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
          ],
          accent: "#c98164",
          dashboardSlots: [],
          devices: [],
        },
      ],
      ceilings: [
        {
          id: "room-ceiling",
          kind: "flat",
          roomIds: ["room"],
          heightMeters,
        },
      ],
    });

    const previousFloor = floorAt(2.5);
    const nextFloor = floorAt(3.1);
    const result = reconcileSceneItemCeilingDependencies([item], nextFloor);

    assert.equal(
      result.items[0],
      item,
      "an item with a surviving support stays referentially stable",
    );
    assert.deepEqual(result.issues, []);
    assert.equal(resolveItemTransform(item.placement, previousFloor).position[1], 2.15);
    assert.equal(resolveItemTransform(result.items[0].placement, nextFloor).position[1], 2.75);
  });

  test("rebinds a ceiling item by plan point after a room split or merge", () => {
    const entitySlots = [
      {
        id: "pendant-primary",
        compatibleDomains: ["light"],
        required: true,
        autoMap: "unique-compatible",
        deviceRole: "primary",
        presentation: { label: "Pendant", dashboardRole: "primary" },
      },
    ];
    const item = {
      id: "smart-pendant",
      kind: "device",
      modelId: "pendant-light",
      size: [0.4, 0.5, 0.4],
      entitySlots,
      placement: {
        kind: "ceiling",
        roomId: "room-before-split",
        at: [3, 1],
        dropMeters: 0.35,
        rotationYRadians: 0.2,
      },
    };
    const nextFloor = {
      ...floor,
      rooms: [
        {
          id: "room-before-split",
          name: "Left",
          polygon: [
            [0, 0],
            [2, 0],
            [2, 3],
            [0, 3],
          ],
          accent: "#c98164",
          dashboardSlots: [],
          devices: [],
        },
        {
          id: "room-after-split",
          name: "Right",
          polygon: [
            [2, 0],
            [4, 0],
            [4, 3],
            [2, 3],
          ],
          accent: "#92aa86",
          dashboardSlots: [],
          devices: [],
        },
      ],
      ceilings: [
        { id: "left-ceiling", kind: "flat", roomIds: ["room-before-split"], heightMeters: 2.5 },
        { id: "right-ceiling", kind: "flat", roomIds: ["room-after-split"], heightMeters: 2.8 },
      ],
    };

    const result = reconcileSceneItemCeilingDependencies([item], nextFloor);
    const rebound = result.items[0];
    assert.deepEqual(result.issues, []);
    assert.notEqual(rebound, item);
    assert.equal(rebound.id, item.id);
    assert.equal(rebound.kind, item.kind);
    assert.equal(rebound.modelId, item.modelId);
    assert.equal(rebound.size, item.size);
    assert.equal(rebound.entitySlots, entitySlots);
    assert.deepEqual(rebound.placement, {
      ...item.placement,
      roomId: "room-after-split",
    });
    assert.ok(
      Math.abs(resolveItemTransform(rebound.placement, nextFloor).position[1] - 2.45) < 1e-9,
    );

    const mergedFloor = {
      ...nextFloor,
      rooms: [
        {
          id: "merged-room",
          name: "Merged",
          polygon: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
          ],
          accent: "#c98164",
          dashboardSlots: [],
          devices: [],
        },
      ],
      ceilings: [{ id: "merged-ceiling", kind: "flat", roomIds: ["merged-room"], heightMeters: 3 }],
    };
    const merged = reconcileSceneItemCeilingDependencies([rebound], mergedFloor);
    assert.deepEqual(merged.issues, []);
    assert.equal(merged.items[0].placement.roomId, "merged-room");
  });

  test("reports unresolved ceiling supports without dropping or mutating items", () => {
    const item = {
      id: "orphan-pendant",
      kind: "furnishing",
      modelId: "pendant-light",
      size: [0.4, 0.5, 0.4],
      placement: {
        kind: "ceiling",
        roomId: "deleted-room",
        at: [8, 8],
        dropMeters: 0.35,
        rotationYRadians: 0,
      },
    };
    const missing = reconcileSceneItemCeilingDependencies([item], floor);
    assert.equal(missing.items[0], item);
    assert.equal(missing.issues[0].code, "editor.ceiling-support-missing");
    assert.equal(missing.issues[0].severity, "warning");
    assert.equal(missing.issues[0].path, "sceneItems[0].placement");

    const ambiguousFloor = {
      ...floor,
      rooms: [
        {
          ...floor.rooms[0],
          id: "first",
          polygon: [
            [0, 0],
            [3, 0],
            [3, 3],
            [0, 3],
          ],
        },
        {
          ...floor.rooms[0],
          id: "second",
          polygon: [
            [1, 0],
            [4, 0],
            [4, 3],
            [1, 3],
          ],
        },
      ],
    };
    const ambiguousItem = {
      ...item,
      placement: { ...item.placement, at: [2, 1] },
    };
    const ambiguous = reconcileSceneItemCeilingDependencies([ambiguousItem], ambiguousFloor);
    assert.equal(ambiguous.items[0], ambiguousItem);
    assert.equal(ambiguous.issues[0].code, "editor.ceiling-support-ambiguous");
    assert.equal(ambiguous.issues[0].severity, "warning");
  });

  test("moves a selected wall endpoint and every connected topology endpoint", () => {
    let state = createConstructEditorState(floor);
    state = reduce(state, { type: "select", selection: { kind: "wall", id: "north-wall" } });
    state = reduce(state, {
      type: "move-wall-endpoint",
      wallId: "north-wall",
      endpoint: "from",
      point: [-0.4, 0],
    });

    assert.deepEqual(
      state.history.present.walls.find((wall) => wall.id === "north-wall").from,
      [-0.4, 0],
    );
    assert.deepEqual(
      state.history.present.walls.find((wall) => wall.id === "west-wall").to,
      [-0.4, 0],
    );
    assert.deepEqual(
      state.previewFloor.walls.find((wall) => wall.id === "west-wall").to,
      [-0.4, 0],
    );
  });

  test("translates a wall and carries both connected corners in one edit", () => {
    let state = createConstructEditorState(floor);
    const north = state.history.present.walls.find((wall) => wall.id === "north-wall");
    const incidentEndpoints = (point) =>
      state.history.present.walls.flatMap((wall) =>
        ["from", "to"]
          .filter(
            (endpoint) =>
              wall.id !== north.id &&
              wall[endpoint][0] === point[0] &&
              wall[endpoint][1] === point[1],
          )
          .map((endpoint) => ({ wallId: wall.id, endpoint })),
      );
    const fromConnections = incidentEndpoints(north.from);
    const toConnections = incidentEndpoints(north.to);
    assert.ok(fromConnections.length > 0);
    assert.ok(toConnections.length > 0);

    state = reduce(state, { type: "translate-wall", wallId: north.id, delta: [0, 0.4] });
    const translated = state.history.present.walls.find((wall) => wall.id === north.id);
    assert.deepEqual(translated.from, [north.from[0], north.from[1] + 0.4]);
    assert.deepEqual(translated.to, [north.to[0], north.to[1] + 0.4]);
    for (const connection of fromConnections) {
      const connected = state.history.present.walls.find((wall) => wall.id === connection.wallId);
      assert.deepEqual(connected[connection.endpoint], translated.from);
    }
    for (const connection of toConnections) {
      const connected = state.history.present.walls.find((wall) => wall.id === connection.wallId);
      assert.deepEqual(connected[connection.endpoint], translated.to);
    }
    assert.equal(state.history.past.length, 1);
  });

  test("measures walls in resolved metres and preserves exact wall metadata", () => {
    const measurement = wallMeasurement(
      { id: "diagonal", from: [10, -2], to: [13, 2] },
      { origin: [10, -2], metersPerPlanUnit: 0.5, scaleBasis: "measured" },
    );
    assert.equal(measurement.planLength, 5);
    assert.equal(measurement.lengthMeters, 2.5);
    assert.equal(measurement.label, "2.50 m");
    assert.ok(Math.abs(measurement.directionDegrees - 53.13010235415598) < 1e-9);

    let state = createConstructEditorState(floor);
    state = reduce(state, {
      type: "update-wall-metadata",
      wallId: "north-wall",
      changes: {
        thicknessMeters: 0.24,
        heightMeters: 3.1,
        exteriorColor: "#b86f58",
        faceColors: { left: "#eee4d7", right: "#d9c8b5" },
      },
    });
    const wall = state.previewFloor.walls.find((candidate) => candidate.id === "north-wall");
    assert.equal(wall.thicknessMeters, 0.24);
    assert.equal(wall.heightMeters, 3.1);
    assert.equal(wall.exteriorColor, "#b86f58");
    assert.deepEqual(wall.faceColors, { left: "#eee4d7", right: "#d9c8b5" });
    assert.equal(state.history.past.length, 1);
  });

  test("adds a wall and supports undo and redo without persistence", () => {
    let state = createConstructEditorState(floor);
    state = reduce(state, {
      type: "add-wall",
      from: [2.4, 0],
      to: [2.4, 3.6],
      exteriorColor: "#b86f58",
    });
    const wall = state.history.present.walls.at(-1);
    assert.equal(state.history.present.walls.length, floor.walls.length + 1);
    assert.equal(state.history.present.selection.id, wall.id);
    assert.equal(wall.exteriorColor, "#b86f58");
    assert.ok(state.previewFloor.walls.some((candidate) => candidate.id === wall.id));
    assert.equal(state.previewFloor.rooms.length, 2);

    state = reduce(state, { type: "undo" });
    assert.equal(state.history.present.walls.length, floor.walls.length);
    assert.equal(state.history.future.length, 1);
    state = reduce(state, { type: "redo" });
    assert.equal(state.history.present.walls.length, floor.walls.length + 1);
  });

  test("adds, edits, and deletes each opening through reducer actions", () => {
    for (const kind of ["door", "window", "passage"]) {
      let state = createConstructEditorState(floor);
      state = reduce(state, { type: "select", selection: { kind: "wall", id: "east-wall" } });
      state = reduce(state, {
        type: "add-opening",
        wallId: "east-wall",
        kind,
        offsetPlanUnits: 1,
      });
      const opening = state.history.present.openings.at(-1);
      assert.equal(opening.kind, kind);
      assert.deepEqual(state.history.present.selection, { kind: "opening", id: opening.id });

      state = reduce(state, {
        type: "update-selected-opening",
        patch: {
          offsetPlanUnits: 1.1,
          widthPlanUnits: 0.8,
          openingHeightMeters: 1.95,
          sillHeightMeters: kind === "window" ? 0.75 : 0,
        },
      });
      const updated = state.history.present.openings.at(-1);
      assert.equal(updated.offsetPlanUnits, 1.1);
      assert.equal(updated.widthPlanUnits, 0.8);
      assert.equal(updated.openingHeightMeters, 1.95);
      const previewOpening = state.previewFloor.openings.find(
        (candidate) => candidate.id === opening.id,
      );
      assert.equal(previewOpening.widthPlanUnits, 0.8);
      assert.equal(previewOpening.openingHeightMeters, 1.95);
      const reopened = createConstructEditorState(JSON.parse(JSON.stringify(state.previewFloor)));
      const restored = reopened.history.present.openings.find(
        (candidate) => candidate.id === opening.id,
      );
      assert.equal(restored.widthPlanUnits, 0.8);
      assert.equal(restored.openingHeightMeters, 1.95);

      state = reduce(state, { type: "delete-selection" });
      assert.equal(
        state.history.present.openings.some((candidate) => candidate.id === opening.id),
        false,
      );
      assert.equal(state.history.present.selection, null);
    }
  });

  test("updates kind-specific opening variants without changing identity", () => {
    let state = createConstructEditorState(floor);
    const source = state.history.present.openings.find((opening) => opening.id === "demo-window");
    state = reduce(state, { type: "select", selection: { kind: "opening", id: source.id } });
    state = reduce(state, {
      type: "replace-selected-opening",
      opening: {
        ...source,
        operation: "fixed",
        variant: "muntined",
        panelCount: 2,
        glazing: "privacy",
        muntins: { columns: 3, rows: 2 },
      },
    });
    const updated = state.history.present.openings.find((opening) => opening.id === source.id);
    assert.equal(updated.id, source.id);
    assert.equal(updated.kind, "window");
    assert.equal(updated.variant, "muntined");
    assert.deepEqual(updated.muntins, { columns: 3, rows: 2 });
    assert.equal(
      state.previewFloor.openings.find((opening) => opening.id === source.id).glazing,
      "privacy",
    );
    assert.equal(state.history.past.length, 1);
  });

  test("keeps added and moved openings out of occupied wall spans", () => {
    const ranges = availableOpeningOffsetRanges({
      draft: createConstructEditorState(floor).history.present,
      wallId: "north-wall",
      widthPlanUnits: 1.2,
    });
    const offset = nearestAvailableOpeningOffset(1.8, ranges);
    const existing = floor.openings.find((opening) => opening.id === "demo-window");
    assert.ok(
      offset + 1.2 < existing.offsetFromWallStartPlanUnits ||
        offset > existing.offsetFromWallStartPlanUnits + existing.widthPlanUnits,
    );
  });

  test("converts world and plan points and bypasses snapping while Alt is held", () => {
    const coordinates = { origin: [10, -2], metersPerPlanUnit: 0.5, scaleBasis: "measured" };
    assert.deepEqual(constructPlanToWorld([12, 2], coordinates), [1, 2]);
    assert.deepEqual(worldToConstructPlan({ x: 1, z: 2 }, coordinates), [12, 2]);
    assert.deepEqual(snapConstructPlanPoint([1.049, 2.051]), [1, 2.1]);
    assert.deepEqual(snapConstructPlanPoint([1.049, 2.051], true), [1.049, 2.051]);
    assert.deepEqual(
      worldDragToConstructPlan({
        point: { x: 0.523, z: 0.976 },
        coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      }),
      [0.5, 1],
    );
    assert.deepEqual(
      worldDragToConstructPlan({
        point: { x: 0.523, z: 0.976 },
        coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
        absolute: true,
      }),
      [0.523, 0.976],
    );
    assert.deepEqual(
      worldDragToConstructPlan({
        point: { x: 0.523, z: 0.976 },
        coordinates,
      }),
      [11, 0],
      "the 10 cm world grid must respect scale and origin",
    );
  });

  test("magnetically connects drawn walls and moves openings along their support", () => {
    assert.deepEqual(
      worldDragToSnappedConstructPlan({
        point: { x: 4.72, z: 0.06 },
        coordinates: floor.coordinates,
        walls: floor.walls,
        pixelsPerMeter: 82,
        pointerType: "mouse",
      }),
      [4.8, 0],
      "nearby wall endpoints must share the exact junction point",
    );
    assert.deepEqual(
      worldDragToSnappedConstructPlan({
        point: { x: 4.72, z: 0.06 },
        coordinates: floor.coordinates,
        walls: floor.walls,
        pixelsPerMeter: 82,
        pointerType: "mouse",
        absolute: true,
      }),
      [4.72, 0.06],
      "Alt/Option bypasses magnetic construction snapping",
    );

    const north = floor.walls.find((wall) => wall.id === "north-wall");
    assert.equal(
      openingOffsetForWorldPoint({
        point: { x: 2, z: 0 },
        coordinates: floor.coordinates,
        wall: north,
        openingWidthPlanUnits: 1.9,
      }),
      1.1,
    );
    assert.equal(
      openingOffsetForWorldPoint({
        point: { x: 2, z: 0 },
        coordinates: floor.coordinates,
        wall: north,
        openingWidthPlanUnits: 1.9,
        absolute: true,
      }),
      1.05,
    );
  });

  test("finds a compatible wall during transfer and resizes from either edge", () => {
    const transferred = openingPlacementForPlanPoint({
      point: [4.73, 1.8],
      walls: floor.walls,
      widthPlanUnits: 0.9,
      metersPerPlanUnit: floor.coordinates.metersPerPlanUnit,
    });
    assert.equal(transferred.wallId, "east-wall");
    assert.equal(transferred.offsetPlanUnits, 1.35);
    assert.equal(
      openingPlacementForPlanPoint({
        point: [2.4, 1.8],
        walls: floor.walls,
        widthPlanUnits: 0.9,
        metersPerPlanUnit: floor.coordinates.metersPerPlanUnit,
        maxDistanceMeters: 0.2,
      }),
      null,
    );
    assert.equal(
      openingPlacementForPlanPoint({
        point: [0.2, 0.2],
        walls: [{ id: "too-short", from: [0, 0], to: [0.5, 0] }],
        widthPlanUnits: 0.9,
        metersPerPlanUnit: 1,
      }),
      null,
    );
    assert.equal(
      openingPlacementIsValid({
        draft: createConstructEditorState(floor).history.present,
        wallId: "north-wall",
        offsetPlanUnits: 1.5,
        widthPlanUnits: 0.9,
      }),
      false,
    );
    assert.equal(
      openingPlacementIsValid({
        draft: createConstructEditorState(floor).history.present,
        wallId: "north-wall",
        offsetPlanUnits: 0.1,
        widthPlanUnits: 0.9,
      }),
      true,
    );

    assert.deepEqual(
      resizeOpeningSpan({
        offsetPlanUnits: 1,
        widthPlanUnits: 1,
        edge: "end",
        cursorOffsetPlanUnits: 2.2,
        wallLengthPlanUnits: 4,
        anchorOpposite: false,
      }),
      { offsetPlanUnits: 0.8, widthPlanUnits: 1.4 },
    );
    assert.deepEqual(
      resizeOpeningSpan({
        offsetPlanUnits: 1,
        widthPlanUnits: 1,
        edge: "end",
        cursorOffsetPlanUnits: 2.2,
        wallLengthPlanUnits: 4,
        anchorOpposite: true,
      }),
      { offsetPlanUnits: 1, widthPlanUnits: 1.2 },
    );
  });

  test("produces renderable topology previews and stable wall overlay transforms", () => {
    let state = createConstructEditorState(floor);
    state = reduce(state, {
      type: "move-wall-endpoint",
      wallId: "east-wall",
      endpoint: "to",
      point: [5.2, 3.6],
    });
    assert.ok(state.previewFloor.footprint.length >= 3);
    assert.equal(state.previewFloor.rooms.length, 1);
    assert.equal(state.previewFloor.wallJunctions.length, 4);
    assert.ok(state.previewFloor.ceilings.length > 0);
    assert.ok(state.previewFloor.walls.every((wall) => wall.thicknessMeters > 0));

    const transform = wallOverlayTransform([0, 0], [4, 0], floor.coordinates);
    assert.deepEqual(transform.center, [2, 0]);
    assert.equal(transform.length, 4);
    assert.equal(transform.rotationYRadians, 0);
  });

  test("keeps intermediate owner-home wall edits renderable", () => {
    let state = createConstructEditorState(ownerProjectManifest.floors[0]);
    state = reduce(state, {
      type: "move-wall-endpoint",
      wallId: "ground-north-wall",
      endpoint: "to",
      point: [23.9, 0.16],
    });
    assert.doesNotThrow(() => buildArchitecturalWallGeometries(state.previewFloor));
  });
});
