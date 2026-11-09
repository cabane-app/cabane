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
  const { deriveRoofRegions } = await load("/packages/engine/src/roof/roof-coverage.ts");
  const { walkCollidersForVerticalRange, isWalkPointClear } = await load(
    "/packages/engine/src/navigation/walk-colliders.ts",
  );
  const { resolveCircleMovement } = await load("/packages/engine/src/navigation/walk-motion.ts");
  const { walkJumpVerticalRange } = await load("/packages/engine/src/navigation/walk-jump.ts");
  const { prepareWalkColliders } = await load(
    "/packages/engine/src/navigation/prepared-walk-colliders.ts",
  );
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

  test("roof edges follow ceiling height independently of floor spacing", () => {
    for (const lean of [-1, 1]) {
      const f = { ...box(lean), defaultWallHeightMeters: 2.5, defaultCeilingHeightMeters: 2.5 };
      const minX = (regions) =>
        Math.min(...regions.flatMap((region) => region.polygon[0].map(([x]) => x)));
      const upright = { ...f, walls: box().walls };
      assert.ok(
        Math.abs(minX(deriveRoofRegions([f])) - minX(deriveRoofRegions([upright])) + lean) < 1e-6,
      );
      assert.deepEqual(
        deriveRoofRegions([{ ...f, floorToFloorHeightMeters: 4 }]),
        deriveRoofRegions([f]),
      );
    }
  });

  test("each flat ceiling tier follows its own height", () => {
    const f = box(-1);
    f.rooms = [
      {
        id: "south",
        polygon: [
          [0, 0],
          [6, 0],
          [6, 2],
          [0, 2],
        ],
      },
      {
        id: "north",
        polygon: [
          [0, 2],
          [6, 2],
          [6, 4],
          [0, 4],
        ],
      },
    ];
    f.ceilings = [
      { id: "low", kind: "flat", roomIds: ["south"], heightMeters: 2 },
      { id: "high", kind: "flat", roomIds: ["north"], heightMeters: 3 },
    ];
    const regions = deriveRoofRegions([f]);
    for (const height of [2, 3]) {
      const region = regions.find(
        (candidate) => Math.abs(candidate.baseHeight - height - 0.16) < 1e-6,
      );
      assert.ok(region, `missing tier ${height}`);
      assert.ok(
        Math.abs(Math.min(...region.polygon[0].map(([x]) => x)) - (height / 3 - 0.1)) < 1e-6,
      );
    }
  });

  test("upper-floor lean does not move the footprint cutting a lower roof", () => {
    const lower = box();
    lower.id = "lower";
    lower.footprint = lower.footprint.map(([x, y]) => [x === 0 ? -3 : x, y]);
    lower.walls = lower.walls.map((wall) => ({
      ...wall,
      from: [wall.from[0] === 0 ? -3 : wall.from[0], wall.from[1]],
      to: [wall.to[0] === 0 ? -3 : wall.to[0], wall.to[1]],
    }));
    const lowerRoof = (lean) =>
      deriveRoofRegions([lower, box(lean)]).filter((region) => region.floorId === "lower");
    assert.deepEqual(lowerRoof(-1), lowerRoof(1));
  });

  test("walking stops at leaning walls from both sides and at raised elevations", () => {
    for (const lean of [-1, 1]) {
      const f = box(lean);
      const prepared = prepareWalkColliders(f, 5);
      for (const jump of [0, 0.7]) {
        const range = walkJumpVerticalRange(5, jump);
        const colliders = walkCollidersForVerticalRange(prepared(new Set(), []), range);
        const wall = colliders.find((collider) => collider.id === "west-walk-0");
        assert.equal(wall.kind, "polygon");
        const shifts = [range.minY - 5, range.maxY - 5].map((height) => (-lean * height) / 3);
        const inner = Math.max(...shifts) + 0.1;
        const outer = Math.min(...shifts) - 0.1;
        const fromInside = resolveCircleMovement({ x: 2, z: 2 }, { x: -4, z: 0 }, [wall]);
        const fromOutside = resolveCircleMovement({ x: -2, z: 2 }, { x: 4, z: 0 }, [wall]);
        assert.ok(Math.abs(fromInside.x - inner - 0.22) < 1e-6);
        assert.ok(Math.abs(fromOutside.x - outer + 0.22) < 1e-6);
        assert.equal(isWalkPointClear({ x: (inner + outer) / 2, z: 2 }, [wall]), false);
        assert.ok(isWalkPointClear(fromInside, [wall]));
      }
    }
  });

  test("leaning door jambs stay passable when open and headers block raised walkers", () => {
    const f = box(-1);
    f.openings = [
      {
        id: "door",
        wallId: "west",
        kind: "door",
        offsetFromWallStartPlanUnits: 1.5,
        widthPlanUnits: 1,
        openingHeightMeters: 2.1,
        sillHeightMeters: 0,
      },
    ];
    const prepared = prepareWalkColliders(f);
    const open = prepared(new Set(["door"]), []);
    const cross = (colliders, z = 2) =>
      resolveCircleMovement({ x: 2, z }, { x: -3, z: 0 }, colliders);
    assert.ok(cross(open).x < -0.9);
    assert.ok(cross(open, 1.3).x > 0.5);
    assert.ok(cross(prepared(new Set(), [])).x > 0.5);
    const raised = walkCollidersForVerticalRange(open, walkJumpVerticalRange(0, 0.7));
    assert.ok(cross(raised).x > 0.7);
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
