import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { leanPlanPolygon } = await load("/packages/engine/src/architecture-geometry/wall-lean.ts");

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
});
