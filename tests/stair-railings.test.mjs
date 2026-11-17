import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";
await withModules(async (load) => {
  const { deriveStairFlight } = await load("/packages/engine/src/stairs/flight-geometry.ts");
  const { deriveStairGuardSegments } = await load("/packages/engine/src/stairs/guard-geometry.ts");
  const { makeStairProject } = await load("/tests/fixtures/multiple-floors.ts");
  test("straight handrails have a supporting post at both ends on each enabled side", () => {
    const project = makeStairProject();
    for (const rotationYRadians of [0, 0.73])
      for (const railings of ["both", "left", "right"]) {
        const flight = deriveStairFlight(project, {
          ...project.stairs[0],
          rotationYRadians,
          railings,
        });
        const guards = deriveStairGuardSegments(flight, project.coordinates);
        for (const side of [-1, 1]) {
          if (railings === (side === -1 ? "right" : "left")) continue;
          for (const end of [flight.path[0], flight.path.at(-1)]) {
            const x = end.x + (side * flight.widthMeters * flight.side[0]) / 2;
            const z = end.z + (side * flight.widthMeters * flight.side[1]) / 2;
            assert.ok(
              guards.some(
                ({ from, to }) =>
                  Math.abs(from[0] - x) < 1e-8 &&
                  Math.abs(to[0] - x) < 1e-8 &&
                  Math.abs(from[2] - z) < 1e-8 &&
                  Math.abs(to[2] - z) < 1e-8 &&
                  Math.abs(from[1] - end.elevation) < 1e-8 &&
                  Math.abs(to[1] - end.elevation - 0.95) < 1e-8,
              ),
              `Missing post: ${railings}, side ${side}, height ${end.elevation}`,
            );
          }
        }
      }
  });
  test("same-floor guards stay on the high ground instead of floating over the lowered terrace", () => {
    const project = makeStairProject();
    project.floors = [project.floors[0]];
    const floor = project.floors[0];
    floor.outdoorPlatforms = [
      {
        id: "lower-terrace",
        polygon: [
          [-2, -4.5],
          [1, -4.5],
          [1, -1.7],
          [-2, -1.7],
        ],
        elevation: { offsetMeters: -2, edges: [0, 1, 2, 3].map((i) => ({ id: `edge-${i}` })) },
      },
    ];
    const stair = {
      id: "terrace-stair",
      terrain: { floorId: floor.id, end: "upper", surfaces: true },
      at: [-0.5, -2.7],
      widthMeters: 1,
      runMeters: 2,
      rotationYRadians: 0,
    };
    const flight = deriveStairFlight(project, stair);
    assert.ok(flight);
    const guards = deriveStairGuardSegments(flight, project.coordinates, true);
    assert.ok(guards.length > 0, "protect the upper ground beside the stair cutout");
    for (const rail of guards)
      for (const point of [rail.from, rail.to])
        assert.ok(point[2] >= -1.7 - 1e-8, "no upper guard floats over the lower terrace");
    assert.ok(
      guards.some((rail) => Math.abs(rail.from[2] + 1.7) < 1e-8),
      "start at the actual ground edge",
    );
  });
  test("upper opening guards do not float where the upper floor is absent", () => {
    const project = makeStairProject();
    project.floors[1].footprint = [
      [0, 6],
      [8, 6],
      [8, 8],
      [0, 8],
    ];
    const flight = deriveStairFlight(project, project.stairs[0]);
    assert.deepEqual(deriveStairGuardSegments(flight, project.coordinates, true), []);
  });

  test("partial and disconnected upper floors clip rails at their actual boundaries", () => {
    const project = makeStairProject();
    project.floors[1].footprintRegions = [
      [
        [0, 2],
        [8, 2],
        [8, 3],
        [0, 3],
      ],
      [
        [0, 4],
        [8, 4],
        [8, 5],
        [0, 5],
      ],
    ];
    const rails = deriveStairGuardSegments(
      deriveStairFlight(project, project.stairs[0]),
      project.coordinates,
      true,
    );
    assert.ok(rails.length > 0);
    for (const rail of rails)
      for (const p of [rail.from, rail.to])
        assert.ok((p[2] >= 2 - 1e-8 && p[2] <= 3 + 1e-8) || (p[2] >= 4 - 1e-8 && p[2] <= 5 + 1e-8));
    assert.ok(rails.some((r) => Math.abs(r.from[2] - 2) < 1e-8 || Math.abs(r.to[2] - 2) < 1e-8));
  });
  test("platform-only support does not use the empty enclosing footprint", () => {
    const project = makeStairProject(),
      floor = project.floors[1];
    floor.rooms = [];
    floor.outdoorPlatforms = [
      {
        polygon: [
          [0, 4],
          [8, 4],
          [8, 5],
          [0, 5],
        ],
      },
    ];
    const rails = deriveStairGuardSegments(
      deriveStairFlight(project, project.stairs[0]),
      project.coordinates,
      true,
    );
    assert.ok(rails.length > 0);
    for (const rail of rails)
      for (const p of [rail.from, rail.to]) assert.ok(p[2] >= 4 - 1e-8 && p[2] <= 5 + 1e-8);
  });
  test("every shape partitions flight rails by ascending side and None also removes upper opening guards", () => {
    const project = makeStairProject(),
      base = project.stairs[0];
    for (const spec of [
      base,
      ...["left", "right"].flatMap((turn) =>
        ["l-shaped", "u-shaped"].map((shape) => ({
          ...base,
          shape,
          turn,
          lowerRunMeters: 2,
          upperRunMeters: 2,
        })),
      ),
      ...["clockwise", "counterclockwise"].map((direction) => ({
        ...base,
        shape: "spiral",
        direction,
        diameterMeters: 2,
        totalTurnDegrees: 360,
      })),
    ]) {
      const guards = (railings, upper = false) =>
        deriveStairGuardSegments(
          deriveStairFlight(project, { ...spec, railings }),
          project.coordinates,
          upper,
        );
      const both = guards("both"),
        left = guards("left"),
        right = guards("right");
      assert.deepEqual(guards(undefined), both);
      assert.deepEqual(guards("none"), []);
      assert.equal(guards("none", true).length, 0, `${spec.shape ?? "straight"}: no upper guards`);
      const upper = guards("both", true);
      assert.ok(upper.length > 0, "the supported upper opening has guards by default");
      for (const railings of [undefined, "left", "right"])
        assert.deepEqual(guards(railings, true), upper);
      assert.ok(left.length > 0 && right.length > 0);
      assert.equal(left.length + right.length, both.length);
      assert.deepEqual(
        new Set([...left, ...right].map(JSON.stringify)),
        new Set(both.map(JSON.stringify)),
      );
    }
  });
  test("straight side selection follows rotation and U-shaped inner rails follow both flights", () => {
    const project = makeStairProject();
    for (const rotationYRadians of [0, Math.PI / 2, 0.73])
      for (const railings of ["left", "right"]) {
        const flight = deriveStairFlight(project, {
          ...project.stairs[0],
          railings,
          rotationYRadians,
        });
        for (const rail of deriveStairGuardSegments(flight, project.coordinates))
          for (const p of [rail.from, rail.to]) {
            const across =
              (p[0] - flight.originWorld[0]) * flight.side[0] +
              (p[2] - flight.originWorld[1]) * flight.side[1];
            assert.ok(
              Math.abs(across - ((railings === "left" ? -1 : 1) * flight.widthMeters) / 2) < 1e-8,
            );
          }
      }
    const flight = deriveStairFlight(project, {
      ...project.stairs[0],
      shape: "u-shaped",
      turn: "right",
      lowerRunMeters: 2,
      upperRunMeters: 2,
      railings: "right",
    });
    const rails = deriveStairGuardSegments(flight, project.coordinates);
    assert.ok(rails.some((r) => r.from[1] > flight.path[1].elevation + 0.95));
    for (const r of rails) assert.ok(Math.abs(r.from[0] - 4.6) < 1e-8);
  });
  const { parseHomeProjectSchema } = await load("/packages/engine/src/home-project/validation.ts");
  const { createSeedProjectRecord, serializeHomeProjectRecord, parseHomeProjectRecord } =
    await load("/packages/engine/src/home-project/project-record-codec.ts");
  const { convertStairShape } = await load(
    "/apps/web/src/editor-floors/stair-placement-geometry.ts",
  );
  test("railing choices survive serialization and shape conversion and reject invalid imports", () => {
    for (const railings of ["both", "left", "right", "none"]) {
      const project = makeStairProject();
      project.stairs[0].railings = railings;
      const parsed = parseHomeProjectRecord(
        serializeHomeProjectRecord(createSeedProjectRecord(project)),
        { furnishingModels: {}, deviceModels: {} },
      );
      assert.ok(parsed.valid, JSON.stringify(parsed.issues));
      assert.equal(parsed.record.draft.stairs[0].railings, railings);
      for (const shape of ["straight", "l-shaped", "u-shaped", "spiral"])
        assert.equal(convertStairShape(project, project.stairs[0], shape).railings, railings);
    }
    const project = makeStairProject();
    project.stairs[0].railings = "rear";
    assert.equal(parseHomeProjectSchema(project).valid, false);
  });
});
