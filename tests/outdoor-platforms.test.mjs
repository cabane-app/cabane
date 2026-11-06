import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";
await withModules(async (load) => {
  const e = await load("/packages/engine/src/index.ts");
  const { deriveRoofRegions } = await load("/packages/engine/src/roof/roof-coverage.ts");
  const { wallLevelContact } = await load(
    "/packages/engine/src/architecture-geometry/wall-level-contact.ts",
  );
  const { layoutFloorFromEditorFloor } = await load("/apps/web/src/editor-preview/project-sync.ts");
  const { stableFurnishingRegistry } = await load("/packages/catalog/src/furnishing/index.ts");
  const { placementCandidate } = await load(
    "/apps/web/src/editor-preview/furnish/placement/placement-candidate.ts",
  );
  const { makeStairProject } = await load("/tests/fixtures/multiple-floors.ts");
  const square = [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ];
  const rawRoomFloor = () =>
    e.deriveFloorTopology({
      floorId: "ground",
      floorName: "Ground",
      rooms: [],
      openings: [],
      walls: square.map((from, i) => ({ id: `wall-${i}`, from, to: square[(i + 1) % 4] })),
    }).floor;
  const roomFloor = () => {
    const floor = rawRoomFloor();
    floor.rooms = floor.rooms.map((r) => ({ ...r, name: "Room" }));
    return floor;
  };
  const platform = (
    polygon = [
      [4, 0],
      [6, 0],
      [6, 4],
      [4, 4],
    ],
    id = "balcony",
  ) => ({
    id,
    polygon,
    finish: { kind: "solid", color: "#c8b79b" },
    defaultEdge: { kind: "railing", heightMeters: 1 },
    edges: polygon.map((_, i) => ({ id: `${id}:edge-${i}` })),
  });
  test("platform validates shared room boundaries and rejects crossed or overlapping support", () => {
    const floor = roomFloor();
    floor.outdoorPlatforms = [platform()];
    assert.equal(e.validateLayoutFloorSpec(floor).valid, true);
    for (const polygon of [
      square,
      [
        [3, 1],
        [5, 1],
        [5, 3],
        [3, 3],
      ],
      [
        [4, 0],
        [6, 4],
        [6, 0],
        [4, 4],
      ],
    ]) {
      floor.outdoorPlatforms = [platform(polygon)];
      assert.ok(
        e.validateLayoutFloorSpec(floor).issues.some((i) => i.code.startsWith("platform.")),
      );
    }
    floor.outdoorPlatforms = [
      platform(),
      platform(
        [
          [5, 1],
          [7, 1],
          [7, 3],
          [5, 3],
        ],
        "other",
      ),
    ];
    assert.ok(e.validateLayoutFloorSpec(floor).issues.some((i) => i.code === "platform.overlap"));
  });
  test("schema rejects malformed platform records and validation rejects duplicate edge IDs", () => {
    const floor = roomFloor();
    floor.outdoorPlatforms = [platform()];
    floor.outdoorPlatforms[0].edges[1].id = floor.outdoorPlatforms[0].edges[0].id;
    assert.ok(e.validateLayoutFloorSpec(floor).issues.some((i) => i.code === "id.duplicate"));
    const project = {
      schemaVersion: 1,
      seedRevision: "schema-test",
      home: e.neutralDemoManifest.home,
      floor: layoutFloorFromEditorFloor(floor),
      sceneItems: [],
      roomProfiles: {},
      openingProfiles: {},
      shortcuts: [],
      assumptions: [],
    };
    project.floor.outdoorPlatforms[0].edges[0].configuration = { kind: "rail" };
    assert.equal(e.parseHomeProjectSchema(project).valid, false);
    delete project.floor.outdoorPlatforms[0].edges[0].configuration;
    project.floor.outdoorPlatforms[0].polygon = [
      [4, 0],
      [6, 4],
      [6, 0],
      [4, 4],
    ];
    assert.equal(
      e.parseHomeProjectSchema(project).valid,
      true,
      "schema-shaped geometry errors remain recoverable",
    );
    assert.equal(
      e.validateHomeProject(project, { furnishingModels: {}, deviceModels: {} }).valid,
      false,
    );
  });
  test("persistent edge identities survive corner moves, undo and export", () => {
    const floor = roomFloor();
    let history = e.createFloorEditorHistory(e.createFloorEditorDraft(floor));
    history = e.floorEditorReducer(history, {
      type: "add-outdoor-platform",
      polygon: platform().polygon,
      finish: platform().finish,
      defaultEdge: platform().defaultEdge,
    });
    assert.equal(history.present.outdoorPlatforms.length, 1);
    const added = history.present.outdoorPlatforms[0];
    history = e.floorEditorReducer(history, {
      type: "update-outdoor-platform",
      id: added.id,
      changes: {
        defaultEdge: { kind: "glass-railing", heightMeters: 1 },
        edges: added.edges.map((edge, index) =>
          index === 1
            ? { ...edge, configuration: { kind: "glass-railing", heightMeters: 1.1 } }
            : edge,
        ),
      },
    });
    const before = structuredClone(history.present.outdoorPlatforms[0]);
    assert.equal(before.defaultEdge.kind, "glass-railing");
    const polygon = before.polygon.map((p, i) => (i === 1 ? [7, 0] : p));
    history = e.floorEditorReducer(history, {
      type: "update-outdoor-platform",
      id: before.id,
      changes: { polygon },
    });
    assert.deepEqual(history.present.outdoorPlatforms[0].edges, before.edges);
    history = e.floorEditorReducer(history, { type: "undo" });
    assert.deepEqual(history.present.outdoorPlatforms[0], before);
    const derived = e.deriveFloorTopology(history.present).floor;
    const project = {
      schemaVersion: 1,
      seedRevision: "test",
      home: e.neutralDemoManifest.home,
      floor: layoutFloorFromEditorFloor(derived),
      sceneItems: [],
      roomProfiles: {},
      openingProfiles: {},
      shortcuts: [],
      assumptions: [],
    };
    const parsed = e.parseHomeProjectSchema(JSON.parse(JSON.stringify(project)));
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
    const composedFloor = e.composeHomeManifest(parsed.project, e.neutralDemoManifest.extensions)
      .floors[0];
    assert.deepEqual(composedFloor.outdoorPlatforms, [before]);
    assert.equal(
      e
        .deriveWalkColliders(composedFloor)
        .find((collider) => collider.id.startsWith(before.edges[1].id))?.maxY,
      1.1,
    );
  });
  test("facade suppression includes door spans and rails produce exposed-edge colliders", () => {
    const floor = roomFloor();
    floor.outdoorPlatforms = [platform()];
    floor.openings = [
      {
        id: "door",
        wallId: "wall-1",
        kind: "passage",
        offsetFromWallStartPlanUnits: 1,
        widthPlanUnits: 1,
        openingHeightMeters: 2,
        sillHeightMeters: 0,
        variant: "rectangular",
      },
    ];
    const runs = e.deriveOutdoorPlatformBarriers(floor);
    assert.equal(runs.length, 3);
    assert.ok(runs.every((run) => run.edgeId !== "balcony:edge-3"));
    assert.equal(e.deriveWalkColliders(floor).filter((c) => c.id.startsWith("balcony:")).length, 3);
    floor.outdoorPlatforms[0].edges[1].configuration = { kind: "open" };
    assert.equal(e.deriveOutdoorPlatformBarriers(floor).length, 2);
  });
  test("open elevated edges preserve support boundary while platform interiors allow walking and spawn", () => {
    const ground = roomFloor(),
      upper = {
        ...roomFloor(),
        id: "upper",
        outdoorPlatforms: [{ ...platform(), defaultEdge: { kind: "open" } }],
      };
    const building = {
      coordinates: ground.coordinates,
      floors: [ground, upper],
      stairs: [],
      sceneItems: [],
    };
    const pose = { floorId: "upper", elevation: 2.6, x: 5, z: 2 };
    assert.ok(
      Math.abs(e.moveBuildingWalker(building, pose, { x: 0.2, z: 0 }, new Set()).x - 5.2) < 1e-8,
    );
    assert.equal(e.moveBuildingWalker(building, pose, { x: 2, z: 0 }, new Set()).x, 5);
    assert.ok(e.safeBuildingSpawn(building, "upper", [5, 2]));
    const terrace = {
      ...upper,
      footprint: platform().polygon,
      rooms: [],
      walls: [],
      wallJunctions: [],
      openings: [],
      ceilings: [],
    };
    assert.ok(
      e.safeBuildingSpawn({ ...building, floors: [ground, terrace] }, "upper"),
      "platform-only floor offers an automatic clear walking entry",
    );
  });
  test("three-level platforms mask lower roofs but never acquire ceilings or roof regions", () => {
    const ground = roomFloor();
    const upper = {
      ...roomFloor(),
      id: "upper",
      outdoorPlatforms: [
        platform([
          [-0.1, -0.1],
          [4.1, -0.1],
          [4.1, 4.1],
          [-0.1, 4.1],
        ]),
      ],
    };
    upper.rooms = [];
    upper.walls = [];
    upper.wallJunctions = [];
    upper.ceilings = [];
    const top = {
      ...roomFloor(),
      id: "top",
      footprint: square.map(([x, z]) => [x + 10, z]),
      rooms: roomFloor().rooms.map((r) => ({
        ...r,
        polygon: r.polygon.map(([x, z]) => [x + 10, z]),
      })),
      walls: roomFloor().walls.map((w) => ({
        ...w,
        from: [w.from[0] + 10, w.from[1]],
        to: [w.to[0] + 10, w.to[1]],
      })),
      wallJunctions: [],
      outdoorPlatforms: [
        platform(
          [
            [4, 0],
            [6, 0],
            [6, 4],
            [4, 4],
          ],
          "top-deck",
        ),
      ],
    };
    const regions = deriveRoofRegions([ground, upper, top]);
    assert.ok(
      !regions.some((r) => r.floorId === "ground"),
      "terrace support masks underlying roof",
    );
    assert.ok(!regions.some((r) => r.floorId === "upper"), "platform has no roof");
    assert.ok(
      regions
        .filter((r) => r.floorId === "top")
        .every((r) => r.polygon[0].every((p) => p[0] >= 9.8)),
      "top deck does not extend roof",
    );
  });
  test("platform-only storey composes without rooms, ceilings or wall classification changes", () => {
    const result = e.deriveFloorTopology({
      floorId: "terrace",
      floorName: "Roof terrace",
      walls: [],
      rooms: [],
      openings: [],
      outdoorPlatforms: [platform(square)],
    });
    assert.ok(result.floor);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.floor.rooms, []);
    assert.deepEqual(result.floor.ceilings, []);
    assert.equal(
      e.validateLayoutFloorSpec(result.floor).valid,
      true,
      JSON.stringify(e.validateLayoutFloorSpec(result.floor).issues),
    );
  });
  test("a platform-only floor envelope provides no invisible walking or placement support", () => {
    const ground = roomFloor(),
      upper = {
        ...roomFloor(),
        id: "upper",
        rooms: [],
        walls: [],
        wallJunctions: [],
        openings: [],
        ceilings: [],
        outdoorPlatforms: [{ ...platform(), defaultEdge: { kind: "open" } }],
      };
    assert.equal(e.validateLayoutFloorSpec(upper).valid, true);
    assert.deepEqual(e.floorSupportPolygons(upper), [platform().polygon]);
    const building = {
      coordinates: ground.coordinates,
      floors: [ground, upper],
      stairs: [],
      sceneItems: [],
    };
    assert.equal(e.safeBuildingSpawn(building, "upper", [2, 2]), null);
    assert.ok(e.safeBuildingSpawn(building, "upper", [5, 2]));
    assert.equal(
      e.moveBuildingWalker(
        building,
        { floorId: "upper", elevation: 2.6, x: 4.1, z: 2 },
        { x: -0.3, z: 0 },
        new Set(),
      ).x,
      4.1,
    );
    const definition = Object.values(stableFurnishingRegistry).find(
      (d) => d.placementEnvironment === "outdoor",
    );
    assert.equal(
      placementCandidate(
        { definition },
        { ...upper, elevationMeters: 2.6 },
        { at: [2, 2], kind: "absolute", raw: true },
      ).placement,
      null,
    );
    assert.ok(
      placementCandidate(
        { definition },
        { ...upper, elevationMeters: 2.6 },
        { at: [5, 2], kind: "absolute", raw: true },
      ).placement,
    );
    const indoor = Object.values(stableFurnishingRegistry).find(
      (d) => d.placementEnvironment !== "outdoor" && d.preferredPlacement === "absolute",
    );
    assert.equal(
      placementCandidate(
        { definition: indoor },
        { ...upper, elevationMeters: 2.6 },
        { at: [2, 2], kind: "absolute", raw: true },
      ).placement,
      null,
    );
    const seed = e.parseHomeProjectSchema({
      schemaVersion: 1,
      seedRevision: "support-gap",
      home: e.neutralDemoManifest.home,
      floor: layoutFloorFromEditorFloor(ground),
      sceneItems: [],
      roomProfiles: {},
      openingProfiles: {},
      shortcuts: [],
      assumptions: [],
    }).project;
    const modelId = Object.entries(stableFurnishingRegistry).find(([, d]) => d === definition)[0];
    const project = {
      ...seed,
      floors: [seed.floors[0], layoutFloorFromEditorFloor(upper)],
      sceneItems: [
        {
          id: "gap-item",
          floorId: "upper",
          kind: "furnishing",
          modelId,
          size: definition.defaultSize,
          placement: { kind: "absolute", at: [2, 2], elevationMeters: 0.001, rotationYRadians: 0 },
        },
      ],
    };
    assert.ok(
      e
        .validateHomeProject(project, {
          furnishingModels: stableFurnishingRegistry,
          deviceModels: {},
        })
        .issues.some((i) => i.code === "project.item-support"),
    );
  });
  test("a stair landing in a platform-only envelope gap is unsupported", () => {
    const building = makeStairProject();
    const upper = building.floors[1];
    upper.rooms = [];
    upper.walls = [];
    upper.wallJunctions = [];
    upper.ceilings = [];
    upper.openings = [];
    upper.outdoorPlatforms = [
      platform([
        [20, 0],
        [22, 0],
        [22, 4],
        [20, 4],
      ]),
    ];
    assert.ok(
      e
        .validateStairs(building)
        .some((i) => i.code === "stair.landing" && i.message.includes(upper.name)),
    );
  });
  test("inserting a corner keeps downstream edge overrides and creates a default edge", () => {
    const before = platform();
    before.edges[1].configuration = { kind: "low-wall", heightMeters: 0.42 };
    const next = e.platformWithPolygon(before, [
      before.polygon[0],
      [5, 0],
      ...before.polygon.slice(1),
    ]);
    assert.equal(next.edges[0].id, before.edges[0].id);
    assert.equal(next.edges[1].configuration, undefined);
    assert.deepEqual(next.edges[2], before.edges[1]);
  });
  test("autosave, reload and Apply retain platform edge overrides atomically", async () => {
    const floor = roomFloor();
    floor.outdoorPlatforms = [platform()];
    floor.outdoorPlatforms[0].edges[1].configuration = { kind: "low-wall", heightMeters: 0.42 };
    const seed = {
      schemaVersion: 1,
      seedRevision: "platform-test",
      home: { ...e.neutralDemoManifest.home, id: "platform-persistence" },
      floor: layoutFloorFromEditorFloor(roomFloor()),
      sceneItems: [],
      roomProfiles: {},
      openingProfiles: {},
      shortcuts: [],
      assumptions: [],
    };
    const parsed = e.parseHomeProjectSchema(seed);
    assert.equal(parsed.valid, true);
    const next = { ...parsed.project, floors: [layoutFloorFromEditorFloor(floor)] };
    const repository = e.createHomeProjectRepository(e.createMemoryProjectRecordStore(), {
      furnishingModels: {},
      deviceModels: {},
    });
    const initial = await repository.replace(e.createSeedProjectRecord(parsed.project, 1000));
    const saved = await e.autosaveHomeProjectDraft(repository, initial, next, 1100);
    assert.equal(saved.status, "saved");
    const reloaded = await repository.load(initial.homeId);
    assert.deepEqual(reloaded.draft.floors[0].outdoorPlatforms, floor.outdoorPlatforms);
    const applied = await e.publishHomeProject(repository, reloaded, { now: 1200 });
    assert.equal(applied.status, "published");
    assert.deepEqual(
      (await repository.load(initial.homeId)).published.floors[0].outdoorPlatforms,
      floor.outdoorPlatforms,
    );
    const invalid = structuredClone(next);
    invalid.floors[0].outdoorPlatforms[0].polygon = [
      [4, 0],
      [6, 4],
      [6, 0],
      [4, 4],
    ];
    const invalidSaved = await e.autosaveHomeProjectDraft(
      repository,
      applied.record,
      invalid,
      1300,
    );
    assert.equal(invalidSaved.status, "saved");
    assert.equal(
      (await e.publishHomeProject(repository, invalidSaved.record, { now: 1400 })).status,
      "blocked",
    );
    assert.deepEqual(
      (await repository.load(initial.homeId)).published.floors[0].outdoorPlatforms,
      floor.outdoorPlatforms,
    );
  });
  test("platforms support outdoor furniture and elevated positions require physical support", async () => {
    const definition = Object.values(stableFurnishingRegistry).find(
      (d) => d.placementEnvironment === "outdoor",
    );
    assert.ok(definition);
    const ground = roomFloor(),
      upper = { ...roomFloor(), id: "upper", outdoorPlatforms: [platform()] };
    const candidate = placementCandidate(
      { definition },
      { ...upper, elevationMeters: 2.6 },
      { at: [5, 2], kind: "absolute", raw: true },
    );
    assert.ok(candidate.placement);
    assert.equal(
      placementCandidate(
        { definition },
        { ...upper, elevationMeters: 2.6 },
        { at: [9, 2], kind: "absolute", raw: true },
      ).placement,
      null,
    );
    const legacy = {
      schemaVersion: 1,
      seedRevision: "placement-test",
      home: e.neutralDemoManifest.home,
      floor: layoutFloorFromEditorFloor(ground),
      sceneItems: [],
      roomProfiles: {},
      openingProfiles: {},
      shortcuts: [],
      assumptions: [],
    };
    const parsed = e.parseHomeProjectSchema(legacy);
    const upperLayout = layoutFloorFromEditorFloor(upper);
    upperLayout.rooms = upperLayout.rooms.map((r) => ({ ...r, id: `upper:${r.id}` }));
    upperLayout.walls = upperLayout.walls.map((w) => ({ ...w, id: `upper:${w.id}` }));
    upperLayout.wallJunctions = upperLayout.wallJunctions.map((j) => ({
      ...j,
      id: `upper:${j.id}`,
      wallIds: j.wallIds.map((id) => `upper:${id}`),
    }));
    upperLayout.ceilings = upperLayout.ceilings.map((c) => ({
      ...c,
      id: `upper:${c.id}`,
      roomIds: c.roomIds.map((id) => `upper:${id}`),
    }));
    const modelId = Object.entries(stableFurnishingRegistry).find(([, d]) => d === definition)[0];
    const project = {
      ...parsed.project,
      floors: [parsed.project.floors[0], upperLayout],
      sceneItems: [
        {
          id: "outdoor-item",
          floorId: "upper",
          kind: "furnishing",
          modelId,
          size: definition.defaultSize,
          placement: candidate.placement,
        },
      ],
    };
    const registries = { furnishingModels: stableFurnishingRegistry, deviceModels: {} };
    assert.equal(
      e.validateHomeProject(project, registries).valid,
      true,
      JSON.stringify(e.validateHomeProject(project, registries).issues),
    );
    project.sceneItems[0].placement.at = [9, 2];
    assert.ok(
      e
        .validateHomeProject(project, registries)
        .issues.some((i) => i.code === "project.item-support"),
    );
  });
  test("a stair landing on a platform does not produce an unsupported-landing warning", async () => {
    const building = makeStairProject();
    const flight = e.deriveStairFlight(building, building.stairs[0]);
    const upper = building.floors[1];
    const xs = flight.upperLanding.map((p) => p[0]),
      zs = flight.upperLanding.map((p) => p[1]);
    const polygon = [
      [Math.min(...xs) - 0.1, Math.min(...zs) - 0.1],
      [Math.max(...xs) + 0.1, Math.min(...zs) - 0.1],
      [Math.max(...xs) + 0.1, Math.max(...zs) + 0.1],
      [Math.min(...xs) - 0.1, Math.max(...zs) + 0.1],
    ];
    upper.footprint = [];
    upper.rooms = [];
    upper.walls = [];
    upper.wallJunctions = [];
    upper.ceilings = [];
    upper.outdoorPlatforms = [platform(polygon)];
    assert.ok(
      !e
        .validateStairs(building)
        .some((i) => i.code === "stair.landing" && i.message.includes(upper.name)),
    );
  });
  test("platform slabs retain a 2.55 m authored ceiling under a 2.6 m storey", () => {
    const below = roomFloor();
    below.floorToFloorHeightMeters = 2.6;
    below.defaultCeilingHeightMeters = 2.55;
    below.ceilings = below.ceilings.map((c) => ({ ...c, heightMeters: 2.55 }));
    const upper = { ...roomFloor(), id: "upper", outdoorPlatforms: [platform(square)] };
    const pieces = e.derivePlatformSlabPieces(upper.outdoorPlatforms[0], upper, below);
    assert.equal(pieces.length, 1);
    assert.ok(Math.abs(pieces[0].depth - 0.05) < 1e-8);
    assert.ok(Math.abs(2.6 + pieces[0].bottom - 2.55) < 1e-8);
  });
  test("rendered low walls stay at .3 m with a higher floor while full walls fill the real slab", () => {
    const floor = roomFloor();
    const above = { ...roomFloor(), id: "upper" };
    floor.walls = floor.walls.map((w) => ({ ...w, heightMeters: 0.3 }));
    const short = e.buildArchitecturalWallGeometries(floor, "#fff", "#aaa", 0, { above });
    assert.ok(short.length);
    for (const group of short) {
      const geometry = group.geometry ?? group;
      const position = geometry.getAttribute("position");
      assert.ok(
        Array.from({ length: position.count }, (_, i) => position.getY(i)).every(
          (y) => y <= 0.300001,
        ),
      );
      geometry.dispose();
    }
    floor.walls = floor.walls.map(({ heightMeters, ...w }) => w);
    const full = e.buildArchitecturalWallGeometries(floor, "#fff", "#aaa", 0, { above });
    assert.ok(
      full.some((group) => {
        const position = group.geometry.getAttribute("position");
        return Array.from({ length: position.count }, (_, i) => position.getY(i)).some(
          (y) => y >= floor.floorToFloorHeightMeters - 0.000001,
        );
      }),
    );
    full.forEach((group) => group.geometry.dispose());
  });
  test("explicit short exterior walls retain authored height with another floor", () => {
    const floor = roomFloor();
    floor.walls = floor.walls.map((w) => ({ ...w, heightMeters: 0.3 }));
    assert.deepEqual(wallLevelContact(floor, "top"), []);
  });
});
