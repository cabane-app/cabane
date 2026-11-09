import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { elevationAreas, transitionBands, localSurfaceAt } = await load(
    "/packages/engine/src/elevation/surfaces.ts",
  );
  const { validateElevationAreas } = await load("/packages/engine/src/elevation/validation.ts");
  const { ceilingHeightAt } = await load("/packages/engine/src/elevation/ceilings.ts");
  const { resolveStairConnection } = await load("/packages/engine/src/stairs/stair-connection.ts");
  const { makeStairProject } = await load("/tests/fixtures/multiple-floors.ts");
  const { resolveTerrainWalking } = await load(
    "/packages/engine/src/navigation/terrain-walking.ts",
  );
  const { deriveStairFlight } = await load("/packages/engine/src/stairs/flight-geometry.ts");
  const { resolveWalkLanding } = await load("/packages/engine/src/navigation/walk-landing.ts");
  const { resolveWalkFall } = await load("/packages/engine/src/navigation/walk-fall.ts");
  const { elevationWalkable } = await load("/packages/engine/src/elevation/walk-support.ts");
  const { validateElevationStoreys } = await load(
    "/packages/engine/src/elevation/building-validation.ts",
  );
  const { moveBuildingWalker, safeBuildingSpawn } = await load(
    "/packages/engine/src/stairs/stair-navigation.ts",
  );
  const { stairEndSupported } = await load("/packages/engine/src/stairs/stair-landing-support.ts");
  const polygon = [
    [1, 1],
    [3, 1],
    [3, 3],
    [1, 3],
  ];
  function fixture(offset = -0.34) {
    const project = makeStairProject();
    project.floors = [project.floors[0]];
    project.stairs = [];
    const floor = project.floors[0];
    floor.coordinates = { ...floor.coordinates, metersPerPlanUnit: 1 };
    floor.rooms = [
      {
        ...floor.rooms[0],
        polygon: [
          [0, 0],
          [8, 0],
          [8, 8],
          [0, 8],
        ],
        floorZones: [
          {
            id: "sunken",
            polygon,
            finish: { kind: "solid", color: "#cccccc" },
            elevation: {
              offsetMeters: offset,
              edges: polygon.map((_, i) => ({ id: `edge-${i}` })),
            },
          },
        ],
      },
    ];
    return project;
  }
  test("bounded positive and negative elevations leave the room identity and surrounding height intact", () => {
    for (const offset of [-0.34, 0.6]) {
      const p = fixture(offset),
        floor = p.floors[0];
      assert.equal(localSurfaceAt(floor, [2, 2]).elevation, offset);
      assert.equal(localSurfaceAt(floor, [5, 5]).elevation, 0);
      assert.equal(localSurfaceAt(floor, [2, 2]).floorId, floor.id);
      assert.equal(floor.rooms.length, 1);
      const parsed = api.parseHomeProjectSchema(JSON.parse(JSON.stringify(p)));
      assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
      assert.equal(parsed.project.floors[0].rooms[0].floorZones[0].elevation.offsetMeters, offset);
    }
  });
  test("slopes interpolate outside the flat footprint and preserve shared corners", () => {
    const floor = fixture().floors[0];
    const zone = floor.rooms[0].floorZones[0];
    zone.elevation.edges = zone.elevation.edges.map((edge) => ({
      ...edge,
      transition: { kind: "sloped", widthMeters: 0.5 },
    }));
    const area = elevationAreas(floor)[0];
    const bands = transitionBands(area, 1);
    assert.equal(bands.length, 4);
    assert.equal(localSurfaceAt(floor, [2, 2]).elevation, -0.34);
    assert.ok(Math.abs(localSurfaceAt(floor, [2, 0.75]).elevation + 0.17) < 1e-8);
    assert.equal(localSurfaceAt(floor, [2, 0.4]).elevation, 0);
    assert.equal(validateElevationAreas(floor).length, 0);
  });
  test("overlap, nesting and transitions outside a room are rejected", () => {
    const floor = fixture().floors[0],
      zone = floor.rooms[0].floorZones[0];
    floor.rooms[0].floorZones.push({ ...structuredClone(zone), id: "overlap" });
    assert.ok(validateElevationAreas(floor).some((i) => i.message.includes("overlap")));
    floor.rooms[0].floorZones.pop();
    zone.elevation.edges[0].transition = { kind: "sloped", widthMeters: 2 };
    assert.ok(validateElevationAreas(floor).some((i) => i.message.includes("inside the room")));
  });
  test("ceiling inheritance and relative object placement resolve independently", () => {
    const floor = fixture().floors[0],
      room = floor.rooms[0];
    const before = ceilingHeightAt(floor, room.id, [2, 2]);
    const p = { kind: "absolute", at: [2, 2], elevationMeters: 0.1, rotationYRadians: 0 };
    assert.equal(api.resolveItemTransform(p, floor).position[1], 0.1);
    assert.ok(
      Math.abs(
        api.resolveItemTransform({ ...p, surfaceRelative: true }, floor).position[1] + 0.24,
      ) < 1e-8,
    );
    room.floorZones[0].elevation.ceilingHeightMeters = 3.2;
    assert.ok(Math.abs(ceilingHeightAt(floor, room.id, [2, 2]) - 2.86) < 1e-8);
    assert.equal(ceilingHeightAt(floor, room.id, [5, 5]), before);
  });
  test("same-storey stairs follow both endpoint surfaces after height edits", () => {
    const p = fixture(),
      floor = p.floors[0];
    const stair = {
      id: "steps",
      terrain: { floorId: floor.id, end: "lower", surfaces: true },
      at: [2, 2],
      rotationYRadians: 0,
      widthMeters: 0.8,
      runMeters: 2,
    };
    const connection = resolveStairConnection(p, stair);
    assert.equal(connection.lowerFloorId, floor.id);
    assert.equal(connection.upperFloorId, floor.id);
    assert.equal(connection.baseElevationMeters, -0.34);
    assert.equal(connection.riseMeters, 0.34);
    floor.rooms[0].floorZones[0].elevation.offsetMeters = -0.5;
    assert.equal(resolveStairConnection(p, stair).riseMeters, 0.5);
  });
  test("walking retains the storey and follows a sunken area without snapping to base height", () => {
    const project = fixture(),
      floor = project.floors[0];
    const pose = { x: 2, z: 2, yaw: 0, pitch: 0, floorId: floor.id, elevation: -0.34 };
    const next = resolveTerrainWalking(project, pose, { ...pose, x: 2.1 }, () => null);
    assert.equal(next.elevation, -0.34);
    assert.equal(next.floorId, floor.id);
    assert.deepEqual(
      resolveTerrainWalking(project, pose, { ...pose, x: 3.1 }, () => null),
      pose,
      "a sharp 34 cm rise requires stairs",
    );
  });
  test("walking off a sharp edge starts a fall without a jump and cannot climb back up", () => {
    const project = fixture(-2),
      floor = project.floors[0];
    const pose = { x: 2, z: 0.95, yaw: 0, pitch: 0, floorId: floor.id, elevation: 0 };
    const next = resolveTerrainWalking(project, pose, { ...pose, z: 1.05 }, () => null);
    assert.equal(next.z, 1.05);
    assert.equal(next.elevation, 0, "retain feet height until gravity takes over");
    const fall = resolveWalkFall(project, next, pose.elevation, () => false);
    assert.equal(fall.kind, "fall");
    assert.equal(fall.jumpHeight, 2);
    assert.equal(fall.point.elevation, -2);
    assert.equal(fall.point.floorId, floor.id);
    assert.deepEqual(
      resolveTerrainWalking(project, fall.point, { ...fall.point, z: 0.95 }, () => null),
      fall.point,
    );
  });
  test("stairs reverse their physical ascent when endpoint elevations swap", () => {
    const project = fixture(0.5),
      floor = project.floors[0];
    const stair = {
      id: "reverse",
      terrain: { floorId: floor.id, end: "lower", surfaces: true },
      at: [2, 2],
      rotationYRadians: 0,
      widthMeters: 0.8,
      runMeters: 2,
    };
    const flight = deriveStairFlight(project, stair);
    assert.equal(flight.baseElevationMeters, 0);
    assert.equal(flight.riseMeters, 0.5);
    assert.equal(flight.lowerFloorId, floor.id);
    assert.equal(flight.upperFloorId, floor.id);
  });
  test("relocation and airborne landing use the local support, even far below a storey", () => {
    const project = fixture(-1.4),
      floor = project.floors[0];
    const landing = resolveWalkLanding(project, { x: 2, y: -1.4, z: 2 }, () => []);
    assert.equal(landing.floorId, floor.id);
    assert.equal(landing.elevation, -1.4);
    const fall = resolveWalkFall(
      project,
      { x: 2, z: 2, floorId: floor.id, elevation: 0 },
      0.6,
      () => false,
    );
    assert.equal(fall.kind, "fall");
    assert.equal(fall.point.elevation, -1.4);
    assert.equal(fall.jumpHeight, 2);
  });
  test("steep transitions and insufficient local headroom reject walking", () => {
    const floor = fixture(-0.5).floors[0];
    const area = floor.rooms[0].floorZones[0];
    area.elevation.edges[0].transition = { kind: "sloped", widthMeters: 0.1 };
    assert.equal(elevationWalkable(floor, [2, 0.95]), false);
    area.elevation.edges[0].transition.widthMeters = 1;
    assert.equal(elevationWalkable(floor, [2, 0.5]), true);
    area.elevation.ceilingHeightMeters = 1.6;
    assert.equal(elevationWalkable(floor, [2, 2]), false);
  });
  test("a local ceiling reports a neighbouring-storey conflict without changing storey levels", () => {
    const project = fixture(),
      floor = project.floors[0];
    const upper = structuredClone(floor);
    upper.id = "upper";
    upper.rooms[0].floorZones = [];
    project.floors.push(upper);
    floor.rooms[0].floorZones[0].elevation.ceilingHeightMeters = 3.2;
    assert.ok(
      validateElevationStoreys(project).some((issue) => issue.code === "elevation.storey-conflict"),
    );
    floor.rooms[0].floorZones[0].elevation.ceilingHeightMeters = 2.6;
    assert.equal(validateElevationStoreys(project).length, 0);
  });
  test("terrace stairs meet terrain, keep their storey during traversal and reject partial landings", () => {
    const project = fixture(),
      floor = project.floors[0];
    floor.rooms = [];
    const platform = {
      id: "terrace",
      polygon: [
        [10, 10],
        [12, 10],
        [12, 12],
        [10, 12],
      ],
      finish: { kind: "solid", color: "#aaaaaa" },
      edges: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, kind: "open" })),
      elevation: { offsetMeters: -0.5, edges: [0, 1, 2, 3].map((i) => ({ id: `p${i}` })) },
    };
    floor.outdoorPlatforms = [platform];
    const stair = {
      id: "terrace-steps",
      terrain: { floorId: floor.id, end: "upper", surfaces: true },
      at: [11, 11],
      rotationYRadians: 0,
      widthMeters: 0.8,
      runMeters: 2,
    };
    project.stairs = [stair];
    const flight = deriveStairFlight(project, stair);
    assert.ok(Math.abs(flight.riseMeters - 0.45) < 1e-8);
    assert.equal(stairEndSupported(project, flight, false), true);
    assert.equal(stairEndSupported(project, flight, true), true);
    let pose = { x: 11, z: 10.99, floorId: floor.id, elevation: -0.5 };
    for (let i = 0; i < 48; i++)
      pose = moveBuildingWalker(
        project,
        pose,
        { x: 0, z: 0.05 },
        new Set(),
        [],
        undefined,
        {},
        { terrainHeight: () => -0.05 },
      );
    assert.ok(pose.z > 13.2, `must leave the upper landing: ${JSON.stringify(pose)}`);
    assert.equal(pose.floorId, floor.id);
    assert.equal(pose.elevation, -0.05);
    const unsupported = deriveStairFlight(project, { ...stair, at: [11.9, 11] });
    assert.equal(
      stairEndSupported(project, unsupported, false),
      false,
      "the whole landing must be supported",
    );
    floor.outdoorPlatforms.push({
      ...structuredClone(platform),
      id: "second-terrace",
      polygon: [
        [10, 12.8],
        [12, 12.8],
        [12, 15],
        [10, 15],
      ],
      elevation: { ...platform.elevation, offsetMeters: -0.2 },
    });
    assert.ok(Math.abs(deriveStairFlight(project, stair).riseMeters - 0.3) < 1e-8);
    assert.equal(stairEndSupported(project, deriveStairFlight(project, stair), true), true);
  });
  test("removing an area restores attached objects to their underlying floor", () => {
    const floor = fixture().floors[0];
    const placement = {
      kind: "absolute",
      at: [2, 2],
      elevationMeters: 0.07,
      rotationYRadians: 0,
      surfaceRelative: true,
    };
    assert.ok(Math.abs(api.resolveItemTransform(placement, floor).position[1] + 0.27) < 1e-8);
    floor.rooms[0].floorZones = [];
    assert.equal(api.resolveItemTransform(placement, floor).position[1], 0.07);
  });
  test("concave areas keep the notch outside the flat surface and close their slope corners", () => {
    const floor = fixture(0.3).floors[0],
      zone = floor.rooms[0].floorZones[0];
    zone.polygon = [
      [1, 1],
      [4, 1],
      [4, 2],
      [2, 2],
      [2, 4],
      [1, 4],
    ];
    zone.elevation.edges = zone.polygon.map((_, i) => ({
      id: `c${i}`,
      transition: { kind: "sloped", widthMeters: 0.2 },
    }));
    assert.equal(localSurfaceAt(floor, [1.5, 3]).elevation, 0.3);
    assert.equal(localSurfaceAt(floor, [3, 3]).elevation, 0);
    assert.ok(Math.abs(localSurfaceAt(floor, [3, 2.1]).elevation - 0.15) < 1e-8);
    assert.equal(validateElevationAreas(floor).length, 0);
  });
  test("spawn checks short furniture at the lowered surface height", () => {
    const project = fixture(-1.4),
      floor = project.floors[0];
    project.sceneItems = [
      {
        id: "low-table",
        kind: "furnishing",
        modelId: "fixture-table",
        floorId: floor.id,
        size: [0.6, 0.3, 0.6],
        placement: {
          kind: "absolute",
          at: [2, 2],
          elevationMeters: 0,
          rotationYRadians: 0,
          surfaceRelative: true,
        },
      },
    ];
    assert.equal(safeBuildingSpawn(project, floor.id, [2, 2]), null);
    assert.ok(safeBuildingSpawn(project, floor.id, [1.3, 1.3]));
  });
});
