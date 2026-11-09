import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";
await withModules(async (load) => {
  const { removeElevationCutWalls } = await load(
    "/packages/engine/src/elevation/cut-wall-geometry.ts",
  );

  const { elevationEdgeGeometry } = await load("/packages/engine/src/elevation/edge-geometry.ts");
  const { Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } = await import("three");
  test("a sloped edge closes its vertical side where it meets a sharp edge", () => {
    const polygon = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    const floor = {
      id: "ground",
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1 },
      rooms: [],
      outdoorPlatforms: [
        {
          id: "terrace",
          polygon,
          elevation: {
            offsetMeters: -0.5,
            edges: polygon.map((_, i) => ({
              id: `e${i}`,
              ...(i === 0 ? { transition: { kind: "sloped", widthMeters: 1 } } : {}),
            })),
          },
        },
      ],
    };
    const geometry = elevationEdgeGeometry(floor, () => -0.05);
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
    mesh.updateMatrixWorld();
    const hits = new Raycaster(
      new Vector3(-1, -0.15, -0.5),
      new Vector3(1, 0, 0),
      0,
      1.01,
    ).intersectObject(mesh);
    assert.ok(hits.length > 0, "missing side face beside the sloped transition");
    geometry.dispose();
    mesh.material.dispose();
  });
  test("terrain excavation leaves retaining faces to the elevation geometry", async () => {
    const { Shape, Path, ExtrudeGeometry } = await import("three");
    const shape = new Shape();
    shape.moveTo(-3, -3);
    shape.lineTo(3, -3);
    shape.lineTo(3, 3);
    shape.lineTo(-3, 3);
    shape.closePath();
    const hole = new Path();
    hole.moveTo(-1, -1);
    hole.lineTo(1, -1);
    hole.lineTo(1, 1);
    hole.lineTo(-1, 1);
    hole.closePath();
    shape.holes.push(hole);
    const geometry = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
    mesh.updateMatrixWorld();
    const ray = new Raycaster(new Vector3(0, 0, 0.5), new Vector3(1, 0, 0), 0, 1.1);
    assert.ok(ray.intersectObject(mesh).length > 0, "reproduce overlapping excavation wall");
    mesh.geometry = removeElevationCutWalls(geometry, { origin: [0, 0], metersPerPlanUnit: 1 }, [
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ],
    ]);
    assert.equal(
      ray.intersectObject(mesh).length,
      0,
      "excavation must not duplicate the retaining face",
    );
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  test("fractional slope widths retain a continuous plane after mesh quantization", () => {
    const polygon = [
      [0, -3],
      [3, -3],
      [3, -0.2],
      [0, -0.2],
    ];
    const floor = {
      id: "ground",
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1 },
      rooms: [],
      outdoorPlatforms: [
        {
          id: "terrace",
          polygon,
          elevation: {
            offsetMeters: -0.49,
            edges: polygon.map((_, i) => ({
              id: `e${i}`,
              ...(i === 0 ? { transition: { kind: "sloped", widthMeters: 0.61 } } : {}),
            })),
          },
        },
      ],
    };
    const geometry = elevationEdgeGeometry(floor, () => -0.05);
    const p = geometry.getAttribute("position");
    for (let i = 0; i < p.count; i += 3) {
      const area =
        (p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i)) -
        (p.getZ(i + 1) - p.getZ(i)) * (p.getX(i + 2) - p.getX(i));
      if (Math.abs(area) < 1e-8) continue;
      for (let j = i; j < i + 3; j++) {
        const expected = -0.49 + (-(p.getZ(j) + 3) / 0.61) * 0.44;
        assert.ok(
          Math.abs(p.getY(j) - expected) < 1e-6,
          `ramp vertex ${j}: ${p.getY(j)} should be ${expected}`,
        );
      }
    }
    geometry.dispose();
  });
  test("adjacent sharp areas draw a single face between their actual heights", () => {
    const polygons = [
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
      [
        [2, 0],
        [4, 0],
        [4, 2],
        [2, 2],
      ],
    ];
    const floor = {
      id: "ground",
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1 },
      rooms: [],
      outdoorPlatforms: polygons.map((polygon, i) => ({
        id: `area-${i}`,
        polygon,
        elevation: {
          offsetMeters: i === 0 ? -0.5 : 0.2,
          edges: polygon.map((_, j) => ({ id: `e${j}` })),
        },
      })),
    };
    const geometry = elevationEdgeGeometry(floor, () => -0.05);
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
    mesh.updateMatrixWorld();
    const hits = new Raycaster(
      new Vector3(1, -0.25, 0.7),
      new Vector3(1, 0, 0),
      0,
      1.1,
    ).intersectObject(mesh);
    assert.equal(hits.length, 1, "shared edge must have one owner, without overlapping faces");
    geometry.dispose();
    mesh.material.dispose();
  });
});
