import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";
import { connectedRuntimeFixture } from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const { ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  const { catalogEntries, filterCatalog } = await load(
    "/apps/web/src/editor-preview/furnish/catalog/catalog.ts",
  );
  const { createCatalogItem: createFloorCatalogItem } = await load(
    "/apps/web/src/editor-preview/furnish/placement/item-creation.ts",
  );
  const createCatalogItem = (entry, placement, items, occupiedIds = []) =>
    createFloorCatalogItem(entry, placement, items, occupiedIds, "ground-floor");
  const { placementCandidate } = await load(
    "/apps/web/src/editor-preview/furnish/placement/placement-candidate.ts",
  );
  const { catalogStartPlacement } = await load(
    "/apps/web/src/editor-preview/furnish/placement/catalog-start-placement.ts",
  );
  const { isDeviceModelDefinition } = await load("/packages/engine/src/validation/core.ts");
  const { createFurnishingEditorState, furnishingEditorReducer, placementForWorldDrag } =
    await load("/apps/web/src/editor-preview/furnish/editor-state.ts");
  const entries = catalogEntries(
    ownerProjectRegistries.furnishingModels,
    ownerProjectRegistries.deviceModels,
  );
  const get = (id) => entries.find((entry) => entry.modelId === id);
  const floor = engine.neutralDemoManifest.floors[0];
  const { windowPlacements } = await load(
    "/apps/web/src/editor-preview/furnish/placement/window-placement.ts",
  );

  const { createSceneItemId } = await load(
    "/apps/web/src/editor-preview/furnish/scene-item-identity.ts",
  );
  test("rattan pendants are offered only as bindable light devices", () => {
    const matches = entries.filter((entry) => entry.modelId === "rattan-bell-pendant");
    assert.equal(matches.length, 1);
    const entry = get("rattan-bell-pendant");
    const placement = catalogStartPlacement(entry, floor, [2, 2]).placement;
    const item = createCatalogItem(entry, placement, []);
    assert.equal(item.kind, "device");
    assert.equal(item.entitySlots.length, 1);
    assert.deepEqual(item.entitySlots[0].compatibleDomains, ["light"]);
    assert.equal(ownerProjectRegistries.furnishingModels["rattan-bell-pendant"].legacyOnly, true);
  });

  test("retired furnishing lights are offered only as bindable light devices", () => {
    const modelIds = [
      "round-globe-wall-lamp",
      "wall-reading-spot",
      "oak-wall-uplight",
      "six-globe-ceiling-lamp",
      "astro-parallel-wall-light",
      "tubular-wall-lamp",
      "clip-reading-lamp",
    ];
    for (const modelId of modelIds) {
      const matches = entries.filter((entry) => entry.modelId === modelId);
      assert.equal(matches.length, 1, modelId);
      assert.equal(matches[0].kind, "device", modelId);
      assert.equal(matches[0].definition.supportedDomains[0], "light", modelId);
      assert.ok(matches[0].definition.sceneLight, modelId);
      assert.equal(ownerProjectRegistries.furnishingModels[modelId].legacyOnly, true, modelId);
    }
  });

  test("UUID allocation retries an occupied identity without changing existing IDs", (t) => {
    const occupied = "00000000-0000-4000-8000-000000000001";
    const fresh = "00000000-0000-4000-8000-000000000002";
    const reserved = [occupied, "legacy-item"];
    let calls = 0;
    t.mock.method(globalThis.crypto, "randomUUID", () => (++calls === 1 ? occupied : fresh));
    assert.equal(createSceneItemId(reserved), fresh);
    assert.equal(calls, 2);
    assert.deepEqual(reserved, [occupied, "legacy-item"]);
  });

  test("new catalog instances and slots use UUIDs without knowledge of other items", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const ids = [];
    const placement = { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 };
    for (const modelId of ["concealed-cistern-toilet", "table-lamp"]) {
      for (let i = 0; i < 3; i++) {
        const item = createCatalogItem(get(modelId), placement, []);
        assert.equal(item.modelId, modelId);
        ids.push(
          item.id,
          ...(item.kind === "device" ? item.entitySlots.map((slot) => slot.id) : []),
        );
      }
    }
    ids.forEach((id) => assert.match(id, uuid));
    assert.equal(new Set(ids).size, ids.length);
  });

  test("catalog starts near the camera target and never falls back outside its view", () => {
    const entry = get("floor-lamp");
    const at = [2, 2];
    const candidate = catalogStartPlacement(entry, floor, at, undefined, () => true);
    assert.deepEqual(candidate.placement.at, at);
    for (const modelId of ["floor-lamp", "indoor-ac", "terracotta-pendant"]) {
      const hidden = catalogStartPlacement(get(modelId), floor, at, undefined, () => false);
      assert.equal(hidden.placement, null);
      assert.match(hidden.error, /current view/);
    }
  });

  test("ceiling items dragged into the garden become free-standing placements", () => {
    const entry = get("terracotta-pendant");
    const placement = placementCandidate(entry, floor, { at: [2, 2], kind: "ceiling" }).placement;
    const item = createCatalogItem(entry, placement, []);
    const moved = placementForWorldDrag({
      world: { x: -20, z: -20 },
      item,
      definition: entry.definition,
      floor,
      raw: true,
    });
    assert.equal(moved.kind, "absolute");
    assert.equal(moved.elevationMeters, engine.resolveItemTransform(placement, floor).position[1]);
  });

  test("ordinary furnishings and devices can be applied outside or without rooms", () => {
    for (const modelId of ["three-seat-sofa", "speaker"]) {
      for (const at of [
        [-20, -20],
        [2, 2],
      ]) {
        const projectFloor = { ...ownerHomeProject.floors[0], rooms: [], ceilings: [] };
        const candidate = placementCandidate(get(modelId), projectFloor, { at, kind: "absolute" });
        assert.ok(candidate.placement, candidate.error);
        const item = createCatalogItem(get(modelId), candidate.placement, []);
        const project = { ...ownerHomeProject, floors: [projectFloor], sceneItems: [item] };
        const result = engine.validateHomeProject(project, ownerProjectRegistries);
        assert.deepEqual(
          result.issues.filter((issue) => issue.path.startsWith("sceneItems[")),
          [],
        );
      }
    }
  });

  test("window covers fit real windows, retain manual sizing on drag, and receive HA cover slots", () => {
    const entry = get("motorized-blind");
    assert.equal(filterCatalog(entries, "living-room", "motorized blind")[0], entry);
    const fittingOpenings = new Set(
      windowPlacements(entry.definition, ownerHomeProject.floors[0], [10, 4]).map(
        (candidate) => candidate.openingId,
      ),
    );
    assert.ok(fittingOpenings.has("living-terrace-slider"));
    assert.ok(fittingOpenings.has("dining-terrace-slider"));
    assert.ok(!fittingOpenings.has("front-entry-door"));
    assert.ok(!fittingOpenings.has("garage-motorized-vehicle-door"));
    const original = JSON.stringify(ownerHomeProject);
    const candidate = catalogStartPlacement(entry, ownerHomeProject.floors[0], [10, 4]);
    assert.ok(candidate.placement, candidate.error);
    const item = {
      ...createCatalogItem(entry, candidate.placement, ownerHomeProject.sceneItems),
      size: candidate.size,
    };
    const opening = ownerHomeProject.floors[0].openings.find(
      (opening) =>
        opening.kind === "window" &&
        opening.wallId === item.placement.wallId &&
        opening.offsetFromWallStartPlanUnits + opening.widthPlanUnits / 2 ===
          item.placement.offsetFromWallStartPlanUnits,
    );
    assert.ok(opening);
    assert.ok(
      Math.abs(
        item.size[0] * entry.definition.windowFit.openingWidthRatio -
          opening.widthPlanUnits * ownerHomeProject.floors[0].coordinates.metersPerPlanUnit,
      ) < 1e-10,
    );
    assert.ok(Math.abs(item.placement.elevationMeters - opening.sillHeightMeters) < 1e-10);
    assert.deepEqual(item.entitySlots[0].compatibleDomains, ["cover"]);
    assert.equal(item.entitySlots[0].deviceRole, "primary");
    assert.equal(item.entitySlots[0].autoMap, "manual");
    const project = { ...ownerHomeProject, sceneItems: [...ownerHomeProject.sceneItems, item] };
    assert.equal(engine.validateHomeProject(project, ownerProjectRegistries).valid, true);
    assert.equal(engine.parseHomeProject(JSON.stringify(project)).valid, true);
    assert.equal(JSON.stringify(ownerHomeProject), original);
    const resized = { ...item, size: [item.size[0] * 0.8, item.size[1] * 0.9, item.size[2]] };
    const { position } = engine.resolveItemTransform(item.placement, ownerHomeProject.floors[0]);
    const moved = placementForWorldDrag({
      world: { x: position[0], z: position[2] },
      item: resized,
      definition: entry.definition,
      floor: ownerHomeProject.floors[0],
      raw: false,
    });
    assert.equal(moved.kind, "wall");
    assert.equal(moved.offsetFromWallStartPlanUnits, item.placement.offsetFromWallStartPlanUnits);
    assert.ok(
      Math.abs(
        moved.elevationMeters +
          resized.size[1] * entry.definition.windowFit.openingHeightRatio -
          opening.sillHeightMeters -
          opening.openingHeightMeters,
      ) < 1e-10,
    );
    assert.equal(
      placementForWorldDrag({
        world: { x: position[0], z: position[2] },
        item,
        definition: entry.definition,
        floor: ownerHomeProject.floors[0],
        raw: true,
      }).kind,
      "absolute",
    );
    for (const changedFloor of [
      { ...floor, openings: [] },
      {
        ...floor,
        openings: floor.openings.map((opening) => ({ ...opening, sillHeightMeters: 10 })),
      },
      { ...floor, walls: [] },
    ])
      assert.equal(catalogStartPlacement(entry, changedFloor, [2, 2]).placement, null);
  });

  test("single curtains fit separate windows on one wall and retain independent dimensions", () => {
    const entry = get("single-window-curtain");
    assert.equal(filterCatalog(entries, "living-room", "single window curtain")[0], entry);
    const source = ownerHomeProject.floors[0];
    const firstWindow = windowPlacements(entry.definition, source, [10, 4])[0];
    assert.ok(firstWindow);
    const opening = source.openings.find((opening) => opening.id === firstWindow.openingId);
    const width = opening.widthPlanUnits / 3;
    const twoWindows = {
      ...source,
      rooms: source.rooms.filter((room) => room.name === firstWindow.roomName),
      openings: [
        { ...opening, id: "curtain-window-left", widthPlanUnits: width },
        {
          ...opening,
          id: "curtain-window-right",
          widthPlanUnits: width,
          offsetFromWallStartPlanUnits: opening.offsetFromWallStartPlanUnits + width * 2,
        },
      ],
    };
    const visible = (position) =>
      engine.pointInsidePolygon(
        [
          position[0] / source.coordinates.metersPerPlanUnit + source.coordinates.origin[0],
          position[2] / source.coordinates.metersPerPlanUnit + source.coordinates.origin[1],
        ],
        twoWindows.rooms[0].polygon,
      );
    const first = catalogStartPlacement(entry, twoWindows, [10, 4], undefined, visible);
    assert.ok(first.placement, first.error);
    const item = { ...createCatalogItem(entry, first.placement, []), size: first.size };
    const second = catalogStartPlacement(
      entry,
      twoWindows,
      [10, 4],
      {
        items: [item],
        ...ownerProjectRegistries,
      },
      visible,
    );
    assert.ok(second.placement, second.error);

    assert.equal(first.placement.wallId, second.placement.wallId);
    assert.notEqual(
      first.placement.offsetFromWallStartPlanUnits,
      second.placement.offsetFromWallStartPlanUnits,
    );
    const spacing =
      Math.abs(
        first.placement.offsetFromWallStartPlanUnits -
          second.placement.offsetFromWallStartPlanUnits,
      ) * source.coordinates.metersPerPlanUnit;
    assert.ok(spacing > (first.size[0] + second.size[0]) / 2);
    const customSize = [first.size[0] * 0.8, first.size[1] * 0.7, first.size[2]];
    const aligned = windowPlacements(entry.definition, twoWindows, [10, 4], customSize)[0];
    assert.deepEqual(aligned.size, customSize);
    assert.deepEqual(second.size, first.size);
    assert.deepEqual(
      entry.definition.variants.map(({ id }) => id),
      ["left", "right"],
    );
  });

  test("window alignment respects translated coordinates, plan scale, and reversed walls", () => {
    const definition = get("motorized-blind").definition;
    const original = windowPlacements(definition, floor, [2, 2])[0];
    assert.ok(original);
    const transformed = {
      ...floor,
      coordinates: { ...floor.coordinates, origin: [10, 20], metersPerPlanUnit: 0.5 },
      walls: floor.walls.map((wall) => ({
        ...wall,
        from: [10 + wall.from[0] * 2, 20 + wall.from[1] * 2],
        to: [10 + wall.to[0] * 2, 20 + wall.to[1] * 2],
      })),
      openings: floor.openings.map((opening) => ({
        ...opening,
        offsetFromWallStartPlanUnits: opening.offsetFromWallStartPlanUnits * 2,
        widthPlanUnits: opening.widthPlanUnits * 2,
      })),
      rooms: floor.rooms.map((room) => ({
        ...room,
        polygon: room.polygon.map(([x, z]) => [10 + x * 2, 20 + z * 2]),
      })),
    };
    const scaled = windowPlacements(definition, transformed, [14, 24])[0];
    assert.deepEqual(scaled.size, original.size);
    const scaledTransform = engine.resolveItemTransform(scaled.placement, transformed);
    const originalTransform = engine.resolveItemTransform(original.placement, floor);
    scaledTransform.position.forEach((value, axis) =>
      assert.ok(Math.abs(value - originalTransform.position[axis]) < 1e-10),
    );
    assert.equal(scaledTransform.rotationYRadians, originalTransform.rotationYRadians);
    const reversed = {
      ...floor,
      walls: floor.walls.map((wall) => ({ ...wall, from: wall.to, to: wall.from })),
      openings: floor.openings.map((opening) => {
        const wall = floor.walls.find((wall) => wall.id === opening.wallId);
        return {
          ...opening,
          offsetFromWallStartPlanUnits:
            Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]) -
            opening.offsetFromWallStartPlanUnits -
            opening.widthPlanUnits,
        };
      }),
    };
    const reverse = windowPlacements(definition, reversed, [2, 2])[0];
    const first = engine.resolveItemTransform(original.placement, floor);
    const second = engine.resolveItemTransform(reverse.placement, reversed);
    first.position.forEach((value, axis) =>
      assert.ok(Math.abs(value - second.position[axis]) < 1e-10),
    );
    assert.ok(
      Math.abs(Math.cos(first.rotationYRadians) - Math.cos(second.rotationYRadians)) < 1e-10,
    );
    assert.ok(
      Math.abs(Math.sin(first.rotationYRadians) - Math.sin(second.rotationYRadians)) < 1e-10,
    );
  });

  test("new items prefer a clear starting spot instead of covering an existing move target", () => {
    const entry = get("round-coffee-table");
    const first = catalogStartPlacement(entry, floor, [2, 2]);
    const existing = createCatalogItem(entry, first.placement, []);
    const next = catalogStartPlacement(entry, floor, [2, 2], {
      ...ownerProjectRegistries,
      items: [existing],
    });
    assert.ok(next.placement);
    const firstPosition = engine.resolveItemTransform(first.placement, floor).position;
    const nextPosition = engine.resolveItemTransform(next.placement, floor).position;
    assert.ok(
      Math.hypot(firstPosition[0] - nextPosition[0], firstPosition[2] - nextPosition[2]) >=
        entry.definition.defaultSize[0],
    );
  });

  test("catalog additions start selected and use ordinary move transactions and undo", () => {
    for (const modelId of [
      "floor-lamp",
      "indoor-ac",
      "terracotta-pendant",
      "ceiling-fan",
      "table-fan",
      "pedestal-fan",
    ]) {
      const entry = get(modelId);
      const candidate = catalogStartPlacement(entry, floor, [2, 2]);
      assert.ok(candidate.placement, candidate.error);
      assert.equal(candidate.placement.kind, entry.definition.preferredPlacement);
      const added = createCatalogItem(entry, candidate.placement, []);
      let state = furnishingEditorReducer(createFurnishingEditorState([]), {
        type: "add-item",
        item: added,
      });
      assert.equal(state.selectedId, added.id);
      assert.equal(state.past.length, 1);
      state = furnishingEditorReducer(state, { type: "begin-transaction" });
      state = furnishingEditorReducer(state, {
        type: "update-placement",
        id: added.id,
        placement: placementForWorldDrag({
          world: { x: 2.13, z: 2.84 },
          item: added,
          definition: entry.definition,
          floor,
          raw: false,
        }),
      });
      const cancelled = furnishingEditorReducer(state, { type: "cancel-transaction" });
      assert.deepEqual(cancelled.items[0], added);
      assert.equal(cancelled.past.length, 1);
      state = furnishingEditorReducer(state, { type: "commit-transaction" });
      assert.equal(state.past.length, 2);
      state = furnishingEditorReducer(state, { type: "undo" });
      assert.deepEqual(state.items[0], added);
      state = furnishingEditorReducer(state, { type: "undo" });
      assert.equal(state.items.length, 0);
      state = furnishingEditorReducer(state, { type: "redo" });
      assert.deepEqual(state.items[0], added);
    }
  });

  test("starting placement handles every owner model, camera room preference, and missing supports", () => {
    for (const entry of entries) {
      const candidate = catalogStartPlacement(entry, ownerHomeProject.floors[0], [10, 4]);
      assert.ok(candidate.placement, `${entry.modelId}: ${candidate.error}`);
    }
    const rooms = ownerHomeProject.floors[0].rooms;
    for (const room of rooms) {
      const candidate = catalogStartPlacement(
        get("floor-lamp"),
        ownerHomeProject.floors[0],
        engine.polygonCentroid(room.polygon),
      );
      assert.ok(engine.pointInsidePolygon(candidate.placement.at, room.polygon), room.id);
    }
    assert.equal(
      catalogStartPlacement(get("floor-lamp"), { ...floor, rooms: [] }, [0, 0]).placement,
      null,
    );
    assert.equal(
      catalogStartPlacement(get("indoor-ac"), { ...floor, walls: [] }, [0, 0]).placement,
      null,
    );
    const concave = {
      ...floor,
      rooms: [
        {
          ...floor.rooms[0],
          polygon: [
            [0, 0],
            [6, 0],
            [6, 1],
            [1, 1],
            [1, 6],
            [0, 6],
          ],
        },
      ],
    };
    const candidate = catalogStartPlacement(get("floor-lamp"), concave, [3, 3]);
    assert.ok(engine.pointInsidePolygon(candidate.placement.at, concave.rooms[0].polygon));
  });

  test("outdoor vegetation starts and remains outside without wall snapping", () => {
    const tree = get("deciduous-tree");
    const shrub = get("garden-shrub");
    assert.equal(tree.definition.defaultRoomType, "outdoor");
    assert.equal(tree.definition.placementEnvironment, "outdoor");
    assert.deepEqual(
      filterCatalog(entries, "outdoor", "")
        .map((entry) => entry.modelId)
        .sort(),
      [
        "compact-car",
        "deciduous-tree",
        "electric-sedan",
        "flower-pot",
        "garden-bench",
        "garden-birdbath",
        "garden-compost-bin",
        "garden-hedge",
        "garden-hose-reel",
        "garden-lantern-pole",
        "garden-shrub",
        "garden-trellis",
        "low-garden-lantern",
        "olive-tree",
        "outdoor-bbq",
        "outdoor-dining-chair",
        "outdoor-dining-table",
        "outdoor-fire-pit",
        "outdoor-side-table",
        "outdoor-storage-box",
        "patio-parasol",
        "pergola-string-lights",
        "pickup-truck",
        "pool-chaise-longue",
        "pop-up-sprinkler",
        "raised-garden-bed",
        "retractable-awning",
        "rotating-sprinkler",
        "slatted-folding-chair",
        "slatted-folding-table",
        "smart-hose-timer",
        "soil-moisture-sensor",
        "teak-lounge-chair",
        "teak-lounge-sofa",
        "terracotta-planter",
        "watering-can",
        "wheelie-bin",
        "wooden-garden-swing",
      ],
    );
    assert.deepEqual(
      filterCatalog(entries, "outdoor", "olivier").map((entry) => entry.modelId),
      ["olive-tree"],
    );
    assert.equal(get("olive-tree").definition.placementEnvironment, "outdoor");
    assert.ok(shrub);

    const preferred = engine.polygonCentroid(ownerHomeProject.floors[0].footprint);
    const start = catalogStartPlacement(tree, ownerHomeProject.floors[0], preferred);
    assert.ok(start.placement, start.error);
    assert.equal(start.placement.kind, "absolute");
    assert.ok(
      engine.pointStrictlyOutsideFloorFootprint(start.placement.at, ownerHomeProject.floors[0]),
    );

    const item = createCatalogItem(tree, start.placement, ownerHomeProject.sceneItems);
    const project = {
      ...ownerHomeProject,
      sceneItems: [...ownerHomeProject.sceneItems, item],
    };
    assert.equal(engine.validateHomeProject(project, ownerProjectRegistries).valid, true);

    const nearWall = placementForWorldDrag({
      world: { x: 0.1, z: 0.1 },
      item,
      definition: tree.definition,
      floor: ownerHomeProject.floors[0],
      raw: false,
    });
    assert.equal(nearWall.kind, "absolute");

    const boundary = ownerHomeProject.floors[0].footprint[0];
    assert.equal(
      placementCandidate(tree, ownerHomeProject.floors[0], {
        at: boundary,
        kind: "absolute",
        raw: true,
      }).placement,
      null,
    );

    const inside = {
      ...item,
      placement: { ...item.placement, at: preferred },
    };
    assert.ok(
      engine
        .validateHomeProject(
          {
            ...ownerHomeProject,
            sceneItems: [...ownerHomeProject.sceneItems, inside],
          },
          ownerProjectRegistries,
        )
        .issues.some((issue) => issue.code === "project.outdoor-placement"),
    );
  });

  test("vehicles support indoor garage placement as well as outdoor catalog use", () => {
    for (const [modelId, at] of [
      ["compact-car", [1.6, 4]],
      ["electric-sedan", [4.7, 4]],
    ]) {
      const entry = get(modelId);
      assert.equal(entry.definition.defaultRoomType, "outdoor");
      assert.equal(entry.definition.placementEnvironment, "indoor-outdoor");
      const item = createCatalogItem(
        entry,
        {
          kind: "absolute",
          at,
          elevationMeters: 0.001,
          rotationYRadians: 0,
        },
        [],
      );
      const project = { ...ownerHomeProject, sceneItems: [item] };
      assert.deepEqual(engine.validateHomeProject(project, ownerProjectRegistries).issues, []);
    }
  });

  test("all effective models have a standard room type and existing project stays valid", () => {
    for (const entry of entries)
      assert.ok(engine.isRoomType(entry.definition.defaultRoomType), entry.modelId);
    assert.equal(engine.isRoomType("primary-suite"), false);
    assert.equal(engine.isRoomType("outdoor"), true);
    assert.equal(
      isDeviceModelDefinition({ ...get("speaker").definition, defaultRoomType: "primary-suite" }),
      false,
    );
    assert.equal(
      isDeviceModelDefinition({ ...get("speaker").definition, supportedDomains: [] }),
      false,
    );
    assert.equal(get("dining-set").definition.defaultRoomType, "dining-room");
    assert.equal(get("shower-assembly").definition.defaultRoomType, "bathroom");
    assert.equal(get("washing-machine").definition.defaultRoomType, "laundry");
    const original = JSON.stringify(ownerHomeProject);
    const restored = engine.parseHomeProject(original);
    assert.equal(restored.valid, true);
    assert.deepEqual(restored.project.sceneItems, ownerHomeProject.sceneItems);
    assert.equal(engine.validateHomeProject(restored.project, ownerProjectRegistries).valid, true);
    assert.equal(JSON.stringify(ownerHomeProject), original);
  });

  test("search scopes to room type, combines words, includes both kinds and retains addable models", () => {
    assert.equal(filterCatalog(entries, "all", "  FLOOR light  ")[0].modelId, "floor-lamp");
    assert.equal(
      filterCatalog(entries, "devices", "").length,
      Object.keys(ownerProjectRegistries.deviceModels).length,
    );
    assert.ok(filterCatalog(entries, "devices", "").every((entry) => entry.kind === "device"));
    assert.deepEqual(filterCatalog(entries, "devices", "sectional furniture"), []);
    assert.deepEqual(filterCatalog(entries, "bedroom", "floor lamp"), []);
    assert.equal(filterCatalog(entries, "living-room", "floor lamp")[0].kind, "device");
    assert.equal(
      filterCatalog(entries, "living-room", "electric heater")[0].modelId,
      "smart-panel-radiator",
    );
    assert.equal(
      filterCatalog(entries, "bathroom", "illuminated mirror")[0].modelId,
      "illuminated-round-mirror",
    );
    assert.equal(
      filterCatalog(entries, "bathroom", "dark oak vanity")[0].modelId,
      "dark-oak-vessel-vanity",
    );
    assert.equal(
      filterCatalog(entries, "bedroom", "corner wardrobe")[0].modelId,
      "white-corner-wardrobe",
    );
    assert.deepEqual(
      filterCatalog(entries, "living-room", "connected frame").map((entry) => entry.modelId),
      ["connected-frame-black", "connected-frame-oak"],
    );
    assert.equal(filterCatalog(entries, "all", "sectional furniture")[0].kind, "furnishing");
    assert.deepEqual(
      filterCatalog(entries, "office", "").map((entry) => entry.modelId),
      ["ergonomic-office-chair", "oak-bookshelf", "oak-desk", "smart-power-strip", "table-fan"],
    );
    const kitchenCabinetResults = new Set(
      filterCatalog(entries, "kitchen", "kitchen cabinet").map((entry) => entry.modelId),
    );
    for (const modelId of [
      "kitchen-base-cabinet",
      "kitchen-cabinet-lighting",
      "kitchen-sink-cabinet",
      "kitchen-wall-cabinet",
    ])
      assert.ok(kitchenCabinetResults.has(modelId), modelId);
    assert.equal(
      filterCatalog(entries, "entryway", "shoe bench")[0].modelId,
      "entryway-shoe-bench",
    );
    assert.equal(filterCatalog(entries, "entryway", "coat rack")[0].modelId, "wall-coat-rack");
    assert.equal(
      filterCatalog(entries, "hallway", "floating wall")[0].modelId,
      "floating-wall-shelf",
    );
    assert.equal(
      filterCatalog(entries, "bedroom", "oak floating shelf")[0].modelId,
      "oak-floating-shelf",
    );
    assert.equal(
      filterCatalog(entries, "hallway", "console table")[0].modelId,
      "hallway-console-table",
    );
    assert.deepEqual(
      filterCatalog(entries, "laundry", "appliances device").map((entry) => entry.modelId),
      ["tumble-dryer", "washing-machine", "water-heater"],
    );
    assert.deepEqual(
      filterCatalog(entries, "kitchen", "appliances device").map((entry) => entry.modelId),
      [
        "built-in-microwave",
        "coffee-maker",
        "dishwasher",
        "electric-kettle",
        "freezer",
        "microwave",
        "oven",
        "pet-feeder",
        "refrigerator",
      ],
    );
    const collision = catalogEntries(
      { speaker: get("sectional-sofa").definition },
      { speaker: get("speaker").definition },
    );
    assert.equal(new Set(collision.map((entry) => entry.key)).size, 2);
    assert.deepEqual(
      filterCatalog(entries, "all", "fan").map((entry) => entry.modelId),
      ["bathroom-extractor-fan", "ceiling-fan", "pedestal-fan", "table-fan"],
    );
    assert.equal(filterCatalog(entries, "bedroom", "fan")[0].modelId, "pedestal-fan");
    assert.equal(filterCatalog(entries, "living-room", "fan")[0].modelId, "ceiling-fan");
    assert.equal(filterCatalog(entries, "bathroom", "fan")[0].modelId, "bathroom-extractor-fan");
    for (const [query, id, domains] of [
      ["dehumidifier", "humidifier-dehumidifier", ["humidifier"]],
      ["robot vacuum", "robot-vacuum", ["vacuum"]],
      ["smart lock", "smart-lock", ["lock"]],
      ["alarm keypad", "alarm-keypad", ["alarm_control_panel"]],
      ["motorized valve", "motorized-valve", ["valve"]],
      ["siren", "siren", ["siren"]],
      ["smart button", "smart-button", ["button"]],
      ["microwave", "built-in-microwave", ["switch", "sensor", "select", "number", "button"]],
      ["coffee maker", "coffee-maker", ["switch", "sensor", "select", "number", "button"]],
      ["electric kettle", "electric-kettle", ["switch", "sensor", "button"]],
      ["freezer", "freezer", ["sensor"]],
      ["pet feeder", "pet-feeder", ["button", "switch", "sensor", "number", "select"]],
      ["weather station", "weather-station", ["sensor"]],
      ["compact european", "compact-car", ["sensor"]],
      ["tesla", "electric-sedan", ["sensor"]],
      ["pickup", "pickup-truck", ["sensor"]],
    ]) {
      const entry = filterCatalog(entries, "all", query)[0];
      assert.equal(entry.modelId, id);
      const item = createCatalogItem(
        entry,
        catalogStartPlacement(entry, ownerHomeProject.floors[0], [10, 4]).placement,
        [],
      );
      assert.deepEqual(item.entitySlots[0].compatibleDomains, domains);
    }
    assert.deepEqual(filterCatalog(entries, "all", "nonexistent"), []);
  });

  test("candidate resolver allows every support while checking physical placement", () => {
    const free = placementCandidate(get("floor-lamp"), floor, { at: [2, 2] });
    assert.equal(free.placement.kind, "absolute");
    assert.equal(
      placementCandidate(get("floor-lamp"), floor, { at: [2, 2], kind: "wall" }).placement,
      null,
    );
    assert.equal(
      placementCandidate(get("floor-lamp"), floor, { at: [2, 0.2] }).placement.kind,
      "wall",
    );
    assert.equal(
      placementCandidate(get("floor-lamp"), floor, { at: [2, 0.2], raw: true }).placement.kind,
      "absolute",
    );
    assert.equal(
      placementCandidate(get("floor-lamp"), floor, { at: [2, 2], kind: "ceiling" }).placement.kind,
      "ceiling",
    );
    assert.equal(
      placementCandidate(get("floor-lamp"), floor, { at: [-2, -2] }).placement.kind,
      "absolute",
    );
    const wall = placementCandidate(get("indoor-ac"), floor, { at: [2, 0.2] });
    assert.equal(wall.placement.kind, "wall");
    assert.equal(wall.placement.wallId, "north-wall");
    assert.equal(
      placementCandidate(get("indoor-ac"), floor, { at: [2, 0.2], face: "left" }).placement.kind,
      "wall",
    );
    assert.ok(
      placementCandidate(get("indoor-ac"), ownerHomeProject.floors[0], { at: [3, 0.4] }).placement,
    );
    assert.equal(placementCandidate(get("indoor-ac"), floor, { at: [2, 2] }).placement, null);
    assert.equal(
      placementCandidate(get("indoor-ac"), floor, { at: [2, 2], kind: "absolute" }).placement.kind,
      "absolute",
    );
    assert.equal(
      placementCandidate(get("indoor-ac"), floor, { at: [2, 0.2], elevation: 20 }).placement,
      null,
    );
    const pendant = placementCandidate(get("terracotta-pendant"), floor, { at: [2, 2] });
    assert.equal(pendant.placement.kind, "ceiling");
    assert.equal(pendant.placement.roomId, floor.rooms[0].id);
    assert.equal(
      placementCandidate(get("terracotta-pendant"), floor, { at: [2, 0.2] }).placement.kind,
      "wall",
    );
    assert.equal(
      placementCandidate(get("terracotta-pendant"), floor, { at: [2, 2], drop: 30 }).placement,
      null,
    );
  });

  test("floor, wall, and ceiling models snap, validate, detach, and round-trip without changing identity", () => {
    for (const modelId of [
      "three-seat-sofa",
      "arched-mirror",
      "rattan-bell-pendant",
      "woven-pendant",
      "washing-machine",
      "wall-switch",
      "terracotta-pendant",
      "ceiling-fan",
      "motorized-blind",
    ]) {
      const entry = get(modelId);
      const start = catalogStartPlacement(entry, floor, [2, 2]);
      assert.ok(start.placement, `${modelId}: ${start.error}`);
      const added = {
        ...createCatalogItem(entry, start.placement, []),
        ...(start.size ? { size: start.size } : {}),
      };
      const placement = placementForWorldDrag({
        world: { x: 2, z: 0.2 },
        item: added,
        definition: entry.definition,
        floor,
        raw: false,
      });
      assert.equal(placement.kind, "wall", modelId);
      assert.equal(placement.wallId, "north-wall", modelId);
      if (!entry.definition.windowFit)
        assert.equal(
          engine.resolveItemTransform(placement, floor).position[1],
          engine.resolveItemTransform(added.placement, floor).position[1],
          `${modelId} elevation`,
        );
      const snapped = { ...added, floorId: floor.id, placement };
      const project = {
        ...ownerHomeProject,
        coordinates: floor.coordinates,
        floors: [floor],
        stairs: [],
        sceneItems: [snapped],
        roomProfiles: {},
        openingProfiles: {},
        shortcuts: [],
      };
      const validation = engine.validateHomeProject(project, ownerProjectRegistries);
      assert.equal(validation.valid, true, `${modelId}: ${JSON.stringify(validation.issues)}`);
      const restored = engine.parseHomeProject(JSON.stringify(project));
      assert.equal(restored.valid, true, modelId);
      assert.deepEqual(restored.project.sceneItems[0], snapped);
      for (const [world, raw] of [
        [{ x: 2.13, z: 0.2 }, true],
        [{ x: 2, z: 2 }, false],
      ]) {
        const detached = {
          ...snapped,
          placement: placementForWorldDrag({
            world,
            item: snapped,
            definition: entry.definition,
            floor,
            raw,
          }),
        };
        assert.equal(detached.placement.kind, "absolute", modelId);
        assert.equal(
          engine.validateHomeProject({ ...project, sceneItems: [detached] }, ownerProjectRegistries)
            .valid,
          true,
          modelId,
        );
        assert.equal(detached.id, added.id);
        assert.deepEqual(detached.entitySlots, added.entitySlots);
      }
    }
  });

  test("world-grid snapping respects translated, non-metre plan coordinates", () => {
    const transformed = {
      ...floor,
      coordinates: { ...floor.coordinates, origin: [10, 20], metersPerPlanUnit: 0.5 },
      rooms: floor.rooms.map((room) => ({
        ...room,
        polygon: room.polygon.map(([x, z]) => [10 + x * 2, 20 + z * 2]),
      })),
      walls: floor.walls.map((wall) => ({
        ...wall,
        from: [10 + wall.from[0] * 2, 20 + wall.from[1] * 2],
        to: [10 + wall.to[0] * 2, 20 + wall.to[1] * 2],
      })),
    };
    const result = placementCandidate(get("speaker"), transformed, { at: [14.13, 24.06] });
    assert.deepEqual(result.placement.at, [14.2, 24]);
  });

  test("device factories allocate fresh manual primary slots and history restores their identity", () => {
    let items = [];
    for (const modelId of [
      "camera-screen",
      "connected-frame-oak",
      "connected-frame-black",
      "washing-machine",
      "tumble-dryer",
      "dishwasher",
      "oven",
      "terracotta-pendant",
      "illuminated-round-mirror",
      "ceiling-fan",
      "table-fan",
      "pedestal-fan",
    ]) {
      const entry = get(modelId);
      const candidate = placementCandidate(entry, floor, {
        at:
          modelId === "camera-screen" ||
          modelId.startsWith("connected-frame-") ||
          modelId === "illuminated-round-mirror"
            ? [2, 0.2]
            : [2, 2],
      });
      assert.ok(candidate.placement, candidate.error);
      const item = createCatalogItem(entry, candidate.placement, items, [`${modelId}-primary`]);
      assert.equal(item.kind, "device");
      assert.equal(item.entitySlots.length, 1);
      assert.equal(item.entitySlots[0].autoMap, "manual");
      assert.equal(item.entitySlots[0].deviceRole, "primary");
      assert.notEqual(item.entitySlots[0].id, `${modelId}-primary`);
      if (modelId === "camera-screen" || modelId.startsWith("connected-frame-")) {
        assert.deepEqual(item.entitySlots[0].compatibleDomains, ["camera"]);
      }
      if (modelId === "illuminated-round-mirror")
        assert.deepEqual(item.entitySlots[0].compatibleDomains, ["light"]);
      if (["washing-machine", "tumble-dryer", "dishwasher", "oven"].includes(modelId)) {
        assert.deepEqual(item.entitySlots[0].compatibleDomains, [
          "switch",
          "sensor",
          "select",
          "number",
          "button",
        ]);
      }
      if (modelId.endsWith("-fan"))
        assert.deepEqual(item.entitySlots[0].compatibleDomains, ["fan"]);
      items.push(item);
    }
    let state = createFurnishingEditorState([]);
    state = furnishingEditorReducer(state, { type: "add-item", item: items[0] });
    state = furnishingEditorReducer(state, { type: "undo" });
    assert.equal(state.items.length, 0);
    state = furnishingEditorReducer(state, { type: "redo" });
    assert.deepEqual(state.items[0], items[0]);
    state = furnishingEditorReducer(state, { type: "delete", id: items[0].id });
    assert.equal(state.items.length, 0);
    state = furnishingEditorReducer(state, { type: "undo" });
    assert.deepEqual(state.items[0], items[0]);
    assert.equal(filterCatalog(entries, "all", "camera screen").length, 1);
  });

  test("appliances added in Arrange resolve exact switch or sensor bindings through the runtime", () => {
    for (const modelId of ["washing-machine", "tumble-dryer", "dishwasher", "oven"]) {
      const entry = get(modelId);
      const { placement } = placementCandidate(entry, floor, { at: [2, 2] });
      const item = createCatalogItem(entry, placement, []);
      const room = floor.rooms[0];
      const device = engine.deviceSlotForItem(item, floor);
      const manifest = {
        ...engine.neutralDemoManifest,
        floors: [{ ...floor, rooms: [{ ...room, dashboardSlots: [], devices: [device] }] }],
      };
      const profile = {
        schemaVersion: 1,
        homeId: manifest.home.id,
        roomAreaIds: { [room.id]: "demo_room" },
        entityIdsBySlotId: {},
      };
      const runtime = connectedRuntimeFixture();
      for (const entityId of ["switch.demo_coffee", "sensor.demo_temperature"]) {
        profile.entityIdsBySlotId[item.entitySlots[0].id] = entityId;
        const resolved = engine.resolveHomeAssistantBindings(
          manifest,
          profile,
          runtime,
          ownerProjectRegistries.deviceModels,
        );
        const binding = resolved.rooms[room.id].devices[0];
        assert.equal(binding.entities[0].entityId, entityId);
        assert.equal(binding.entities[0].state, runtime.entityStates[entityId]);
        assert.deepEqual(binding.issues, [], `${modelId}/${entityId}`);
      }
      profile.entityIdsBySlotId[item.entitySlots[0].id] = "light.demo_ceiling";
      const incompatible = engine.resolveHomeAssistantBindings(
        manifest,
        profile,
        runtime,
        ownerProjectRegistries.deviceModels,
      );
      assert.ok(
        incompatible.rooms[room.id].devices[0].issues.some(
          (issue) => issue.code === "binding.domain-incompatible",
        ),
      );
    }
  });

  test("alternative primary domains retain device-class constraints", () => {
    const placement = { kind: "absolute", at: [2, 2], elevationMeters: 0 };
    const heater = createCatalogItem(get("water-heater"), placement, []);
    assert.deepEqual(heater.entitySlots[0].compatibleDomains, ["switch", "water_heater"]);
    const thermometer = createCatalogItem(get("thermometer"), placement, []);
    assert.deepEqual(thermometer.entitySlots[0].compatibleDomains, ["sensor"]);
    assert.deepEqual(thermometer.entitySlots[0].compatibleDeviceClasses, ["temperature"]);
    const wallSwitch = createCatalogItem(get("wall-switch"), placement, []);
    assert.deepEqual(wallSwitch.entitySlots[0].compatibleDomains, [
      "light",
      "switch",
      "input_boolean",
      "event",
    ]);
    const towelRail = createCatalogItem(get("heated-towel-rail"), placement, []);
    assert.deepEqual(towelRail.entitySlots[0].compatibleDomains, ["climate", "switch"]);
    const purifier = createCatalogItem(get("air-purifier"), placement, []);
    assert.deepEqual(purifier.entitySlots[0].compatibleDomains, ["fan", "switch"]);
    const plug = createCatalogItem(get("smart-plug"), placement, []);
    assert.deepEqual(plug.entitySlots[0].compatibleDomains, ["switch"]);
    assert.deepEqual(plug.entitySlots[0].compatibleDeviceClasses, ["outlet"]);
    const curtain = createCatalogItem(get("motorized-curtain"), placement, []);
    assert.deepEqual(curtain.entitySlots[0].compatibleDomains, ["cover"]);
    assert.deepEqual(curtain.entitySlots[0].compatibleDeviceClasses, ["curtain"]);
    assert.equal(get("video-doorbell").definition.liveMedia.kind, "camera-stream");
    assert.equal(get("video-doorbell").definition.interaction.target, "camera-viewer");
    assert.equal(get("connected-frame-oak").definition.liveMedia.kind, "camera-stream");
    assert.equal(get("connected-frame-black").definition.interaction.target, "camera-viewer");
  });
});
