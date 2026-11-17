import assert from "node:assert/strict";
import test from "node:test";
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

const rectangle = (x1, y1, x2, y2) => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];
const stone = { kind: "preset", preset: "limestone" };
const grass = { kind: "grass" };
const bark = { kind: "preset", preset: "pine-bark" };
const floor = {
  coordinates: { origin: [0, 0], metersPerPlanUnit: 1 },
  rooms: [],
  footprint: [],
};
const zone = (id, finish, polygon) => ({ id, finish, polygon });
const span = (edge) => [edge.from[0], edge.to[0]].sort((a, b) => a - b);
const alongBottom = (edges, id) =>
  edges.filter((edge) => edge.surfaceId === id && edge.from[1] === 0 && edge.to[1] === 0);

await withModules(async (load) => {
  const { groundLawnEdges } = await load(
    "/packages/engine/src/floor-finishes/ground-lawn-edges.ts",
  );

  test("contiguous finishes expose only turf-facing intervals, including reversed outlines and partial T-junctions", () => {
    const paving = zone("paving", stone, rectangle(0, 0, 9, 2).reverse());
    const mulch = zone("bed", bark, rectangle(3, -1, 6, 0));
    const lawn = zone("lawn", grass, rectangle(6, -1, 9, 0));
    // A partly overlapping, higher zone obscures the left metre of paving.
    const cover = zone("cover", bark, rectangle(-2, -1, 1, 3));
    const areas = [paving, mulch, lawn, cover];
    const edges = groundLawnEdges({ ...floor, groundZones: areas });
    const bottom = alongBottom(edges, "paving").sort((a, b) => span(a)[0] - span(b)[0]);
    assert.deepEqual(bottom.map(span), [
      [1, 3],
      [6, 9],
    ]);
    assert.deepEqual(
      bottom.map((edge) => edge.explicitGrass),
      [false, true],
    );
    assert.ok(bottom.every((edge) => edge.lawnNormal[0] === 0 && edge.lawnNormal[1] === -1));
    assert.ok(bottom.every((edge) => edge.finish === stone && !edge.platform));
    assert.ok(edges.every((edge) => edge.sourceId !== "lawn" || edge.explicitGrass));
  });

  test("a rotated grass island painted over a finish owns its inner boundary", () => {
    const bounds = rectangle(5, 3, 405, 403);
    const island = [
      [205, 100],
      [305, 200],
      [205, 300],
      [105, 200],
    ];
    const edges = groundLawnEdges({
      ...floor,
      coordinates: { origin: [10, -100], metersPerPlanUnit: 0.01 },
      groundZones: [zone("paving", stone, bounds), zone("turf", grass, island)],
    });
    const inner = edges.filter((edge) => edge.explicitGrass);
    assert.equal(inner.length, 4);
    for (const edge of inner) {
      const midpoint = edge.from.map((v, i) => (v + edge.to[i]) / 2);
      const intoIsland =
        (205 - midpoint[0]) * edge.lawnNormal[0] + (200 - midpoint[1]) * edge.lawnNormal[1];
      assert.ok(intoIsland > 0);
      assert.equal(edge.sourceId, "turf");
      assert.equal(edge.surfaceId, "paving");
    }
    assert.equal(edges.length, 8);
  });

  test("no lawn is placed against building walls, raised surfaces, stair openings or pool coping", () => {
    const path = zone("path", stone, rectangle(0, 0, 12, 1));
    const raised = {
      ...zone("deck", stone, rectangle(0, -2, 2, 0)),
      defaultEdge: { kind: "open" },
      edges: [],
      elevation: { offsetMeters: 0.8, edges: [] },
    };
    const edges = groundLawnEdges(
      {
        ...floor,
        rooms: [{ id: "inside", polygon: rectangle(7, -1, 8, 0) }],
        footprint: rectangle(7, -1, 8, 0),
        groundZones: [path],
        outdoorPlatforms: [raised],
        pools: [{ id: "basin", polygon: rectangle(4, -2, 6, 0) }],
      },
      [rectangle(9, -1, 11, 1)],
    );
    assert.ok(edges.every((edge) => edge.sourceId !== "deck"));
    assert.deepEqual(alongBottom(edges, "path").map(span), [
      [2, 3.75],
      [6.25, 7],
      [8, 9],
      [11, 12],
    ]);
  });

  test("an open platform edge meets lawn while a configured low wall keeps its hard edge", () => {
    const platform = {
      ...zone("patio", stone, rectangle(0, 0, 4, 2)),
      edges: [
        { id: "garden" },
        { id: "parapet", configuration: { kind: "low-wall", heightMeters: 0.4 } },
        { id: "back" },
        { id: "front" },
      ],
      defaultEdge: { kind: "open" },
    };
    const edges = groundLawnEdges({ ...floor, outdoorPlatforms: [platform] });
    assert.deepEqual(
      edges.map((edge) => edge.edgeIndex),
      [0, 2, 3],
    );
    assert.ok(edges.every((edge) => edge.platform && !edge.explicitGrass));
  });
  const { createTerrainSurface } = await load("/packages/engine/src/terrain/terrain-surface.ts");
  const { createFloorFinishGeometry } = await load(
    "/packages/engine/src/floor-finishes/finish-geometry.ts",
  );
  const { conformToTerrain } = await load("/packages/engine/src/terrain/terrain-geometry.ts");
  const { createTurfFringe } = await load("/packages/engine/src/floor-finishes/turf-fringe.ts");

  test("the translucent margin stays above the triangulated finish on a 1.6m grade", () => {
    const bed = zone("bed", bark, rectangle(-1, -2, 11.5, -1));
    const site = {
      ...floor,
      id: "site",
      floorToFloorHeightMeters: 3,
      footprint: rectangle(0, 0, 12, 12),
      groundZones: [bed],
    };
    const terrain = createTerrainSurface(
      { topLeftMeters: 0, topRightMeters: 1.6, bottomLeftMeters: 0, bottomRightMeters: 1.6 },
      [site],
    );
    const receiver = conformToTerrain(
      createFloorFinishGeometry(bed.polygon, site.coordinates, 1),
      terrain,
    );
    receiver.rotateX(-Math.PI / 2).translate(0, -0.044, 0);
    const fringe = createTurfFringe(groundLawnEdges(site), site.coordinates, terrain);
    const material = new MeshBasicMaterial({ side: DoubleSide });
    const top = new Mesh(fringe, material),
      finish = new Mesh(receiver, material);
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
    // Intersect both *rendered triangles*, including the space between generated vertices.
    for (let x = 0.1; x < 11.4; x += 0.07) {
      ray.ray.origin.set(x, 5, -1.02);
      const marginY = ray.intersectObject(top)[0].point.y;
      const finishY = ray.intersectObject(finish)[0].point.y;
      const clearance = marginY - finishY;
      assert.ok(clearance > 0 && clearance < 0.007, `Clearance ${clearance}m at x=${x}`);
    }
    fringe.dispose();
    receiver.dispose();
    material.dispose();
  });
});
