import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Color } from "three";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { deriveRoofRegions } = await load("/packages/engine/src/roof/roof-coverage.ts");
  const { buildRoofGeometries } = await load("/packages/engine/src/roof/roof-geometry.ts");
  const { DEFAULT_ROOF_SETTINGS } = await load("/packages/engine/src/roof/roof-settings.ts");
  const { legacyFloorHeight } = await load("/packages/engine/src/building/floor-levels.ts");
  const { parseHomeProject, serializeHomeProject } = await load(
    "/packages/engine/src/home-project/serialization.ts",
  );
  const { composeHomeManifest } = await load("/packages/engine/src/home-project/runtime.ts");
  const {
    createWorkspaceHistory,
    commitWorkspaceSnapshot,
    undoWorkspaceHistory,
    redoWorkspaceHistory,
  } = await load("/packages/engine/src/home-editor/workspace-history.ts");
  const { makeThreeFloorProject, emptyExtensions } = await load(
    "/tests/fixtures/multiple-floors.ts",
  );
  test("north angle persists through import, runtime composition and history with old-project defaults", () => {
    const project = makeThreeFloorProject();
    assert.equal(project.home.northAngleDegrees, undefined);
    const next = { ...project, home: { ...project.home, northAngleDegrees: 90 } };
    const parsed = parseHomeProject(serializeHomeProject(next));
    assert.equal(parsed.project.home.northAngleDegrees, 90);
    assert.equal(composeHomeManifest(parsed.project, emptyExtensions).home.northAngleDegrees, 90);
    const history = createWorkspaceHistory({ project, bindings: {} });
    const changed = commitWorkspaceSnapshot(history, { project: next, bindings: {} });
    assert.equal(undoWorkspaceHistory(changed).present.project.home.northAngleDegrees, undefined);
    assert.equal(
      redoWorkspaceHistory(undoWorkspaceHistory(changed)).present.project.home.northAngleDegrees,
      90,
    );
    for (const value of [-1, 360, "90", null]) {
      const invalid = parseHomeProject(
        serializeHomeProject({ ...next, home: { ...next.home, northAngleDegrees: value } }),
      );
      assert.ok(invalid.issues.some((issue) => issue.path === "home.northAngleDegrees"));
    }
  });
  const rectangle = (x, z, width, depth) => [
    [x, z],
    [x + width, z],
    [x + width, z + depth],
    [x, z + depth],
  ];
  const makeFloor = (polygons, id = "ground") => ({
    id,
    name: id,
    coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
    floorToFloorHeightMeters: 3,
    defaultWallHeightMeters: 2.5,
    defaultCeilingHeightMeters: 2.5,
    footprint: polygons[0],
    footprintRegions: polygons,
    rooms: polygons.map((polygon, i) => ({
      id: `${id}-${i}`,
      name: `${i}`,
      polygon,
      accent: "#ffffff",
      devices: [],
      dashboardSlots: [],
    })),
    walls: [],
    wallJunctions: [],
    openings: [],
  });
  const area = (ring) =>
    Math.abs(
      ring.reduce((sum, p, i) => {
        const q = ring[(i + 1) % ring.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ) / 2;
  const coverageArea = (regions) =>
    regions.reduce(
      (sum, r) =>
        sum +
        area(r.polygon[0]) -
        r.polygon.slice(1).reduce((total, hole) => total + area(hole), 0),
      0,
    );
  const projectedArea = (geometry) => {
    const p = geometry.attributes.position.array;
    let total = 0;
    for (let i = 0; i < p.length; i += 9)
      total +=
        Math.abs(
          (p[i + 3] - p[i]) * (p[i + 8] - p[i + 2]) - (p[i + 6] - p[i]) * (p[i + 5] - p[i + 2]),
        ) / 2;
    return total;
  };
  const near = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 0.001, `${actual} ≠ ${expected}`);

  test("merges adjacent rooms into one roof with gable directions or a level flat surface", () => {
    const floor = makeFloor([rectangle(0, 0, 5, 6), rectangle(5, 0, 5, 6)]);
    const regions = deriveRoofRegions([floor]);
    assert.equal(regions.length, 1);
    near(coverageArea(regions), 60);
    for (const direction of ["left-right", "front-back", "flat"]) {
      const geometry = buildRoofGeometries([floor], { ...DEFAULT_ROOF_SETTINGS, direction });
      near(projectedArea(geometry.top), 60);
      const axis = direction === "left-right" ? 2 : 0,
        ridge = direction === "left-right" ? 3 : 5;
      const positions = geometry.top.attributes.position.array;
      for (let i = 0; i < positions.length; i += 9) {
        const values = [positions[i + axis], positions[i + 3 + axis], positions[i + 6 + axis]];
        if (direction === "flat") {
          for (const offset of [1, 4, 7]) near(positions[i + offset], regions[0].baseHeight + 0.08);
        } else
          assert.ok(Math.max(...values) <= ridge + 1e-5 || Math.min(...values) >= ridge - 1e-5);
      }
      assert.ok([...positions].every(Number.isFinite));
      assert.ok([...geometry.edges.attributes.position.array].every(Number.isFinite));
      for (let i = 1; i < geometry.top.attributes.normal.array.length; i += 3)
        assert.ok(geometry.top.attributes.normal.array[i] > 0);
      geometry.top.dispose();
      geometry.edges.dispose();
      geometry.infill.dispose();
    }
  });

  test("preserves L-shaped outlines, detached components, and open courtyard holes", () => {
    const l = makeFloor([
      [
        [0, 0],
        [8, 0],
        [8, 3],
        [3, 3],
        [3, 8],
        [0, 8],
      ],
    ]);
    const detached = makeFloor([rectangle(0, 0, 4, 4), rectangle(10, 0, 3, 3)]);
    const court = makeFloor([
      rectangle(0, 0, 10, 2),
      rectangle(0, 8, 10, 2),
      rectangle(0, 2, 2, 6),
      rectangle(8, 2, 2, 6),
    ]);
    for (const [floor, expected, count] of [
      [l, 39, 1],
      [detached, 25, 2],
      [court, 64, 1],
    ]) {
      const regions = deriveRoofRegions([floor]);
      assert.equal(regions.length, count);
      near(coverageArea(regions), expected);
      const geometry = buildRoofGeometries([floor]);
      near(projectedArea(geometry.top), expected);
      geometry.top.dispose();
      geometry.edges.dispose();
      geometry.infill.dispose();
    }
    assert.equal(deriveRoofRegions([court])[0].polygon.length, 2);
  });

  test("only roofs exposed lower wings, in the common building coordinate system", () => {
    const lower = makeFloor([rectangle(0, 0, 10, 8)]);
    const upper = makeFloor([rectangle(3, 0, 4, 8)], "upper");
    const regions = deriveRoofRegions([lower, upper]);
    near(coverageArea(regions.filter((r) => r.floorId === "ground")), 48);
    near(coverageArea(regions.filter((r) => r.floorId === "upper")), 32);
    assert.ok(regions.filter((r) => r.floorId === "upper").every((r) => r.baseHeight === 5.66));
    assert.equal(
      deriveRoofRegions([lower, { ...upper, footprint: [], footprintRegions: [], rooms: [] }])
        .length,
      1,
    );
    const transformed = {
      ...lower,
      coordinates: { origin: [2, 1], metersPerPlanUnit: 0.5, scaleBasis: "measured" },
    };
    near(coverageArea(deriveRoofRegions([transformed])), 20);
  });

  test("a wraparound balcony covers the lower exterior wall tops without a gable in front of its rails", () => {
    const lower = makeFloor([rectangle(0, 0, 14, 18)]);
    lower.walls = lower.footprint.map((from, i, points) => ({
      id: `wall-${i}`,
      from,
      to: points[(i + 1) % points.length],
      classification: "exterior",
      thicknessMeters: 0.3,
    }));
    const upper = makeFloor([rectangle(2, 0, 12, 16)], "upper");
    upper.outdoorPlatforms = [
      {
        id: "balcony",
        polygon: [
          [14, 16],
          [14, 18],
          [0, 18],
          [0, 0],
          [2, 0],
          [2, 16],
        ],
        finish: { kind: "preset", preset: "travertine" },
        defaultEdge: { kind: "railing", heightMeters: 1 },
        edges: Array.from({ length: 6 }, (_, i) => ({ id: `edge-${i}` })),
      },
    ];
    // The upper room covers its own wall tops; the balcony ends on the
    // lower wall centerline, as it does in the reported exported home.
    upper.walls = upper.footprint.map((from, i, points) => ({
      id: `upper-wall-${i}`,
      from,
      to: points[(i + 1) % points.length],
      classification: "exterior",
      thicknessMeters: 0.3,
    }));
    const lowerRoofs = deriveRoofRegions([lower, upper]).filter(
      (region) => region.floorId === lower.id,
    );
    near(coverageArea(lowerRoofs), 0);
    for (const direction of ["left-right", "front-back", "flat"]) {
      const geometry = buildRoofGeometries([lower, upper], { ...DEFAULT_ROOF_SETTINGS, direction });
      try {
        const positions = geometry.top.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          assert.ok(
            positions.getY(i) >= 5.66,
            "no lower roof face may rise in front of the balcony rails",
          );
        }
      } finally {
        Object.values(geometry).forEach((part) => part.dispose());
      }
    }
    // Removing the west balcony must restore the genuinely exposed room roof.
    upper.outdoorPlatforms[0].polygon = rectangle(0, 16, 14, 2);
    assert.ok(
      coverageArea(
        deriveRoofRegions([lower, upper]).filter((region) => region.floorId === lower.id),
      ) >= 29,
      "wall-top coverage must not erase the exposed lower wing",
    );
  });

  test("follows different ceiling heights without overlapping coverage or crossing taller roofs", () => {
    const floor = makeFloor([rectangle(0, 0, 5, 6), rectangle(5, 0, 5, 6)]);
    floor.ceilings = [
      { id: "a", kind: "flat", roomIds: ["ground-0"], heightMeters: 2.5 },
      { id: "b", kind: "flat", roomIds: ["ground-1"], heightMeters: 3 },
    ];
    const regions = deriveRoofRegions([floor]);
    near(coverageArea(regions), 60);
    assert.equal(regions.length, 2);
    assert.ok(regions.find((r) => r.baseHeight === 2.66).maxRise <= 0.42 + 1e-6);
  });

  test("honors authored sloped planes instead of adding a second gable", () => {
    const floor = makeFloor([rectangle(0, 0, 8, 6)]);
    floor.ceilings = [
      {
        id: "slope",
        kind: "sloped",
        roomIds: ["ground-0"],
        planes: [
          {
            id: "plane",
            boundary: rectangle(0, 0, 8, 6),
            lowEdge: [
              [0, 0],
              [8, 0],
            ],
            highEdge: [
              [0, 6],
              [8, 6],
            ],
            lowHeightMeters: 2.5,
            highHeightMeters: 4,
          },
        ],
      },
    ];
    const geometry = buildRoofGeometries([floor]);
    near(projectedArea(geometry.top), 48);
    const p = geometry.top.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) near(p[i + 1], 2.5 + 0.16 + 0.08 + (p[i + 2] / 6) * 1.5);
    geometry.top.dispose();
    geometry.edges.dispose();
    geometry.infill.dispose();
  });

  test("the bundled home has one continuous roof without room-to-wall seam holes", () => {
    const floor = JSON.parse(
      readFileSync(new URL("./fixtures/previous-demo/layout.json", import.meta.url), "utf8"),
    ).floors[0];
    floor.floorToFloorHeightMeters ??= legacyFloorHeight(floor);
    const regions = deriveRoofRegions([floor]);
    assert.equal(regions.length, 1);
    assert.equal(regions[0].polygon.length, 1);
    const geometries = buildRoofGeometries([floor]);
    near(projectedArea(geometries.top), coverageArea(regions));
    geometries.top.dispose();
    geometries.edges.dispose();
    geometries.infill.dispose();
  });

  test("only thin trim uses the roof edge material; infill continues each wall finish down to the ceiling", () => {
    const floor = makeFloor([rectangle(0, 0, 8, 6)]);
    const wall = (id, from, to, extra = {}) => ({
      id,
      from,
      to,
      classification: "exterior",
      thicknessMeters: 0.2,
      ...extra,
    });
    floor.walls = [
      wall("north-left", [0, 0], [4, 0], { exteriorColor: "#123456" }),
      wall("north-right", [4, 0], [8, 0], {
        exteriorColor: "#ffffff",
        faceColors: { right: "#445566" },
      }),
      wall("east", [8, 0], [8, 6]),
      wall("south", [8, 6], [0, 6]),
      wall("west", [0, 6], [0, 0]),
    ];
    const geometry = buildRoofGeometries([floor], DEFAULT_ROOF_SETTINGS, "#aa3344");
    try {
      const trim = geometry.edges.attributes.position.array;
      const heights = new Map();
      for (let i = 0; i < trim.length; i += 3) {
        const key = `${trim[i].toFixed(4)},${trim[i + 2].toFixed(4)}`;
        heights.set(key, [...(heights.get(key) ?? []), trim[i + 1]]);
      }
      assert.ok(
        [...heights.values()].every(
          (values) => Math.max(...values) - Math.min(...values) <= 0.0801,
        ),
        "the trim material must never cover a tall gable or slab panel",
      );
      geometry.infill.computeBoundingBox();
      near(geometry.infill.boundingBox.min.y, 2.5);
      const p = geometry.infill.attributes.position.array,
        c = geometry.infill.attributes.color.array;
      let left = 0,
        right = 0;
      for (let i = 0; i < p.length; i += 9) {
        if (![p[i + 2], p[i + 5], p[i + 8]].every((z) => Math.abs(z + 0.1) < 0.001)) continue;
        const x = (p[i] + p[i + 3] + p[i + 6]) / 3;
        if (x < 0 || x > 8) continue;
        const expected = new Color(x < 4 ? "#123456" : "#445566");
        for (let j = 0; j < 9; j += 3) {
          near(c[i + j], expected.r);
          near(c[i + j + 1], expected.g);
          near(c[i + j + 2], expected.b);
        }
        if (x < 4) {
          left++;
          assert.ok(Math.max(p[i], p[i + 3], p[i + 6]) <= 4.001);
        } else {
          right++;
          assert.ok(Math.min(p[i], p[i + 3], p[i + 6]) >= 3.999);
        }
      }
      assert.ok(
        left > 0 && right > 0,
        "both adjacent wall finishes should continue into the infill",
      );
    } finally {
      geometry.top.dispose();
      geometry.edges.dispose();
      geometry.infill.dispose();
    }
  });

  test("roof infill inherits wall finishes through thick corner miters", () => {
    for (const reverse of [false, true])
      for (const angle of [0, 0.37])
        for (const thickness of [0.18, 0.4]) {
          const rotate = ([x, z]) => [
            x * Math.cos(angle) - z * Math.sin(angle),
            x * Math.sin(angle) + z * Math.cos(angle),
          ];
          const floor = makeFloor([rectangle(0, 0, 8, 6)]);
          const colors = ["#123456", "#445566", "#778899", "#abcdef"];
          const corners = floor.footprint;
          floor.walls = corners.map((from, i) => ({
            id: `wall-${i}`,
            from,
            to: corners[(i + 1) % 4],
            classification: "exterior",
            thicknessMeters: thickness,
            exteriorColor: "#ffffff",
            faceColors: { right: colors[i] },
          }));
          floor.wallJunctions = corners.map((at, i) => ({
            id: `corner-${i}`,
            at,
            wallIds: [`wall-${i}`, `wall-${(i + 3) % 4}`],
          }));
          if (reverse) {
            floor.walls.reverse();
            floor.walls.forEach((wall) => {
              [wall.from, wall.to] = [wall.to, wall.from];
              wall.faceColors = { left: wall.faceColors.right };
            });
          }
          floor.footprint = floor.footprint.map(rotate);
          floor.footprintRegions = [floor.footprint];
          floor.rooms[0].polygon = floor.footprint;
          floor.walls.forEach((wall) => {
            wall.from = rotate(wall.from);
            wall.to = rotate(wall.to);
          });
          floor.wallJunctions.forEach((junction) => {
            junction.at = rotate(junction.at);
          });
          const geometries = buildRoofGeometries([floor], DEFAULT_ROOF_SETTINGS, "#ff0000");
          try {
            const p = geometries.infill.attributes.position,
              c = geometries.infill.attributes.color;
            for (let i = 0; i < p.count; i += 3) {
              const expectedIndex = [
                [2, -thickness / 2],
                [0, 8 + thickness / 2],
                [2, 6 + thickness / 2],
                [0, -thickness / 2],
              ].findIndex(([axis, value]) =>
                [i, i + 1, i + 2].every(
                  (v) =>
                    Math.abs(
                      (axis === 0
                        ? p.getX(v) * Math.cos(angle) + p.getZ(v) * Math.sin(angle)
                        : -p.getX(v) * Math.sin(angle) + p.getZ(v) * Math.cos(angle)) - value,
                    ) < 1e-5,
                ),
              );
              assert.ok(expectedIndex >= 0);
              for (let v = i; v < i + 3; v++)
                assert.equal(
                  new Color().fromBufferAttribute(c, v).getHexString(),
                  colors[expectedIndex].slice(1),
                  `corner infill at ${p.getX(v)}, ${p.getZ(v)} must inherit its supporting wall`,
                );
            }
          } finally {
            Object.values(geometries).forEach((geometry) => geometry.dispose());
          }
        }
  });

  test("sloped roof edges inside wall thickness retain the outward face override", () => {
    const floor = makeFloor([rectangle(0, 0, 8, 6)]);
    floor.walls = floor.footprint.map((from, i, points) => ({
      id: `wall-${i}`,
      from,
      to: points[(i + 1) % 4],
      classification: "exterior",
      thicknessMeters: 0.4,
      faceColors: { left: "#abcdef", right: "#123456" },
    }));
    floor.ceilings = [
      {
        id: "slope",
        kind: "sloped",
        roomIds: ["ground-0"],
        planes: [
          {
            id: "plane",
            boundary: floor.footprint,
            lowEdge: [
              [0, 0],
              [8, 0],
            ],
            highEdge: [
              [0, 6],
              [8, 6],
            ],
            lowHeightMeters: 2.5,
            highHeightMeters: 4,
          },
        ],
      },
    ];
    const geometries = buildRoofGeometries([floor], DEFAULT_ROOF_SETTINGS, "#ff0000");
    try {
      const colors = geometries.infill.attributes.color;
      assert.ok(colors.count > 0);
      for (let i = 0; i < colors.count; i++)
        assert.equal(new Color().fromBufferAttribute(colors, i).getHexString(), "123456");
    } finally {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
    }
  });

  test("roof settings round-trip, compose into runtime, and undo/redo with old-project defaults", () => {
    const project = makeThreeFloorProject();
    assert.equal(project.home.roof, undefined);
    assert.equal(parseHomeProject(serializeHomeProject(project)).valid, true);
    for (const direction of ["front-back", "flat"]) {
      const roof = { ...DEFAULT_ROOF_SETTINGS, direction, color: "#445566" };
      const next = { ...project, home: { ...project.home, roof } };
      const roundTrip = parseHomeProject(serializeHomeProject(next));
      assert.equal(roundTrip.valid, true);
      assert.deepEqual(roundTrip.project.home.roof, roof);
      assert.deepEqual(composeHomeManifest(roundTrip.project, emptyExtensions).home.roof, roof);
      const changed = commitWorkspaceSnapshot(createWorkspaceHistory({ project, bindings: {} }), {
        project: next,
        bindings: {},
      });
      assert.equal(undoWorkspaceHistory(changed).present.project.home.roof, undefined);
      assert.deepEqual(
        redoWorkspaceHistory(undoWorkspaceHistory(changed)).present.project.home.roof,
        roof,
      );
      for (const patch of [
        { direction: "diagonal" },
        { color: "red" },
        { edgeColor: null },
        { pitch: 25 },
      ]) {
        const invalid = parseHomeProject(
          serializeHomeProject({ ...next, home: { ...next.home, roof: { ...roof, ...patch } } }),
        );
        assert.equal(invalid.valid, false);
        assert.ok(invalid.issues.some((issue) => issue.path.startsWith("home.roof")));
      }
    }
  });
});
