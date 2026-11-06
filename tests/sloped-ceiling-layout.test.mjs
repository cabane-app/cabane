import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const {
    composeHomeManifest,
    createEmptyHomeProject,
    deriveFloorTopology,
    parseHomeProject,
    resolveItemTransform,
    sceneItemPlacementIssues,
    serializeHomeProject,
    validateHomeProject,
    validateLayoutFloorSpec,
  } = await load("/packages/engine/src/index.ts");
  const { ArchitectureScene } = await load("/packages/engine/src/ArchitectureScene.tsx");
  const { buildRoofGeometries } = await load("/packages/engine/src/roof/roof-geometry.ts");
  const { createConstructEditorState, constructEditorReducer } = await load(
    "/apps/web/src/editor-preview/construct/construct-controller-reducer.ts",
  );
  const { projectFromEditorState } = await load("/apps/web/src/editor-preview/project-sync.ts");
  const { placementCandidate } = await load(
    "/apps/web/src/editor-preview/furnish/placement/placement-candidate.ts",
  );
  const { makeLegacyProject, makeStairProject, emptyExtensions, emptyRegistries } = await load(
    "/tests/fixtures/multiple-floors.ts",
  );

  const rectangle = (left, right, depth = 4) => [
    [left, 0],
    [right, 0],
    [right, depth],
    [left, depth],
  ];
  const floorPlan = (id, left = 0, right = 6) => {
    const polygon = rectangle(left, right);
    const topology = deriveFloorTopology({
      floorId: id,
      floorName: id,
      floorToFloorHeightMeters: 2.8,
      defaultWallHeightMeters: 2.4,
      defaultCeilingHeightMeters: 2.4,
      walls: polygon.map((from, index) => ({
        id: `${id}-wall-${index}`,
        from,
        to: polygon[(index + 1) % polygon.length],
      })),
      openings: [],
      rooms: [{ id: `${id}-room`, name: id, accent: "#c9a477", anchor: [(left + right) / 2, 2] }],
    });
    assert.deepEqual(topology.issues, []);
    return topology.floor;
  };

  const atticProject = () => {
    const project = createEmptyHomeProject("slope-fixture", "A-frame fixture");
    const floor = floorPlan("attic");
    const plane = (id, boundary, eave, depth = 4) => ({
      id,
      boundary,
      lowEdge: [
        [eave, 0],
        [eave, depth],
      ],
      highEdge: [
        [3, 0],
        [3, depth],
      ],
      lowHeightMeters: 2.4,
      highHeightMeters: 4.2,
    });
    floor.ceilings = [
      {
        id: "attic:room-1",
        kind: "sloped",
        roomIds: ["attic-room"],
        planes: [plane("west", rectangle(0, 3), 0), plane("east", rectangle(3, 6).toReversed(), 6)],
      },
    ];
    return { ...project, floors: [floor] };
  };

  test("sloped layout and edited rooms round-trip through project JSON and Construct history", () => {
    const project = atticProject();
    const parsed = parseHomeProject(serializeHomeProject(project));
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
    const floor = parsed.project.floors[0];
    assert.equal(validateLayoutFloorSpec(floor).valid, true);
    assert.equal(validateHomeProject(parsed.project, emptyRegistries).valid, true);
    assert.deepEqual(
      composeHomeManifest(parsed.project, emptyExtensions).floors[0].ceilings,
      floor.ceilings,
    );

    let editor = createConstructEditorState(floor);
    editor = constructEditorReducer(editor, {
      type: "update-room-metadata",
      roomId: "attic-room",
      anchor: [2, 2],
      changes: { name: "Attic studio" },
    });
    assert.deepEqual(editor.previewFloor.ceilings, floor.ceilings);
    editor = constructEditorReducer(editor, { type: "add-wall", from: [4, 0], to: [4, 4] });
    const [flat, sloped] = editor.previewFloor.ceilings;
    assert.equal(flat.kind, "flat");
    assert.deepEqual(flat.roomIds, [
      editor.previewFloor.rooms.find((room) => room.id !== "attic-room").id,
    ]);
    assert.deepEqual(sloped, floor.ceilings[0]);

    const edited = projectFromEditorState(parsed.project, editor.previewFloor, []);
    assert.equal(validateHomeProject(edited, emptyRegistries).valid, true);
    const restored = parseHomeProject(serializeHomeProject(edited));
    assert.equal(restored.valid, true, JSON.stringify(restored.issues));
    assert.deepEqual(restored.project.floors[0].ceilings, [flat, sloped]);
    assert.equal(
      restored.project.floors[0].rooms.find((room) => room.id === "attic-room").name,
      "Attic studio",
    );
    assert.deepEqual(
      constructEditorReducer(editor, { type: "undo" }).previewFloor.ceilings,
      floor.ceilings,
    );

    const discarded = constructEditorReducer(editor, {
      type: "discard-room-identity",
      roomId: "attic-room",
    });
    assert.ok(discarded.previewFloor.ceilings.every((ceiling) => ceiling.kind === "flat"));
    assert.deepEqual(constructEditorReducer(discarded, { type: "undo" }).previewFloor.ceilings, [
      flat,
      sloped,
    ]);
  });

  test("malformed planes are rejected before storage and legacy flat projects still migrate", () => {
    const project = atticProject();
    const [ceiling] = project.floors[0].ceilings;
    const [plane] = ceiling.planes;
    for (const [planes, code] of [
      [[], "ceiling.planes"],
      [[null], "ceiling.plane"],
      [[{ ...plane, lowEdge: [[0, 0]] }], "ceiling.plane-edge"],
      [
        [
          {
            ...plane,
            highEdge: [
              [3, 0],
              [3, 0],
            ],
          },
        ],
        "ceiling.plane-edge",
      ],
      [[{ ...plane, highEdge: plane.lowEdge }], "ceiling.plane-axis"],
      [
        [
          {
            ...plane,
            highEdge: [
              [3, 0],
              [2, 4],
            ],
          },
        ],
        "ceiling.plane-axis",
      ],
      [[{ ...plane, boundary: rectangle(0, 6) }], "ceiling.plane-span"],
      [[{ ...plane, highHeightMeters: 2 }], "ceiling.plane-height"],
      [[{ ...plane, lowHeightMeters: -1 }], "ceiling.plane-height"],
      [[{ ...plane, highHeightMeters: null }], "ceiling.plane-height"],
      [
        [
          {
            ...plane,
            boundary: [
              [0, 0],
              [2, 2],
              [0, 2],
              [3, 0],
            ],
          },
        ],
        "ceiling.plane-boundary",
      ],
      [
        [
          {
            ...plane,
            boundary: [
              [0, 0],
              [1, 1],
              [2, 2],
            ],
          },
        ],
        "ceiling.plane-boundary",
      ],
      [[plane, plane], "ceiling.plane-id"],
    ]) {
      project.floors[0].ceilings = [{ ...ceiling, planes }];
      const parsed = parseHomeProject(JSON.stringify(project));
      assert.equal(parsed.valid, false);
      assert.ok(
        parsed.issues.some((issue) => issue.code === code),
        JSON.stringify(parsed.issues),
      );
      assert.ok(
        validateLayoutFloorSpec(project.floors[0]).issues.some((issue) => issue.code === code),
      );
    }
    project.floors[0].ceilings = [{ ...ceiling, planes: [{ ...plane, skylights: [] }] }];
    const newer = parseHomeProject(JSON.stringify(project));
    assert.ok(
      newer.issues.some(
        (issue) => issue.path.endsWith(".skylights") && issue.message.includes("HACS"),
      ),
    );

    project.floors[0].ceilings = [{ ...ceiling, roomIds: [] }];
    const noRoom = parseHomeProject(JSON.stringify(project));
    assert.ok(noRoom.issues.some((issue) => issue.code === "ceiling.rooms"));
    assert.equal(validateLayoutFloorSpec(project.floors[0]).valid, false);

    project.floors[0].ceilings = [{ ...ceiling, roomIds: ["missing-room"] }];
    const wrongRoom = validateHomeProject(project, emptyRegistries);
    assert.ok(wrongRoom.issues.some((issue) => issue.code === "ceiling.rooms"));

    const legacy = makeLegacyProject();
    const migrated = parseHomeProject(JSON.stringify(legacy));
    assert.equal(migrated.valid, true);
    assert.deepEqual(migrated.project.floors[0].ceilings, legacy.floor.ceilings);
  });

  test("Arrange, placement diagnostics and runtime agree on the ceiling at an attachment point", () => {
    const project = atticProject();
    const [floor] = project.floors;
    const [ceiling] = floor.ceilings;
    const [west, east] = ceiling.planes;
    // The shorter reference edge is shifted along the ridge. Its whole length stays level.
    ceiling.planes = [
      {
        ...west,
        highEdge: [
          [3, 1],
          [3, 3.5],
        ],
      },
      east,
    ];
    assert.equal(validateHomeProject(project, emptyRegistries).valid, true);
    const definition = {
      defaultSize: [0.2, 0.2, 0.2],
      bounds: { min: [-0.1, -0.2, -0.1], max: [0.1, 0, 0.1] },
      preferredPlacement: "ceiling",
    };
    const at = [2.5, 2];
    const candidate = placementCandidate({ definition }, floor, { at, drop: 3, raw: true });
    assert.equal(candidate.error, null);
    const item = {
      kind: "furnishing",
      floorId: floor.id,
      modelId: "synthetic-ceiling-fixture",
      size: definition.defaultSize,
      placement: candidate.placement,
    };
    assert.ok(Math.abs(resolveItemTransform(item.placement, floor).position[1] - 0.9) < 1e-6);
    assert.deepEqual(sceneItemPlacementIssues(item, project, definition), []);
    assert.ok(
      Math.abs(
        resolveItemTransform({ ...item.placement, at: [3, 2], dropMeters: 0 }, floor).position[1] -
          4.2,
      ) < 1e-6,
    );
    ceiling.planes = [east];
    assert.equal(placementCandidate({ definition }, floor, { at, raw: true }).placement, null);
    assert.ok(
      sceneItemPlacementIssues(item, project, definition).some(
        (issue) => issue.code === "project.ceiling-support",
      ),
    );
  });

  const verticalTrianglesAt = (geometry, axis, value) => {
    const positions = geometry.attributes.position.array;
    const triangles = [];
    for (let index = 0; index < positions.length; index += 9) {
      const triangle = positions.slice(index, index + 9);
      if ([0, 3, 6].every((offset) => Math.abs(triangle[offset + axis] - value) < 1e-6)) {
        triangles.push(triangle);
      }
    }
    return triangles;
  };

  test("A-frame roof closes the gable ends and leaves the shared ridge clear", () => {
    const [floor] = atticProject().floors;
    const [ceiling] = floor.ceilings;
    const [west, east] = ceiling.planes;
    const cases = [
      { east, seamEnd: 4, remaining: false },
      { east: { ...east, boundary: rectangle(3, 6, 2) }, seamEnd: 2, remaining: true },
      { east: { ...east, highHeightMeters: 4.6 }, seamEnd: 0, remaining: true },
    ];
    for (const { east, seamEnd, remaining } of cases) {
      floor.ceilings = [{ ...ceiling, planes: [west, east] }];
      const roof = buildRoofGeometries([floor]);
      try {
        const gable = verticalTrianglesAt(roof.infill, 2, 0);
        const heights = gable.flatMap((triangle) => [triangle[1], triangle[4], triangle[7]]);
        assert.ok(Math.abs(Math.min(...heights) - floor.defaultWallHeightMeters) < 1e-6);
        assert.ok(Math.max(...heights) > 4.2);
        for (const geometry of [roof.infill, roof.edges]) {
          const seam = verticalTrianglesAt(geometry, 0, 3);
          assert.equal(seam.length > 0, remaining);
          assert.ok(
            seam.every((triangle) =>
              [triangle[2], triangle[5], triangle[8]].every((z) => z >= seamEnd),
            ),
          );
        }
      } finally {
        Object.values(roof).forEach((geometry) => geometry.dispose());
      }
    }
  });

  const scene = (project, activeFloorId, walkMode = false) =>
    createElement(ArchitectureScene, {
      manifest: composeHomeManifest(project, emptyExtensions),
      activeFloorId,
      selectedRoomId: null,
      walkMode,
      wallFadeEnabled: false,
      reducedMotion: true,
      resolvedBindings: { rooms: {}, openings: {} },
      architectureModels: {},
      deviceModels: {},
      openingPositions: {},
      onInteract() {},
    });
  const ceilingsOn = (renderer, floorId) =>
    renderer.scene
      .findByProps({ name: `building-floor-${floorId}` })
      .findByProps({ name: "floor-ceilings" });

  test("cutaway hides only lower slopes crossing the selected floor's footprint and level", async () => {
    const project = atticProject();
    project.floors.push(floorPlan("upper"));
    const [west, east] = project.floors[0].ceilings[0].planes;
    project.floors[0].ceilings[0].planes = [west, { ...east, highHeightMeters: 2.7 }];
    const renderer = await create(scene(project, "upper"));
    try {
      const lowerCeilings = () => ceilingsOn(renderer, "attic").findAllByType("Mesh");
      const meshes = lowerCeilings();
      assert.equal(meshes.length, 1);
      meshes[0].instance.geometry.computeBoundingBox();
      assert.ok(Math.abs(meshes[0].instance.geometry.boundingBox.max.y - 2.7) < 1e-6);
      await renderer.update(scene(project, "upper", true));
      assert.equal(lowerCeilings().length, 2);
      for (const [left, right] of [
        [12, 18],
        [0, 0.5],
      ]) {
        project.floors[1] = floorPlan("upper", left, right);
        await renderer.update(scene(project, "upper"));
        assert.equal(lowerCeilings().length, 2);
      }
    } finally {
      await renderer.unmount();
    }
  });

  test("a sloped ceiling leaves the real stair opening clear in Walk", async () => {
    const project = makeStairProject();
    const [floor] = project.floors;
    floor.ceilings = [
      {
        id: "stair-slope",
        kind: "sloped",
        roomIds: [floor.rooms[0].id],
        planes: [
          {
            id: "stair-plane",
            boundary: floor.footprint,
            lowEdge: [
              [0, 0],
              [0, 8],
            ],
            highEdge: [
              [8, 0],
              [8, 8],
            ],
            lowHeightMeters: 2.1,
            highHeightMeters: 2.55,
          },
        ],
      },
    ];
    const renderer = await create(scene(project, floor.id, true));
    try {
      const ceiling = ceilingsOn(renderer, floor.id).instance;
      ceiling.updateWorldMatrix(true, true);
      const hits = (x, z) =>
        new Raycaster(new Vector3(x, 0, z), new Vector3(0, 1, 0)).intersectObject(ceiling, true);
      assert.equal(hits(4, 3.5).length, 0);
      assert.ok(hits(1, 3.5).length > 0);
    } finally {
      await renderer.unmount();
    }
  });
});
