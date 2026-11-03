import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Shape, ShapeGeometry, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { ArchitecturalPools } = await load("/packages/engine/src/pools/ArchitecturalPools.tsx");
  const { cutPoolOpenings } = await load("/packages/engine/src/pools/pool-shapes.ts");
  const { layoutFloorFromEditorFloor } = await load("/apps/web/src/editor-preview/project-sync.ts");
  const { exportFloorSpec, importFloorSpec } = await load(
    "/packages/engine/src/home-project/legacy-floor-storage.ts",
  );
  const { collectConstructContextualIssues, constructValidationTargetForPath } = await load(
    "/apps/web/src/editor-preview/construct/contextual-validation.ts",
  );
  const { constructIssueVisualTargets, constructIssuePlanPoint } = await load(
    "/apps/web/src/editor-preview/construct/validation-visuals.ts",
  );
  const base = engine.neutralDemoManifest.floors[0];
  const pool = {
    id: "garden-pool",
    polygon: [
      [10, 0],
      [14, 0],
      [14, 3],
      [10, 3],
    ],
  };
  const floor = () => ({ ...structuredClone(base), pools: [structuredClone(pool)] });
  const project = (nextFloor = floor()) => ({
    schemaVersion: 1,
    seedRevision: "pool-test",
    home: engine.neutralDemoManifest.home,
    floor: layoutFloorFromEditorFloor(nextFloor),
    sceneItems: [],
    roomProfiles: {},
    openingProfiles: {},
    shortcuts: [],
    assumptions: [],
  });
  const registries = { furnishingModels: {}, deviceModels: {} };

  test("supports either winding and concave pool outlines, rejecting malformed and degenerate rings", () => {
    const concave = [
      [0, 0],
      [4, 0],
      [4, 2],
      [2, 2],
      [2, 4],
      [0, 4],
    ];
    assert.equal(engine.isPoolOutline(concave), true);
    assert.equal(engine.isPoolOutline([...concave].reverse()), true);
    for (const bad of [
      null,
      [],
      [
        [0, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
      [
        [0, 0],
        [2, 2],
        [0, 2],
        [2, 0],
      ],
      [...pool.polygon, pool.polygon[0]],
      [
        [0, 0],
        [2, 0],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [Infinity, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, NaN],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1, 2],
      ],
    ]) {
      assert.equal(engine.isPoolOutline(bad), false, JSON.stringify(bad));
    }
  });

  test("adds optional pools to manifest, layout and strict project schemas without changing V1", () => {
    assert.equal(engine.validateLayoutFloorSpec(base).valid, true);
    assert.deepEqual(engine.validateLayoutFloorSpec(floor()).issues, []);
    assert.equal(engine.validateHomeProject(project(), registries).valid, true);
    const unknown = project();
    unknown.floor.pools[0].depthMeters = 2;
    assert.equal(engine.parseHomeProjectSchema(unknown).valid, false);
    const malformed = floor();
    malformed.pools = "not an array";
    assert.ok(engine.validateLayoutFloorSpec(malformed).issues.some((i) => i.path === "pools"));
    const invalid = floor();
    invalid.pools[0].polygon = [
      [10, 0],
      [14, 3],
      [14, 0],
      [10, 3],
    ];
    assert.ok(
      engine.validateLayoutFloorSpec(invalid).issues.some((i) => i.path === "pools[0].polygon"),
    );
  });

  test("pool IDs share the global architecture, scene item, slot and shortcut namespace", () => {
    const duplicate = floor();
    duplicate.pools[0].id = duplicate.rooms[0].id;
    assert.ok(
      engine.validateLayoutFloorSpec(duplicate).issues.some((i) => i.code === "id.duplicate"),
    );
    const next = project();
    next.shortcuts = [{ id: pool.id, action: "home-view", context: "overview", order: 0 }];
    assert.ok(
      engine
        .validateHomeProject(next, registries)
        .issues.some((i) => i.code === "project.id-duplicate"),
    );
  });

  test("validation includes rims, wall thickness, edge crossings and containment", () => {
    const overlap = floor();
    overlap.pools[0].polygon = base.footprint;
    assert.ok(
      engine
        .validateLayoutFloorSpec(overlap)
        .issues.some((i) => i.code === "pool.building-overlap"),
    );
    const near = floor();
    const x = Math.max(...base.footprint.map((p) => p[0])) + 0.1;
    near.pools[0].polygon = [
      [x, 1],
      [x + 2, 1],
      [x + 2, 2],
      [x, 2],
    ];
    assert.ok(
      engine.validateLayoutFloorSpec(near).issues.some((i) => i.code === "pool.building-overlap"),
    );
    for (const polygon of [
      [
        [14.4, 0],
        [16, 0],
        [16, 3],
        [14.4, 3],
      ],
      [
        [11, 1],
        [12, 1],
        [12, 2],
        [11, 2],
      ],
      [
        [11, -1],
        [12, -1],
        [12, 4],
        [11, 4],
      ],
    ]) {
      const next = floor();
      next.pools.push({ id: "second-pool", polygon });
      assert.ok(engine.validateLayoutFloorSpec(next).issues.some((i) => i.code === "pool.overlap"));
    }
  });

  test("pool clearance includes exterior corner miters, not just rectangular wall runs", () => {
    const next = engine.deriveFloorTopology({
      floorId: "corner-floor",
      floorName: "Corner floor",
      rooms: [],
      openings: [],
      walls: [
        { id: "n", from: [0, 0], to: [4, 0] },
        { id: "e", from: [4, 0], to: [4, 4] },
        { id: "s", from: [4, 4], to: [0, 4] },
        { id: "w", from: [0, 4], to: [0, 0] },
      ],
    }).floor;
    // The 25 cm rounded rim clips the 10 cm miter, while remaining clear of both rectangular runs.
    next.pools = [
      {
        id: "corner-pool",
        polygon: [
          [-2, -2],
          [-0.27, -2],
          [-0.27, -0.27],
          [-2, -0.27],
        ],
      },
    ];
    const withMiter = engine.validateLayoutFloorSpec(next);
    const withoutMiter = engine.validateLayoutFloorSpec({ ...next, wallJunctions: [] });
    assert.ok(withMiter.issues.some((i) => i.code === "pool.building-overlap"));
    assert.ok(!withoutMiter.issues.some((i) => i.code === "pool.building-overlap"));
  });

  test("allows a pool in the outdoor gap between disjoint building regions", () => {
    const draft = engine.createFloorEditorDraft(base);
    const walls = [0, 10].flatMap((offset, region) => {
      const points = [
        [offset, 0],
        [offset + 3, 0],
        [offset + 3, 3],
        [offset, 3],
      ];
      return points.map((from, index) => ({
        id: `region-${region}-wall-${index}`,
        from,
        to: points[(index + 1) % 4],
      }));
    });
    const result = engine.deriveFloorTopology({
      ...draft,
      walls,
      rooms: [],
      openings: [],
      junctions: [],
      pools: [
        {
          id: "gap-pool",
          polygon: [
            [5, 0],
            [8, 0],
            [8, 3],
            [5, 3],
          ],
        },
      ],
    });
    assert.equal(result.floor.footprintRegions.length, 2);
    assert.ok(
      !engine.validateLayoutFloorSpec(result.floor).issues.some((i) => i.code.startsWith("pool.")),
    );
  });

  test("concave rims join without crossings and retain unoccupied islands in separation checks", () => {
    const outline = [
      [10, 0],
      [15, 0],
      [15, 5],
      [12.6, 5],
      [12.6, 4],
      [14, 4],
      [14, 1],
      [11, 1],
      [11, 4],
      [12.4, 4],
      [12.4, 5],
      [10, 5],
    ];
    const next = floor();
    next.pools[0].polygon = outline;
    const rim = engine.poolOuterFootprint(outline, next.coordinates);
    assert.equal(rim[0].length, 2, "the narrow inlet joins while the dry island remains open");
    next.pools.push({
      id: "island-pool",
      polygon: [
        [12, 2],
        [13, 2],
        [13, 3],
        [12, 3],
      ],
    });
    assert.ok(!engine.validateLayoutFloorSpec(next).issues.some((i) => i.code.startsWith("pool.")));
    const reverse = engine.poolOuterFootprint([...outline].reverse(), next.coordinates);
    assert.deepEqual(reverse, rim, "winding does not change the rim joins");
  });

  test("round-trips completed and semantically invalid pool drafts without changing unrelated data", () => {
    const before = project();
    const parsed = engine.parseHomeProjectSchema(JSON.parse(JSON.stringify(before)));
    assert.equal(parsed.valid, true);
    assert.deepEqual(
      engine.composeHomeManifest(parsed.project, engine.neutralDemoManifest.extensions).floors[0]
        .pools,
      [pool],
    );
    assert.deepEqual(importFloorSpec(exportFloorSpec(before.floor)).floor, before.floor);
    const draft = engine.createFloorEditorDraft(floor());
    assert.deepEqual(engine.deriveFloorTopology(draft).floor.pools, [pool]);
    const invalid = project();
    invalid.floor.pools[0].polygon = [
      [10, 0],
      [14, 3],
      [14, 0],
      [10, 3],
    ];
    assert.equal(
      engine.parseHomeProjectSchema(invalid).valid,
      true,
      "recoverable schema-shaped draft",
    );
    assert.equal(
      engine.validateHomeProject(invalid, registries).valid,
      false,
      "cannot publish invalid geometry",
    );
  });

  test("pool Apply is atomic on storage failure and invalid drafts remain recoverable", async () => {
    let raw = null,
      failWrite = false;
    const repository = engine.createHomeProjectRepository(
      {
        read: async () => raw,
        write: async (_id, value) => {
          if (failWrite) {
            failWrite = false;
            throw new Error("quota exceeded");
          }
          raw = value;
        },
      },
      registries,
    );
    const initial = await repository.replace(engine.createSeedProjectRecord(project(base), 1000));
    const saved = await engine.autosaveHomeProjectDraft(repository, initial, project(), 1100);
    assert.equal(saved.status, "saved");
    failWrite = true;
    assert.equal(
      (await engine.publishHomeProject(repository, saved.record, { now: 1200 })).status,
      "storage-error",
    );
    assert.deepEqual((await repository.load(initial.homeId)).published, initial.published);
    const published = await engine.publishHomeProject(repository, saved.record, { now: 1300 });
    assert.equal(published.status, "published");
    assert.deepEqual(published.record.published.floors[0].pools, [pool]);
    const invalid = project();
    invalid.floor.pools[0].polygon = [
      [10, 0],
      [14, 3],
      [14, 0],
      [10, 3],
    ];
    const invalidSaved = await engine.autosaveHomeProjectDraft(
      repository,
      published.record,
      invalid,
      1400,
    );
    assert.equal(invalidSaved.status, "saved");
    assert.equal(
      (await engine.publishHomeProject(repository, invalidSaved.record, { now: 1500 })).status,
      "blocked",
    );
    assert.deepEqual((await repository.load(initial.homeId)).published.floors[0].pools, [pool]);
  });

  test("scene bounds include rims and respect origin/scale without enlarging building footprints", () => {
    const next = floor();
    next.coordinates = { origin: [10, -2], metersPerPlanUnit: 0.5, scaleBasis: "measured" };
    const original = structuredClone(next.footprint);
    const bounds = engine.worldBoundsForFloorScene(next);
    assert.equal(bounds.maxX, 2.25);
    assert.deepEqual(next.footprint, original);
    const outer = engine.poolOuterFootprint(pool.polygon, next.coordinates).flat(2);
    assert.ok(outer.every((point) => point.every(Number.isFinite)));
    assert.ok(Math.max(...outer.map((p) => p[0])) <= bounds.maxX + 1e-8);
  });

  test("derives pool-edge barriers and prevents walking through the basin", () => {
    const colliders = engine.deriveWalkColliders(floor());
    assert.equal(colliders.filter((c) => c.id.startsWith(`${pool.id}-pool-edge`)).length, 4);
    const stopped = engine.resolveCircleMovement({ x: 9, z: 1.5 }, { x: 4, z: 0 }, colliders);
    assert.ok(stopped.x <= 10 - engine.POOL_RIM_WIDTH_METERS - engine.WALK_PLAYER_RADIUS + 1e-7);
    assert.deepEqual(
      engine.evaluateDerivedWalkNavigation(floor()).rooms.map((r) => r.roomId),
      base.rooms.map((r) => r.id),
    );
  });

  test("ground cutouts triangulate real holes, including concave and overlapping draft basins", () => {
    const shape = new Shape();
    shape.moveTo(0, 5);
    shape.lineTo(20, 5);
    shape.lineTo(20, -10);
    shape.lineTo(0, -10);
    shape.closePath();
    const shapes = cutPoolOpenings(shape, floor());
    assert.equal(shapes[0].holes.length, 1);
    const geometry = new ShapeGeometry(shapes);
    const positions = geometry.getAttribute("position");
    const indices = geometry.index;
    let area = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const [a, b, c] = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
      area +=
        Math.abs(
          (positions.getX(b) - positions.getX(a)) * (positions.getY(c) - positions.getY(a)) -
            (positions.getY(b) - positions.getY(a)) * (positions.getX(c) - positions.getX(a)),
        ) / 2;
    }
    const excavationArea = engine
      .poolExcavationFootprint(pool.polygon, floor().coordinates)
      .reduce(
        (sum, rings) =>
          sum +
          Math.abs(engine.polygonSignedArea(rings[0])) -
          rings
            .slice(1)
            .reduce((holes, ring) => holes + Math.abs(engine.polygonSignedArea(ring)), 0),
        0,
      );
    assert.ok(
      excavationArea > 12,
      "clearance prevents ground walls z-fighting with the basin lining",
    );
    assert.ok(Math.abs(area - (300 - excavationArea)) < 1e-5);
    geometry.dispose();
    const overlapping = floor();
    overlapping.pools.push({
      id: "overlap",
      polygon: [
        [12, 1],
        [16, 1],
        [16, 4],
        [12, 4],
      ],
    });
    assert.doesNotThrow(() => cutPoolOpenings(shape, overlapping));
    const concave = floor();
    concave.pools[0].polygon = [
      [10, 0],
      [14, 0],
      [14, 2],
      [12, 2],
      [12, 4],
      [10, 4],
    ];
    assert.equal(cutPoolOpenings(shape, concave)[0].holes.length, 1);
    assert.deepEqual(cutPoolOpenings(shape, base), [shape]);
  });

  test("outdoor finish zones leave pool water uncovered", () => {
    const next = floor();
    const zone = [
      [9, -1],
      [15, -1],
      [15, 4],
      [9, 4],
    ];
    const surfaceArea = (geometry) => {
      const positions = geometry.getAttribute("position");
      const indices = geometry.index;
      let area = 0;
      for (let index = 0; index < indices.count; index += 3) {
        const [a, b, c] = [indices.getX(index), indices.getX(index + 1), indices.getX(index + 2)];
        area +=
          Math.abs(
            (positions.getX(b) - positions.getX(a)) * (positions.getY(c) - positions.getY(a)) -
              (positions.getY(b) - positions.getY(a)) * (positions.getX(c) - positions.getX(a)),
          ) / 2;
      }
      return area;
    };
    const uncut = engine.createFloorFinishGeometry(zone, next.coordinates, 1);
    const cut = engine.createFloorFinishGeometry(zone, next.coordinates, 1, [], next);
    try {
      assert.ok(surfaceArea(uncut) - surfaceArea(cut) > 12);
    } finally {
      uncut.dispose();
      cut.dispose();
    }
  });

  test("renders fixed basin/rim/water elevations and skips malformed outlines safely", async () => {
    const renderer = await create(createElement(ArchitecturalPools, { floor: floor() }));
    try {
      assert.ok(
        Math.abs(
          renderer.scene.findByProps({ name: `pool-water-${pool.id}` }).props.position[1] + 0.17,
        ) < 1e-8,
      );
      assert.equal(
        renderer.scene.findByProps({ name: `pool-bottom-${pool.id}` }).props.position[1],
        -1.55,
      );
      const rim = renderer.scene.findByProps({ name: `pool-rim-${pool.id}` });
      assert.ok(rim.instance.geometry.getAttribute("position").count > 0);
      const invalid = floor();
      invalid.pools[0].polygon = [
        [0, 0],
        [1, 1],
        [2, 2],
      ];
      await renderer.update(createElement(ArchitecturalPools, { floor: invalid }));
      assert.equal(renderer.scene.findAllByProps({ name: `pool-water-${pool.id}` }).length, 0);
    } finally {
      await renderer.unmount();
    }
  });

  test("wooden pool lining stays clear of timber and ground and its coping overhangs the shell", async () => {
    const next = floor();
    next.coordinates = { ...next.coordinates, origin: [0, 0], metersPerPlanUnit: 1 };
    next.pools[0] = {
      id: pool.id,
      polygon: [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
      ],
      type: "above-ground-wood",
      heightMeters: 1.2,
    };
    const renderer = await create(
      createElement(ArchitecturalPools, { floor: next, reducedMotion: true }),
    );
    try {
      const root = renderer.scene.instance;
      root.updateMatrixWorld(true);
      const hits = new Raycaster(
        new Vector3(2.1, 0.55, 1.5),
        new Vector3(0, 0, -1),
      ).intersectObject(root, true);
      const conflicts = hits.filter((hit, index) =>
        hits
          .slice(index + 1)
          .some(
            (other) =>
              other.object !== hit.object && Math.abs(other.distance - hit.distance) < 1e-5,
          ),
      );
      assert.equal(
        conflicts.length,
        0,
        "liner and timber must not share the same rendered wall plane",
      );
      const bottomY = renderer.scene.findByProps({ name: `pool-bottom-${pool.id}` }).props
        .position[1];
      assert.ok(
        bottomY > engine.POOL_GROUND_Y + 0.01,
        "opaque liner floor must sit above the uncut terrain",
      );
      const wall = new Raycaster(new Vector3(2.1, 0.55, -1), new Vector3(0, 0, 1)).intersectObject(
        root,
        true,
      )[0];
      const copingY = engine.poolVerticalLayout(next.pools[0]).rim + 0.04;
      const coping = new Raycaster(
        new Vector3(2.1, copingY, -1),
        new Vector3(0, 0, 1),
      ).intersectObject(root, true)[0];
      assert.ok(coping.point.z < wall.point.z - 0.04, "coping must project beyond the timber wall");
    } finally {
      await renderer.unmount();
    }
  });

  test("wooden pools preserve settings, stand above intact ground, and align water with their height", async () => {
    const next = floor();
    next.pools[0] = { ...pool, type: "above-ground-wood", heightMeters: 1.2 };
    const draft = engine.createFloorEditorDraft(next);
    assert.deepEqual(engine.deriveFloorTopology(draft).floor.pools, next.pools);
    assert.equal(engine.validateHomeProject(project(next), registries).valid, true);
    assert.equal(
      engine.validateLayoutFloorSpec(next).issues.filter((i) => i.code.startsWith("pool.")).length,
      0,
    );
    const ground = new Shape();
    ground.moveTo(-50, -50);
    ground.lineTo(50, -50);
    ground.lineTo(50, 50);
    ground.lineTo(-50, 50);
    ground.closePath();
    assert.equal(cutPoolOpenings(ground, next)[0], ground);
    const renderer = await create(
      createElement(ArchitecturalPools, { floor: next, reducedMotion: true }),
    );
    try {
      assert.equal(
        renderer.scene.findByProps({ name: `pool-bottom-${pool.id}` }).props.position[1],
        engine.POOL_GROUND_Y + 0.025,
      );
      assert.equal(
        renderer.scene.findByProps({ name: `pool-water-${pool.id}` }).props.position[1],
        engine.POOL_WATER_Y + 1.2,
      );
      assert.equal(
        renderer.scene.findByProps({ name: `pool-rim-${pool.id}` }).props.position[1],
        engine.POOL_RIM_BASE_Y + 1.2,
      );
      assert.ok(renderer.scene.findByProps({ name: `pool-timber-${pool.id}` }));
    } finally {
      await renderer.unmount();
    }
    for (const height of [0, -1, NaN, Infinity, 6]) {
      next.pools[0].heightMeters = height;
      assert.ok(engine.validateLayoutFloorSpec(next).issues.some((i) => i.code === "pool.height"));
    }
  });

  test("pool validation paths focus and highlight the affected pool", () => {
    const target = constructValidationTargetForPath("floor.pools[0].polygon", { floor: floor() });
    assert.deepEqual(target, { kind: "pool", id: pool.id });
    const issues = collectConstructContextualIssues({
      floor: floor(),
      projectIssues: [
        {
          code: "pool.overlap",
          path: "floor.pools[0].polygon",
          severity: "error",
          message: "Pool rims overlap.",
        },
      ],
    });
    assert.deepEqual(constructIssueVisualTargets(issues[0], floor(), []), [target]);
    assert.deepEqual(constructIssuePlanPoint(issues[0], floor(), []), [12, 1.5]);
  });
});
