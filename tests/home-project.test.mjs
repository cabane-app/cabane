import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const homeProjectApi = await load("/packages/engine/src/home-project/index.ts");
  const engineApi = await load("/packages/engine/src/index.ts");
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const {
    defineFurnishingModel,
    defineFurnishingModelRegistry,
    defineHomeProject,
    parseHomeProjectSchema,
    resolveItemTransform,
    validateHomeProject,
    composeHomeManifest,
  } = homeProjectApi;

  const fixtureFloorForPlacementTests = () => ({
    id: "floor",
    name: "Floor",
    coordinates: {
      origin: [0, 0],
      metersPerPlanUnit: 1,
      scaleBasis: "measured",
    },
    defaultWallHeightMeters: 2.4,
    defaultCeilingHeightMeters: 2.4,
    footprint: [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ],
    rooms: [
      {
        id: "room",
        name: "Room",
        polygon: [
          [0.2, 0.2],
          [3.8, 0.2],
          [3.8, 2.8],
          [0.2, 2.8],
        ],
        accent: "#c98164",
        dashboardSlots: [],
        devices: [],
      },
    ],
    walls: [
      {
        id: "north",
        from: [0, 0],
        to: [4, 0],
        classification: "exterior",
        thicknessMeters: 0.2,
      },
    ],
    wallJunctions: [],
    openings: [],
    ceilings: [
      {
        id: "room-ceiling",
        kind: "flat",
        roomIds: ["room"],
        heightMeters: 2.4,
      },
    ],
  });

  const entitySlot = (id, compatibleDomains, label) => ({
    id,
    compatibleDomains,
    required: true,
    autoMap: "manual",
    deviceRole: "primary",
    presentation: { label, dashboardRole: "primary" },
  });

  const fixtureHomeProject = () =>
    defineHomeProject({
      schemaVersion: 1,
      seedRevision: "fixture-v1",
      home: {
        id: "fixture-home",
        name: "Fixture home",
        locale: "en",
        palette: {
          accent: "#d48a54",
          secondary: "#758f83",
          exterior: "#c97370",
          interior: "#e4e0d8",
          ground: "#91a06a",
        },
      },
      floor: {
        id: "ground-floor",
        name: "Ground floor",
        coordinates: {
          origin: [0, 0],
          metersPerPlanUnit: 1,
          scaleBasis: "measured",
        },
        defaultWallHeightMeters: 2.4,
        defaultCeilingHeightMeters: 2.4,
        footprint: [
          [0, 0],
          [4, 0],
          [4, 3],
          [0, 3],
        ],
        rooms: [
          {
            id: "room",
            name: "Room",
            polygon: [
              [0.12, 0.12],
              [3.88, 0.12],
              [3.88, 2.88],
              [0.12, 2.88],
            ],
            accent: "#c98164",
            dashboardSlots: [],
            devices: [],
          },
        ],
        walls: [
          {
            id: "north",
            from: [0, 0],
            to: [4, 0],
            classification: "exterior",
            thicknessMeters: 0.18,
          },
          {
            id: "east",
            from: [4, 0],
            to: [4, 3],
            classification: "exterior",
            thicknessMeters: 0.18,
          },
          {
            id: "south",
            from: [4, 3],
            to: [0, 3],
            classification: "exterior",
            thicknessMeters: 0.18,
          },
          {
            id: "west",
            from: [0, 3],
            to: [0, 0],
            classification: "exterior",
            thicknessMeters: 0.18,
          },
        ],
        wallJunctions: [
          { id: "north-west", at: [0, 0], wallIds: ["north", "west"] },
          { id: "north-east", at: [4, 0], wallIds: ["north", "east"] },
          { id: "south-east", at: [4, 3], wallIds: ["east", "south"] },
          { id: "south-west", at: [0, 3], wallIds: ["south", "west"] },
        ],
        openings: [
          {
            id: "door",
            wallId: "south",
            kind: "door",
            offsetFromWallStartPlanUnits: 1.5,
            widthPlanUnits: 0.9,
            openingHeightMeters: 2.1,
            sillHeightMeters: 0,
            operation: "hinged",
            variant: "panel",
            finish: "wood",
            leafCount: 1,
          },
        ],
        ceilings: [
          {
            id: "room-ceiling",
            kind: "flat",
            roomIds: ["room"],
            heightMeters: 2.4,
          },
        ],
      },
      sceneItems: [
        {
          id: "chair",
          kind: "furnishing",
          modelId: "chair",
          placement: {
            kind: "absolute",
            at: [2, 1],
            elevationMeters: 0,
            rotationYRadians: 0,
          },
          size: [0.6, 0.9, 0.6],
        },
        {
          id: "wall-switch",
          kind: "device",
          modelId: "wall-switch",
          placement: {
            kind: "wall",
            wallId: "north",
            face: "right",
            offsetFromWallStartPlanUnits: 1,
            elevationMeters: 1,
            depthOffsetMeters: 0.04,
            rotationOffsetRadians: 0,
          },
          size: [0.12, 0.15, 0.05],
          entitySlots: [entitySlot("wall-switch-entity", ["switch"], "Wall switch")],
        },
      ],
      roomProfiles: {
        room: {
          dashboardSlots: [entitySlot("room-light", ["light"], "Room light")],
        },
      },
      openingProfiles: {
        door: {
          contactSlot: {
            id: "door-contact",
            compatibleDeviceClasses: ["door"],
            openState: "on",
            autoMap: "unique-compatible",
          },
        },
      },
      shortcuts: [],
      assumptions: [],
    });

  const fixtureHomeExtensions = () => ({
    furnishingModels: defineFurnishingModelRegistry({
      chair: defineFurnishingModel({
        component: () => null,
        label: "Fixture chair",
        category: "Seating",
        defaultRoomType: "living-room",
        defaultSize: [0.6, 0.9, 0.6],
        bounds: { min: [-0.3, 0, -0.3], max: [0.3, 0.9, 0.3] },
        resizePolicy: { kind: "uniform" },
        preferredPlacement: "absolute",
        outlineContact: false,
        complexity: { visibleMeshes: 1, triangles: 12 },
      }),
    }),
    deviceModels: {
      "wall-switch": {
        component: () => null,
        label: "Wall switch",
        category: "Controls",
        defaultRoomType: "living-room",
        defaultSize: [0.12, 0.15, 0.05],
        bounds: { min: [-0.06, 0, 0], max: [0.06, 0.15, 0.05] },
        resizePolicy: { kind: "fixed" },
        preferredPlacement: "wall",
        outlineContact: false,
        complexity: { visibleMeshes: 1, triangles: 12 },
        supportedDomains: ["switch"],
        mountKind: "wall",
        interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
      },
    },
    openingModels: {},
    roomFurnishings: {},
  });

  test("wall custom edge color survives portable JSON and rejects malformed values", () => {
    const project = fixtureHomeProject();
    project.floors[0].walls[0].edgeColor = "#bcb99b";
    const parsed = parseHomeProjectSchema(
      JSON.parse(homeProjectApi.serializeCanonicalJson(project)),
    );
    assert.equal(parsed.valid, true);
    assert.equal(parsed.project.floors[0].walls[0].edgeColor, "#bcb99b");
    project.floors[0].walls[0].edgeColor = 123;
    const invalid = parseHomeProjectSchema(project);
    assert.equal(invalid.valid, false);
    assert.ok(invalid.issues.some((issue) => issue.path === "floors[0].walls[0].edgeColor"));
  });

  test("exports the home project contract from the engine public API", () => {
    assert.equal(engineApi.defineHomeProject, defineHomeProject);
  });

  test("resolves absent action bar to five defaults but honors an explicit empty bar", () => {
    assert.equal(typeof engineApi.resolveActionBarItems, "function");
    assert.deepEqual(
      engineApi.resolveActionBarItems().map((item) => item.target.action),
      ["build", "walk", "night", "weather", "view"],
    );
    assert.deepEqual(engineApi.resolveActionBarItems({ items: [] }), []);
    const legacy = fixtureHomeProject();
    legacy.shortcuts = [{ id: "old-light", action: "all-lights", context: "both", order: 0 }];
    assert.deepEqual(
      engineApi.resolveActionBarItems(legacy.actionBar).map((item) => item.target.action),
      ["build", "walk", "night", "weather", "view"],
    );
  });

  test("round trips portable room and device action bar targets", () => {
    const project = fixtureHomeProject();
    project.actionBar = {
      items: [
        { id: "room-link", target: { kind: "room", roomId: "room" } },
        { id: "device-link", target: { kind: "device", deviceId: "wall-switch" } },
      ],
    };
    const parsed = parseHomeProjectSchema(
      JSON.parse(homeProjectApi.serializeCanonicalJson(project)),
    );
    assert.equal(parsed.valid, true);
    assert.deepEqual(parsed.project.actionBar, project.actionBar);
    assert.deepEqual(
      composeHomeManifest(parsed.project, fixtureHomeExtensions()).actionBar,
      project.actionBar,
    );
  });

  test("rejects malformed action bar targets and missing draft references", () => {
    for (const target of [
      { kind: "unknown", roomId: "room" },
      { kind: "built-in", action: "delete-home" },
    ]) {
      const project = fixtureHomeProject();
      project.actionBar = { items: [{ id: "bad", target }] };
      const parsed = parseHomeProjectSchema(project);
      assert.equal(parsed.valid, false);
      assert.ok(parsed.issues.some((issue) => issue.path.startsWith("actionBar.items[0].target")));
    }
    const cases = [
      [
        { id: "a", target: { kind: "room", roomId: "missing" } },
        "actionBar.items[0].target.roomId",
      ],
      [
        { id: "a", target: { kind: "device", deviceId: "chair" } },
        "actionBar.items[0].target.deviceId",
      ],
      [
        { id: "a", target: { kind: "device", deviceId: "missing" } },
        "actionBar.items[0].target.deviceId",
      ],
    ];
    for (const [item, path] of cases) {
      const project = fixtureHomeProject();
      project.actionBar = { items: [item] };
      const result = validateHomeProject(project, fixtureHomeExtensions());
      assert.equal(result.valid, false);
      assert.ok(
        result.issues.some((issue) => issue.path === path),
        path,
      );
    }
  });

  test("rejects duplicate action bar IDs and targets", () => {
    for (const second of [
      { id: "first", target: { kind: "device", deviceId: "wall-switch" } },
      { id: "second", target: { kind: "room", roomId: "room" } },
    ]) {
      const project = fixtureHomeProject();
      project.actionBar = {
        items: [{ id: "first", target: { kind: "room", roomId: "room" } }, second],
      };
      const result = validateHomeProject(project, fixtureHomeExtensions());
      assert.equal(result.valid, false);
      assert.ok(result.issues.some((issue) => issue.path.startsWith("actionBar.items[1]")));
    }
  });

  test("allows outside-room device shortcuts and rejects targets with no floor", () => {
    const project = fixtureHomeProject();
    project.sceneItems = project.sceneItems.map((item) =>
      item.id === "wall-switch"
        ? {
            ...item,
            placement: { kind: "absolute", at: [20, 20], elevationMeters: 0, rotationYRadians: 0 },
          }
        : item,
    );
    project.actionBar = {
      items: [{ id: "outside", target: { kind: "device", deviceId: "wall-switch" } }],
    };
    const result = validateHomeProject(project, fixtureHomeExtensions());
    assert.equal(
      result.issues.some((issue) => issue.path === "actionBar.items[0].target.deviceId"),
      false,
    );
    project.sceneItems.find((item) => item.id === "wall-switch").floorId = "missing-floor";
    assert.ok(
      validateHomeProject(project, fixtureHomeExtensions()).issues.some(
        (issue) => issue.path === "actionBar.items[0].target.deviceId",
      ),
    );
  });

  test("defines a serializable home project without runtime components", () => {
    const project = defineHomeProject({
      schemaVersion: 1,
      seedRevision: "fixture-v1",
      home: {
        id: "fixture-home",
        name: "Fixture home",
        locale: "en",
        palette: {
          accent: "#d48a54",
          secondary: "#758f83",
          exterior: "#c97370",
          interior: "#e4e0d8",
          ground: "#91a06a",
        },
      },
      floor: {
        id: "ground-floor",
        name: "Ground floor",
        coordinates: {
          origin: [0, 0],
          metersPerPlanUnit: 1,
          scaleBasis: "measured",
        },
        defaultWallHeightMeters: 2.4,
        defaultCeilingHeightMeters: 2.4,
        footprint: [
          [0, 0],
          [4, 0],
          [4, 3],
          [0, 3],
        ],
        rooms: [
          {
            id: "room",
            name: "Room",
            polygon: [
              [0.2, 0.2],
              [3.8, 0.2],
              [3.8, 2.8],
              [0.2, 2.8],
            ],
            accent: "#c98164",
            dashboardSlots: [],
            devices: [],
          },
        ],
        walls: [],
        wallJunctions: [],
        openings: [],
        ceilings: [],
      },
      sceneItems: [],
      roomProfiles: {},
      openingProfiles: {},
      shortcuts: [],
      assumptions: [],
    });
    assert.equal(project.schemaVersion, 2);
    const serialized = JSON.stringify(project);
    assert.deepEqual(JSON.parse(serialized), project);
  });

  test("defines furnishing editor metadata without changing registry identity", () => {
    const component = () => null;
    const definition = defineFurnishingModel({
      component,
      label: "Fixture chair",
      category: "Seating",
      defaultRoomType: "living-room",
      defaultSize: [0.6, 0.9, 0.6],
      bounds: { min: [-0.3, 0, -0.3], max: [0.3, 0.9, 0.3] },
      resizePolicy: { kind: "uniform" },
      preferredPlacement: "absolute",
      outlineContact: false,
      complexity: { visibleMeshes: 1, triangles: 12 },
    });
    const registry = defineFurnishingModelRegistry({ chair: definition });

    assert.equal(definition.component, component);
    assert.equal(registry.chair, definition);
    assert.deepEqual(registry.chair.defaultSize, [0.6, 0.9, 0.6]);
  });

  test("resolves absolute, wall, and ceiling placements from project data", () => {
    const floor = fixtureFloorForPlacementTests();
    assert.deepEqual(
      resolveItemTransform(
        {
          kind: "absolute",
          at: [2, 1],
          elevationMeters: 0.2,
          rotationYRadians: 0.5,
        },
        floor,
      ),
      { position: [2, 0.2, 1], rotationYRadians: 0.5 },
    );
    assert.deepEqual(
      resolveItemTransform(
        {
          kind: "wall",
          wallId: "north",
          face: "right",
          offsetFromWallStartPlanUnits: 1.5,
          elevationMeters: 1,
          depthOffsetMeters: 0.02,
          rotationOffsetRadians: 0,
        },
        floor,
      ),
      { position: [1.5, 1, 0.12], rotationYRadians: 0 },
    );
    assert.deepEqual(
      resolveItemTransform(
        {
          kind: "ceiling",
          roomId: "room",
          at: [2, 1],
          dropMeters: 0.3,
          rotationYRadians: 0,
        },
        floor,
      ),
      { position: [2, 2.1, 1], rotationYRadians: 0 },
    );
  });

  test("parses recoverable semantic drafts while rejecting non-JSON project data", () => {
    const openChain = structuredClone(fixtureHomeProject());
    openChain.floors[0].walls.pop();
    openChain.floors[0].wallJunctions.pop();
    assert.equal(parseHomeProjectSchema(openChain).valid, true);
    assert.equal(validateHomeProject(openChain, fixtureHomeExtensions()).valid, false);

    const withFunction = fixtureHomeProject();
    withFunction.assumptions.push(() => undefined);
    assert.equal(parseHomeProjectSchema(withFunction).valid, false);

    class ProjectMetadata {
      constructor() {
        this.label = "not plain JSON";
      }
    }
    const withClass = fixtureHomeProject();
    withClass.assumptions.push(new ProjectMetadata());
    assert.equal(parseHomeProjectSchema(withClass).valid, false);
  });

  test("rejects every non-JSON value without invoking accessors", () => {
    const cases = [
      (project) => {
        project.home.name = undefined;
      },
      (project) => {
        project.home.name = () => "Fixture";
      },
      (project) => {
        project.sceneItems[0].size[0] = Number.NaN;
      },
      (project) => {
        project.assumptions.push(new Date());
      },
      (project) => {
        project.assumptions.push(new Map());
      },
      (project) => {
        project.assumptions.push(new (class Metadata {})());
      },
      (project) => {
        Object.defineProperty(project.sceneItems, "note", { value: "hidden", enumerable: true });
      },
      (project) => {
        project.sceneItems[Symbol("note")] = "hidden";
      },
    ];
    for (const mutate of cases) {
      const project = fixtureHomeProject();
      mutate(project);
      assert.equal(parseHomeProjectSchema(project).valid, false);
    }

    let getterInvoked = false;
    const accessor = fixtureHomeProject();
    Object.defineProperty(accessor.home, "danger", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return "unsafe";
      },
    });
    assert.deepEqual(parseHomeProjectSchema(accessor), {
      valid: false,
      issues: [
        {
          code: "project.non-json-property",
          path: "home.danger",
          message: "Projects cannot contain accessors or hidden properties.",
          severity: "error",
        },
      ],
    });
    assert.equal(getterInvoked, false);
  });

  test("reports pure-JSON diagnostics in deterministic path order", () => {
    const project = fixtureHomeProject();
    project.home.name = undefined;
    project.sceneItems[0].size[0] = Number.NaN;
    assert.deepEqual(parseHomeProjectSchema(project), {
      valid: false,
      issues: [
        {
          code: "project.non-json-value",
          path: "home.name",
          message: "Projects may contain only JSON values.",
          severity: "error",
        },
        {
          code: "project.number",
          path: "sceneItems[0].size[0]",
          message: "Project numbers must be finite.",
          severity: "error",
        },
      ],
    });
  });

  test("rejects exact household Home Assistant keys recursively", () => {
    for (const key of ["entity_id", "area_id", "access_token"]) {
      const project = fixtureHomeProject();
      project.sceneItems[0].metadata = { [key]: "must-not-persist" };
      const result = parseHomeProjectSchema(project);
      assert.equal(result.valid, false, key);
      assert.ok(
        result.issues.some((issue) => issue.code === "project.forbidden-key"),
        key,
      );
    }
  });

  test("rejects unknown current-schema keys at every schema level", () => {
    const project = fixtureHomeProject();
    project.extra = true;
    project.home.palette.tint = "#fff";
    project.floors[0].openings[0].visualModel = "legacy-inline";
    project.floors[0].openings[0].contactSlot = {
      id: "inline-contact",
      compatibleDeviceClasses: ["door"],
      openState: "on",
      autoMap: "manual",
    };
    const result = parseHomeProjectSchema(project);
    assert.equal(result.valid, false);
    assert.deepEqual(
      result.issues.map(({ code, path }) => ({ code, path })),
      [
        { code: "project.unknown-key", path: "extra" },
        { code: "project.unknown-key", path: "floors[0].openings[0].contactSlot" },
        { code: "project.unknown-key", path: "floors[0].openings[0].visualModel" },
        { code: "project.unknown-key", path: "home.palette.tint" },
      ],
    );
  });

  test("enforces the rectangular and arched passage schema union", () => {
    const projectWithPassage = (variant, archRiseMeters) => {
      const project = fixtureHomeProject();
      project.floors[0].openings[0] = {
        id: "passage",
        wallId: "south",
        kind: "passage",
        offsetFromWallStartPlanUnits: 1.5,
        widthPlanUnits: 0.9,
        openingHeightMeters: 2.1,
        sillHeightMeters: 0,
        variant,
        ...(archRiseMeters === undefined ? {} : { archRiseMeters }),
      };
      return project;
    };

    assert.equal(parseHomeProjectSchema(projectWithPassage("rectangular")).valid, true);
    assert.equal(parseHomeProjectSchema(projectWithPassage("arched", 0.25)).valid, true);

    const rectangularWithRise = parseHomeProjectSchema(projectWithPassage("rectangular", 0.25));
    assert.equal(rectangularWithRise.valid, false);
    assert.deepEqual(
      rectangularWithRise.issues.map(({ code, path }) => ({ code, path })),
      [
        {
          code: "project.passage-arch-rise",
          path: "floors[0].openings[0].archRiseMeters",
        },
      ],
    );

    const archedWithoutRise = parseHomeProjectSchema(projectWithPassage("arched"));
    assert.equal(archedWithoutRise.valid, false);
    assert.deepEqual(
      archedWithoutRise.issues.map(({ code, path }) => ({ code, path })),
      [
        {
          code: "project.passage-arch-rise",
          path: "floors[0].openings[0].archRiseMeters",
        },
      ],
    );
  });

  test("uses own registry entries for inherited object names", () => {
    for (const modelId of ["toString", "constructor", "__proto__"]) {
      const missing = fixtureHomeProject();
      missing.sceneItems[0].modelId = modelId;
      const missingResult = validateHomeProject(missing, fixtureHomeExtensions());
      assert.equal(missingResult.valid, true);
      assert.ok(
        missingResult.issues.some((issue) => issue.code === "project.model-missing"),
        modelId,
      );

      const project = fixtureHomeProject();
      project.sceneItems[0].modelId = modelId;
      const extensions = fixtureHomeExtensions();
      const ownRegistry = Object.create(null);
      Object.defineProperty(ownRegistry, modelId, {
        value: extensions.furnishingModels.chair,
        enumerable: true,
      });
      extensions.furnishingModels = ownRegistry;
      assert.equal(validateHomeProject(project, extensions).valid, true, modelId);
    }
  });

  test("unavailable furniture and device variants warn and render defaults without changing saved IDs", () => {
    const project = fixtureHomeProject();
    const registries = fixtureHomeExtensions();
    assert.equal(validateHomeProject(project, registries).valid, true);
    for (const item of project.sceneItems) {
      const registry =
        item.kind === "device" ? registries.deviceModels : registries.furnishingModels;
      registry[item.modelId] = {
        ...registry[item.modelId],
        variants: [
          { id: "default", label: "Default" },
          { id: "alternate", label: "Alternate" },
        ],
      };
      item.variant = "alternate";
      assert.equal(validateHomeProject(project, registries).valid, true);
      item.variant = "missing";
      const result = validateHomeProject(project, registries);
      assert.equal(result.valid, true, JSON.stringify(result.issues));
      assert.equal(
        result.issues.find((issue) => issue.code === "project.variant-missing")?.severity,
        "warning",
      );
      assert.equal(item.variant, "missing");
      assert.equal(
        engineApi.resolveModelVariant(registry[item.modelId], item.variant).id,
        "default",
      );
      item.variant = "default";
    }
  });

  test("validates and composes profiles plus scene items without household IDs", () => {
    const project = fixtureHomeProject();
    const extensions = fixtureHomeExtensions();
    const validation = validateHomeProject(project, extensions);
    assert.equal(validation.valid, true);
    assert.equal(validation.project, project);

    const manifest = composeHomeManifest(project, extensions);
    assert.equal(manifest.sceneItems.length, 2);
    assert.equal(manifest.floors[0].rooms[0].dashboardSlots[0].id, "room-light");
    assert.equal(manifest.floors[0].rooms[0].devices[0].id, "wall-switch");
    assert.equal(manifest.floors[0].rooms[0].devices[0].entitySlots[0].id, "wall-switch-entity");
    assert.equal(manifest.floors[0].openings[0].contactSlot.id, "door-contact");
    assert.doesNotMatch(JSON.stringify(project), /entity_id|area_id|access_token/);
  });

  test("keeps every allowed device placement valid through compatibility composition", () => {
    const project = fixtureHomeProject();
    project.sceneItems.push(
      {
        id: "wall-television",
        kind: "device",
        floorId: "ground-floor",
        modelId: "television",
        placement: {
          kind: "wall",
          wallId: "north",
          face: "right",
          offsetFromWallStartPlanUnits: 2,
          elevationMeters: 1,
          depthOffsetMeters: 0.04,
          rotationOffsetRadians: 0,
        },
        size: stableDeviceRegistry.television.defaultSize,
        entitySlots: [entitySlot("wall-television-entity", ["media_player"], "Wall television")],
      },
      {
        id: "absolute-camera",
        kind: "device",
        floorId: "ground-floor",
        modelId: "camera-screen",
        placement: { kind: "absolute", at: [2, 1.5], elevationMeters: 0, rotationYRadians: 0 },
        size: stableDeviceRegistry["camera-screen"].defaultSize,
        entitySlots: [entitySlot("absolute-camera-entity", ["camera"], "Camera")],
      },
      {
        id: "absolute-thermometer",
        kind: "device",
        floorId: "ground-floor",
        modelId: "thermometer",
        placement: { kind: "absolute", at: [2.5, 1.5], elevationMeters: 0, rotationYRadians: 0 },
        size: stableDeviceRegistry.thermometer.defaultSize,
        entitySlots: [
          {
            ...entitySlot("absolute-thermometer-entity", ["sensor"], "Thermometer"),
            compatibleDeviceClasses: ["temperature"],
          },
        ],
      },
      {
        id: "ceiling-motion",
        kind: "device",
        floorId: "ground-floor",
        modelId: "motion-sensor",
        placement: {
          kind: "ceiling",
          roomId: "room",
          at: [3, 1],
          dropMeters: 0.2,
          rotationYRadians: 0,
        },
        size: stableDeviceRegistry["motion-sensor"].defaultSize,
        entitySlots: [
          {
            ...entitySlot("ceiling-motion-entity", ["binary_sensor"], "Motion"),
            compatibleDeviceClasses: ["motion"],
          },
        ],
      },
    );
    const registries = {
      furnishingModels: fixtureHomeExtensions().furnishingModels,
      deviceModels: stableDeviceRegistry,
    };
    const extensions = {
      ...registries,
      openingModels: {},
      roomFurnishings: {},
    };
    const validation = validateHomeProject(project, registries);
    assert.equal(validation.valid, true, JSON.stringify(validation.issues));
    const manifest = composeHomeManifest(project, extensions);
    assert.deepEqual(
      manifest.floors[0].rooms[0].devices.map((device) => device.id),
      [
        "wall-switch",
        "wall-television",
        "absolute-camera",
        "absolute-thermometer",
        "ceiling-motion",
      ],
    );
    assert.ok(
      Math.abs(manifest.floors[0].rooms[0].devices.at(-1).placement.elevationMeters - 2.2) < 1e-12,
    );
    assert.deepEqual(
      engineApi.validateHomeManifest(manifest, {
        deviceModels: stableDeviceRegistry,
      }).issues,
      [],
    );
  });

  test("television accepts camera, media-player, or combined primary slots", () => {
    for (const domains of [["camera"], ["media_player"], ["camera", "media_player"]]) {
      const project = fixtureHomeProject();
      project.sceneItems.push({
        id: "streaming-tv",
        floorId: project.floors[0].id,
        kind: "device",
        modelId: "television",
        placement: { kind: "absolute", at: [2, 1.5], elevationMeters: 0, rotationYRadians: 0 },
        size: stableDeviceRegistry.television.defaultSize,
        entitySlots: [{ ...entitySlot("tv-primary", domains, "TV"), required: true }],
      });
      const registries = {
        furnishingModels: fixtureHomeExtensions().furnishingModels,
        deviceModels: stableDeviceRegistry,
      };
      const result = validateHomeProject(project, registries);
      assert.equal(result.valid, true, JSON.stringify(result.issues));
      const manifest = composeHomeManifest(project, {
        ...registries,
        openingModels: {},
        roomFurnishings: {},
      });
      assert.deepEqual(
        engineApi.validateHomeManifest(manifest, { deviceModels: stableDeviceRegistry }).issues,
        [],
      );
    }
  });

  test("requires a live camera model to expose one required primary camera slot", () => {
    const project = fixtureHomeProject();
    project.sceneItems.push({
      id: "camera-screen",
      kind: "device",
      floorId: "ground-floor",
      modelId: "camera-screen",
      placement: { kind: "absolute", at: [2, 1.5], elevationMeters: 0, rotationYRadians: 0 },
      size: stableDeviceRegistry["camera-screen"].defaultSize,
      entitySlots: [
        {
          ...entitySlot("camera-screen-entity", ["camera"], "Camera"),
          required: false,
        },
      ],
    });
    const registries = {
      furnishingModels: fixtureHomeExtensions().furnishingModels,
      deviceModels: stableDeviceRegistry,
    };
    const invalid = validateHomeProject(project, registries);
    assert.equal(invalid.valid, false);
    assert.ok(
      invalid.issues.some(
        (issue) =>
          issue.code === "project.camera-stream-slot" && issue.path === "sceneItems[2].entitySlots",
      ),
    );

    project.sceneItems[2].entitySlots[0].required = true;
    const valid = validateHomeProject(project, registries);
    assert.equal(valid.valid, true, JSON.stringify(valid.issues));
    const manifest = composeHomeManifest(project, {
      ...registries,
      openingModels: {},
      roomFurnishings: {},
    });
    assert.deepEqual(
      engineApi.validateHomeManifest(manifest, {
        deviceModels: stableDeviceRegistry,
      }).issues,
      [],
    );
  });

  test("warns about missing models while rejecting duplicate ids and missing supports", () => {
    const project = structuredClone(fixtureHomeProject());
    project.sceneItems[1].id = project.sceneItems[0].id;
    project.sceneItems[0].modelId = "missing-model";
    project.sceneItems[1].placement.wallId = "missing-wall";
    const result = validateHomeProject(project, fixtureHomeExtensions());
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues, [
      {
        code: "project.model-missing",
        path: "sceneItems[0].modelId",
        message:
          "Model “missing-model” is unavailable. A placeholder is shown. Its placement and connections are kept.",
        severity: "warning",
      },
      {
        code: "project.item-id-duplicate",
        path: "sceneItems[1].id",
        message: `Scene item “${project.sceneItems[1].modelId}” on “${project.floors[0].name}” has internal ID “chair”, already used by Scene item “missing-model” on “${project.floors[0].name}” (sceneItems[0].id). Catalog models may repeat; delete and re-add the conflicting item in Arrange, or assign distinct item and slot IDs in the project JSON.`,
        severity: "error",
      },
      {
        code: "project.wall-support-missing",
        path: "sceneItems[1].placement.wallId",
        message: "Wall “missing-wall” does not exist.",
        severity: "error",
      },
    ]);
  });

  test("keeps architecture, scene items, slots, and shortcuts in one ID namespace", () => {
    const collisions = [
      ["room", () => undefined],
      ["north", () => undefined],
      ["door", () => undefined],
      ["room-light", () => undefined],
      [
        "shortcut",
        (project) =>
          project.shortcuts.push({
            id: "shortcut",
            action: "home-view",
            context: "both",
            order: 0,
          }),
      ],
    ];
    for (const [id, prepare] of collisions) {
      const project = fixtureHomeProject();
      prepare(project);
      project.sceneItems[0].id = id;
      const result = validateHomeProject(project, fixtureHomeExtensions());
      assert.equal(result.valid, false, id);
      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "project.item-id-duplicate" && issue.path === "sceneItems[0].id",
        ),
        id,
      );
    }
  });

  test("room identity errors identify both floors and distinguish IDs from names", () => {
    const project = fixtureHomeProject();
    project.floors.push({
      ...structuredClone(project.floors[0]),
      id: "upper",
      name: "Upper floor",
    });
    const result = validateHomeProject(project, fixtureHomeExtensions());
    const conflict = result.issues.find(
      (issue) => issue.code === "project.id-duplicate" && issue.path === "floors[1].rooms[0].id",
    );
    assert.ok(conflict);
    assert.match(conflict.message, /Room “Room” on “Upper floor”/);
    assert.match(conflict.message, /Room names may repeat/);
    assert.match(conflict.message, /Renaming a room does not change its ID/);
  });

  test("public identity reservations include implicit opening slots and every validated namespace", () => {
    const project = fixtureHomeProject();
    const ids = engineApi.collectProjectIds(project);
    for (const id of [project.floors[0].id, "room", "north", "door", "chair", "room-light"])
      assert.ok(ids.includes(id), id);
    project.openingProfiles = {};
    assert.ok(engineApi.collectProjectIds(project).includes("door-contact"));
  });

  test("validates ceiling membership as missing, mismatched, or ambiguous", () => {
    const ceilingProject = () => {
      const project = fixtureHomeProject();
      project.sceneItems[0].placement = {
        kind: "ceiling",
        roomId: "room",
        at: [2, 1],
        dropMeters: 0.2,
        rotationYRadians: 0,
      };
      const extensions = fixtureHomeExtensions();
      return { project, extensions };
    };

    const missing = ceilingProject();
    missing.project.sceneItems[0].placement.at = [10, 10];
    assert.ok(
      validateHomeProject(missing.project, missing.extensions).issues.some(
        (issue) => issue.code === "project.room-membership-missing",
      ),
    );

    const mismatch = ceilingProject();
    mismatch.project.floors[0].rooms.push({
      id: "other",
      name: "Other",
      polygon: [
        [3, 2],
        [3.5, 2],
        [3.5, 2.5],
        [3, 2.5],
      ],
      accent: "#ffffff",
      dashboardSlots: [],
      devices: [],
    });
    mismatch.project.sceneItems[0].placement.roomId = "other";
    assert.ok(
      validateHomeProject(mismatch.project, mismatch.extensions).issues.some(
        (issue) => issue.code === "project.ceiling-room-mismatch",
      ),
    );

    const ambiguous = ceilingProject();
    ambiguous.project.floors[0].rooms.push({
      ...structuredClone(ambiguous.project.floors[0].rooms[0]),
      id: "other",
    });
    assert.ok(
      validateHomeProject(ambiguous.project, ambiguous.extensions).issues.some(
        (issue) => issue.code === "project.room-membership-ambiguous",
      ),
    );
  });

  test("validates profile references without restricting model placement", () => {
    const project = structuredClone(fixtureHomeProject());
    project.roomProfiles.missing = { dashboardSlots: [] };
    project.openingProfiles.missing = {};
    project.sceneItems[0].placement = {
      kind: "ceiling",
      roomId: "room",
      at: [2, 1],
      dropMeters: 0.2,
      rotationYRadians: 0,
    };
    const result = validateHomeProject(project, fixtureHomeExtensions());
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues.map((issue) => issue.code).sort(), [
      "project.opening-profile-missing",
      "project.room-profile-missing",
    ]);
  });

  test("validates profile slot identity and support bounds after schema parsing", () => {
    const project = structuredClone(fixtureHomeProject());
    project.roomProfiles.room.dashboardSlots[0].id = "wall-switch-entity";
    project.sceneItems[1].placement.elevationMeters = 2.3;
    const result = validateHomeProject(project, fixtureHomeExtensions());
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues.map((issue) => issue.code).sort(), [
      "project.id-duplicate",
      "project.wall-support-height",
    ]);
  });

  test("wall bounds account for hanging model origins and resized geometry", () => {
    const project = fixtureHomeProject();
    const extensions = fixtureHomeExtensions();
    const model = extensions.furnishingModels.chair;
    model.preferredPlacement = "ceiling";
    model.bounds = { min: [-0.3, -0.9, -0.3], max: [0.3, 0, 0.3] };
    const hanging = project.sceneItems[0];
    hanging.placement = {
      kind: "wall",
      wallId: "north",
      face: "right",
      offsetFromWallStartPlanUnits: 2,
      elevationMeters: 2.4,
      depthOffsetMeters: 0.303,
      rotationOffsetRadians: 0,
    };
    assert.equal(validateHomeProject(project, extensions).valid, true);
    for (const [elevation, height] of [
      [2.5, 0.9],
      [0.8, 0.9],
      [1.5, 1.8],
    ]) {
      hanging.placement.elevationMeters = elevation;
      hanging.size = [0.6, height, 0.6];
      const result = validateHomeProject(project, extensions);
      assert.equal(result.valid, true);
      assert.equal(
        result.issues.find((issue) => issue.code === "project.wall-support-height")?.severity,
        "warning",
      );
    }
  });
});
