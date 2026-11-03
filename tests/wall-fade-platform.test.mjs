import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { wallExteriorNormal } = await load(
    "/packages/engine/src/architecture-geometry/wall-coordinate-frame.ts",
  );
  const { buildArchitecturalWallGeometries, buildContinuousWallGeometry } = await load(
    "/packages/engine/src/architecture-geometry.ts",
  );
  const { junctionCornerMiterPolygon } = await load(
    "/packages/engine/src/architecture-geometry/wall-solid-footprints.ts",
  );
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { cameraFacingWallOpacity, WALL_FADE_MIN_OPACITY } = await load(
    "/packages/engine/src/wall-fade.ts",
  );
  // A 4 x 4 m building with a 4 x 2 m outdoor platform on its south side (z 4 to 6).
  const floor = {
    coordinates: { metersPerPlanUnit: 1, origin: [0, 0], scaleBasis: "measured" },
    footprint: [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
    outdoorPlatforms: [
      {
        id: "terrace",
        polygon: [
          [0, 4],
          [4, 4],
          [4, 6],
          [0, 6],
        ],
        finish: { kind: "preset", preset: "travertine" },
        defaultEdge: { kind: "open" },
        edges: [],
      },
    ],
    walls: [],
    wallJunctions: [],
  };
  const wall = (from, to, classification = "exterior") => ({
    id: "w",
    from,
    to,
    classification,
    thicknessMeters: 0.15,
  });
  const assertNormal = (actual, expected) => {
    assert.ok(actual, "wall has an outward fade direction");
    assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 1e-9);
  };

  test("a house wall still faces away from the building", () => {
    assertNormal(wallExteriorNormal(wall([0, 0], [4, 0]), floor), [0, -1]);
  });

  test("a house wall that borders the platform keeps facing the platform side", () => {
    assertNormal(wallExteriorNormal(wall([0, 4], [4, 4]), floor), [0, 1]);
  });

  test("platform perimeter walls fade only toward the outside regardless of drawing direction", () => {
    for (const [from, to, expected] of [
      [
        [0, 4.5],
        [0, 5.5],
        [-1, 0],
      ],
      [
        [4, 4.5],
        [4, 5.5],
        [1, 0],
      ],
      [
        [1, 5.95],
        [3, 5.95],
        [0, 1],
      ],
    ]) {
      for (const endpoints of [
        [from, to],
        [to, from],
      ]) {
        const normal = wallExteriorNormal(wall(...endpoints), floor);
        assertNormal(normal, expected);
        assert.equal(cameraFacingWallOpacity(true, expected, normal), WALL_FADE_MIN_OPACITY);
        assert.equal(
          cameraFacingWallOpacity(
            true,
            expected.map((v) => -v),
            normal,
          ),
          1,
        );
        assert.equal(cameraFacingWallOpacity(false, expected, normal), 1);
      }
    }
  });

  test("platform fading respects rotated plans, non-metre units and coordinate origins", () => {
    const coordinates = { ...floor.coordinates, metersPerPlanUnit: 0.025, origin: [120, -80] };
    const rotate = ([x, z]) => [(x - z) * Math.SQRT1_2, (x + z) * Math.SQRT1_2];
    const toPlan = (point) =>
      rotate(point).map(
        (value, axis) => value / coordinates.metersPerPlanUnit + coordinates.origin[axis],
      );
    const transformed = {
      ...floor,
      coordinates,
      footprint: floor.footprint.map(toPlan),
      outdoorPlatforms: floor.outdoorPlatforms.map((platform) => ({
        ...platform,
        polygon: platform.polygon.map(toPlan),
      })),
    };
    assertNormal(
      wallExteriorNormal(wall(toPlan([1, 5.95]), toPlan([3, 5.95])), transformed),
      rotate([0, 1]),
    );
  });

  test("disconnected building footprints take precedence over surrounding platforms", () => {
    assertNormal(
      wallExteriorNormal(wall([1, 5], [3, 5]), {
        ...floor,
        footprintRegions: [
          floor.footprint,
          [
            [0, 4],
            [4, 4],
            [4, 5],
            [0, 5],
          ],
        ],
      }),
      [0, 1],
    );
  });

  test("walls with no unambiguous outside keep no fade direction", () => {
    assert.equal(wallExteriorNormal(wall([10, 10], [10, 12]), floor), null);
    assert.equal(wallExteriorNormal(wall([0, 4.5], [0, 5.5], "interior"), floor), null);
    assert.equal(wallExteriorNormal(wall([2, 5], [2, 5.5]), floor), null);
    assert.equal(wallExteriorNormal(wall([1, 2], [3, 2]), floor), null);
    assert.equal(
      wallExteriorNormal(wall([0, 4.5], [0, 5.5]), { ...floor, outdoorPlatforms: undefined }),
      null,
    );
    assert.equal(
      wallExteriorNormal(wall([4, 4.5], [4, 5.5]), {
        ...floor,
        outdoorPlatforms: [
          ...floor.outdoorPlatforms,
          {
            ...floor.outdoorPlatforms[0],
            id: "neighbor",
            polygon: [
              [4, 4],
              [6, 4],
              [6, 6],
              [4, 6],
            ],
          },
        ],
      }),
      null,
    );
  });

  test("platform corners keep their miter, exterior finish and wall fade groups", () => {
    const east = { ...wall([4, 4.5], [4, 6]), id: "east" };
    const south = { ...wall([4, 6], [1, 6]), id: "south" };
    const junction = { id: "corner", at: [4, 6], wallIds: [east.id, south.id] };
    const cornerFloor = {
      ...neutralDemoManifest.floors[0],
      ...floor,
      walls: [east, south],
      wallJunctions: [junction],
      openings: [],
    };
    const miter = junctionCornerMiterPolygon(junction, cornerFloor.walls, cornerFloor);
    assert.ok(miter?.[0].some(([x, z]) => Math.hypot(x - 4.075, z - 6.075) < 1e-9));

    const standalone = buildContinuousWallGeometry(east, cornerFloor, []);
    try {
      const exterior = standalone.groups.find((group) => group.materialIndex === 1);
      assert.ok(exterior?.count > 0, "standalone wall has an exterior face");
      const normals = standalone.getAttribute("normal");
      for (let index = exterior.start; index < exterior.start + exterior.count; index++)
        assert.ok(normals.getX(index) > 0.999, "exterior finish faces away from the platform");
    } finally {
      standalone.dispose();
    }

    const groups = buildArchitecturalWallGeometries(cornerFloor);
    try {
      assert.ok(groups.length > 0);
      assert.ok(groups.every(({ fadeNormals }) => fadeNormals.length > 0));
      assert.ok(groups.some(({ fadeNormals }) => fadeNormals.some(([x, z]) => x === 1 && z === 0)));
      assert.ok(groups.some(({ fadeNormals }) => fadeNormals.some(([x, z]) => x === 0 && z === 1)));
    } finally {
      groups.forEach(({ geometry }) => geometry.dispose());
    }
  });
});
