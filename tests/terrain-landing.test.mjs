import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { createTerrainSupportQuery } = await load(
    "/packages/engine/src/navigation/terrain-support.ts",
  );
  const { resolveWalkLanding } = await load("/packages/engine/src/navigation/walk-landing.ts");
  const { DioramaGround } = await load("/packages/engine/src/architecture-scene/DioramaGround.tsx");
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { homeGroundFrame, orbitDioramaFrame } = await load(
    "/packages/engine/src/architecture-scene/diorama-frame.ts",
  );
  test("Orbit's plot includes detached rotated models and walls in world metres", () => {
    const floor = {
      ...neutralDemoManifest.floors[0],
      coordinates: { origin: [10, 10], metersPerPlanUnit: 0.5, scaleBasis: "measured" },
      footprint: [
        [10, 10],
        [18, 10],
        [18, 18],
        [10, 18],
      ],
      footprintRegions: [],
      groundZones: [],
      outdoorPlatforms: [],
      hedges: [],
      pools: [],
      openings: [],
      rooms: [],
      walls: [{ id: "garden-wall", from: [10, 24], to: [15, 24], thicknessMeters: 0.2 }],
    };
    const manifest = {
      ...neutralDemoManifest,
      floors: [floor],
      stairs: [],
      extensions: {
        ...neutralDemoManifest.extensions,
        furnishingModels: {
          pergola: { defaultSize: [2, 2, 4], bounds: { min: [0, 0, -1], max: [2, 2, 3] } },
        },
      },
      sceneItems: [
        {
          id: "pergola",
          floorId: floor.id,
          kind: "furnishing",
          modelId: "pergola",
          size: [4, 2, 8],
          placement: {
            kind: "absolute",
            at: [30, 14],
            elevationMeters: 0,
            rotationYRadians: Math.PI / 2,
          },
        },
      ],
    };
    const frame = orbitDioramaFrame(manifest, {});
    assert.ok(Math.abs(frame.centerX + frame.width / 2 - 16.9) < 1e-8);
    assert.ok(Math.abs(frame.centerZ - frame.depth / 2 + 2.9) < 1e-8);
    assert.ok(Math.abs(frame.centerZ + frame.depth / 2 - 8.1) < 1e-8);
    manifest.sceneItems[0].modelId = "unknown";
    assert.equal(orbitDioramaFrame(manifest, {}), null);
  });
  const { worldBoundsForFloorScene } = await load("/packages/engine/src/pools/pool-footprint.ts");
  const { worldPointToPlan } = await load("/packages/engine/src/geometry.ts");
  const { createWalkParcel } = await load("/packages/engine/src/navigation/walk-parcel.ts");
  const { resolveCircleMovement } = await load("/packages/engine/src/navigation/walk-motion.ts");
  const { safeBuildingSpawn } = await load("/packages/engine/src/stairs/stair-navigation.ts");
  test("Walk and Construct share the automatic Walk board and keep movement and relocation inside edited edges", () => {
    const manifest = { ...neutralDemoManifest, stairs: [], sceneItems: [] };
    const floor = manifest.floors[0];
    const legacy = homeGroundFrame(manifest, {}, "walk");
    const bounds = worldBoundsForFloorScene(floor);
    assert.equal(legacy.width, Math.max(bounds.width, bounds.depth) + 7);
    assert.equal(legacy.depth, legacy.width);
    assert.deepEqual(homeGroundFrame(manifest, {}), legacy);
    const edited = {
      ...manifest,
      home: { ...manifest.home, groundMargins: { left: 1.6, right: 2.1, top: 0.6, bottom: 1.4 } },
    };
    const frame = homeGroundFrame(edited, {}, "walk");
    assert.deepEqual(frame, homeGroundFrame(edited, {}, "orbit"));
    const parcel = createWalkParcel(frame);
    const center = { x: frame.centerX, z: frame.centerZ };
    const corner = { x: frame.centerX + frame.width / 2, z: frame.centerZ + frame.depth / 2 };
    const right = corner.x - 0.05 - 0.22;
    const moved = resolveCircleMovement(center, { x: 100, z: 0 }, [], undefined, undefined, parcel);
    assert.ok(Math.abs(moved.x - right) < 1e-8);
    const slide = resolveCircleMovement(moved, { x: 1, z: 0.8 }, [], undefined, undefined, parcel);
    assert.ok(Math.abs(slide.z - moved.z - 0.8) < 1e-8 && Math.abs(slide.x - right) < 1e-8);
    const diagonal = resolveCircleMovement(
      slide,
      { x: 20, z: 20 },
      [],
      undefined,
      undefined,
      parcel,
    );
    assert.ok(parcel.contains(diagonal) && diagonal.x < right && diagonal.z < corner.z - 0.22);
    assert.equal(
      safeBuildingSpawn(
        edited,
        floor.id,
        worldPointToPlan(corner, edited.coordinates),
        () => true,
        [],
        parcel,
      ),
      null,
    );
    assert.equal(
      resolveWalkLanding(
        edited,
        { ...corner, y: 0 },
        () => [],
        () => true,
        parcel,
      ),
      null,
    );
    assert.ok(
      parcel.contains(safeBuildingSpawn(edited, floor.id, undefined, undefined, [], parcel)),
    );
  });
  test("terrain landings use the rendered outline and pool holes, without relaxing other-floor or obstacle checks", async () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    floor.pools = [
      {
        id: "pool",
        polygon: [
          [5, 0],
          [7, 0],
          [7, 2],
          [5, 2],
        ],
      },
    ];
    const building = {
      coordinates: floor.coordinates,
      floors: [floor, { ...floor, id: "upper" }],
      stairs: [],
      sceneItems: [],
    };
    const renderer = await create(
      createElement(DioramaGround, {
        floor,
        centerX: 2.4,
        centerZ: 1.8,
        size: 12,
        color: "#91a06a",
      }),
    );
    try {
      const scene = renderer.scene.instance;
      const supports = createTerrainSupportQuery(scene);
      assert.equal(supports({ x: 2.4, z: 5 }), true, "rendered terrain support");
      const land = (x, z, y = 0, obstacles = []) =>
        resolveWalkLanding(building, { x, y, z }, () => obstacles, supports);
      assert.ok(land(2.4, 5), "outdoor terrain supports relocation");
      assert.equal(land(6, 1), null, "pool interior has no support");
      assert.equal(land(7.1, 1), null, "the whole player radius must clear the pool cutout");
      assert.equal(land(8.3, 4), null, "terrain edge does not support the whole player");
      assert.equal(land(40, 4), null, "void beyond the diorama");
      assert.equal(land(2.4, 5, 2.8), null, "terrain cannot support an upper-floor exit");
      assert.equal(land(2.4, 3.6), null, "wall collision still rejects a landing");
      assert.equal(
        land(2.4, 5, 0, [{ kind: "box", id: "obstacle", minX: 2, maxX: 3, minZ: 4, maxZ: 6 }]),
        null,
      );
      const terrain = scene.getObjectByName("diorama-ground");
      terrain.raycast = () => undefined;
      assert.ok(
        land(2.4, 5),
        "support remains available while another storey owns interaction picking",
      );
      assert.equal(
        resolveWalkLanding(building, { x: 2.4, y: 0, z: 5 }, () => []),
        null,
        "no terrain inference without injected geometry support",
      );
    } finally {
      await renderer.unmount();
    }
  });
});
