import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { layoutFloorFromEditorFloor } = await load("/apps/web/src/editor-preview/project-sync.ts");
  const { createWallContactMap } = await load(
    "/packages/engine/src/floor-finishes/wall-contact-map.ts",
  );
  const { createContactReceiverResolver } = await load(
    "/packages/engine/src/item-contacts/contact-receivers.ts",
  );
  const { contactReceiverGroup, floorContactSources } = await load(
    "/packages/engine/src/item-contacts/contact-sources.ts",
  );
  const registries = { furnishingModels: {}, deviceModels: {} };
  const project = () =>
    engine.defineHomeProject({
      schemaVersion: 1,
      seedRevision: "floor-finish-test",
      home: structuredClone(engine.neutralDemoManifest.home),
      floor: layoutFloorFromEditorFloor(structuredClone(engine.neutralDemoManifest.floors[0])),
      sceneItems: [],
      roomProfiles: {},
      openingProfiles: {},
      shortcuts: [],
      assumptions: [],
    });

  test("floor contact follows real walls and leaves doorways and virtual boundaries open", () => {
    const floor = project().floors[0];
    const footprint = [
      [10, 20],
      [26, 20],
      [26, 28],
      [10, 28],
    ];
    const wall = {
      ...floor.walls[0],
      id: "back",
      from: footprint[0],
      to: footprint[1],
      thicknessMeters: 0.2,
    };
    const map = createWallContactMap({
      ...floor,
      coordinates: { origin: [10, 20], metersPerPlanUnit: 0.5 },
      footprint,
      footprintRegions: [footprint],
      walls: [
        wall,
        { ...wall, id: "divider", from: footprint[3], to: footprint[2], virtual: true },
      ],
      openings: [
        {
          wallId: wall.id,
          sillHeightMeters: 0,
          offsetFromWallStartPlanUnits: 6,
          widthPlanUnits: 4,
        },
      ],
    });
    const { data, width, height } = map.image;
    const texel = (uv, size) => Math.max(0, Math.min(size - 1, Math.floor(uv * size)));
    const sample = (x, z) =>
      data[
        texel(z * map.repeat.y + map.offset.y, height) * width +
          texel(x * map.repeat.x + map.offset.x, width)
      ];
    try {
      assert.ok(sample(1.5, 0.15) < sample(1.5, 0.55));
      assert.equal(sample(1.5, 1), 255);
      assert.equal(sample(4, 0.15), 255);
      assert.equal(sample(4, 3.85), 255);
    } finally {
      map.dispose();
    }
  });

  test("item contact finds the actual support at each foot and clips overhanging edges", () => {
    const floor = new Group();
    floor.position.set(3, 8, -4);
    floor.rotation.y = 0.72;
    const material = new MeshStandardMaterial();
    const box = (width, thickness, depth, top) => {
      const mesh = new Mesh(new BoxGeometry(width, thickness, depth), material);
      mesh.position.y = top - thickness / 2;
      return mesh;
    };
    const room = box(4, 0.01, 4, 0.012);
    room.name = "room-library";
    const table = new Group();
    table.name = "scene-item-table";
    table.add(box(1, 0.05, 0.6, 0.75));
    const wire = box(1, 0.05, 0.6, 0.9);
    wire.material = new MeshStandardMaterial({ wireframe: true });
    const scatter = new InstancedMesh(wire.geometry, material, 513);
    scatter.position.y = 1.2;
    table.add(wire, scatter);
    const vase = new Group();
    vase.name = "scene-item-vase";
    vase.add(box(0.08, 0.04, 0.08, 0.82));
    floor.add(room, table, vase);
    const { items, ground } = floorContactSources(floor);
    const resolve = createContactReceiverResolver([
      ...Array.from(ground, (mesh) => contactReceiverGroup(floor, mesh, false)),
      ...Array.from(items.keys(), (root) => contactReceiverGroup(floor, root, true)),
    ]);
    const patch = (x) => [
      [x - 0.03, -0.02],
      [x + 0.03, -0.02],
      [x + 0.03, 0.02],
      [x - 0.03, 0.02],
    ];
    const resolveAt = (x, y) => resolve(vase, patch(x), y, 0.12);
    const edge = resolveAt(0.515, 0.751);
    assert.ok(Math.abs(edge.y - 0.75) < 1e-6);
    assert.ok(edge.triangles.flat().every(([x]) => x <= 0.500001));
    assert.equal(resolveAt(0.54, 0.751), null);
    assert.equal(resolveAt(0, 0.82), null);
    assert.equal(resolveAt(0, 0.9), null);
    assert.equal(resolveAt(0, 1.225), null);
    assert.ok(Math.abs(resolveAt(0, 0).y - 0.012) < 1e-6);
    assert.equal(resolveAt(3, 0), null);
  });

  test("strict schema accepts canonical finishes and ordered zones", () => {
    const input = project();
    input.floors[0].rooms[0].floorFinish = {
      kind: "preset",
      preset: "travertine",
    };
    input.floors[0].rooms[0].floorZones = [
      {
        id: "floor-zone-1",
        polygon: [
          [0.5, 0.5],
          [2, 0.5],
          [2, 1.5],
          [0.5, 1.5],
        ],
        finish: { kind: "solid", color: "#c8bca8" },
      },
    ];
    input.floors[0].groundZones = [
      {
        id: "garden-path",
        polygon: [
          [-2, 0.5],
          [-0.2, 0.5],
          [-0.2, 1.2],
          [-2, 1.2],
        ],
        finish: { kind: "preset", preset: "gravel" },
      },
    ];
    const result = engine.parseHomeProjectSchema(input);
    assert.equal(result.valid, true);
    assert.deepEqual(result.project.floors[0].rooms[0].floorFinish, {
      kind: "preset",
      preset: "travertine",
    });
    assert.equal(result.project.floors[0].rooms[0].floorZones[0].id, "floor-zone-1");
    assert.equal(engine.validateHomeProject(input, registries).valid, true);
  });

  test("colored ceramic finishes survive portable JSON and reject invalid colors", () => {
    for (const preset of ["square-tile", "subway-tile", "checkerboard-tile"]) {
      const input = project();
      const finish = { kind: "preset", preset, color: "#237a91" };
      input.floors[0].rooms[0].floorFinish = finish;
      const restored = engine.parseHomeProjectSchema(JSON.parse(JSON.stringify(input)));
      assert.equal(restored.valid, true);
      assert.deepEqual(restored.project.floors[0].rooms[0].floorFinish, finish);
      assert.equal(engine.validateHomeProject(input, registries).valid, true);
      input.floors[0].rooms[0].floorFinish.color = "invalid";
      assert.equal(engine.parseHomeProjectSchema(input).valid, false);
      assert.equal(engine.validateHomeProject(input, registries).valid, false);
    }
  });

  test("strict schema rejects malformed discriminators and unknown keys", () => {
    const badKind = project();
    badKind.floors[0].rooms[0].floorFinish = { kind: "wood" };
    assert.equal(engine.parseHomeProjectSchema(badKind).valid, false);

    const badPreset = project();
    badPreset.floors[0].rooms[0].floorFinish = {
      kind: "preset",
      preset: "marble",
    };
    assert.equal(engine.parseHomeProjectSchema(badPreset).valid, false);

    const unknown = project();
    unknown.floors[0].rooms[0].floorZones = [
      {
        id: "floor-zone-1",
        polygon: [
          [0.5, 0.5],
          [1, 0.5],
          [1, 1],
        ],
        finish: { kind: "preset", preset: "light-oak" },
        rotation: 90,
      },
    ];
    assert.ok(
      engine
        .parseHomeProjectSchema(unknown)
        .issues.some((candidate) => candidate.code === "project.unknown-key"),
    );
  });

  test("manifest validation enforces finish and zone geometry", () => {
    const valid = structuredClone(engine.neutralDemoManifest);
    const room = valid.floors[0].rooms[0];
    room.floorFinish = { kind: "preset", preset: "light-oak" };
    room.floorZones = [
      {
        id: "floor-zone-1",
        polygon: [
          [0.5, 0.5],
          [2, 0.5],
          [2, 1.5],
          [0.5, 1.5],
        ],
        finish: { kind: "preset", preset: "travertine" },
      },
    ];
    valid.floors[0].groundZones = [
      {
        id: "garden-path",
        polygon: [
          [-2, 0.5],
          [-0.2, 0.5],
          [-0.2, 1.2],
          [-2, 1.2],
        ],
        finish: { kind: "preset", preset: "sand" },
      },
    ];
    assert.equal(engine.validateHomeManifest(valid).issues.length, 0);

    const crossing = structuredClone(valid);
    crossing.floors[0].rooms[0].floorZones[0].polygon = [
      [0.5, 0.5],
      [2, 1.5],
      [0.5, 1.5],
      [2, 0.5],
    ];
    assert.ok(
      engine
        .validateHomeManifest(crossing)
        .issues.some((candidate) => candidate.code === "floor-zone.polygon"),
    );

    const outside = structuredClone(valid);
    outside.floors[0].rooms[0].floorZones[0].polygon = [
      [0.5, 0.5],
      [6, 0.5],
      [6, 1.5],
      [0.5, 1.5],
    ];
    assert.ok(
      engine
        .validateHomeManifest(outside)
        .issues.some((candidate) => candidate.code === "floor-zone.outside-room"),
    );

    const crossingBuilding = structuredClone(valid);
    crossingBuilding.floors[0].groundZones[0].polygon = [
      [-0.5, 0.5],
      [1, 0.5],
      [1, 1.2],
      [-0.5, 1.2],
    ];
    assert.ok(
      engine
        .validateHomeManifest(crossingBuilding)
        .issues.some((candidate) => candidate.code === "ground-zone.inside-footprint"),
    );

    const duplicate = structuredClone(valid);
    duplicate.floors[0].rooms[0].floorZones.push(
      structuredClone(duplicate.floors[0].rooms[0].floorZones[0]),
    );
    assert.ok(
      engine
        .validateHomeManifest(duplicate)
        .issues.some((candidate) => candidate.code === "id.duplicate"),
    );
  });

  test("rooms without a finish use the neutral fallback", () => {
    assert.deepEqual(engine.resolveRoomFloorFinish(engine.neutralDemoManifest.floors[0].rooms[0]), {
      kind: "solid",
      color: "#d3cec5",
    });
    const removedField = project();
    removedField.floors[0].rooms[0].floorColor = "#ffffff";
    assert.equal(engine.parseHomeProjectSchema(removedField).valid, false);
  });

  test("containment handles concavity and boundary contact", () => {
    const room = [
      [0, 0],
      [4, 0],
      [4, 1],
      [1, 1],
      [1, 4],
      [0, 4],
    ];
    const crossing = [
      [0.5, 0.5],
      [3.5, 0.5],
      [0.5, 3.5],
    ];
    const touching = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    assert.equal(engine.floorZoneWithinRoom(crossing, room), false);
    assert.equal(engine.floorZoneWithinRoom(touching, room), true);
  });

  test("preset registry is complete, unique, and deterministic", () => {
    assert.deepEqual(
      engine.FLOOR_FINISH_PRESETS.map((preset) => preset.id),
      [...engine.FLOOR_PATTERN_PRESET_IDS],
    );
    assert.equal(
      new Set(engine.FLOOR_FINISH_PRESETS.map((preset) => preset.label)).size,
      engine.FLOOR_PATTERN_PRESET_IDS.length,
    );
    const operations = [];
    const context = new Proxy(
      {
        canvas: { width: 128, height: 128 },
        createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        putImageData: (image, x, y) =>
          operations.push([
            "putImageData",
            createHash("sha256").update(image.data).digest("hex"),
            x,
            y,
          ]),
      },
      {
        set(target, property, value) {
          target[property] = value;
          operations.push(["set", String(property), value]);
          return true;
        },
        get(target, property) {
          if (property in target) return target[property];
          return (...args) => operations.push([String(property), ...args]);
        },
      },
    );
    for (const preset of engine.FLOOR_PATTERN_PRESET_IDS) {
      operations.length = 0;
      engine.paintFloorPattern(context, preset, "scene");
      assert.ok(
        operations.some(([operation]) => operation !== "set"),
        preset,
      );
      const first = JSON.stringify(operations);
      operations.length = 0;
      engine.paintFloorPattern(context, preset, "scene");
      assert.equal(JSON.stringify(operations), first, preset);
    }
  });

  test("one texture set services many room bases and zones", () => {
    let canvasCount = 0;
    let disposeCount = 0;
    const makeCanvas = () => {
      const canvas = { width: 0, height: 0, getContext: () => context };
      const context = new Proxy(
        {
          canvas,
          createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        },
        {
          set(target, property, value) {
            target[property] = value;
            return true;
          },
          get(target, property) {
            if (property in target) return target[property];
            return () => undefined;
          },
        },
      );
      return canvas;
    };
    const canvasDocument = {
      createElement(tag) {
        assert.equal(tag, "canvas");
        canvasCount += 1;
        return makeCanvas();
      },
    };
    const originalDispose = CanvasTexture.prototype.dispose;
    CanvasTexture.prototype.dispose = function disposeFixtureTexture() {
      disposeCount += 1;
    };
    try {
      const textureSet = engine.createFloorFinishTextureSet("scene", canvasDocument);
      const surfaces = Array.from(
        { length: 70 },
        (_, index) =>
          engine.FLOOR_PATTERN_PRESET_IDS[index % engine.FLOOR_PATTERN_PRESET_IDS.length],
      );
      const resolved = surfaces.map((preset) => textureSet.get(preset));
      assert.equal(canvasCount, engine.FLOOR_PATTERN_PRESET_IDS.length);
      assert.ok(resolved.every(Boolean));
      assert.equal(new Set(resolved).size, engine.FLOOR_PATTERN_PRESET_IDS.length);
      const colored = textureSet.get("square-tile", "#237a91");
      assert.ok(colored);
      assert.equal(textureSet.get("square-tile", "#237a91"), colored);
      assert.notEqual(colored, textureSet.get("square-tile"));
      assert.equal(canvasCount, engine.FLOOR_PATTERN_PRESET_IDS.length + 1);
      textureSet.dispose();
      assert.equal(disposeCount, engine.FLOOR_PATTERN_PRESET_IDS.length + 1);
    } finally {
      CanvasTexture.prototype.dispose = originalDispose;
    }
  });

  test("surface UVs stay anchored to absolute plan metres", () => {
    const coordinates = {
      origin: [10, -2],
      metersPerPlanUnit: 0.5,
      scaleBasis: "measured",
    };
    const first = engine.createFloorFinishGeometry(
      [
        [10, -2],
        [12, -2],
        [12, 0],
        [10, 0],
      ],
      coordinates,
      1,
    );
    const moved = engine.createFloorFinishGeometry(
      [
        [11, -1],
        [13, -1],
        [13, 1],
        [11, 1],
      ],
      coordinates,
      1,
    );
    try {
      assert.notDeepEqual([...first.getAttribute("uv").array], [...moved.getAttribute("uv").array]);
      assert.ok([...moved.getAttribute("uv").array].some((value) => value === 0.5));
    } finally {
      first.dispose();
      moved.dispose();
    }
  });

  test("renders ordered zones and routes zone clicks to the room", async () => {
    const floor = structuredClone(engine.neutralDemoManifest.floors[0]);
    floor.rooms[0].floorFinish = { kind: "preset", preset: "light-oak" };
    floor.rooms[0].floorZones = [
      {
        id: "floor-zone-1",
        polygon: [
          [0.5, 0.5],
          [2, 0.5],
          [2, 1.5],
          [0.5, 1.5],
        ],
        finish: { kind: "preset", preset: "travertine" },
      },
      {
        id: "floor-zone-2",
        polygon: [
          [1, 0.75],
          [2.5, 0.75],
          [2.5, 2],
          [1, 2],
        ],
        finish: { kind: "solid", color: "#bca98c" },
      },
    ];
    floor.groundZones = [
      {
        id: "garden-path",
        polygon: [
          [-2, 0.5],
          [-0.2, 0.5],
          [-0.2, 1.2],
          [-2, 1.2],
        ],
        finish: { kind: "preset", preset: "gravel" },
      },
    ];
    const selected = [];
    const renderer = await create(
      createElement(engine.FloorFinishSurfaces, {
        floor,
        variant: "scene",
        selectedRoomId: null,
        reducedMotion: true,
        onSelectRoom: (id) => selected.push(id),
      }),
    );
    try {
      const firstZone = renderer.scene.findByProps({
        name: "floor-zone-floor-zone-1",
      });
      const secondZone = renderer.scene.findByProps({
        name: "floor-zone-floor-zone-2",
      });
      const groundZone = renderer.scene.findByProps({
        name: "ground-zone-garden-path",
      });
      assert.ok(firstZone.props.renderOrder < secondZone.props.renderOrder);
      assert.ok(groundZone.props.position[1] < 0);
      const pointer = {
        pointerId: 1,
        nativeEvent: { clientX: 10, clientY: 10 },
        stopPropagation() {},
      };
      await renderer.fireEvent(secondZone, "pointerDown", pointer);
      await renderer.fireEvent(secondZone, "pointerUp", pointer);
      assert.deepEqual(selected, [floor.rooms[0].id]);
    } finally {
      await renderer.unmount();
    }
  });

  test("draft save, publish, and JSON round trip retain finish order", async () => {
    const before = project();
    before.floors[0].rooms[0].floorFinish = {
      kind: "preset",
      preset: "dark-walnut",
    };
    before.floors[0].rooms[0].floorZones = [
      {
        id: "floor-zone-1",
        polygon: [
          [0.5, 0.5],
          [2, 0.5],
          [2, 1.5],
          [0.5, 1.5],
        ],
        finish: { kind: "preset", preset: "travertine" },
      },
      {
        id: "floor-zone-2",
        polygon: [
          [1, 0.75],
          [2.5, 0.75],
          [2.5, 2],
          [1, 2],
        ],
        finish: { kind: "preset", preset: "encaustic-tile" },
      },
    ];
    before.floors[0].groundZones = [
      {
        id: "garden-path",
        polygon: [
          [-2, 0.5],
          [-0.2, 0.5],
          [-0.2, 1.2],
          [-2, 1.2],
        ],
        finish: { kind: "preset", preset: "sand" },
      },
    ];
    const parsed = engine.parseHomeProjectSchema(JSON.parse(JSON.stringify(before)));
    assert.equal(parsed.valid, true);
    assert.deepEqual(
      parsed.project.floors[0].rooms[0].floorZones.map((zone) => zone.id),
      ["floor-zone-1", "floor-zone-2"],
    );
    assert.deepEqual(parsed.project.floors[0].groundZones, before.floors[0].groundZones);

    let raw = null;
    const repository = engine.createHomeProjectRepository(
      {
        read: async () => raw,
        write: async (_id, value) => {
          raw = value;
        },
      },
      registries,
    );
    const initial = await repository.replace(engine.createSeedProjectRecord(project(), 1000));
    const saved = await engine.autosaveHomeProjectDraft(repository, initial, before, 1100);
    assert.equal(saved.status, "saved");
    const published = await engine.publishHomeProject(repository, saved.record, { now: 1200 });
    assert.equal(published.status, "published");
    assert.deepEqual(
      published.record.published.floors[0].rooms[0].floorZones,
      before.floors[0].rooms[0].floorZones,
    );
    assert.deepEqual(
      published.record.published.floors[0].groundZones,
      before.floors[0].groundZones,
    );

    const invalid = structuredClone(before);
    invalid.floors[0].rooms[0].floorZones[0].polygon = [
      [0.5, 0.5],
      [2, 1.5],
      [0.5, 1.5],
      [2, 0.5],
    ];
    const invalidSaved = await engine.autosaveHomeProjectDraft(
      repository,
      published.record,
      invalid,
      1300,
    );
    assert.equal(invalidSaved.status, "saved");
    assert.equal(
      (await engine.publishHomeProject(repository, invalidSaved.record, { now: 1400 })).status,
      "blocked",
    );
  });
});
