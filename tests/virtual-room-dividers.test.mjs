import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const {
    buildArchitecturalWallGeometries,
    createFloorEditorDraft,
    defineHomeManifest,
    deriveFloorTopology,
    deriveWalkColliders,
    isWalkPointClear,
    neutralDemoManifest,
    validateHomeManifest,
    availableOpeningOffsetRanges,
    nearestAvailableOpeningOffset,
    resolveItemTransform,
    sceneItemPlacementIssues,
  } = await load("/packages/engine/src/index.ts");
  const { physicalFloor } = await load(
    "/packages/engine/src/architecture-geometry/physical-floor.ts",
  );
  const { planPointToWorld } = await load("/packages/engine/src/geometry.ts");
  const { wallSolidBands } = await load(
    "/packages/engine/src/architecture-geometry/wall-solid-bands.ts",
  );
  const { parseHomeProjectSchema } = await load("/packages/engine/src/home-project/validation.ts");
  const { makeLegacyProject } = await load("/tests/fixtures/multiple-floors.ts");
  const { placementCandidate } = await load(
    "/apps/web/src/editor-preview/furnish/placement/placement-candidate.ts",
  );
  const { placementNearWallsForWorldDrag } = await load(
    "/apps/web/src/editor-preview/furnish/placement/wall-drag-placement.ts",
  );

  const wall = (id, from, to, extra = {}) => ({ id, from, to, thicknessMeters: 0.2, ...extra });
  const topologyInput = (partitionExtra) => ({
    floorId: "ground",
    floorName: "Ground",
    walls: [
      wall("north", [0, 0], [6, 0]),
      wall("east", [6, 0], [6, 4]),
      wall("south", [6, 4], [0, 4]),
      wall("west", [0, 4], [0, 0]),
      wall("divider", [3, 0], [3, 4], partitionExtra),
    ],
    openings: [],
    rooms: [
      { id: "left", name: "Left", accent: "#c9a477", anchor: [1.5, 2] },
      { id: "right", name: "Right", accent: "#8fb0b0", anchor: [4.5, 2] },
    ],
  });
  const derive = (partitionExtra) => {
    const result = deriveFloorTopology(topologyInput(partitionExtra));
    assert.deepEqual(result.issues, []);
    return result.floor;
  };
  const virtualFloor = derive({ virtual: true });
  const solidFloor = derive({});
  const dividerOf = (floor) => floor.walls.find((candidate) => candidate.id === "divider");

  test("a virtual divider still closes two named rooms and keeps its flag", () => {
    assert.equal(virtualFloor.rooms.length, 2);
    assert.equal(dividerOf(virtualFloor).virtual, true);
    assert.equal(
      virtualFloor.walls.filter((candidate) => candidate.virtual).length,
      1,
      "only the divider is virtual",
    );
    assert.equal(dividerOf(solidFloor).virtual, undefined);
  });

  test("the editor draft round-trip preserves a virtual divider", () => {
    const draft = createFloorEditorDraft(virtualFloor);
    assert.equal(draft.walls.find((candidate) => candidate.id === "divider").virtual, true);
    const again = deriveFloorTopology(draft);
    assert.deepEqual(again.issues, []);
    assert.equal(dividerOf(again.floor).virtual, true);
  });

  test("physicalFloor drops virtual walls and prunes their junctions", () => {
    const built = physicalFloor(virtualFloor);
    assert.equal(
      built.walls.some((candidate) => candidate.id === "divider"),
      false,
    );
    assert.equal(built.rooms.length, 2, "rooms stay so each area keeps its name");
    for (const junction of built.wallJunctions) {
      assert.ok(junction.wallIds.length >= 2);
      assert.equal(junction.wallIds.includes("divider"), false);
    }
    assert.equal(physicalFloor(virtualFloor), built, "result is cached per floor");
    assert.equal(
      physicalFloor(solidFloor),
      solidFloor,
      "floors without virtual walls pass through",
    );
  });

  test("walkers cross a virtual divider but not a solid one", () => {
    const [x, z] = planPointToWorld([3, 2], virtualFloor.coordinates);
    const point = { x, z };
    const virtualColliders = deriveWalkColliders(virtualFloor);
    assert.equal(
      virtualColliders.some((collider) => collider.id.startsWith("divider-")),
      false,
    );
    assert.equal(isWalkPointClear(point, virtualColliders), true);
    assert.equal(isWalkPointClear(point, deriveWalkColliders(solidFloor)), false);
  });

  test("a virtual divider adds no wall geometry", () => {
    const vertexCount = (floor) =>
      buildArchitecturalWallGeometries(floor).reduce(
        (total, { geometry }) => total + geometry.getAttribute("position").count,
        0,
      );
    assert.ok(vertexCount(virtualFloor) > 0);
    assert.ok(vertexCount(virtualFloor) < vertexCount(solidFloor));
  });

  test("wall solid bands, which feed stair clearance, skip a virtual divider", () => {
    const solids = (floor) => JSON.stringify(wallSolidBands(floor).map((band) => band.footprint));
    assert.notEqual(solids(virtualFloor), solids(solidFloor));
    assert.equal(solids(virtualFloor), solids(physicalFloor(virtualFloor)));
  });

  const manifestWith = (floor) => defineHomeManifest({ ...neutralDemoManifest, floors: [floor] });
  const codes = (floor) => validateHomeManifest(manifestWith(floor)).issues.map((i) => i.code);

  const definition = {
    defaultSize: [0.3, 0.6, 0.3],
    preferredPlacement: "absolute",
    bounds: { min: [-0.15, 0, -0.15], max: [0.15, 0.6, 0.15] },
  };
  const floorItem = {
    id: "lamp",
    kind: "furnishing",
    modelId: "lamp",
    floorId: virtualFloor.id,
    size: definition.defaultSize,
    placement: {
      kind: "absolute",
      at: [2, 2],
      elevationMeters: 0.001,
      rotationYRadians: 0,
    },
  };

  test("Arrange placement and world dragging ignore invisible wall supports", () => {
    const candidate = placementCandidate({ definition }, virtualFloor, { at: [3.1, 2] });
    assert.equal(candidate.error, null);
    assert.equal(candidate.placement.kind, "absolute");
    assert.doesNotThrow(() =>
      resolveItemTransform(candidate.placement, physicalFloor(virtualFloor)),
    );
    assert.equal(
      placementNearWallsForWorldDrag({
        rawAt: [3.1, 2],
        item: floorItem,
        definition,
        floor: virtualFloor,
      }),
      null,
    );
    assert.equal(
      placementCandidate({ definition }, virtualFloor, {
        at: [3.1, 2],
        kind: "wall",
        wallId: "divider",
      }).placement,
      null,
    );
    const physical = placementCandidate({ definition }, solidFloor, { at: [3.1, 2] });
    assert.equal(physical.placement.kind, "wall", "physical dividers remain valid supports");
  });

  test("saved-project validation rejects attachments to invisible walls", () => {
    const item = {
      ...floorItem,
      placement: {
        kind: "wall",
        wallId: "divider",
        face: "right",
        offsetFromWallStartPlanUnits: 2,
        elevationMeters: 0,
        depthOffsetMeters: 0.2,
        rotationOffsetRadians: 0,
      },
    };
    const issues = sceneItemPlacementIssues(item, { floors: [virtualFloor] }, definition);
    assert.ok(
      issues.some(
        (issue) => issue.code === "project.wall-support-virtual" && issue.severity === "error",
      ),
    );
    assert.deepEqual(sceneItemPlacementIssues(item, { floors: [solidFloor] }, definition), []);
  });

  test("invisible junctions do not block validation or placement of facade windows", () => {
    const floor = {
      ...virtualFloor,
      openings: [
        {
          id: "facade-window",
          kind: "window",
          wallId: "north",
          offsetFromWallStartPlanUnits: 2.5,
          widthPlanUnits: 1,
          openingHeightMeters: 1.2,
          sillHeightMeters: 0.8,
          operation: "fixed",
          variant: "plain",
          panelCount: 1,
          glazing: "clear",
        },
      ],
    };
    assert.equal(codes(floor).includes("wall-junction.opening-overlap"), false);
    const draft = createFloorEditorDraft(virtualFloor);
    const request = { draft, wallId: "north", widthPlanUnits: 1, sillHeightMeters: 0.8 };
    assert.equal(nearestAvailableOpeningOffset(2.5, availableOpeningOffsetRanges(request)), 2.5);
    assert.deepEqual(availableOpeningOffsetRanges({ ...request, wallId: "divider" }), []);
    assert.ok(
      codes({ ...solidFloor, openings: floor.openings }).includes("wall-junction.opening-overlap"),
    );
  });

  test("validation accepts the flag, rejects non-boolean values, and bars openings on it", () => {
    assert.equal(codes(virtualFloor).includes("wall.virtual"), false);
    const malformed = {
      ...virtualFloor,
      walls: virtualFloor.walls.map((candidate) =>
        candidate.id === "divider" ? { ...candidate, virtual: "yes" } : candidate,
      ),
    };
    assert.ok(codes(malformed).includes("wall.virtual"));
    const hosted = {
      ...virtualFloor,
      openings: [
        {
          id: "divider-passage",
          kind: "passage",
          wallId: "divider",
          offsetFromWallStartPlanUnits: 1,
          widthPlanUnits: 1,
          openingHeightMeters: 2.1,
          sillHeightMeters: 0,
          variant: "rectangular",
        },
      ],
    };
    assert.ok(codes(hosted).includes("opening.virtual-wall"));
  });

  test("the project schema validates the virtual flag", () => {
    const project = (virtual) => {
      const source = makeLegacyProject();
      source.floor.walls[0] = { ...source.floor.walls[0], virtual };
      return parseHomeProjectSchema(source);
    };
    const issueCodes = (result) => (result.valid ? [] : result.issues.map((i) => i.code));
    assert.equal(issueCodes(project(true)).includes("project.wall-virtual"), false);
    assert.ok(issueCodes(project("yes")).includes("project.wall-virtual"));
  });
});
