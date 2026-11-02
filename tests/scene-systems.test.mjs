import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { toCreasedNormals } from "three-stdlib";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const geometrySnapshot = (geometry) => ({
  index: geometry.index ? [...geometry.index.array] : null,
  groups: geometry.groups,
  attributes: Object.fromEntries(
    Object.entries(geometry.attributes).map(([name, attribute]) => [
      name,
      {
        array: [...attribute.array],
        itemSize: attribute.itemSize,
        normalized: attribute.normalized,
      },
    ]),
  ),
});

const geometryTriangleColors = (assemblies, predicate = () => true) => {
  const colors = new Set();
  for (const { geometry } of assemblies) {
    const positions = geometry.getAttribute("position");
    const vertexColors = geometry.getAttribute("color");
    const indices = geometry.index;
    for (let index = 0; index < indices.count; index += 3) {
      const vertices = [0, 1, 2].map((offset) => indices.getX(index + offset));
      const points = vertices.map((vertex) => [
        positions.getX(vertex),
        positions.getY(vertex),
        positions.getZ(vertex),
      ]);
      if (!predicate(points)) continue;
      colors.add(
        new Color()
          .setRGB(
            vertexColors.getX(vertices[0]),
            vertexColors.getY(vertices[0]),
            vertexColors.getZ(vertices[0]),
          )
          .getHexString(),
      );
    }
  }
  return colors;
};

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const lighting = await load("/packages/engine/src/lighting.ts");
  const { sceneLightState } = await load("/packages/engine/src/scene-light-state.ts");
  const fade = await load("/packages/engine/src/wall-fade.ts");
  const performance = await load("/packages/engine/src/performance.ts");
  const controls = await load("/packages/engine/src/SceneControls.tsx");
  const geometry = await load("/packages/engine/src/geometry.ts");
  const rendering = await load("/packages/engine/src/rendering.tsx");
  const { SceneStyleContext } = await load("/packages/engine/src/scene-style.ts");
  const architecture = await load("/packages/engine/src/architecture-geometry.ts");
  const openingModels = await load("/packages/catalog/src/architecture/index.ts");
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const scene = await load("/packages/engine/src/ArchitectureScene.tsx");
  const outline = await load("/packages/engine/src/SceneOutlines.tsx");
  const { OpeningThreshold } = await load(
    "/packages/engine/src/architecture-scene/OpeningThreshold.tsx",
  );
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const cabaneFloor = JSON.parse(await readFile("tests/fixtures/cabane-floor.json", "utf8"));

  test("Sims materials change shading and palette without mutating authored colors", async () => {
    const authored = new Color("#719976");
    const original = authored.clone();
    const element = (style) =>
      createElement(
        SceneStyleContext.Provider,
        { value: style },
        createElement("mesh", null, createElement(rendering.ToonMaterial, { color: authored })),
      );
    const renderer = await create(element("default"));
    const material = renderer.scene.children[0].instance.material;
    const gradient = material.gradientMap;
    await renderer.update(element("sims"));
    assert.ok("FLAT_SHADED" in material.defines);
    assert.notEqual(material.gradientMap, gradient);
    assert.ok(!material.color.equals(original));
    assert.ok(authored.equals(original));
    await renderer.update(element("default"));
    assert.ok(!("FLAT_SHADED" in material.defines));
    assert.equal(material.gradientMap, gradient);
    assert.ok(material.color.equals(original));
    await renderer.unmount();
  });

  test("outline smoothing preserves the source mesh normals for non-indexed geometry", async () => {
    const source = new BoxGeometry(1, 1, 1).toNonIndexed();
    const before = geometrySnapshot(source);
    const renderer = await create(
      createElement(
        "mesh",
        { geometry: source },
        createElement(rendering.ToonMaterial, { color: "white" }),
        createElement(outline.SceneOutlines, { thickness: 0.0015 }),
      ),
    );
    assert.deepEqual(geometrySnapshot(source), before);
    const children = [];
    renderer.scene.instance.traverse((object) => {
      if (object.userData.sceneOutline) children.push(object);
    });
    assert.equal(children.length, 1);
    assert.notEqual(children[0].geometry, source);
    await renderer.unmount();
  });

  test("renders physical lights only for the active floor", async () => {
    const manifest = structuredClone(neutralDemoManifest);
    const ground = manifest.floors[0];
    const upper = {
      ...structuredClone(ground),
      id: "upper-floor",
      name: "Upper floor",
      rooms: ground.rooms.map((room) => ({ ...room, id: "upper-room" })),
    };
    manifest.floors = [ground, upper];
    manifest.sceneItems = [ground, upper].map((floor) => ({
      id: `${floor.id}-lamp`,
      floorId: floor.id,
      kind: "device",
      modelId: "table-lamp",
      lightState: "always-on",
      placement: { kind: "absolute", at: [2, 2], elevationMeters: 0.6, rotationYRadians: 0 },
      size: stableDeviceRegistry["table-lamp"].defaultSize,
      entitySlots: [],
    }));
    const props = {
      manifest,
      selectedRoomId: null,
      floorView: "cutaway",
      walkMode: false,
      wallFadeEnabled: false,
      reducedMotion: true,
      resolvedBindings: { rooms: {}, openings: {}, issues: [] },
      architectureModels: openingModels.stableArchitectureModelRegistry,
      deviceModels: stableDeviceRegistry,
      openingPositions: {},
      onInteract: () => undefined,
    };
    const renderer = await create(
      createElement(scene.ArchitectureScene, {
        ...props,
        activeFloorId: upper.id,
      }),
    );
    assert.equal(
      renderer.scene.findAllByProps({ name: `ha-device-light-${upper.id}-lamp` }).length,
      1,
    );
    assert.equal(
      renderer.scene.findAllByProps({ name: `ha-device-light-${ground.id}-lamp` }).length,
      0,
    );
    await renderer.update(
      createElement(scene.ArchitectureScene, {
        ...props,
        activeFloorId: ground.id,
      }),
    );
    assert.equal(
      renderer.scene.findAllByProps({ name: `ha-device-light-${ground.id}-lamp` }).length,
      1,
    );
    assert.equal(
      renderer.scene.findAllByProps({ name: `ha-device-light-${upper.id}-lamp` }).length,
      0,
    );
    await renderer.unmount();
  });

  test("renders declarative furnishing and device items exactly once", async () => {
    const manifest = structuredClone(neutralDemoManifest);
    manifest.floors[0].rooms[0].furnishings = "legacy-fixture";
    manifest.sceneItems = [
      {
        id: "fixture-chair",
        floorId: manifest.floors[0].id,
        kind: "furnishing",
        modelId: "fixture-chair-model",
        placement: {
          kind: "absolute",
          at: [1, 1],
          elevationMeters: 0,
          rotationYRadians: 0,
        },
        size: [0.6, 0.9, 0.6],
      },
      {
        id: "fixture-switch",
        floorId: manifest.floors[0].id,
        kind: "device",
        modelId: "fixture-switch-model",
        placement: {
          kind: "absolute",
          at: [2, 1],
          elevationMeters: 1,
          rotationYRadians: 0,
        },
        size: [0.12, 0.15, 0.05],
        entitySlots: [
          {
            id: "fixture-switch-primary",
            compatibleDomains: ["switch"],
            required: true,
            autoMap: "unique-compatible",
            section: "primary",
            deviceRole: "primary",
            presentation: { label: "Fixture switch", icon: "toggle" },
          },
        ],
      },
    ];
    manifest.extensions = {
      furnishingModels: {
        "fixture-chair-model": {
          component: () => createElement("group", { name: "fixture-chair-model" }),
          label: "Fixture chair",
          category: "Seating",
          defaultRoomType: "living-room",
          defaultSize: [0.6, 0.9, 0.6],
          bounds: { min: [-0.3, 0, -0.3], max: [0.3, 0.9, 0.3] },
          resizePolicy: { kind: "uniform" },
          preferredPlacement: "absolute",
          outlineContact: false,
          complexity: { visibleMeshes: 1, triangles: 12 },
        },
      },
      deviceModels: {
        "fixture-switch-model": {
          component: () => createElement("group", { name: "fixture-switch-model" }),
          label: "Fixture switch",
          category: "Controls",
          defaultRoomType: "living-room",
          defaultSize: [0.12, 0.15, 0.05],
          bounds: { min: [-0.06, 0, -0.025], max: [0.06, 0.15, 0.025] },
          resizePolicy: { kind: "fixed" },
          preferredPlacement: "absolute",
          outlineContact: false,
          complexity: { visibleMeshes: 1, triangles: 12 },
          supportedDomains: ["switch"],
          mountKind: "surface",
          interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
        },
      },
      openingModels: {},
      roomFurnishings: {
        "legacy-fixture": () => createElement("group", { name: "legacy-room-furnishings" }),
      },
    };
    const deviceSlot = {
      id: "fixture-switch",
      model: "fixture-switch-model",
      placement: {
        at: [2, 1],
        elevationMeters: 1,
        rotationYRadians: 0,
        support: { kind: "surface" },
      },
      entitySlots: manifest.sceneItems[1].entitySlots,
    };
    const resolvedBindings = {
      rooms: {
        "demo-room": {
          room: manifest.floors[0].rooms[0],
          displayName: "Demo room",
          pictureUrl: null,
          sections: { primary: [], secondary: [], diagnostic: [] },
          devices: [{ slot: deviceSlot, entities: [], issues: [] }],
          issues: [],
        },
      },
      openings: {},
      issues: [],
    };
    const stableDeviceModels = {
      "fixture-switch-model": {
        ...manifest.extensions.deviceModels["fixture-switch-model"],
        component: () => createElement("group", { name: "fixture-switch-stable-model" }),
      },
    };
    const renderScene = (walkMode) =>
      createElement(scene.ArchitectureScene, {
        manifest,
        selectedRoomId: null,
        walkMode,
        wallFadeEnabled: false,
        reducedMotion: true,
        resolvedBindings,
        architectureModels: openingModels.stableArchitectureModelRegistry,
        deviceModels: stableDeviceModels,
        openingPositions: {},
        onSelectRoom: () => undefined,
        onInteract: () => undefined,
      });
    const renderer = await create(renderScene(false));

    assert.equal(renderer.scene.findAllByProps({ name: "scene-item-fixture-chair" }).length, 1);
    assert.equal(renderer.scene.findAllByProps({ name: "scene-item-fixture-switch" }).length, 1);
    assert.equal(renderer.scene.findAllByProps({ name: "fixture-switch-stable-model" }).length, 1);
    assert.equal(renderer.scene.findAllByProps({ name: "fixture-switch-model" }).length, 0);
    assert.equal(renderer.scene.findAllByProps({ name: "legacy-room-furnishings" }).length, 0);

    const originalDocument = globalThis.document;
    globalThis.document = { body: { style: { cursor: "crosshair" } } };
    try {
      const switchItem = renderer.scene.findByProps({ name: "scene-item-fixture-switch" });
      await renderer.fireEvent(switchItem, "pointerOver");
      assert.equal(globalThis.document.body.style.cursor, "pointer");
      assert.equal(
        renderer.scene.findAllByProps({ name: "device-hover-outline-fixture-switch" }).length,
        0,
      );
      await renderer.update(renderScene(true));
      assert.equal(globalThis.document.body.style.cursor, "crosshair");
      assert.equal(
        renderer.scene.findAllByProps({ name: "device-hover-outline-fixture-switch" }).length,
        0,
      );
    } finally {
      globalThis.document = originalDocument;
    }
    await renderer.unmount();

    manifest.sceneItems[1].size = [0.24, 0.15, 0.05];
    const invalidSizeRenderer = await create(
      createElement(scene.ArchitectureScene, {
        manifest,
        selectedRoomId: null,
        walkMode: false,
        wallFadeEnabled: false,
        reducedMotion: true,
        resolvedBindings,
        architectureModels: openingModels.stableArchitectureModelRegistry,
        deviceModels: stableDeviceModels,
        openingPositions: {},
        onSelectRoom: () => undefined,
        onInteract: () => undefined,
      }),
    );
    assert.equal(
      invalidSizeRenderer.scene.findAllByProps({ name: "scene-item-fixture-chair" }).length,
      1,
    );
    assert.equal(
      invalidSizeRenderer.scene.findAllByProps({ name: "scene-item-fixture-switch" }).length,
      0,
    );
    await invalidSizeRenderer.unmount();

    manifest.sceneItems = [];
    const legacyRenderer = await create(
      createElement(scene.ArchitectureScene, {
        manifest,
        selectedRoomId: null,
        walkMode: false,
        wallFadeEnabled: false,
        reducedMotion: true,
        resolvedBindings,
        architectureModels: openingModels.stableArchitectureModelRegistry,
        deviceModels: stableDeviceModels,
        openingPositions: {},
        onSelectRoom: () => undefined,
        onInteract: () => undefined,
      }),
    );
    assert.equal(
      legacyRenderer.scene.findAllByProps({ name: "legacy-room-furnishings" }).length,
      1,
    );
    assert.equal(
      legacyRenderer.scene.findAllByProps({ name: "scene-item-fixture-chair" }).length,
      0,
    );
    await legacyRenderer.unmount();
  });

  test("requires a complete architecture model registry", () => {
    const complete = engine.defineArchitectureModelRegistry({
      door: () => null,
      window: () => null,
      passage: () => null,
    });
    assert.deepEqual(engine.validateArchitectureModelRegistry(complete), []);
    assert.deepEqual(engine.validateArchitectureModelRegistry({ door: () => null }), [
      {
        code: "architecture.model-registry",
        severity: "fatal",
        path: "architectureModels.window",
        message: "The stable window architecture model is missing.",
      },
      {
        code: "architecture.model-registry",
        severity: "fatal",
        path: "architectureModels.passage",
        message: "The stable passage architecture model is missing.",
      },
    ]);
  });

  test("moves continuously from daylight through readable night", () => {
    const day = lighting.deriveSolarLighting(undefined, "day");
    const night = lighting.deriveSolarLighting(undefined, "night");
    assert.ok(day.sunIntensity > night.sunIntensity);
    assert.notEqual(day.backgroundColor, night.backgroundColor);
  });

  test("returns a finite neutral fallback without a Home Assistant sun", () => {
    const fallback = lighting.deriveSolarLighting(undefined, "live");
    assert.equal(fallback.valid, false);
    assert.ok(fallback.sunPosition.every(Number.isFinite));
  });

  test("night-only lights follow the sun or scene preview and turn off by day", () => {
    const day = new Date(2026, 0, 1, 12);
    const night = new Date(2026, 0, 1, 23);
    assert.equal(lighting.isNightLighting("live", { state: "below_horizon" }, day), true);
    assert.equal(lighting.isNightLighting("live", { state: "above_horizon" }, night), false);
    assert.equal(lighting.isNightLighting("live", undefined, day), false);
    assert.equal(lighting.isNightLighting("live", undefined, night), true);
    assert.equal(lighting.isNightLighting("night", undefined, day), true);
    assert.equal(lighting.isNightLighting("day", undefined, night), false);
    assert.equal(sceneLightState("night-only", undefined, true).state, "on");
    assert.equal(sceneLightState("night-only", undefined, false).state, "off");
  });

  test("fades only the outward camera-facing side", () => {
    const forward = fade.cameraFacingWallOpacity(true, [0, 10], [0, 1]);
    const reverse = fade.cameraFacingWallOpacity(true, [0, -10], [0, 1]);
    assert.ok(forward < 1);
    assert.equal(reverse, 1);
    assert.equal(fade.cameraFacingWallOpacity(false, [0, 10], [0, 1]), 1);
  });

  test("matches custom wall fading from the shared scene origin", () => {
    assert.equal(
      fade.cameraFacingWallOpacity(true, [10, 0], [1, 0], [20, 0]),
      fade.WALL_FADE_MIN_OPACITY,
    );
  });

  test("uses four readable toon band levels", () => {
    assert.deepEqual([...rendering.TOON_GRADIENT_DATA], [55, 115, 185, 255]);
  });

  test("builds crease-normal outline geometry without changing vertex positions", () => {
    const source = new BufferGeometry();
    source.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1], 3),
    );
    const result = outline.optimizedCreasedNormalGeometry(source, Math.PI / 3);
    assert.equal(result.getAttribute("position").count, 6);
    assert.equal(result.getAttribute("normal").count, 6);
  });

  for (const { name, geometry, angle } of [
    {
      name: "indexed box at the scene outline angle",
      geometry: new BoxGeometry(1.3, 0.7, 2.1, 2, 1, 3),
      angle: Math.PI,
    },
    {
      name: "indexed curved geometry at a sharp crease angle",
      geometry: new TorusGeometry(1, 0.23, 7, 13),
      angle: 0.42,
    },
    {
      name: "non-indexed geometry",
      geometry: new SphereGeometry(1, 11, 7).toNonIndexed(),
      angle: Math.PI / 3,
    },
  ]) {
    test(`matches the original outline normals for ${name}`, () => {
      const referenceSource = geometry.clone();
      const optimizedSource = geometry.clone();
      const reference = toCreasedNormals(referenceSource, angle);
      const optimized = outline.optimizedCreasedNormalGeometry(optimizedSource, angle);
      assert.deepEqual(geometrySnapshot(optimized), geometrySnapshot(reference));
      reference.dispose();
      if (reference !== referenceSource) referenceSource.dispose();
      optimized.dispose();
      if (optimized !== optimizedSource) optimizedSource.dispose();
      geometry.dispose();
    });
  }

  test("preserves material base state and suppresses translucent wall shadows", () => {
    const material = new MeshToonMaterial({ opacity: 0.6, transparent: true, depthWrite: false });
    const mesh = new Mesh(undefined, material);
    mesh.castShadow = true;
    rendering.applyCameraFadeToMesh(mesh, 0.2);
    assert.equal(material.opacity, 0.12);
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.equal(mesh.castShadow, false);
    rendering.applyCameraFadeToMesh(mesh, 1);
    assert.equal(material.opacity, 0.6);
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.equal(mesh.castShadow, true);
  });

  test("builds continuous opening masonry and explicit corner geometry", () => {
    const floor = neutralDemoManifest.floors[0];
    const north = floor.walls.find((wall) => wall.id === "north-wall");
    const wallGeometry = architecture.buildContinuousWallGeometry(north, floor, floor.openings);
    assert.ok(wallGeometry.getAttribute("position").count > 0);
    assert.equal(wallGeometry.groups.length, 2);
    const corner = architecture.buildWallJunctionGeometries(floor.wallJunctions[0], floor);
    assert.equal(corner.length, 1);
    assert.ok(corner[0].geometry.getAttribute("position").count > 0);
    const assemblies = architecture.buildArchitecturalWallGeometries(floor, "#fff", "#f00");
    const hasVisibleUpperInteriorFace = assemblies.some(({ geometry }) => {
      const positions = geometry.getAttribute("position");
      const indices = geometry.index;
      for (let index = 0; index < indices.count; index += 3) {
        const vertices = [0, 1, 2].map((offset) => {
          const vertex = indices.getX(index + offset);
          return [positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)];
        });
        if (!vertices.every(([, y, z]) => y >= 2.12 - 1e-6 && Math.abs(z - 0.09) < 1e-6)) continue;
        const first = vertices[0];
        const ab = vertices[1].map((value, axis) => value - first[axis]);
        const ac = vertices[2].map((value, axis) => value - first[axis]);
        if (ab[0] * ac[1] - ab[1] * ac[0] > 0) return true;
      }
      return false;
    });
    assert.equal(hasVisibleUpperInteriorFace, true);
    wallGeometry.dispose();
    corner.forEach(({ geometry }) => geometry.dispose());
    assemblies.forEach(({ geometry }) => geometry.dispose());
  });

  test("colors the left and right wall faces while keeping horizontal caps on the palette", () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    floor.walls.find((wall) => wall.id === "north-wall").faceColors = {
      left: "#ff0000",
      right: "#0000ff",
    };
    const assemblies = architecture.buildArchitecturalWallGeometries(floor, "#00ff00", "#ffff00");
    const verticalColors = geometryTriangleColors(
      assemblies,
      (points) =>
        Math.max(...points.map((point) => point[1])) -
          Math.min(...points.map((point) => point[1])) >
        0.5,
    );
    assert.ok(verticalColors.has("ff0000"));
    assert.ok(verticalColors.has("0000ff"));
    const capColors = geometryTriangleColors(assemblies, (points) =>
      points.every((point) => Math.abs(point[1] - 2.55) < 1e-6),
    );
    assert.deepEqual([...capColors], ["00ff00"]);
    assemblies.forEach(({ geometry }) => geometry.dispose());
  });

  test("colors only the outside wall face with the direction-independent exterior color", () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    floor.walls.find((wall) => wall.id === "north-wall").exteriorColor = "#b86f58";
    const assemblies = architecture.buildArchitecturalWallGeometries(floor, "#00ff00", "#ffff00");
    const verticalColors = geometryTriangleColors(
      assemblies,
      (points) =>
        Math.max(...points.map((point) => point[1])) -
          Math.min(...points.map((point) => point[1])) >
        0.5,
    );
    assert.ok(verticalColors.has("b86f58"));
    assert.ok(verticalColors.has("00ff00"), "the inside face keeps the interior palette");
    assemblies.forEach(({ geometry }) => geometry.dispose());
  });

  test("standalone walls honor exterior and side finishes instead of palette defaults", async () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    const wall = floor.walls.find((wall) => wall.id === "north-wall");
    wall.exteriorColor = "#123456";
    wall.faceColors = { left: "#abcdef" };
    const renderer = await create(
      createElement(scene.ArchitecturalWall, {
        wall,
        floor,
        openings: floor.openings,
        interiorColor: "#00ff00",
        exteriorColor: "#ff0000",
        fade: false,
        reducedMotion: true,
      }),
    );
    try {
      const meshes = renderer.scene
        .findAll((node) => node.instance?.isMesh)
        .map((node) => node.instance);
      const colors = new Set(
        meshes.flatMap((mesh) => {
          const attribute = mesh.geometry.getAttribute("color");
          return attribute
            ? Array.from({ length: attribute.count }, (_, i) =>
                new Color().fromBufferAttribute(attribute, i).getHexString(),
              )
            : [mesh.material.color.getHexString()];
        }),
      );
      assert.ok(colors.has("123456"), "the exterior override reaches the rendered wall");
      assert.ok(colors.has("abcdef"), "the side override reaches the rendered wall");
      assert.equal(colors.has("00ff00"), false, "caps inherit authored exterior paint");
      assert.equal(colors.has("ff0000"), false);
    } finally {
      await renderer.unmount();
    }
  });

  test("exterior doorway thresholds bridge terrain and floor level", async () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    const opening = floor.openings[0];
    const wall = floor.walls.find((wall) => wall.id === opening.wallId);
    const renderer = await create(createElement(OpeningThreshold, { floor, wall, opening }));
    const mesh = renderer.scene.findByProps({ name: `opening-threshold-${opening.id}` }).instance;
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    assert.ok(Math.abs(mesh.position.y + bounds.min.y + 0.05) < 1e-6);
    assert.ok(Math.abs(mesh.position.y + bounds.max.y - 0.002) < 1e-6);
    assert.ok(
      Math.abs(
        bounds.max.x -
          bounds.min.x -
          opening.widthPlanUnits * floor.coordinates.metersPerPlanUnit -
          0.004,
      ) < 1e-6,
    );
    await renderer.update(
      createElement(OpeningThreshold, {
        floor,
        wall: { ...wall, classification: "interior" },
        opening,
      }),
    );
    assert.equal(renderer.scene.children.length, 0);
    await renderer.update(
      createElement(OpeningThreshold, { floor, wall, opening: floor.openings[1] }),
    );
    assert.equal(renderer.scene.children.length, 0);
    await renderer.unmount();
  });

  test("wall bases meet outdoor terrain without moving wall tops or door heads", () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    const assemblies = architecture.buildArchitecturalWallGeometries(floor);
    const heights = assemblies.flatMap(({ geometry }) => {
      const positions = geometry.getAttribute("position");
      return Array.from({ length: positions.count }, (_, index) => positions.getY(index));
    });
    assert.ok(Math.abs(Math.min(...heights) + 0.05) < 1e-6);
    assert.ok(Math.abs(Math.max(...heights) - floor.defaultWallHeightMeters) < 1e-6);
    assert.ok(
      heights.some((height) => Math.abs(height - floor.openings[0].openingHeightMeters) < 1e-6),
    );
    assert.equal(
      heights.some((height) => height === 0),
      false,
    );
    assemblies.forEach(({ geometry }) => geometry.dispose());
  });

  test("extends each exterior wall finish over its corner face", () => {
    for (const reverse of [false, true]) {
      const floor = structuredClone(neutralDemoManifest.floors[0]);
      floor.walls.find((wall) => wall.id === "north-wall").exteriorColor = "#b86f58";
      floor.walls.find((wall) => wall.id === "west-wall").exteriorColor = "#c8bca8";
      floor.walls.find((wall) => wall.id === "south-wall").exteriorColor = "#b86f58";
      floor.walls.find((wall) => wall.id === "east-wall").exteriorColor = "#c8bca8";
      if (reverse) {
        for (const wall of floor.walls) [wall.from, wall.to] = [wall.to, wall.from];
        floor.walls.reverse();
      }
      const assemblies = architecture.buildArchitecturalWallGeometries(floor);
      for (const [axis, coordinate, min, max, expected] of [
        [2, -0.09, -0.09, 0, "b86f58"],
        [0, -0.09, -0.09, 0, "c8bca8"],
        [2, 3.69, -0.09, 0, "b86f58"],
        [0, -0.09, 3.6, 3.69, "c8bca8"],
        [2, -0.09, 4.8, 4.89, "b86f58"],
        [0, 4.89, -0.09, 0, "c8bca8"],
        [2, 3.69, 4.8, 4.89, "b86f58"],
        [0, 4.89, 3.6, 3.69, "c8bca8"],
      ]) {
        const colors = geometryTriangleColors(
          assemblies,
          (points) =>
            points.every(
              (point) =>
                Math.abs(point[axis] - coordinate) < 1e-5 &&
                point[axis === 0 ? 2 : 0] >= min - 1e-5 &&
                point[axis === 0 ? 2 : 0] <= max + 1e-5,
            ) &&
            Math.max(...points.map((point) => point[1])) >
              Math.min(...points.map((point) => point[1])),
        );
        assert.deepEqual([...colors], [expected]);
      }
      assemblies.forEach(({ geometry }) => geometry.dispose());
    }
  });

  test("preserves adjacent wall finishes above door openings", () => {
    for (const reverse of [false, true]) {
      const floor = structuredClone(neutralDemoManifest.floors[0]);
      const wall = floor.walls.find((wall) => wall.id === "south-wall");
      wall.to = [2.4, 3.6];
      wall.exteriorColor = "#b86f58";
      const neighbor = {
        ...wall,
        id: "south-second",
        from: [2.4, 3.6],
        to: [0, 3.6],
        exteriorColor: "#ff0000",
      };
      floor.walls.push(neighbor);
      floor.wallJunctions.find((junction) => junction.id === "south-west-junction").wallIds = [
        neighbor.id,
        "west-wall",
      ];
      floor.wallJunctions.push({
        id: "south-middle",
        at: [2.4, 3.6],
        wallIds: [wall.id, neighbor.id],
      });
      if (reverse) {
        [wall.from, wall.to] = [wall.to, wall.from];
        const door = floor.openings[0];
        door.offsetFromWallStartPlanUnits =
          2.4 - door.offsetFromWallStartPlanUnits - door.widthPlanUnits;
        floor.walls.reverse();
      }
      const assemblies = architecture.buildArchitecturalWallGeometries(floor);
      for (const [left, right, expected] of [
        [2.4, 4.8, "b86f58"],
        [0, 2.4, "ff0000"],
      ]) {
        const colors = geometryTriangleColors(assemblies, (points) => {
          const centerX = points.reduce((sum, point) => sum + point[0], 0) / 3;
          return (
            centerX > left &&
            centerX < right &&
            points.every((point) => Math.abs(point[2] - 3.69) < 1e-5 && point[1] >= 2.12 - 1e-5) &&
            Math.max(...points.map((point) => point[1])) >
              Math.min(...points.map((point) => point[1]))
          );
        });
        assert.deepEqual([...colors], [expected]);
      }
      assemblies.forEach(({ geometry }) => geometry.dispose());
    }
  });

  test("renders a solid room floor finish beneath the integrated interaction overlay", async () => {
    const manifest = structuredClone(neutralDemoManifest);
    manifest.floors[0].rooms[0].floorFinish = { kind: "solid", color: "#c8bca8" };
    const renderer = await create(
      createElement(scene.ArchitectureScene, {
        manifest,
        selectedRoomId: "demo-room",
        walkMode: false,
        wallFadeEnabled: false,
        reducedMotion: true,
        resolvedBindings: { rooms: {}, issues: [] },
        architectureModels: openingModels.stableArchitectureModelRegistry,
        deviceModels: {},
        openingPositions: {},
        onSelectRoom: () => undefined,
        onInteract: () => undefined,
      }),
    );
    const floorMaterial = renderer.scene.findByProps({ name: "room-demo-room" }).instance.material;
    const selectionMaterial = renderer.scene.findByProps({ name: "room-demo-room-interaction" })
      .instance.material;
    assert.ok(floorMaterial.color.r > new Color("#c8bca8").r);
    assert.equal(selectionMaterial.color.getHexString(), "f2c7a7");
    assert.equal(selectionMaterial.opacity, 0.055);
    await renderer.unmount();
  });

  test("renders opening variants independently from their operation", async () => {
    const manifest = structuredClone(neutralDemoManifest);
    Object.assign(manifest.floors[0].openings[0], {
      operation: "hinged",
      variant: "french",
      leafCount: 2,
    });
    Object.assign(manifest.floors[0].openings[1], {
      operation: "casement",
      variant: "muntined",
      panelCount: 2,
      glazing: "privacy",
      muntins: { columns: 2, rows: 3 },
    });
    manifest.floors[0].openings.push(
      {
        id: "demo-sliding-glass",
        wallId: "west-wall",
        kind: "door",
        offsetFromWallStartPlanUnits: 1.2,
        widthPlanUnits: 1.4,
        openingHeightMeters: 2.12,
        sillHeightMeters: 0,
        operation: "sliding",
        variant: "full-glass",
        finish: "white",
        leafCount: 2,
      },
      {
        id: "demo-archway",
        wallId: "east-wall",
        kind: "passage",
        offsetFromWallStartPlanUnits: 1.2,
        widthPlanUnits: 1,
        openingHeightMeters: 2.18,
        sillHeightMeters: 0,
        variant: "arched",
        archRiseMeters: 0.12,
      },
      {
        id: "demo-plank-slider",
        wallId: "east-wall",
        kind: "door",
        offsetFromWallStartPlanUnits: 2.5,
        widthPlanUnits: 0.8,
        openingHeightMeters: 2.04,
        sillHeightMeters: 0,
        operation: "sliding",
        variant: "plank",
        finish: "wood",
        leafCount: 1,
      },
    );
    const renderer = await create(
      createElement(scene.ArchitectureScene, {
        manifest,
        selectedRoomId: null,
        walkMode: false,
        wallFadeEnabled: false,
        reducedMotion: true,
        resolvedBindings: { rooms: {}, openings: {}, issues: [] },
        architectureModels: openingModels.stableArchitectureModelRegistry,
        deviceModels: {},
        openingPositions: {},
        onSelectRoom: () => undefined,
        onInteract: () => undefined,
      }),
    );

    assert.ok(renderer.scene.findByProps({ name: "opening-model-french" }));
    assert.ok(renderer.scene.findByProps({ name: "opening-model-full-glass" }));
    assert.ok(renderer.scene.findByProps({ name: "opening-model-muntined" }));
    assert.ok(renderer.scene.findByProps({ name: "opening-model-arched" }));
    assert.ok(renderer.scene.findByProps({ name: "opening-model-plank" }));
    assert.ok(renderer.scene.findAllByProps({ name: "opening-door-handles" }).length >= 2);
    assert.ok(renderer.scene.findAllByProps({ name: "opening-door-handle-rosette" }).length >= 2);
    assert.ok(renderer.scene.findAllByProps({ name: "opening-glass-door-handle" }).length >= 2);
    assert.ok(renderer.scene.findAllByProps({ name: "opening-window-handle-privacy" }).length >= 1);
    assert.equal(renderer.scene.findAllByProps({ name: "opening-plank-rail-hanger" }).length, 2);
    assert.ok(renderer.scene.findByProps({ name: "opening-plank-pull" }));
    const plankOpening = manifest.floors[0].openings.find(
      (opening) => opening.id === "demo-plank-slider",
    );
    const plankWall = manifest.floors[0].walls.find((wall) => wall.id === plankOpening.wallId);
    const plankLeafMount = renderer.scene.findByProps({
      name: "opening-plank-sliding-leaf-mount",
    });
    const plankRail = renderer.scene.findByProps({ name: "opening-plank-rail" });
    const plankRailBar = renderer.scene.findByProps({
      name: "opening-plank-rail-bar",
    });
    assert.ok(plankLeafMount.props.position[2] > plankWall.thicknessMeters / 2);
    assert.ok(plankRail.props.position[2] > plankWall.thicknessMeters / 2);
    assert.ok(Math.abs(plankRailBar.props.position[0]) < 0.02);
    await renderer.unmount();
  });

  test("builds an arched passage whose curve reaches the configured crown", () => {
    const shape = openingModels.buildArchedPassageSpandrelShape(
      {
        openingHeightMeters: 2.19,
        archRiseMeters: 0.12,
      },
      0.82,
    );
    assert.equal(shape.curves[0].getPoint(0).y, 2.07);
    assert.equal(shape.curves[0].getPoint(1).y, 2.19);
    assert.equal(shape.curves[1].getPoint(1).y, 2.07);
  });

  test("resolves a directed face color after rotating the full floor and preserves fallback faces", () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    const angle = Math.PI / 5;
    const rotate = ([x, y]) => [
      x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle),
    ];
    floor.footprint = floor.footprint.map(rotate);
    floor.rooms.forEach((room) => {
      room.polygon = room.polygon.map(rotate);
    });
    floor.walls.forEach((wall) => {
      wall.from = rotate(wall.from);
      wall.to = rotate(wall.to);
    });
    floor.wallJunctions.forEach((junction) => {
      junction.at = rotate(junction.at);
    });
    floor.walls.find((wall) => wall.id === "north-wall").faceColors = { left: "#ff0000" };
    const assemblies = architecture.buildArchitecturalWallGeometries(floor, "#00ff00", "#ffff00");
    const verticalColors = geometryTriangleColors(
      assemblies,
      (points) =>
        Math.max(...points.map((point) => point[1])) -
          Math.min(...points.map((point) => point[1])) >
        0.5,
    );
    assert.ok(verticalColors.has("ff0000"));
    assert.ok(verticalColors.has("ffff00"));
    assemblies.forEach(({ geometry }) => geometry.dispose());
  });

  test("miters unequal angled exterior walls without a shaded corner sliver", () => {
    const assemblies = architecture.buildArchitecturalWallGeometries(
      cabaneFloor,
      "#e4e0d8",
      "#c97370",
    );
    const directions = new Set();
    for (const { geometry } of assemblies) {
      const positions = geometry.getAttribute("position");
      const colors = geometry.getAttribute("color");
      const indices = geometry.index;
      for (let index = 0; index < indices.count; index += 3) {
        const vertices = [0, 1, 2].map((offset) => indices.getX(index + offset));
        if (colors.getX(vertices[0]) <= colors.getY(vertices[0]) * 2) continue;
        const points = vertices.map((vertex) => [
          positions.getX(vertex),
          positions.getY(vertex),
          positions.getZ(vertex),
        ]);
        if (
          Math.max(...points.map((point) => point[1])) -
            Math.min(...points.map((point) => point[1])) <
          1
        )
          continue;
        const horizontal = [
          ...new Map(
            points.map((point) => [`${point[0].toFixed(5)}:${point[2].toFixed(5)}`, point]),
          ).values(),
        ];
        if (
          horizontal.length !== 2 ||
          !horizontal.some((point) => Math.hypot(point[0], point[2]) < 0.25)
        )
          continue;
        let dx = horizontal[1][0] - horizontal[0][0];
        let dz = horizontal[1][2] - horizontal[0][2];
        const length = Math.hypot(dx, dz);
        dx /= length;
        dz /= length;
        if (dx < -1e-6 || (Math.abs(dx) <= 1e-6 && dz < 0)) {
          dx *= -1;
          dz *= -1;
        }
        directions.add(`${dx.toFixed(3)}:${dz.toFixed(3)}`);
      }
    }
    assert.deepEqual([...directions].sort(), ["0.066:0.998", "1.000:0.000"]);
    assemblies.forEach(({ geometry }) => geometry.dispose());
  });

  test("reduces expensive buffers for touch walk mode", () => {
    assert.deepEqual(performance.sceneRenderingQuality(false, false, 2), {
      dpr: [1.25, 2],
      shadowMapSize: 2048,
      antialias: true,
    });
    assert.deepEqual(performance.sceneRenderingQuality(true, true, 0), {
      dpr: [0.65, 0.85],
      shadowMapSize: 1024,
      antialias: true,
    });
  });

  test("keeps static foreground views at an antialiased DPR", () => {
    assert.deepEqual(
      performance.foregroundRenderingDpr(performance.sceneRenderingQuality(true, false, 2)),
      [1, 1.25],
    );
    assert.deepEqual(
      performance.foregroundRenderingDpr(performance.sceneRenderingQuality(false, false, 2)),
      [1.25, 2],
    );
  });

  test("fits overview and room cameras across portrait and desktop viewports", () => {
    const bounds = { width: 4.8, depth: 3.6 };
    const portrait = controls.cameraZoomForViewport(390, 844, bounds, false);
    const desktop = controls.cameraZoomForViewport(1440, 900, bounds, false);
    const room = controls.cameraZoomForViewport(390, 844, bounds, true);
    assert.ok(portrait >= 28);
    assert.ok(desktop > portrait);
    assert.ok(room > portrait);
  });

  test("interpolates a sloped ceiling between its declared edges", () => {
    const plane = {
      id: "slope-a",
      boundary: [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
      ],
      lowEdge: [
        [0, 0],
        [0, 3],
      ],
      highEdge: [
        [4, 0],
        [4, 3],
      ],
      lowHeightMeters: 2.2,
      highHeightMeters: 3.4,
    };
    assert.equal(geometry.slopedCeilingHeightAtPoint([0, 1.5], plane), 2.2);
    assert.equal(geometry.slopedCeilingHeightAtPoint([4, 1.5], plane), 3.4);
    assert.equal(geometry.slopedCeilingHeightAtPoint([2, 1.5], plane), 2.8);
  });
});
