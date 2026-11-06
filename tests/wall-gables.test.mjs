import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { buildArchitecturalWallGeometries, buildWallGableGlass } = await load(
    "/packages/engine/src/architecture-geometry.ts",
  );
  const { wallCeilingProfile, wallGableShapes } = await load(
    "/packages/engine/src/architecture-geometry/wall-gable-geometry.ts",
  );
  const { buildRoofGeometries } = await load("/packages/engine/src/roof/roof-geometry.ts");
  const { parseHomeProject, serializeHomeProject } = await load(
    "/packages/engine/src/home-project/serialization.ts",
  );
  const { validateWalls } = await load("/packages/engine/src/validation/wall-rules.ts");
  const { makeThreeFloorProject } = await load("/tests/fixtures/multiple-floors.ts");
  const {
    createHomeProjectLifecycle,
    createHomeProjectRepository,
    createMemoryProjectRecordStore,
  } = await load("/packages/engine/src/index.ts");
  const { exportWorkspaceBackup, parseWorkspaceImport } = await load(
    "/apps/web/src/workspaces/workspace-transfer.ts",
  );
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");

  // An 8 m wide A-frame, 6 m deep: knee walls of 1 m on both sides, ridge at
  // 5 m along x = 4. The gable wall runs across the front at y = 0.
  const knee = 1;
  const ridge = 5;
  const plane = (id, x0) => ({
    id,
    boundary: [
      [x0, 0],
      [4, 0],
      [4, 6],
      [x0, 6],
    ],
    lowEdge: [
      [x0, 0],
      [x0, 6],
    ],
    highEdge: [
      [4, 0],
      [4, 6],
    ],
    lowHeightMeters: knee,
    highHeightMeters: ridge,
  });
  const aFrame = (gable, openings = []) => {
    const wall = (id, from, to, extra = {}) => ({
      id,
      from,
      to,
      classification: "exterior",
      thicknessMeters: 0.2,
      ...extra,
    });
    return {
      id: "ground",
      name: "Ground",
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      floorToFloorHeightMeters: 3,
      defaultWallHeightMeters: 2.5,
      defaultCeilingHeightMeters: 2.5,
      footprint: [
        [0, 0],
        [8, 0],
        [8, 6],
        [0, 6],
      ],
      rooms: [
        {
          id: "living",
          name: "Living",
          polygon: [
            [0.1, 0.1],
            [7.9, 0.1],
            [7.9, 5.9],
            [0.1, 5.9],
          ],
          accent: "#ffffff",
          devices: [],
          dashboardSlots: [],
        },
      ],
      walls: [
        wall("front", [0, 0], [8, 0], { heightMeters: 2.4, ...(gable ? { gable } : {}) }),
        wall("east", [8, 0], [8, 6], { heightMeters: knee }),
        wall("back", [8, 6], [0, 6], { heightMeters: knee }),
        wall("west", [0, 6], [0, 0], { heightMeters: knee }),
      ],
      wallJunctions: [],
      openings,
      ceilings: [
        {
          id: "a-frame",
          kind: "sloped",
          roomIds: ["living"],
          planes: [plane("west", 0), plane("east", 8)],
        },
      ],
    };
  };
  const near = (actual, expected, tolerance = 0.001) =>
    assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
  const heights = (geometry) => {
    const p = geometry.attributes.position.array;
    return Array.from({ length: p.length / 3 }, (_, i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
  };
  const polygonArea = (multi) =>
    multi.reduce(
      (sum, polygon) =>
        sum +
        polygon.reduce((ringSum, ring, index) => {
          let twice = 0;
          for (let i = 0; i < ring.length - 1; i++)
            twice += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
          return ringSum + (index ? -1 : 1) * Math.abs(twice / 2);
        }, 0),
      0,
    );

  test("a wall under an A-frame reads the ceiling's two slopes as one gable profile", () => {
    const floor = aFrame({ fill: "solid" });
    const [run, ...rest] = wallCeilingProfile(floor.walls[0], floor);
    assert.equal(rest.length, 0);
    assert.deepEqual(
      run.map(([s, h]) => [Math.round(s * 1000) / 1000, Math.round(h * 1000) / 1000]),
      [
        [0, knee],
        [4, ridge],
        [8, knee],
      ],
    );
    // The knee walls run under the low edges, so their profile is flat.
    for (const run of wallCeilingProfile(floor.walls[1], floor))
      for (const [, h] of run) near(h, knee);
  });

  test("a solid gable rises to the ridge and never above either slope", () => {
    const floor = aFrame({ fill: "solid" });
    const shapes = wallGableShapes(floor.walls[0], floor, []);
    assert.equal(shapes.bandTop, knee);
    // The pentagon between the knee line and the two slopes.
    near(polygonArea(shapes.solid), (8 * (ridge - knee)) / 2);
    const vertices = buildArchitecturalWallGeometries(floor).flatMap(({ geometry }) =>
      heights(geometry),
    );
    near(Math.max(...vertices.map(([, y]) => y)), ridge);
    for (const [x, y, z] of vertices) {
      if (Math.abs(z) > 0.11) continue;
      const roof = knee + (ridge - knee) * (1 - Math.min(1, Math.abs(x - 4) / 4));
      assert.ok(y <= roof + 0.06, `wall point (${x}, ${y}) pokes through the ceiling at ${roof}`);
    }
  });

  test("a glass gable sits on its header with frames, mullions and transoms", () => {
    const slider = {
      id: "slider",
      kind: "door",
      wallId: "front",
      offsetFromWallStartPlanUnits: 2.5,
      widthPlanUnits: 3,
      sillHeightMeters: 0,
      openingHeightMeters: 2.1,
      operation: "sliding",
      variant: "full-glass",
      leafCount: 2,
    };
    const floor = aFrame(
      { fill: "glass", columns: 2, transomHeightsMeters: [3.5], frameColor: "#222222" },
      [slider],
    );
    const shapes = wallGableShapes(floor.walls[0], floor, floor.openings);
    // The wall below the header is cut to the slopes near the corners.
    assert.equal(shapes.bandTop, knee);
    const total = polygonArea(shapes.glass) + polygonArea(shapes.frame);
    const above = polygonArea(shapes.solid);
    // The triangle above the 2.4 m header: 5.2 m wide there, 2.6 m tall.
    near(total, (5.2 * 2.6) / 2);
    assert.ok(polygonArea(shapes.frame) < total / 3);
    // A mullion at the ridge and a transom at 3.5 m split the glass.
    assert.ok(shapes.glass.length >= 4, `${shapes.glass.length} panes`);
    assert.ok(above > 0, "the corners under the header stay solid");
    const glass = buildWallGableGlass(floor);
    assert.equal(glass.length, 1);
    const points = heights(glass[0].geometry);
    near(Math.min(...points.map(([, y]) => y)), 2.4 + 0.05, 0.002);
    assert.ok(Math.max(...points.map(([, y]) => y)) < ridge);
  });

  test("the roof follows the A without a ridge wall, and leaves a glass gable open", () => {
    const solid = buildRoofGeometries([aFrame({ fill: "solid" })]);
    const glass = buildRoofGeometries([aFrame({ fill: "glass" })]);
    const plain = buildRoofGeometries([aFrame(undefined)]);
    for (const geometry of [solid, glass, plain]) {
      // No infill stands along the ridge between the two halves. Its triangles
      // would reach the peak at both ends and stand along the ridge between.
      const p = geometry.infill.attributes.position.array;
      const ridgeTriangles = [];
      for (let i = 0; i < p.length; i += 9)
        if ([0, 3, 6].every((o) => Math.abs(p[i + o] - 4) < 0.01)) ridgeTriangles.push(i);
      assert.deepEqual(ridgeTriangles, []);
      const ridgeWall = heights(geometry.infill).filter(
        // The back gable (a plain wall) still closes the A with infill at z = 6.
        ([x, y, z]) => Math.abs(x - 4) < 0.01 && z > 0.01 && z < 5.99 && y > knee + 0.5,
      );
      assert.deepEqual(ridgeWall, []);
    }
    const frontInfill = (geometry) =>
      heights(geometry.infill).filter(([, y, z]) => Math.abs(z) < 0.01 && y > knee + 0.5);
    assert.ok(frontInfill(plain).length > 0, "a plain wall still gets roof infill above it");
    assert.deepEqual(frontInfill(glass), []);
    for (const geometry of [solid, glass, plain])
      Object.values(geometry).forEach((part) => part.dispose());
  });

  // An A carried over two floors.
  const twoFloorAFrame = (gable = { fill: "solid" }) => {
    // The lower floor's A covers y 0–3; the floor above carries it on from y 3
    // at the same heights, 3 m lower in its own coordinates.
    const lower = aFrame(gable);
    lower.ceilings[0].planes = lower.ceilings[0].planes.map((plane) => ({
      ...plane,
      boundary: plane.boundary.map(([x, y]) => [x, Math.min(y, 3)]),
    }));
    const upper = {
      ...aFrame(undefined),
      id: "upper",
      footprint: [
        [0, 3],
        [8, 3],
        [8, 6],
        [0, 6],
      ],
      rooms: [
        {
          ...lower.rooms[0],
          id: "upper-room",
          polygon: [
            [0.1, 3.1],
            [7.9, 3.1],
            [7.9, 5.9],
            [0.1, 5.9],
          ],
        },
      ],
      walls: [],
    };
    upper.ceilings = [
      {
        id: "upper-a",
        kind: "sloped",
        roomIds: ["upper-room"],
        planes: [plane("west", 0), plane("east", 8)].map((p) => ({
          ...p,
          boundary: p.boundary.map(([x, y]) => [x, Math.max(y, 3)]),
          lowHeightMeters: knee - 3,
          highHeightMeters: ridge - 3,
        })),
      },
    ];
    return [lower, upper];
  };

  test("an A carried over two floors joins without infill between them", () => {
    const [lower, upper] = twoFloorAFrame();
    const roof = buildRoofGeometries([lower, upper]);
    const joint = heights(roof.infill).filter(
      ([, y, z]) => Math.abs(z - 3) < 0.01 && y > knee + 0.5,
    );
    assert.deepEqual(joint, []);
    Object.values(roof).forEach((part) => part.dispose());
  });

  test("projects save sloped ceilings and wall gables, and reject malformed ones", () => {
    const project = makeThreeFloorProject();
    const floor = aFrame({ fill: "glass", columns: 3, transomHeightsMeters: [3] });
    const [ground, ...rest] = project.floors;
    const next = {
      ...project,
      floors: [
        {
          ...ground,
          rooms: floor.rooms,
          footprint: floor.footprint,
          walls: floor.walls,
          wallJunctions: [],
          openings: [],
          ceilings: floor.ceilings,
          coordinates: floor.coordinates,
        },
        ...rest,
      ],
    };
    const parsed = parseHomeProject(serializeHomeProject(next));
    assert.deepEqual(
      (parsed.issues ?? []).filter((issue) => /ceiling|gable/.test(issue.path)),
      [],
    );
    assert.equal(parsed.project.floors[0].ceilings[0].kind, "sloped");
    assert.equal(parsed.project.floors[0].walls[0].gable.columns, 3);
    const broken = structuredClone(next);
    broken.floors[0].walls[0].gable = { fill: "stained", columns: 0 };
    broken.floors[0].ceilings[0].planes[0].lowEdge = [[0, 0]];
    const paths = parseHomeProject(serializeHomeProject(broken)).issues.map((issue) => issue.path);
    assert.ok(paths.some((path) => path.endsWith("walls[0].gable.fill")));
    assert.ok(paths.some((path) => path.endsWith("walls[0].gable.columns")));
    assert.ok(paths.some((path) => path.endsWith("planes[0].lowEdge")));
    const { issues } = validateWalls(aFrame({ fill: "stained" }), "floor", {
      input: {},
      options: {},
      ids: new Map(),
    });
    assert.ok(issues.some((issue) => issue.code === "wall.gable"));
  });

  test("a two-floor A-frame survives import, save and a backup round trip", async () => {
    const [lower, upper] = twoFloorAFrame({
      fill: "glass",
      frameColor: "#2b2b2b",
      columns: 4,
      transomHeightsMeters: [2.4, 3.6],
    });
    // Corners and walls of a plain box, all at one height.
    const box = (prefix, [x0, y0], [x1, y1], heightMeters) => {
      const corners = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ];
      const ids = ["front", "east", "back", "west"].map((side) => `${prefix}${side}`);
      return {
        walls: ids.map((id, i) => ({
          id,
          from: corners[i],
          to: corners[(i + 1) % 4],
          classification: "exterior",
          thicknessMeters: 0.2,
          heightMeters,
        })),
        wallJunctions: corners.map((at, i) => ({
          id: `${prefix}corner-${i}`,
          at,
          wallIds: [ids[(i + 3) % 4], ids[i]],
        })),
      };
    };
    // The loft stands where the A clears its floor: 0.5 m knee walls at x 2.5 and 5.5.
    const loft = {
      ...upper,
      name: "Loft",
      footprint: [
        [2.5, 3],
        [5.5, 3],
        [5.5, 6],
        [2.5, 6],
      ],
      rooms: [
        {
          ...upper.rooms[0],
          polygon: [
            [2.6, 3.1],
            [5.4, 3.1],
            [5.4, 5.9],
            [2.6, 5.9],
          ],
        },
      ],
      ...box("loft-", [2.5, 3], [5.5, 6], 0.5),
      ceilings: upper.ceilings.map((ceiling) => ({
        ...ceiling,
        planes: ceiling.planes.map((p) => ({ ...p, id: `loft-${p.id}` })),
      })),
    };
    const ground = { ...lower, wallJunctions: box("", [0, 0], [8, 6], knee).wallJunctions };
    const base = makeThreeFloorProject();
    const project = {
      ...base,
      floors: [ground, loft].map((floor, index) => ({ ...base.floors[index], ...floor })),
    };
    const shape = (home) =>
      home.floors.map((floor) => ({
        ceilings: floor.ceilings,
        gables: floor.walls.filter((wall) => wall.gable).map(({ id, gable }) => ({ id, gable })),
      }));
    const expected = shape(project);
    assert.equal(expected[0].gables.length, 1);
    assert.equal(expected[1].ceilings[0].kind, "sloped");

    const imported = parseWorkspaceImport(JSON.stringify(project), ownerProjectRegistries);
    assert.deepEqual(shape(imported.record.draft), expected);

    const repository = createHomeProjectRepository(
      createMemoryProjectRecordStore(),
      ownerProjectRegistries,
    );
    const lifecycle = createHomeProjectLifecycle(repository, imported.record.draft);
    const loaded = await lifecycle.load();
    const saved = await lifecycle.autosave(loaded.record, imported.record.draft);
    assert.equal(saved.status, "saved");
    const stored = await repository.load(project.home.id);
    assert.deepEqual(shape(stored.draft), expected);

    const backup = exportWorkspaceBackup(
      { name: "A-frame", homeAssistantUrl: null, hasPublished: stored.publishedAt !== 0 },
      stored,
    );
    const restored = parseWorkspaceImport(backup, ownerProjectRegistries);
    assert.deepEqual(shape(restored.record.draft), expected);
  });
});
