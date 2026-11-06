import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { leanPlanPolygon, wallLeanMatrix } = await load(
    "/packages/engine/src/architecture-geometry/wall-lean.ts",
  );
  const { buildArchitecturalWallGeometries } = await load(
    "/packages/engine/src/architecture-geometry.ts",
  );
  const { buildRoofGeometries } = await load("/packages/engine/src/roof/roof-geometry.ts");
  const { validateWalls } = await load("/packages/engine/src/validation/wall-rules.ts");
  const { createFloorEditorDraft, deriveFloorTopology } = await load(
    "/packages/engine/src/index.ts",
  );
  const { Vector3 } = await load("/node_modules/three/build/three.module.js");

  // A 6 x 4 m box whose west side is split at y = 2 and whose west and south
  // sides lean out 1 m at the top (3 m walls).
  const wall = (id, from, to, extra = {}) => ({
    id,
    from,
    to,
    classification: "exterior",
    thicknessMeters: 0.2,
    ...extra,
  });
  const floor = (walls) => ({
    id: "ground",
    name: "Ground",
    coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
    floorToFloorHeightMeters: 3,
    defaultWallHeightMeters: 3,
    defaultCeilingHeightMeters: 3,
    footprint: [
      [0, 0],
      [6, 0],
      [6, 4],
      [0, 4],
    ],
    rooms: [],
    walls,
    wallJunctions: [],
    openings: [],
  });
  const close = (actual, expected) =>
    actual.forEach((point, index) =>
      point.forEach((value, axis) => assert.ok(Math.abs(value - expected[index][axis]) < 1e-6)),
    );

  test("a leaning wall split in two moves the joint out once, keeping the top straight", () => {
    const split = floor([
      wall("south", [0, 0], [6, 0]),
      wall("east", [6, 0], [6, 4]),
      wall("north", [6, 4], [0, 4]),
      wall("west-a", [0, 4], [0, 2], { leanMeters: 1 }),
      wall("west-b", [0, 2], [0, 0], { leanMeters: 1 }),
    ]);
    close(
      leanPlanPolygon(
        [
          [0, 4],
          [0, 2],
          [0, 1],
        ],
        split,
        3,
      ),
      [
        [-1, 4],
        [-1, 2],
        [-1, 1],
      ],
    );
  });

  test("where two leaning walls meet at a corner, it moves out along both", () => {
    const corner = floor([
      wall("south", [0, 0], [6, 0], { leanMeters: 1 }),
      wall("east", [6, 0], [6, 4]),
      wall("north", [6, 4], [0, 4]),
      wall("west", [0, 4], [0, 0], { leanMeters: 1 }),
    ]);
    const [point] = leanPlanPolygon([[0, 0]], corner, 3);
    assert.ok(Math.abs(Math.abs(point[0]) - 1) < 1e-6 && Math.abs(Math.abs(point[1]) - 1) < 1e-6);
  });

  const box = (westLean) =>
    floor([
      wall("south", [0, 0], [6, 0]),
      wall("east", [6, 0], [6, 4]),
      wall("north", [6, 4], [0, 4]),
      wall("west", [0, 4], [0, 0], westLean === undefined ? {} : { leanMeters: westLean }),
    ]);
  const vertices = (geometry) => {
    const p = geometry.attributes.position.array;
    return Array.from({ length: p.length / 3 }, (_, i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
  };
  const xSpan = (points) => {
    const xs = points.map(([x]) => x);
    return Math.max(...xs) - Math.min(...xs);
  };
  const wallPoints = (f) =>
    buildArchitecturalWallGeometries(f).flatMap(({ geometry }) => vertices(geometry));

  test("a leaning wall's top sits leanMeters out from its base, which stays put", () => {
    const upright = wallPoints(box());
    for (const lean of [1, -0.5]) {
      const leaning = wallPoints(box(lean));
      const base = (points) => points.filter(([, y]) => y < 0.01);
      const top = (points) => points.filter(([, y]) => y > 2.99);
      assert.ok(Math.abs(xSpan(base(leaning)) - xSpan(base(upright))) < 1e-6);
      assert.ok(Math.abs(xSpan(top(leaning)) - (xSpan(top(upright)) + lean)) < 1e-6);
    }
  });

  test("openings and wall-mounted items shear with their wall about the floor", () => {
    const f = box(1);
    assert.equal(wallLeanMatrix(f.walls[0], f), null);
    const matrix = wallLeanMatrix(f.walls[3], f);
    const atFloor = new Vector3(0, 0, 2).applyMatrix4(matrix);
    assert.deepEqual(atFloor.toArray(), [0, 0, 2]);
    const atTop = new Vector3(0, 3, 2).applyMatrix4(matrix);
    assert.ok(Math.abs(atTop.y - 3) < 1e-9);
    assert.ok(Math.abs(Math.hypot(atTop.x, atTop.z - 2) - 1) < 1e-9);
  });

  test("the roof reaches out over the top of a leaning wall", () => {
    const span = (f) => xSpan(vertices(buildRoofGeometries([f]).top));
    assert.ok(Math.abs(span(box(1)) - (span(box()) + 1)) < 0.01);
  });

  test("lean is validated, and Construct keeps it through topology", () => {
    const rules = (f) =>
      validateWalls(f, "floor", { input: {}, options: {}, ids: new Map() }).issues.filter(
        (issue) => issue.code === "wall.lean",
      );
    assert.deepEqual(rules(box(1)), []);
    assert.equal(rules(box(3.5)).length, 1);
    assert.equal(rules(box(Number.NaN)).length, 1);
    const derived = deriveFloorTopology(createFloorEditorDraft(box(1))).floor;
    assert.equal(derived.walls.find((w) => w.id === "west").leanMeters, 1);
  });
});
