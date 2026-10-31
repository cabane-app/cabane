import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { create } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { makeStairProject, emptyExtensions } = await load("/tests/fixtures/multiple-floors.ts");
  const { ArchitectureScene } = await load("/packages/engine/src/ArchitectureScene.tsx");
  const { WalkCameraController } = await load("/packages/engine/src/WalkCameraController.tsx");
  const { stableArchitectureModelRegistry } = await load(
    "/packages/catalog/src/architecture/index.ts",
  );
  const { createTerrainHeightQuery } = await load(
    "/packages/engine/src/navigation/terrain-support.ts",
  );
  const { convertStairShape } = await load(
    "/apps/web/src/editor-floors/stair-placement-geometry.ts",
  );
  function projectWithSteps() {
    const project = makeStairProject();
    project.floors = [project.floors[0]];
    project.home.terrain = {
      topLeftMeters: -1.3,
      topRightMeters: -1.3,
      bottomLeftMeters: 0,
      bottomRightMeters: 0,
    };
    const floor = project.floors[0];
    const wall = floor.walls.find((wall) => wall.from[1] === 0 && wall.to[1] === 0);
    floor.openings = [
      {
        id: "garden-exit",
        wallId: wall.id,
        kind: "passage",
        variant: "rectangular",
        offsetFromWallStartPlanUnits: 3.4,
        widthPlanUnits: 1.2,
        openingHeightMeters: 2.1,
        sillHeightMeters: 0,
      },
    ];
    project.stairs = [
      {
        id: "garden-steps",
        terrain: { floorId: floor.id, end: "lower" },
        at: [4, -2.6],
        rotationYRadians: 0,
        widthMeters: 1.2,
        runMeters: 2.6,
      },
    ];
    return project;
  }
  const sceneProps = (project) => ({
    manifest: api.composeHomeManifest(project, emptyExtensions),
    floorView: "whole",
    activeFloorId: project.floors.find((floor) => !floor.belowGround).id,
    selectedRoomId: null,
    walkMode: false,
    wallFadeEnabled: false,
    reducedMotion: true,
    resolvedBindings: { rooms: {}, openings: {} },
    architectureModels: stableArchitectureModelRegistry,
    deviceModels: {},
    openingPositions: {},
    onInteract() {},
  });

  test("terrain stairs persist one floor connection, recalculate rise, and resolve the exit warning", async () => {
    const project = projectWithSteps();
    const flight = api.deriveStairFlight(project, project.stairs[0]);
    assert.ok(flight);
    assert.equal(flight.baseElevationMeters, -1.3);
    assert.equal(flight.riseMeters, 1.3);
    assert.deepEqual(api.stairFloorIds(project.stairs[0]), ["ground"]);
    assert.equal(api.validateHomeProject(project, emptyExtensions).valid, true);
    assert.deepEqual(api.validateStairs(project), []);
    assert.equal(
      api
        .validateHomeProject(project, emptyExtensions)
        .issues.filter((issue) => issue.code === "terrain.exit-height").length,
      0,
    );
    const parsed = api.parseHomeProject(api.serializeHomeProject(project));
    assert.equal(parsed.valid, true);
    assert.deepEqual(parsed.project.stairs, project.stairs);
    for (const style of ["open", "concrete", "stone"]) {
      const styled = structuredClone(project);
      styled.stairs[0].style = style;
      const restored = api.parseHomeProject(api.serializeHomeProject(styled));
      assert.equal(restored.valid, true);
      assert.equal(restored.project.stairs[0].style, style);
    }
    const unknownStyle = structuredClone(project);
    unknownStyle.stairs[0].style = "unknown";
    assert.equal(api.parseHomeProjectSchema(unknownStyle).valid, false);
    const mixedConnection = structuredClone(project);
    mixedConnection.stairs[0].lowerFloorId = "ground";
    assert.equal(
      api.parseHomeProjectSchema(mixedConnection).valid,
      false,
      "a stair cannot store two connection kinds",
    );
    const unknownConnection = structuredClone(project);
    unknownConnection.stairs[0].terrain.end = "side";
    assert.equal(api.parseHomeProjectSchema(unknownConnection).valid, false);
    const pooled = structuredClone(project);
    pooled.floors[0].pools = [
      {
        id: "pool",
        polygon: [
          [3, -3.3],
          [5, -3.3],
          [5, -2.65],
          [3, -2.65],
        ],
      },
    ];
    assert.ok(
      api.validateStairs(pooled).some((issue) => issue.code === "stair.landing"),
      "pool cutouts cannot support the ground landing",
    );
    project.home.terrain.topLeftMeters = project.home.terrain.topRightMeters = -1.8;
    assert.equal(api.deriveStairFlight(project, project.stairs[0]).riseMeters, 1.8);
    const detached = structuredClone(project);
    detached.stairs[0].at[0] = 6;
    assert.equal(
      api
        .validateHomeProject(detached, emptyExtensions)
        .issues.filter((issue) => issue.code === "terrain.exit-height").length,
      1,
    );
    const repository = api.createHomeProjectRepository(
      api.createMemoryProjectRecordStore(),
      emptyExtensions,
    );
    const record = await repository.replace(api.createSeedProjectRecord(project));
    assert.deepEqual(record.draft.stairs, project.stairs);
  });

  test("placement connects a floor-first route in either direction and shape changes retain its floor landing", () => {
    const project = projectWithSteps();
    const raw = { ...project.stairs[0], at: [4, 0], rotationYRadians: Math.PI };
    const placed = api.connectStairToTerrain(project, raw);
    placed.style = "stone";
    const flight = api.deriveStairFlight(project, placed);
    assert.ok(flight);
    assert.ok(Math.abs(flight.path.at(-1).x - 4) < 1e-8);
    assert.ok(Math.abs(flight.path.at(-1).z) < 1e-8);
    for (const shape of ["l-shaped", "u-shaped", "spiral", "straight"]) {
      const converted = convertStairShape(project, placed, shape);
      const changed = api.deriveStairFlight(project, converted);
      assert.ok(changed, shape);
      assert.equal(converted.style, "stone");
      assert.ok(Math.abs(changed.path.at(-1).x - 4) < 1e-7, `${shape}: floor x`);
      assert.ok(Math.abs(changed.path.at(-1).z) < 1e-7, `${shape}: floor z`);
    }
    const basement = structuredClone(project.floors[0]);
    basement.id = "basement";
    basement.belowGround = true;
    project.floors.unshift(basement);
    const ascending = api.connectStairToTerrain(project, {
      ...raw,
      terrain: { floorId: "basement", end: "upper" },
    });
    assert.equal(ascending.terrain.end, "upper");
    assert.ok(api.deriveStairFlight(project, ascending));
  });

  test("a closed ground-floor door opens when returning up terrain stairs from the basement level", async () => {
    const project = projectWithSteps();
    project.home.terrain.topLeftMeters = project.home.terrain.topRightMeters = -1.9;
    const ground = project.floors[0];
    ground.openings[0] = {
      ...ground.openings[0],
      kind: "door",
      variant: "flush",
      operation: "hinged",
      finish: "white",
      leafCount: 1,
    };
    project.floors.unshift({
      ...makeStairProject().floors[1],
      belowGround: true,
      openings: [
        {
          ...ground.openings[0],
          id: "basement-exit",
          wallId: ground.openings[0].wallId.replace("ground-", "first-"),
        },
      ],
    });
    const levels = api.deriveFloorLevels(project.floors);
    const poseRef = { current: { x: 4, z: 0.8, yaw: 0, pitch: 0 } };
    const movementInputRef = { current: { x: 0, y: -1 } };
    let floorId = ground.id;
    let automatic = new Set();
    let reopenedFromBasement = false;
    const manifest = api.composeHomeManifest(project, emptyExtensions);
    const render = () => {
      const openingPositions = Object.fromEntries([...automatic].map((id) => [id, 1]));
      return React.createElement(
        "group",
        null,
        React.createElement(ArchitectureScene, {
          ...sceneProps(project),
          manifest,
          activeFloorId: floorId,
          walkMode: true,
          openingPositions,
        }),
        React.createElement(WalkCameraController, {
          building: manifest,
          floor: manifest.floors.find((floor) => floor.id === floorId),
          elevation: levels.find((level) => level.floorId === floorId).elevationMeters,
          poseRef,
          movementInputRef,
          lookInputRef: { current: { x: 0, y: 0 } },
          lookDeltaRef: { current: { x: 0, y: 0 } },
          reducedMotion: true,
          openingPositions,
          onOpeningsChange(ids) {
            automatic = ids;
            if (floorId === project.floors[0].id && ids.has("garden-exit"))
              reopenedFromBasement = true;
          },
          onFloorChange(id) {
            floorId = id;
          },
          onRoomChange() {},
        }),
      );
    };
    const renderer = await create(render());
    const advance = async (count) => {
      for (let i = 0; i < count; i++) {
        await renderer.update(render());
        await renderer.advanceFrames(1, 1 / 60);
      }
    };
    try {
      await advance(1);
      assert.equal(automatic.has("garden-exit"), true);
      assert.equal(
        automatic.has("basement-exit"),
        false,
        "a stacked door on another level stays closed",
      );
      await advance(119);
      assert.ok(poseRef.current.z < -3, "walker leaves through the door and reaches terrain");
      assert.equal(floorId, project.floors[0].id, "outside selects the nearby basement level");
      assert.equal(automatic.has("garden-exit"), false, "the door closes after departure");
      reopenedFromBasement = false;
      movementInputRef.current.y = 1;
      await advance(120);
      assert.ok(
        poseRef.current.z > 0.6,
        `the ground-floor door must reopen before its threshold: ${JSON.stringify(poseRef.current)}`,
      );
      assert.equal(floorId, ground.id);
      assert.equal(reopenedFromBasement, true, "the door opens before the floor selection changes");
    } finally {
      await renderer.unmount();
    }
  });

  for (const [basement, drop, style] of [
    [false, 1.3, "concrete"],
    [true, 1.3, "stone"],
    [true, 2.8, "open"],
  ])
    test(`rendered terrain stairs support a complete down-and-up Walk over ${drop} m ${basement ? "above a basement" : "without a basement"}`, async () => {
      const project = projectWithSteps();
      project.stairs[0].style = style;
      project.home.terrain.topLeftMeters = project.home.terrain.topRightMeters = -drop;
      if (basement) project.floors.unshift({ ...makeStairProject().floors[1], belowGround: true });
      const renderer = await create(React.createElement(ArchitectureScene, sceneProps(project)));
      try {
        const scene = renderer.scene.instance;
        scene.updateMatrixWorld(true);
        const terrainHeight = createTerrainHeightQuery(scene, 0);
        const prepared = api.prepareBuildingWalk(project);
        let pose = { x: 4, z: 0.8, floorId: "ground", elevation: 0 };
        const move = (direction) => {
          pose = api.moveBuildingWalker(
            project,
            pose,
            { x: 0, z: direction * 0.04 },
            new Set(),
            [],
            prepared,
            {},
            {
              terrainHeight,
              verticalRange: { minY: pose.elevation + 0.08, maxY: pose.elevation + 1.8 },
            },
          );
        };
        for (let i = 0; i < 100; i++) move(-1);
        assert.ok(pose.z < -3, `outside: ${JSON.stringify(pose)}`);
        assert.ok(Math.abs(pose.elevation + drop) < 0.01);
        assert.equal(pose.stairId, undefined);
        for (let i = 0; i < 100; i++) move(1);
        assert.ok(pose.z > 0.6, `inside: ${JSON.stringify(pose)}`);
        assert.equal(pose.elevation, 0);
        assert.equal(pose.stairId, undefined);
        for (const view of [{ floorView: "cutaway" }, { walkMode: true }]) {
          await renderer.update(
            React.createElement(ArchitectureScene, { ...sceneProps(project), ...view }),
          );
          assert.ok(renderer.scene.instance.getObjectByName("stair-garden-steps"));
        }
      } finally {
        await renderer.unmount();
      }
    });
});
