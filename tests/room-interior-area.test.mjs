import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { roomInteriorAreaSquareMeters } = await load(
    "/packages/engine/src/architecture-geometry.ts",
  );
  const { createFloorEditorDraft } = await load(
    "/packages/engine/src/home-editor/construct/editor-state.ts",
  );
  const { deriveFloorTopology } = await load(
    "/packages/engine/src/home-editor/construct/topology.ts",
  );
  const polygon = [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3],
  ];
  const floor = {
    coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
    footprint: polygon,
    walls: polygon.map((from, index) => ({
      id: `wall-${index}`,
      from,
      to: polygon[(index + 1) % polygon.length],
      thicknessMeters: 0.2,
      classification: "exterior",
    })),
    wallJunctions: [],
    openings: [],
  };
  const closeTo = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);

  test("measures between wall faces without counting doorway recesses", () => {
    closeTo(
      roomInteriorAreaSquareMeters(
        { polygon },
        {
          ...floor,
          openings: [
            {
              wallId: "wall-0",
              offsetFromWallStartPlanUnits: 1,
              widthPlanUnits: 1,
              sillHeightMeters: 0,
            },
          ],
        },
      ),
      3.8 * 2.8,
    );
  });

  test("does not subtract wall thickness twice from an inset imported room", () => {
    closeTo(
      roomInteriorAreaSquareMeters(
        {
          polygon: [
            [0.1, 0.1],
            [3.9, 0.1],
            [3.9, 2.9],
            [0.1, 2.9],
          ],
        },
        floor,
      ),
      3.8 * 2.8,
    );
  });

  test("converts plan coordinates while preserving physical wall thickness", () => {
    closeTo(
      roomInteriorAreaSquareMeters(
        { polygon },
        {
          ...floor,
          coordinates: { ...floor.coordinates, origin: [10, -8], metersPerPlanUnit: 0.5 },
        },
      ),
      1.8 * 1.3,
    );
  });

  test("subtracts overlapping internal wall footprints only once, including holes", () => {
    const wall = {
      id: "partition",
      from: [1, 1.5],
      to: [3, 1.5],
      thicknessMeters: 0.2,
      classification: "interior",
    };
    closeTo(
      roomInteriorAreaSquareMeters(
        { polygon },
        {
          ...floor,
          walls: [...floor.walls, wall, { ...wall, id: "overlap", from: [2, 1.5] }],
        },
      ),
      3.8 * 2.8 - 0.4,
    );
  });

  test("supports diagonal walls independently of room rotation", () => {
    const rotate = ([x, y]) => [(x - y) / Math.sqrt(2), (x + y) / Math.sqrt(2)];
    closeTo(
      roomInteriorAreaSquareMeters(
        { polygon: polygon.map(rotate) },
        {
          ...floor,
          footprint: polygon.map(rotate),
          walls: floor.walls.map((wall) => ({
            ...wall,
            from: rotate(wall.from),
            to: rotate(wall.to),
          })),
        },
      ),
      3.8 * 2.8,
    );
  });

  test("returns zero when walls cover the room completely", () => {
    closeTo(
      roomInteriorAreaSquareMeters(
        { polygon },
        {
          ...floor,
          walls: floor.walls.map((wall) => ({ ...wall, thicknessMeters: 8 })),
        },
      ),
      0,
    );
  });

  test("owner bedrooms use their interior dimensions at the current and calibrated scales", () => {
    const source = JSON.parse(readFileSync("tests/fixtures/previous-demo/layout.json", "utf8"))
      .floors[1];
    const { floor: derived } = deriveFloorTopology(createFloorEditorDraft(source));
    assert.ok(derived);
    for (const [id, width, depth] of [
      ["primary-bedroom", 8, 8],
      ["bedroom-four", 8, 4],
    ]) {
      const room = derived.rooms.find((room) => room.id === id);
      assert.ok(room);
      let previousArea = Infinity;
      for (const scale of [1, 0.92]) {
        const area = roomInteriorAreaSquareMeters(room, {
          ...derived,
          coordinates: { ...derived.coordinates, metersPerPlanUnit: scale },
        });
        assert.ok(area > 0 && area < width * depth * scale * scale);
        assert.ok(area < previousArea);
        previousArea = area;
      }
    }
  });
});
