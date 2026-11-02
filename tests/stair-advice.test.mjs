import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { validateStairs } = await load("/packages/engine/src/stairs/index.ts");
  const { validateHomeProject } = await load("/packages/engine/src/home-project/validation.ts");
  const { makeStairProject, emptyRegistries } = await load("/tests/fixtures/multiple-floors.ts");
  const { familyBathtubDefinition } = await load(
    "/packages/catalog/src/furnishing/definitions/family-bathtub.tsx",
  );
  const { caneWardrobeDefinition } = await load(
    "/packages/catalog/src/furnishing/definitions/cane-wardrobe.tsx",
  );
  const registries = {
    deviceModels: {},
    furnishingModels: { tub: familyBathtubDefinition, wardrobe: caneWardrobeDefinition },
  };
  const item = (modelId, at, size, rotationYRadians = 0, elevationMeters = 0) => ({
    id: "obstacle",
    kind: "furnishing",
    modelId,
    floorId: "ground",
    size,
    placement: { kind: "absolute", at, rotationYRadians, elevationMeters },
  });
  const itemIssues = (p) =>
    validateStairs(p, registries).filter((i) => i.code === "stair.item-obstruction");

  test("compact spiral and steep flights have no width or slope policy", () => {
    const p = makeStairProject(),
      base = p.stairs[0];
    const stairs = [
      { ...base, widthMeters: 0.3, runMeters: 0.5 },
      {
        ...base,
        shape: "l-shaped",
        widthMeters: 0.3,
        lowerRunMeters: 0.5,
        upperRunMeters: 0.5,
        turn: "right",
      },
      ...[180, 270, 360].map((totalTurnDegrees) => ({
        id: base.id,
        lowerFloorId: "ground",
        upperFloorId: "first",
        at: [4, 4],
        rotationYRadians: 0,
        shape: "spiral",
        diameterMeters: 1.2,
        totalTurnDegrees,
        direction: "clockwise",
      })),
    ];
    for (const stair of stairs)
      assert.equal(
        validateStairs({ ...p, stairs: [stair] }).some((i) =>
          ["stair.width", "stair.slope"].includes(i.code),
        ),
        false,
      );
  });
  test("warning-only overlaps remain valid projects; malformed connections do not", () => {
    const p = makeStairProject();
    p.stairs.push({ ...p.stairs[0], id: "overlap" });
    const result = validateHomeProject(p, emptyRegistries);
    assert.equal(result.valid, true, JSON.stringify(result.issues));
    assert.equal(result.issues.find((i) => i.code === "stair.overlap").severity, "warning");
    p.stairs[0].upperFloorId = "second";
    assert.equal(validateHomeProject(p, emptyRegistries).valid, false);
  });
  test("stacked flights in one stairwell do not overlap across adjacent storeys", () => {
    const p = makeStairProject();
    p.stairs.push({
      ...p.stairs[0],
      id: "first-stairs",
      lowerFloorId: "first",
      upperFloorId: "second",
    });
    assert.equal(
      validateStairs(p).some((issue) => issue.code === "stair.overlap"),
      false,
    );
  });
  test("spiral bridge collisions warn at each storey and coordinate scale", () => {
    for (const coordinates of [
      { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      { origin: [17, -9], metersPerPlanUnit: 0.25, scaleBasis: "measured" },
    ]) {
      for (const [lowerFloorId, upperFloorId] of [
        ["ground", "first"],
        ["first", "second"],
      ]) {
        const p = makeStairProject();
        p.coordinates = coordinates;
        const at = (x, z) => [
          coordinates.origin[0] + x / coordinates.metersPerPlanUnit,
          coordinates.origin[1] + z / coordinates.metersPerPlanUnit,
        ];
        p.stairs = [
          {
            id: "spiral",
            lowerFloorId,
            upperFloorId,
            at: at(4, 6),
            rotationYRadians: 0,
            shape: "spiral",
            diameterMeters: 2,
            totalTurnDegrees: 180,
            direction: "clockwise",
          },
          {
            id: "straight",
            lowerFloorId,
            upperFloorId,
            at: at(4, 1.95),
            rotationYRadians: 0,
            widthMeters: 1.2,
            runMeters: 4,
          },
        ];
        const overlaps = () => validateStairs(p).filter((issue) => issue.code === "stair.overlap");
        assert.equal(overlaps().length, 1, "the top tread intersects only the spiral's bridge");
        assert.equal(overlaps()[0].severity, "warning");
        p.stairs[1].at = at(6, 1.95);
        assert.equal(overlaps().length, 0, "separated stairs must not warn");
      }
    }
  });
  test("long rotated wardrobe uses its physical narrow side, not its diagonal radius", () => {
    const p = makeStairProject();
    p.stairs[0].widthMeters = 1;
    p.sceneItems = [item("wardrobe", [5.8, 3], [4, 2.15, 0.474], Math.PI / 2)];
    assert.deepEqual(itemIssues(p), []);
    p.sceneItems[0].placement.rotationYRadians = 0;
    assert.equal(
      itemIssues(p).length,
      1,
      "rotating the long side into the stairs must be detected",
    );
  });
  test("wall offsets on either face do not invent a wardrobe intersection through a partition", () => {
    for (const face of ["left", "right"]) {
      const p = makeStairProject(),
        x = face === "left" ? 5.6 : 2.4;
      p.floors[0].walls.push({
        ...p.floors[0].walls[0],
        id: "partition",
        from: [x, 0.5],
        to: [x, 7.5],
        thicknessMeters: 0.1,
      });
      p.sceneItems = [
        {
          ...item("wardrobe", [0, 0], [4, 2.15, 0.474]),
          placement: {
            kind: "wall",
            wallId: "partition",
            face,
            offsetFromWallStartPlanUnits: 2.5,
            depthOffsetMeters: 0.284,
            elevationMeters: 0,
            rotationOffsetRadians: 0,
          },
        },
      ];
      assert.deepEqual(itemIssues(p), [], face);
    }
  });
  test("bathtub bounds distinguish touching, overlap and clearance underneath the flight", () => {
    const p = makeStairProject();
    p.stairs[0].widthMeters = 1;
    p.sceneItems = [item("tub", [5.32, 2], [1.64, 0.782, 0.78])];
    assert.deepEqual(itemIssues(p), [], "touching edge");
    p.sceneItems[0].placement.at = [5.3, 2];
    assert.equal(itemIssues(p).length, 1);
    p.sceneItems[0].placement.at = [4, 4.7];
    assert.deepEqual(itemIssues(p), [], "low tub fits below high flight");
    p.sceneItems[0].placement.elevationMeters = 2;
    assert.equal(itemIssues(p).length, 1);
    assert.deepEqual(
      validateStairs(p).filter((i) => i.code === "stair.item-obstruction"),
      [],
      "unknown bounds are not guessed",
    );
  });
  test("closed doors do not become permanent structural solids", () => {
    const p = makeStairProject();
    const wall = { ...p.floors[0].walls[0], id: "crossing", from: [2, 1.6], to: [6, 1.6] };
    p.floors[0].walls.push(wall);
    p.floors[0].openings = [
      {
        id: "door",
        wallId: wall.id,
        kind: "door",
        offsetFromWallStartPlanUnits: 1,
        widthPlanUnits: 2,
        sillHeightMeters: 0,
        openingHeightMeters: 2.5,
      },
    ];
    assert.equal(
      validateStairs(p).some((i) => i.code === "stair.obstruction"),
      false,
    );
    p.floors[0].openings = [];
    assert.equal(validateStairs(p).find((i) => i.code === "stair.obstruction").severity, "warning");
  });
  test("landing containment detects a notch between supported corners", () => {
    const p = makeStairProject();
    p.floors[0].footprint = [
      [0, 0],
      [3.9, 0],
      [3.9, 1.2],
      [4.1, 1.2],
      [4.1, 0],
      [8, 0],
      [8, 8],
      [0, 8],
    ];
    assert.equal(validateStairs(p).find((i) => i.code === "stair.landing")?.severity, "warning");
  });
});
