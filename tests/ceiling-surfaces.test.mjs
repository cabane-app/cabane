import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Raycaster, ShapeUtils, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { CeilingSurfaces } = await load(
    "/packages/engine/src/architecture-scene/CeilingSurfaces.tsx",
  );
  const { PlatformSlab } = await load("/packages/engine/src/outdoor-platforms/PlatformSlab.tsx");
  const { derivePlatformSlabPieces } = await load(
    "/packages/engine/src/outdoor-platforms/platform-slab-coverage.ts",
  );
  const { cutSurfaceShapes } = await load("/packages/engine/src/stairs/surface-apertures.tsx");
  const { ArchitectureScene } = await load("/packages/engine/src/ArchitectureScene.tsx");
  const { composeHomeManifest, polygonSignedArea } = await load("/packages/engine/src/index.ts");
  const { makeStairProject, emptyExtensions } = await load("/tests/fixtures/multiple-floors.ts");

  test("nearly coincident terrace edges preserve basement slabs, ceiling holes and every scene view", async () => {
    const polygon = [
      [0, 0],
      [8, 0.2],
      [8.2, 6],
      [0.15, 5.76],
    ];
    const platformPolygon = [
      [0.15, 0.318533 + Number.EPSILON],
      [-3, 0.318533],
      [-3, 5.76],
      [0.15, 5.76],
    ];
    const project = makeStairProject();
    project.stairs = [];
    project.home.terrain = {
      topLeftMeters: 0,
      topRightMeters: 0,
      bottomLeftMeters: -1,
      bottomRightMeters: -2,
    };
    project.floors = project.floors.slice(0, 2).map((floor, index) => ({
      ...floor,
      ...(index === 0 ? { belowGround: true } : {}),
      footprint: polygon,
      rooms: [{ ...floor.rooms[0], polygon }],
      walls: [],
      wallJunctions: [],
      ceilings: [
        {
          id: `${floor.id}-ceiling`,
          kind: "flat",
          roomIds: [floor.rooms[0].id],
          heightMeters: 2.4,
        },
      ],
    }));
    const platform = {
      id: "terrace",
      polygon: platformPolygon,
      finish: { kind: "preset", preset: "travertine" },
      defaultEdge: { kind: "railing", heightMeters: 1 },
      edges: platformPolygon.map((_, index) => ({ id: `terrace-edge-${index}` })),
    };
    project.floors[1].outdoorPlatforms = [platform];
    const manifest = composeHomeManifest(project, emptyExtensions);
    const [below, upper] = manifest.floors;
    const original = JSON.stringify(project);
    const area = (rings) =>
      Math.abs(polygonSignedArea(rings[0])) -
      rings.slice(1).reduce((sum, ring) => sum + Math.abs(polygonSignedArea(ring)), 0);
    const pieces = derivePlatformSlabPieces(platform, upper, below);
    assert.equal(pieces.length, 2, "both covered and exposed slab pieces survive");
    assert.ok(
      Math.abs(
        pieces.reduce((sum, piece) => sum + area(piece.polygon), 0) -
          Math.abs(polygonSignedArea(platformPolygon)),
      ) < 1e-6,
    );
    const covered = pieces
      .filter((piece) => Math.abs(piece.depth - 0.2) < 1e-7)
      .reduce((sum, piece) => sum + area(piece.polygon), 0);
    assert.ok(covered > 0);
    const hole = [
      [2, 2],
      [3, 2],
      [3, 3],
      [2, 3],
    ];
    const shapes = cutSurfaceShapes(polygon, below.coordinates, [platformPolygon, hole]);
    assert.equal(
      shapes.reduce((sum, shape) => sum + shape.holes.length, 0),
      1,
    );
    const ceilingArea = shapes.reduce((sum, shape) => {
      const points = shape.extractPoints();
      return (
        sum +
        Math.abs(ShapeUtils.area(points.shape)) -
        points.holes.reduce((n, ring) => n + Math.abs(ShapeUtils.area(ring)), 0)
      );
    }, 0);
    assert.ok(Math.abs(ceilingArea - (Math.abs(polygonSignedArea(polygon)) - covered - 1)) < 1e-6);
    for (const floorView of ["whole", "cutaway", "walk"]) {
      const renderer = await create(
        createElement(ArchitectureScene, {
          manifest,
          floorView,
          activeFloorId: upper.id,
          selectedRoomId: null,
          walkMode: floorView === "walk",
          wallFadeEnabled: false,
          reducedMotion: true,
          resolvedBindings: { rooms: {}, openings: {} },
          architectureModels: {},
          deviceModels: {},
          openingPositions: {},
          onInteract() {},
        }),
      );
      try {
        assert.ok(renderer.scene.findAllByType("Mesh").length > 0);
        renderer.scene.instance.traverse((object) => {
          const positions = object.geometry?.getAttribute("position");
          if (positions) assert.ok([...positions.array].every(Number.isFinite));
        });
      } finally {
        await renderer.unmount();
      }
    }
    assert.equal(JSON.stringify(project), original, "rendering never rounds saved coordinates");
  });

  test("a single-room walk ceiling stays within its floor footprint", async () => {
    const footprint = [
      [-3.6, -3.2],
      [2.2, -3.2],
      [2.2, 0.2],
      [-3.6, 0.2],
    ];
    const floor = {
      id: "ground-floor",
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      footprint,
      rooms: [{ id: "room", polygon: footprint }],
      ceilings: [{ id: "ceiling", kind: "flat", roomIds: ["room"], heightMeters: 2.4 }],
    };
    const renderer = await create(createElement(CeilingSurfaces, { floor }));
    try {
      const meshes = renderer.scene.findAllByType("Mesh");
      assert.equal(meshes.length, 1);
      const geometry = meshes[0].instance.geometry;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      assert.ok(box.max.x - box.min.x <= 5.81, `ceiling width: ${box.max.x - box.min.x}`);
      assert.ok(box.max.y - box.min.y <= 3.41, `ceiling depth: ${box.max.y - box.min.y}`);
    } finally {
      await renderer.unmount();
    }
  });

  test("an upper outdoor platform retains the lower room ceiling underside", async () => {
    const polygon = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ];
    const below = {
      id: "lower",
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      footprint: polygon,
      rooms: [{ id: "living", polygon }],
      ceilings: [{ id: "living-ceiling", kind: "flat", roomIds: ["living"], heightMeters: 3 }],
      defaultCeilingHeightMeters: 3,
      floorToFloorHeightMeters: 3.2,
    };
    const platform = {
      id: "upper-balcony",
      polygon,
      finish: { kind: "preset", preset: "travertine" },
      defaultEdge: { kind: "railing", heightMeters: 1 },
      edges: polygon.map((_, index) => ({ id: `upper-balcony:edge-${index}` })),
    };
    const upper = { ...below, id: "upper", outdoorPlatforms: [platform] };
    const ceilingRenderer = await create(createElement(CeilingSurfaces, { floor: below }));
    const platformRenderer = await create(
      createElement(PlatformSlab, { platform, floor: upper, below }),
    );
    try {
      const ceilingMaterial = ceilingRenderer.scene.findByType("Mesh").instance.material;
      const structure = platformRenderer.scene.findByProps({
        name: "platform-slab-upper-balcony-structure-0",
      }).instance;
      const liner = platformRenderer.scene.findByProps({
        name: "platform-slab-upper-balcony-ceiling-0",
      }).instance;
      structure.updateMatrixWorld(true);
      liner.updateMatrixWorld(true);
      const [undersideHit] = new Raycaster(
        new Vector3(2, -2, 2),
        new Vector3(0, 1, 0),
      ).intersectObject(liner);
      assert.ok(undersideHit, "an upward view must hit the platform underside");
      assert.equal(
        `#${liner.material.color.getHexString()}`,
        `#${ceilingMaterial.color.getHexString()}`,
      );
      assert.equal(liner.receiveShadow, false);
      assert.equal(structure.receiveShadow, true);
      assert.ok(liner.position.y < structure.position.y);
    } finally {
      await ceilingRenderer.unmount();
      await platformRenderer.unmount();
    }
  });
});
