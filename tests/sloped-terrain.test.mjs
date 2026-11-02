import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { create } from "@react-three/test-renderer";
import { Mesh, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

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
  const { createTerrainSurface } = await load("/packages/engine/src/terrain/terrain-surface.ts");
  const { resolveTerrainWalking } = await load(
    "/packages/engine/src/navigation/terrain-walking.ts",
  );
  const { resolveWalkFall } = await load("/packages/engine/src/navigation/walk-fall.ts");
  const { editProject } = await load("/apps/web/src/editor-workspace/editor-project-actions.ts");
  const { TerrainSettingsEditor } = await load(
    "/apps/web/src/editor-preview/construct/TerrainSettingsEditor.tsx",
  );
  const { collectConstructContextualIssues } = await load(
    "/apps/web/src/editor-preview/construct/contextual-validation.ts",
  );
  const { constructIssuePlanPoint } = await load(
    "/apps/web/src/editor-preview/construct/validation-visuals.ts",
  );
  const terrain = {
    topLeftMeters: -2.6,
    topRightMeters: -2.6,
    bottomLeftMeters: 0,
    bottomRightMeters: 0,
  };
  const rectangle = (x, z, w, d) => [
    [x, z],
    [x + w, z],
    [x + w, z + d],
    [x, z + d],
  ];
  const projectWithGarage = () => {
    const project = makeStairProject();
    return {
      ...project,
      stairs: [],
      floors: project.floors
        .slice(0, 2)
        .map((floor, index) => ({ ...floor, ...(index === 0 ? { belowGround: true } : {}) })),
    };
  };
  const near = (a, b) => assert.ok(Math.abs(a - b) < 0.025, `${a} ≠ ${b}`);

  const exitProject = (height = -1) => {
    const project = projectWithGarage();
    project.floors = [project.floors[1]];
    project.home.terrain = Object.fromEntries(Object.keys(terrain).map((key) => [key, height]));
    const floor = project.floors[0];
    const wall = floor.walls.find((wall) => wall.from[1] === 0 && wall.to[1] === 0);
    const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
    floor.openings = [
      {
        id: "outside-exit",
        wallId: wall.id,
        kind: "passage",
        variant: "rectangular",
        offsetFromWallStartPlanUnits: length / 2 - 0.6,
        widthPlanUnits: 1.2,
        openingHeightMeters: 2.1,
        sillHeightMeters: 0,
      },
    ];
    return project;
  };
  const exitWarnings = (project) =>
    api
      .validateHomeProject(project, emptyExtensions)
      .issues.filter((issue) => issue.code === "terrain.exit-height");
  const landingPlatform = (polygon, id = "landing") => ({
    id,
    polygon,
    finish: { kind: "preset", preset: "travertine" },
    defaultEdge: { kind: "railing", heightMeters: 1 },
    edges: polygon.map((_, index) => ({ id: `${id}-edge-${index}` })),
  });

  test("terrain exit warnings share Walk's step limit and do not require a basement", () => {
    for (const height of [-1, -0.30001, 0.30001, 1]) {
      const project = exitProject(height);
      const result = api.validateHomeProject(project, emptyExtensions);
      assert.equal(result.valid, true, JSON.stringify(result.issues));
      assert.equal(exitWarnings(project).length, 1);
      assert.equal(exitWarnings(project)[0].severity, "warning");
    }
    for (const height of [-0.3, 0.3, 0]) assert.equal(exitWarnings(exitProject(height)).length, 0);
    const project = exitProject();
    const basement = projectWithGarage().floors[0];
    project.floors.unshift(basement);
    assert.equal(
      exitWarnings(project).length,
      1,
      "an unconnected basement does not bridge the doorway drop",
    );
    project.floors[1].openings = [];
    basement.openings = [
      {
        ...exitProject().floors[0].openings[0],
        wallId: basement.walls.find((w) => w.from[1] === 0 && w.to[1] === 0).id,
      },
    ];
    project.home.terrain = Object.fromEntries(Object.keys(terrain).map((key) => [key, -2.6]));
    assert.equal(exitWarnings(project).length, 0, "a near-level basement entrance is usable");
    project.floors = [exitProject().floors[0]];
    project.home.apartmentFloor = 2;
    assert.equal(exitWarnings(project).length, 0);
    delete project.home.apartmentFloor;
    project.floors[0].openings = [
      {
        ...project.floors[0].openings[0],
        kind: "window",
        operation: "fixed",
        variant: "plain",
        panelCount: 1,
        glazing: "clear",
      },
    ];
    assert.equal(exitWarnings(project).length, 0, "windows are not exits");
    project.floors[0].openings = exitProject().floors[0].openings;
    project.floors[0].walls = project.floors[0].walls.map((wall) => ({
      ...wall,
      classification: "interior",
    }));
    assert.equal(exitWarnings(project).length, 0, "interior openings are not terrain exits");
  });

  test("terrain exits account for platforms, open edges, partial crossings and connected stairs", () => {
    const project = exitProject();
    const floor = project.floors[0];
    floor.outdoorPlatforms = [landingPlatform(rectangle(0, -2, 8, 2))];
    assert.equal(exitWarnings(project).length, 0, "a railed landing supports the doorway");
    floor.outdoorPlatforms[0].polygon = rectangle(0, -2.05, 8, 2);
    assert.equal(exitWarnings(project).length, 1, "a nearby landing must actually reach the exit");
    floor.outdoorPlatforms[0].polygon = rectangle(0, -2, 8, 2);
    floor.outdoorPlatforms[0].edges[0].configuration = { kind: "open" };
    assert.deepEqual(
      exitWarnings(project).map((issue) => issue.path),
      ["floors[0].outdoorPlatforms[0].edges[0]"],
    );
    project.home.terrain = {
      topLeftMeters: 0,
      topRightMeters: -1,
      bottomLeftMeters: 0,
      bottomRightMeters: -1,
    };
    assert.equal(
      exitWarnings(project).length,
      0,
      "one usable crossing along the open edge is enough",
    );
    project.home.terrain = { ...terrain, bottomLeftMeters: -2.6, bottomRightMeters: -2.6 };
    floor.outdoorPlatforms = [];
    const basement = projectWithGarage().floors[0];
    basement.outdoorPlatforms = [landingPlatform(rectangle(3, -4.8, 2, 0.9), "lower-landing")];
    project.floors.unshift(basement);
    project.stairs = [
      {
        id: "outside-stairs",
        lowerFloorId: basement.id,
        upperFloorId: floor.id,
        at: [4, -4],
        rotationYRadians: 0,
        widthMeters: 1.2,
        runMeters: 4,
      },
    ];
    assert.equal(exitWarnings(project).length, 0, "connected stair landings bridge the drop");
    project.stairs[0].at = [6, -4];
    assert.equal(exitWarnings(project).length, 1, "nearby stairs do not connect this doorway");
  });

  test("terrain warnings locate the affected exit and still allow saving", async () => {
    const project = exitProject();
    const floor = project.floors[0];
    const [issue] = collectConstructContextualIssues({
      project,
      floor,
      projectIssues: exitWarnings(project),
    });
    assert.deepEqual(issue.target, { kind: "opening", id: "outside-exit" });
    assert.equal(issue.floorId, floor.id);
    assert.match(issue.suggestion, /terrain|platform|stairs/i);
    assert.match(issue.suggestion, /save with this warning/i);
    assert.ok(constructIssuePlanPoint(issue, floor, []));
    const repository = api.createHomeProjectRepository(
      api.createMemoryProjectRecordStore(),
      emptyExtensions,
    );
    const record = await repository.replace(api.createSeedProjectRecord(project));
    const result = await api.publishHomeProject(repository, record, { confirmWarnings: true });
    assert.equal(result.status, "published", JSON.stringify(result));
    assert.deepEqual((await repository.load(project.home.id)).published, project);
    floor.outdoorPlatforms = [landingPlatform(rectangle(0, -2, 8, 2))];
    floor.outdoorPlatforms[0].edges[0].configuration = { kind: "open" };
    const [platformIssue] = collectConstructContextualIssues({
      project,
      floor,
      projectIssues: exitWarnings(project),
    });
    assert.deepEqual(platformIssue.target, { kind: "outdoor-platform", id: "landing" });
    assert.equal(platformIssue.floorId, floor.id);
    assert.ok(constructIssuePlanPoint(platformIssue, floor, []));
  });

  test("corner heights survive project edits, import, runtime composition and undo without changing floor levels", () => {
    const project = projectWithGarage();
    const before = { project, bindings: {} };
    const edited = editProject(before, { type: "update-home-settings", changes: { terrain } });
    const parsed = api.parseHomeProject(api.serializeHomeProject(edited.project));
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
    const manifest = api.composeHomeManifest(parsed.project, emptyExtensions);
    assert.deepEqual(manifest.home.terrain, terrain);
    assert.deepEqual(
      api.deriveFloorLevels(manifest.floors).map((floor) => floor.elevationMeters),
      [-2.6, 0],
    );
    const history = api.commitWorkspaceSnapshot(api.createWorkspaceHistory(before), edited);
    assert.equal(api.undoWorkspaceHistory(history).present.project.home.terrain, undefined);
    assert.deepEqual(
      api.redoWorkspaceHistory(api.undoWorkspaceHistory(history)).present.project.home.terrain,
      terrain,
    );
    for (const invalid of [
      null,
      [],
      {},
      { ...terrain, topLeftMeters: "-2.6" },
      { ...terrain, bottomRightMeters: 101 },
      { ...terrain, unknown: 1 },
    ]) {
      const result = api.parseHomeProjectSchema({
        ...project,
        home: { ...project.home, terrain: invalid },
      });
      assert.equal(result.valid, false);
      assert.ok(result.issues.some((issue) => issue.path.startsWith("home.terrain")));
    }
    assert.equal(createTerrainSurface(undefined, project.floors), null);
    assert.equal(createTerrainSurface(api.FLAT_TERRAIN, project.floors), null);
    const shifted = {
      ...project,
      coordinates: { origin: [10, 20], metersPerPlanUnit: 2, scaleBasis: "measured" },
    };
    const surface = createTerrainSurface(
      terrain,
      shifted.floors.map((floor) => ({ ...floor, coordinates: shifted.coordinates })),
    );
    near(surface.offsetAt(-20, -40), -2.6);
    near(surface.offsetAt(-12, -32), -1.3);
    near(surface.offsetAt(-4, -24), 0);
  });

  test("the exterior reveals the garage while terrain, paths and soil retain indoor, pool and stair cutouts", async () => {
    const project = projectWithGarage();
    project.home.terrain = terrain;
    project.floors[1].groundZones = [
      {
        id: "driveway",
        polygon: rectangle(-2, -2, 12, 12),
        finish: { kind: "solid", color: "#aaa391" },
      },
    ];
    project.floors[1].pools = [{ id: "pool", polygon: rectangle(8.5, 2, 1, 2) }];
    project.stairs = [
      {
        id: "outdoor-stairs",
        lowerFloorId: "ground",
        upperFloorId: "first",
        at: [-1.5, 0],
        rotationYRadians: 0,
        widthMeters: 1,
        runMeters: 4,
      },
    ];
    const manifest = api.composeHomeManifest(project, emptyExtensions);
    const props = {
      manifest,
      floorView: "whole",
      activeFloorId: "first",
      selectedRoomId: null,
      walkMode: false,
      wallFadeEnabled: false,
      reducedMotion: true,
      resolvedBindings: { rooms: {}, openings: {} },
      architectureModels: stableArchitectureModelRegistry,
      deviceModels: {},
      openingPositions: {},
      onInteract() {},
    };
    const renderer = await create(React.createElement(ArchitectureScene, props));
    try {
      assert.equal(
        renderer.scene.findAll((node) => node.props.name?.startsWith("building-floor-")).length,
        2,
      );
      const scene = renderer.scene.instance;
      const heightAt = createTerrainHeightQuery(scene, 0);
      const ray = new Raycaster();
      scene.updateMatrixWorld(true);
      const surfaceHeight = (name, x, z) => {
        ray.set(new Vector3(x, 10, z), new Vector3(0, -1, 0));
        const hits = [];
        Mesh.prototype.raycast.call(scene.getObjectByName(name), ray, hits);
        return hits[0]?.point.y;
      };
      const surface = createTerrainSurface(terrain, manifest.floors);
      for (const [x, z] of [
        [-1, -1],
        [9, 0],
        [9, 6],
        [9, 9],
      ]) {
        near(heightAt({ x, z }), surface.offsetAt(x, z) - 0.05);
        near(surfaceHeight("ground-zone-driveway", x, z), surface.offsetAt(x, z) - 0.044);
        assert.ok(surfaceHeight("diorama-base", x, z) < heightAt({ x, z }));
      }
      // Grade transitions must follow the authored surface, without diagonal
      // triangle ramps spilling onto the level ends of the plot.
      for (const z of [-0.1, 0, 0.1, 0.4, 7.6, 7.9, 8, 8.1])
        near(heightAt({ x: 10.5, z }), surface.offsetAt(10.5, z) - 0.05);
      const underside = (z) => {
        ray.set(new Vector3(10.5, -20, z), new Vector3(0, 1, 0));
        return ray.intersectObject(scene.getObjectByName("diorama-base"), false)[0]?.point.y;
      };
      near(underside(-1), underside(9));
      assert.equal(heightAt({ x: 4, z: 4 }), null, "no terrain inside the garage");
      assert.equal(
        surfaceHeight("diorama-base", 4, 4),
        undefined,
        "soil also excavates the interior",
      );
      assert.equal(
        surfaceHeight("ground-zone-driveway", 4, 4),
        undefined,
        "paths do not fill the interior",
      );
      assert.equal(heightAt({ x: 9, z: 3 }), null, "pool stays open");
      assert.equal(heightAt({ x: -1.5, z: 2 }), null, "stairs stay open");
      assert.equal(heightAt({ x: 100, z: 100 }), null, "no support beyond the terrain");
      const upper = {
        ...manifest.floors[1],
        id: "upper",
        rooms: [],
        walls: [],
        wallJunctions: [],
        openings: [],
        ceilings: [],
        pools: [],
        groundZones: [
          {
            id: "upper-path",
            polygon: rectangle(8.5, 2, 1.5, 4),
            finish: { kind: "solid", color: "#aaaaaa" },
          },
        ],
      };
      await renderer.update(
        React.createElement(ArchitectureScene, {
          ...props,
          manifest: { ...manifest, floors: [...manifest.floors, upper] },
        }),
      );
      scene.updateMatrixWorld(true);
      near(surfaceHeight("ground-zone-upper-path", 9, 5), 2.6 - 0.044);
      await renderer.update(
        React.createElement(ArchitectureScene, {
          ...props,
          floorView: "cutaway",
          activeFloorId: "ground",
        }),
      );
      assert.equal(
        renderer.scene.findAllByProps({ name: "diorama-ground" }).length,
        0,
        "basement cutaway stays clear",
      );
      await renderer.update(
        React.createElement(ArchitectureScene, {
          ...props,
          manifest: { ...manifest, home: { ...manifest.home, terrain: api.FLAT_TERRAIN } },
        }),
      );
      assert.equal(
        renderer.scene.findAll((node) => node.props.name?.startsWith("building-floor-")).length,
        1,
        "reset preserves the old exterior",
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("doorway thresholds clear the supporting basement facade on their top and outer face", async () => {
    const project = exitProject();
    const floor = project.floors[0];
    project.floors.unshift(projectWithGarage().floors[0]);
    for (const level of project.floors) {
      level.floorToFloorHeightMeters = 2.8;
      level.defaultWallHeightMeters = 2.4;
      level.defaultCeilingHeightMeters = 2.4;
    }
    const renderer = await create(
      React.createElement(ArchitectureScene, {
        manifest: api.composeHomeManifest(project, emptyExtensions),
        floorView: "whole",
        activeFloorId: floor.id,
        selectedRoomId: null,
        walkMode: false,
        wallFadeEnabled: false,
        reducedMotion: true,
        resolvedBindings: { rooms: {}, openings: {} },
        architectureModels: stableArchitectureModelRegistry,
        deviceModels: {},
        openingPositions: {},
        onInteract() {},
      }),
    );
    try {
      const scene = renderer.scene.instance;
      scene.updateMatrixWorld(true);
      const threshold = scene.getObjectByName("opening-threshold-outside-exit");
      const center = threshold.getWorldPosition(new Vector3());
      const meshes = [];
      scene.traverse((object) => {
        if (object.isMesh) meshes.push(object);
      });
      for (const [origin, direction] of [
        [new Vector3(center.x, 0.5, -0.05), new Vector3(0, -1, 0)],
        [new Vector3(center.x, center.y, -2), new Vector3(0, 0, 1)],
      ]) {
        const ray = new Raycaster(origin, direction);
        const hits = [];
        // Inspect rendered geometry even when other floors disable interaction picking.
        for (const mesh of meshes) Mesh.prototype.raycast.call(mesh, ray, hits);
        const thresholdHit = hits.find((hit) => hit.object === threshold);
        assert.ok(thresholdHit, "the threshold still covers the doorway");
        assert.ok(
          !hits.some(
            (hit) =>
              hit.object !== threshold && Math.abs(hit.distance - thresholdHit.distance) < 0.0001,
          ),
          "no facade face may share the visible threshold surface and flicker",
        );
      }
    } finally {
      await renderer.unmount();
    }
  });

  test("walking follows the grade, crosses the garage threshold and rejects unsupported ground or high steps", () => {
    const building = projectWithGarage();
    const outside = { x: 4, z: -0.1, elevation: -2.6, floorId: "first" };
    const entered = resolveTerrainWalking(building, outside, { ...outside, z: 0.1 }, () => null);
    assert.equal(entered.floorId, "ground");
    near(entered.elevation, -2.6);
    const exited = resolveTerrainWalking(building, entered, outside, () => -2.65);
    near(exited.elevation, -2.6);
    const slope = resolveTerrainWalking(building, exited, { ...exited, z: -0.2 }, () => -2.55);
    near(slope.elevation, -2.5);
    const high = resolveTerrainWalking(
      building,
      { ...slope, elevation: -0.1 },
      { ...slope, x: 9 },
      () => -0.05,
    );
    assert.equal(
      high.floorId,
      "first",
      "door proximity follows the grade before entering the upper footprint",
    );
    assert.equal(
      resolveTerrainWalking(building, slope, outside, () => null),
      slope,
    );
    assert.equal(
      resolveTerrainWalking(building, slope, outside, () => 0),
      slope,
    );
    const fall = resolveWalkFall(
      building,
      slope,
      -1,
      () => false,
      () => -2.55,
    );
    assert.equal(fall.kind, "fall");
    near(fall.point.elevation, -2.5);
    near(fall.jumpHeight, 1.5);
  });

  test("the Walk camera follows rendered terrain below the ground-floor datum", async () => {
    const project = projectWithGarage();
    project.home.terrain = terrain;
    project.floors = project.floors.map((floor) => ({ ...floor, walls: [], wallJunctions: [] }));
    const manifest = api.composeHomeManifest(project, emptyExtensions);
    const poseRef = { current: { x: 9, z: 8.5, yaw: 0, pitch: 0 } };
    const renderer = await create(
      React.createElement(
        "group",
        null,
        React.createElement(ArchitectureScene, {
          manifest,
          selectedRoomId: null,
          activeFloorId: "first",
          walkMode: true,
          wallFadeEnabled: false,
          reducedMotion: true,
          resolvedBindings: { rooms: {}, openings: {} },
          architectureModels: stableArchitectureModelRegistry,
          deviceModels: {},
          openingPositions: {},
          onInteract() {},
        }),
        React.createElement(WalkCameraController, {
          building: manifest,
          floor: manifest.floors[1],
          poseRef,
          movementInputRef: { current: { x: 0, y: -1 } },
          lookInputRef: { current: { x: 0, y: 0 } },
          lookDeltaRef: { current: { x: 0, y: 0 } },
          reducedMotion: true,
          openingPositions: {},
          onOpeningsChange() {},
          onRoomChange() {},
        }),
      ),
    );
    try {
      await renderer.advanceFrames(90, 1 / 60);
      assert.ok(poseRef.current.z < 7.5, "walk continues along the slope");
      const camera = renderer.scene.findByType("PerspectiveCamera").instance;
      const surface = createTerrainSurface(terrain, manifest.floors);
      near(camera.position.y, surface.offsetAt(poseRef.current.x, poseRef.current.z) + 1.52);
      assert.ok(camera.position.y < 1.4, "the camera descends with the grade");
    } finally {
      await renderer.unmount();
    }
  });

  test("walking through a basement entrance is not blocked by the facade on the floor above", async () => {
    const project = projectWithGarage();
    project.home.terrain = terrain;
    const basement = project.floors[0];
    const wall = basement.walls.find((wall) => wall.from[1] === 0 && wall.to[1] === 0);
    basement.openings = [
      {
        id: "garage-passage",
        wallId: wall.id,
        kind: "passage",
        variant: "rectangular",
        offsetFromWallStartPlanUnits: 2,
        widthPlanUnits: 3,
        openingHeightMeters: 2.3,
        sillHeightMeters: 0,
      },
    ];
    const manifest = api.composeHomeManifest(project, emptyExtensions);
    const poseRef = { current: { x: 4, z: 0.6, yaw: 0, pitch: 0 } };
    const movementInputRef = { current: { x: 0, y: -1 } };
    const renderer = await create(
      React.createElement(
        "group",
        null,
        React.createElement(ArchitectureScene, {
          manifest,
          selectedRoomId: null,
          activeFloorId: "ground",
          walkMode: true,
          wallFadeEnabled: false,
          reducedMotion: true,
          resolvedBindings: { rooms: {}, openings: {} },
          architectureModels: stableArchitectureModelRegistry,
          deviceModels: {},
          openingPositions: {},
          onInteract() {},
        }),
        React.createElement(WalkCameraController, {
          building: manifest,
          floor: manifest.floors[0],
          elevation: -2.6,
          poseRef,
          movementInputRef,
          lookInputRef: { current: { x: 0, y: 0 } },
          lookDeltaRef: { current: { x: 0, y: 0 } },
          reducedMotion: true,
          openingPositions: {},
          onOpeningsChange() {},
          onRoomChange() {},
        }),
      ),
    );
    try {
      await renderer.advanceFrames(60, 1 / 60);
      assert.ok(poseRef.current.z < -1, `The walker must leave the garage, z=${poseRef.current.z}`);
      movementInputRef.current = { x: 0, y: 1 };
      await renderer.advanceFrames(90, 1 / 60);
      assert.ok(
        poseRef.current.z > 0.5,
        `The walker must re-enter the garage, z=${poseRef.current.z}`,
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("terrain fields commit validated undoable edits, support unit suffixes and reset to flat", async () => {
    await withStorageDom(async ({ document, window, mount, until, click }) => {
      const initial = api.createWorkspaceHistory({ project: projectWithGarage(), bindings: {} });
      let history = initial;
      let setHistory;
      function Harness() {
        [history, setHistory] = React.useState(initial);
        return React.createElement(TerrainSettingsEditor, {
          value: history.present.project.home.terrain,
          onChange: (terrain) =>
            setHistory((previous) =>
              api.commitWorkspaceSnapshot(
                previous,
                editProject(previous.present, {
                  type: "update-home-settings",
                  changes: { terrain },
                }),
              ),
            ),
        });
      }
      await mount(() => {
        const root = createRoot(document.body.appendChild(document.createElement("div")));
        root.render(React.createElement(Harness));
        return { unmount: () => root.unmount() };
      });
      const input = document.querySelector('[aria-label="Terrain top left"]');
      const increase = document.querySelector('[aria-label="Increase Terrain top left"]');
      const decrease = document.querySelector('[aria-label="Decrease Terrain top left"]');
      await act(async () => increase.click());
      assert.equal(history.present.project.home.terrain.topLeftMeters, 0.1);
      assert.equal(input.value, "0.1");
      await act(async () =>
        decrease.dispatchEvent(new window.MouseEvent("click", { bubbles: true, shiftKey: true })),
      );
      assert.equal(history.present.project.home.terrain.topLeftMeters, -0.9);
      await act(async () => setHistory(api.undoWorkspaceHistory(history)));
      assert.equal(history.present.project.home.terrain.topLeftMeters, 0.1);
      await act(async () => setHistory(initial));
      const edit = async (text) =>
        act(async () => {
          input.value = text;
          input.dispatchEvent(new window.Event("input", { bubbles: true }));
        });
      const enter = async () =>
        act(async () => input.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true })));
      await edit("-260 cm");
      await enter();
      await until(() => history.present.project.home.terrain?.topLeftMeters === -2.6);
      await act(async () => setHistory(api.undoWorkspaceHistory(history)));
      assert.equal(input.value, "0");
      await edit("-101");
      await enter();
      assert.equal(input.getAttribute("aria-invalid"), "true");
      assert.equal(history.present.project.home.terrain, undefined);
      await edit("100");
      await enter();
      assert.equal(increase.disabled, true);
      await edit("-100");
      await enter();
      assert.equal(decrease.disabled, true);
      await edit("-2.6");
      await enter();
      await click("Reset to flat ground");
      assert.deepEqual(history.present.project.home.terrain, api.FLAT_TERRAIN);
    });
  });
});
