import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { validateHomeManifest, assertValidHomeManifest } = await load(
    "/packages/engine/src/validation.ts",
  );
  const { splitWallIntoRuns, openingWorldPlacement } = await load(
    "/packages/engine/src/geometry.ts",
  );
  const { buildArchitecturalWallGeometries } = await load(
    "/packages/engine/src/architecture-geometry.ts",
  );
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const { isDeviceModelDefinition } = await load("/packages/engine/src/validation/core.ts");

  test("accepts the disconnected neutral demo", () => {
    const result = validateHomeManifest(neutralDemoManifest);
    assert.equal(result.canRender, true);
    assert.deepEqual(result.issues, []);
    assert.equal(assertValidHomeManifest(neutralDemoManifest), neutralDemoManifest);
  });

  test("device light metadata has no physical-count cap and isolates malformed emitters", () => {
    const source = { position: [0, 0.5, 0], color: "#ffe3b4", maxIntensity: 1, distance: 5 };
    const manifest = {
      ...neutralDemoManifest,
      extensions: {
        ...neutralDemoManifest.extensions,
        deviceModels: {
          test: { ...stableDeviceRegistry["floor-lamp"], sceneLight: source, sceneLights: [] },
        },
      },
    };
    const definition = manifest.extensions.deviceModels.test;
    for (const count of [0, 8, 16, 64, 129]) {
      definition.sceneLights = Array.from({ length: count }, () => source);
      assert.equal(validateHomeManifest(manifest).canRender, true);
    }
    for (const field of ["sceneLight", "sceneLights"]) {
      for (const invalid of [
        { position: [0, NaN, 0] },
        { position: [0, 0] },
        { color: "" },
        { maxIntensity: -1 },
        { maxIntensity: Infinity },
        { distance: -1 },
        { distance: NaN },
      ]) {
        const light = { ...source, ...invalid };
        Object.assign(
          definition,
          { sceneLight: source, sceneLights: [source] },
          {
            [field]: field === "sceneLight" ? light : [light],
          },
        );
        assert.equal(isDeviceModelDefinition(definition), false);
        const original = definition[field];
        const result = validateHomeManifest(manifest);
        assert.equal(result.canRender, true);
        assert.deepEqual(
          result.issues.map(({ code, severity }) => ({ code, severity })),
          [{ code: "model.lighting-disabled", severity: "warning" }],
        );
        assert.match(
          result.issues[0].message,
          /Floor lamp.*disabled.*saved settings are unchanged/i,
        );
        const recovered = result.manifest.extensions.deviceModels.test;
        assert.equal(recovered.component, definition.component);
        assert.equal(recovered.sceneLight, undefined);
        assert.equal(recovered.sceneLights, undefined);
        assert.equal(recovered.lightingDisabled, true);
        assert.equal(
          definition[field],
          original,
          "recovery never rewrites the source emitter metadata",
        );
      }
    }
    definition.label = "";
    assert.equal(
      validateHomeManifest(manifest).canRender,
      false,
      "structural faults are not hidden by lighting recovery",
    );
  });

  test("requires scene items and code-native furnishing model registries", () => {
    const manifest = structuredClone(neutralDemoManifest);
    delete manifest.sceneItems;
    delete manifest.extensions.furnishingModels;
    assert.deepEqual(
      validateHomeManifest(manifest).issues.map(({ code, path }) => ({ code, path })),
      [
        { code: "extensions.registry", path: "extensions.furnishingModels" },
        { code: "scene-items.type", path: "sceneItems" },
      ],
    );
  });

  test("validates the optional legacy room furnishings registry", () => {
    const malformedRegistry = structuredClone(neutralDemoManifest);
    malformedRegistry.extensions.roomFurnishings = 42;
    assert.deepEqual(
      validateHomeManifest(malformedRegistry).issues.map(({ code, path }) => ({ code, path })),
      [{ code: "extensions.registry", path: "extensions.roomFurnishings" }],
    );

    const malformedEntry = structuredClone(neutralDemoManifest);
    malformedEntry.extensions.roomFurnishings = { bad: 42 };
    assert.deepEqual(
      validateHomeManifest(malformedEntry).issues.map(({ code, path }) => ({ code, path })),
      [{ code: "extensions.entry", path: "extensions.roomFurnishings.bad" }],
    );
  });

  test("does not resolve inherited device model names", () => {
    for (const model of ["toString", "constructor", "__proto__"]) {
      const manifest = structuredClone(neutralDemoManifest);
      manifest.floors[0].rooms[0].devices.push({
        id: `device-${model}`,
        model,
        entitySlots: [
          {
            id: `slot-${model}`,
            compatibleDomains: ["switch"],
            required: true,
            autoMap: "manual",
            deviceRole: "primary",
            presentation: { label: model, dashboardRole: "primary" },
          },
        ],
        placement: { at: [2, 2], elevationMeters: 0, support: { kind: "surface" } },
      });
      assert.ok(
        validateHomeManifest(manifest).issues.some(
          (issue) => issue.code === "device.model-extension" && issue.path.endsWith(".model"),
        ),
        model,
      );
    }
  });

  test("accepts explicit door, window, and passage specifications", () => {
    const manifest = structuredClone(neutralDemoManifest);
    Object.assign(manifest.floors[0].openings[0], {
      operation: "hinged",
      variant: "panel",
      leafCount: 1,
    });
    Object.assign(manifest.floors[0].openings[1], {
      operation: "casement",
      variant: "muntined",
      panelCount: 2,
      glazing: "clear",
      muntins: { columns: 2, rows: 3 },
    });
    manifest.floors[0].openings.push({
      id: "demo-archway",
      wallId: "east-wall",
      kind: "passage",
      offsetFromWallStartPlanUnits: 1.2,
      widthPlanUnits: 1,
      openingHeightMeters: 2.18,
      sillHeightMeters: 0,
      variant: "arched",
      archRiseMeters: 0.12,
    });

    assert.deepEqual(validateHomeManifest(manifest).issues, []);
  });

  test("requires kind-specific opening operation and model fields", () => {
    const manifest = structuredClone(neutralDemoManifest);
    Object.assign(manifest.floors[0].openings[0], {
      operation: "casement",
      variant: "muntined",
      finish: "steel",
      leafCount: 3,
      walkThrough: true,
    });
    Object.assign(manifest.floors[0].openings[1], {
      operation: "sliding",
      variant: "panel",
      panelCount: 3,
      glazing: "opaque",
      muntins: { columns: 0, rows: 2 },
    });
    manifest.floors[0].openings.push({
      id: "invalid-archway",
      wallId: "east-wall",
      kind: "passage",
      offsetFromWallStartPlanUnits: 1.2,
      widthPlanUnits: 1,
      openingHeightMeters: 2.18,
      sillHeightMeters: 0,
      variant: "arched",
    });
    const result = validateHomeManifest(manifest);

    for (const code of [
      "opening.door-operation",
      "opening.door-variant",
      "opening.door-finish",
      "opening.door-leaf-count",
      "opening.door-walk-through",
      "opening.window-operation",
      "opening.window-variant",
      "opening.window-panel-count",
      "opening.window-glazing",
      "opening.window-muntins",
      "opening.passage-arch-rise",
    ]) {
      assert.ok(
        result.issues.some((issue) => issue.code === code),
        `missing ${code}`,
      );
    }
  });

  test("reports exact paths for the V1 floor and locale constraints", () => {
    const invalid = structuredClone(neutralDemoManifest);
    invalid.schemaVersion = 1;
    invalid.home.locale = "fr";
    invalid.floors.push(structuredClone(invalid.floors[0]));
    const result = validateHomeManifest(invalid);
    assert.equal(result.canRender, false);
    assert.ok(result.issues.some((issue) => issue.path === "home.locale"));
    assert.ok(result.issues.some((issue) => issue.path === "floors"));
  });

  test("validates optional custom wall edge color at its exact path", () => {
    const manifest = structuredClone(neutralDemoManifest);
    manifest.floors[0].walls[0].edgeColor = "#bcb99b";
    assert.deepEqual(validateHomeManifest(manifest).issues, []);
    manifest.floors[0].walls[0].edgeColor = "";
    assert.ok(
      validateHomeManifest(manifest).issues.some(
        (issue) =>
          issue.code === "wall.edge-color" && issue.path === "floors[0].walls[0].edgeColor",
      ),
    );
  });

  test("validates optional floor finishes and wall colors at exact paths", () => {
    const valid = structuredClone(neutralDemoManifest);
    valid.floors[0].rooms[0].floorFinish = { kind: "solid", color: "#c8bca8" };
    valid.floors[0].walls[0].exteriorColor = "#b86f58";
    valid.floors[0].walls[0].faceColors = { left: "#d8d0e2", right: "#cadccb" };
    assert.deepEqual(validateHomeManifest(valid).issues, []);

    const invalid = structuredClone(valid);
    invalid.floors[0].rooms[0].floorFinish.color = "";
    invalid.floors[0].walls[0].exteriorColor = "";
    invalid.floors[0].walls[0].faceColors.left = "";
    invalid.floors[0].walls[1].faceColors = "#ffffff";
    const result = validateHomeManifest(invalid);
    assert.deepEqual(
      result.issues.map(({ code, path }) => ({ code, path })),
      [
        { code: "floor-finish.color", path: "floors[0].rooms[0].floorFinish.color" },
        { code: "wall.exterior-color", path: "floors[0].walls[0].exteriorColor" },
        { code: "wall.face-color", path: "floors[0].walls[0].faceColors.left" },
        { code: "wall.face-colors", path: "floors[0].walls[1].faceColors" },
      ],
    );
  });

  test("preserves the complete ordered diagnostic and assertion contract", () => {
    const invalid = structuredClone(neutralDemoManifest);
    invalid.schemaVersion = 1;
    invalid.home.locale = "fr";
    invalid.shortcuts[0].id = "demo-room";
    invalid.floors[0].rooms[0].devices.push({
      id: "golden-device",
      model: "wall-switch",
      entitySlots: [
        {
          id: "golden-device-primary",
          compatibleDomains: ["switch"],
          required: true,
          autoMap: "manual",
          deviceRole: "primary",
          presentation: { label: "Wall switch", dashboardRole: "primary" },
        },
      ],
      placement: {
        at: [1, 1],
        elevationMeters: 0.9,
        support: { kind: "surface" },
      },
    });
    const options = { deviceModels: {} };
    const expectedIssues = [
      {
        code: "device.model-registry",
        path: "floors[0].rooms[0].devices[0].model",
        message: "Model “wall-switch” is unavailable. A placeholder will be shown.",
        severity: "warning",
      },
      {
        code: "home.locale",
        path: "home.locale",
        message: 'V1 supports only the "en" locale.',
        severity: "fatal",
      },
      {
        code: "id.duplicate",
        path: "shortcuts[0].id",
        message: 'ID "demo-room" is already used at floors[0].rooms[0].id.',
        severity: "fatal",
      },
    ];

    assert.deepEqual(validateHomeManifest(invalid, options), {
      issues: expectedIssues,
      canRender: false,
    });
    assert.throws(
      () => assertValidHomeManifest(invalid, options),
      new Error(expectedIssues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")),
    );
  });

  test("rejects self-intersecting rooms while keeping household HA IDs out of the manifest", () => {
    const invalid = structuredClone(neutralDemoManifest);
    const first = invalid.floors[0].rooms[0];
    first.polygon = [
      [0.2, 0.2],
      [4.4, 3.2],
      [4.4, 0.2],
      [0.2, 3.2],
    ];
    invalid.floors[0].rooms.push({ ...structuredClone(first), id: "second-room" });
    const result = validateHomeManifest(invalid);
    assert.ok(result.issues.some((issue) => issue.code === "room.polygon-invalid"));
    assert.equal(JSON.stringify(invalid).includes("haAreaId"), false);
  });

  test("rejects overlapping and overflowing wall-owned openings", () => {
    const invalid = structuredClone(neutralDemoManifest);
    invalid.floors[0].openings.push({
      ...structuredClone(invalid.floors[0].openings[1]),
      id: "overlap-window",
      offsetFromWallStartPlanUnits: 2,
      widthPlanUnits: 4,
    });
    const result = validateHomeManifest(invalid);
    assert.ok(result.issues.some((issue) => issue.code === "opening.overlap"));
    assert.ok(result.issues.some((issue) => issue.code === "opening.containment"));
  });

  test("requires a complete explicit junction at every wall intersection", () => {
    const absent = structuredClone(neutralDemoManifest);
    delete absent.floors[0].wallJunctions;
    assert.ok(
      validateHomeManifest(absent).issues.some((issue) => issue.code === "wall-junctions.required"),
    );

    const omitted = structuredClone(neutralDemoManifest);
    omitted.floors[0].wallJunctions.pop();
    assert.ok(
      validateHomeManifest(omitted).issues.some((issue) => issue.code === "wall-junction.missing"),
    );

    const incomplete = structuredClone(neutralDemoManifest);
    incomplete.floors[0].walls.push({
      id: "corner-divider",
      from: [0, 0],
      to: [1, 1],
      classification: "interior",
      thicknessMeters: 0.12,
    });
    assert.ok(
      validateHomeManifest(incomplete).issues.some(
        (issue) => issue.code === "wall-junction.incomplete",
      ),
    );
  });

  test("rejects off-wall, duplicate, and opening-overlapping junction declarations", () => {
    const invalid = structuredClone(neutralDemoManifest);
    invalid.floors[0].wallJunctions.push({
      id: "duplicate-corner",
      at: [0, 0],
      wallIds: ["north-wall", "west-wall"],
    });
    invalid.floors[0].wallJunctions[1].at = [4.7, 0.2];
    invalid.floors[0].openings[1].offsetFromWallStartPlanUnits = 0;
    invalid.floors[0].openings[1].widthPlanUnits = 0.3;
    const result = validateHomeManifest(invalid);
    assert.ok(result.issues.some((issue) => issue.code === "wall-junction.duplicate"));
    assert.ok(result.issues.some((issue) => issue.code === "wall-junction.off-wall"));
    assert.ok(result.issues.some((issue) => issue.code === "wall-junction.opening-overlap"));
  });

  test("a nearly straight room extension does not flag both distant terrace doors", () => {
    const manifest = structuredClone(neutralDemoManifest);
    const floor = manifest.floors[0];
    floor.walls = [
      {
        id: "south",
        from: [14, 17.9],
        to: [0, 18],
        classification: "exterior",
        thicknessMeters: 0.32,
      },
      { id: "west", from: [0, 18], to: [0, 0], classification: "exterior", thicknessMeters: 0.32 },
      {
        id: "extension",
        from: [0, 18],
        to: [-7, 18],
        classification: "exterior",
        thicknessMeters: 0.32,
      },
    ];
    floor.wallJunctions = [
      { id: "extension-corner", at: [0, 18], wallIds: ["south", "west", "extension"] },
    ];
    floor.openings = [2, 8.2].map((offset, index) => ({
      ...structuredClone(neutralDemoManifest.floors[0].openings[0]),
      id: ["living-terrace-slider", "dining-terrace-slider"][index],
      wallId: "south",
      offsetFromWallStartPlanUnits: offset,
      widthPlanUnits: 4.2,
    }));
    const overlaps = () =>
      validateHomeManifest(manifest).issues.filter(
        ({ code }) => code === "wall-junction.opening-overlap",
      );
    assert.deepEqual(overlaps(), [], "a wall extending away from the doors must not obstruct them");
    // Stored endpoint order must not change the occupied wall span.
    [floor.walls[2].from, floor.walls[2].to] = [floor.walls[2].to, floor.walls[2].from];
    assert.deepEqual(overlaps(), []);
    // A shallow-angle wall extending towards the doors really does obstruct them.
    floor.walls[2].from = [0, 18];
    floor.walls[2].to = [14, 18];
    assert.equal(overlaps().length, 2);
    // A short branch must not be treated as an infinite wall either.
    floor.walls[2].to = [0.5, 18];
    assert.deepEqual(overlaps(), []);
  });

  test("accepts an opening whose jamb aligns with the face of a perpendicular junction wall", () => {
    const manifest = structuredClone(neutralDemoManifest);
    manifest.floors[0].walls.push({
      id: "north-divider",
      from: [3, 0],
      to: [3, 1],
      classification: "interior",
      thicknessMeters: 0.12,
    });
    manifest.floors[0].wallJunctions.push({
      id: "north-divider-junction",
      at: [3, 0],
      wallIds: ["north-wall", "north-divider"],
    });
    Object.assign(manifest.floors[0].openings[1], {
      offsetFromWallStartPlanUnits: 3.06,
      widthPlanUnits: 1,
    });

    assert.ok(
      !validateHomeManifest(manifest).issues.some(
        (issue) => issue.code === "wall-junction.opening-overlap",
      ),
    );
  });

  test("allows two centimetres of opening finish into a junction but rejects structural overlap", () => {
    const manifest = structuredClone(neutralDemoManifest);
    manifest.floors[0].walls.push({
      id: "north-divider",
      from: [3, 0],
      to: [3, 1],
      classification: "interior",
      thicknessMeters: 0.12,
    });
    manifest.floors[0].wallJunctions.push({
      id: "north-divider-junction",
      at: [3, 0],
      wallIds: ["north-wall", "north-divider"],
    });
    Object.assign(manifest.floors[0].openings[1], {
      offsetFromWallStartPlanUnits: 3.04,
      widthPlanUnits: 1,
    });

    assert.ok(
      !validateHomeManifest(manifest).issues.some(
        (issue) => issue.code === "wall-junction.opening-overlap",
      ),
    );
    assert.doesNotThrow(() => buildArchitecturalWallGeometries(manifest.floors[0]));

    manifest.floors[0].openings[1].offsetFromWallStartPlanUnits = 3.039;
    assert.ok(
      validateHomeManifest(manifest).issues.some(
        (issue) => issue.code === "wall-junction.opening-overlap",
      ),
    );
  });

  test("accepts a declared endpoint junction between straight continuation walls", () => {
    const manifest = structuredClone(neutralDemoManifest);
    manifest.floors[0].walls.push(
      {
        id: "straight-left",
        from: [1, 1],
        to: [2, 1],
        classification: "interior",
        thicknessMeters: 0.12,
      },
      {
        id: "straight-right",
        from: [2, 1],
        to: [3, 1],
        classification: "interior",
        thicknessMeters: 0.12,
      },
    );
    manifest.floors[0].wallJunctions.push({
      id: "straight-continuation-junction",
      at: [2, 1],
      wallIds: ["straight-left", "straight-right"],
    });
    assert.ok(
      !validateHomeManifest(manifest).issues.some(
        (issue) => issue.code === "wall-junction.topology",
      ),
    );
  });

  test("validates typed entity slots and opening contact slots", () => {
    const invalid = structuredClone(neutralDemoManifest);
    invalid.floors[0].rooms[0].devices.push({
      id: "mixed-device",
      model: "wall-switch",
      entitySlots: [
        {
          id: "mixed-device-primary",
          compatibleDomains: [],
          required: true,
          autoMap: "guess",
          deviceRole: "primary",
          presentation: { label: "Room lamp", dashboardRole: "primary" },
        },
      ],
      placement: { at: [1, 1], elevationMeters: 1, support: { kind: "surface" } },
    });
    invalid.floors[0].openings[0].contactSlot = {
      id: "entry-contact-slot",
      compatibleDeviceClasses: ["motion"],
      openState: "maybe",
      autoMap: "guess",
    };
    const result = validateHomeManifest(invalid);
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.path.endsWith("entitySlots[0].compatibleDomains") && issue.code === "slot.domains",
      ),
    );
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.path.endsWith("contactSlot.compatibleDeviceClasses") &&
          issue.code === "opening.contact-device-class",
      ),
    );
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.path.endsWith("contactSlot.openState") &&
          issue.code === "opening.contact-open-state",
      ),
    );
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.path.endsWith("contactSlot.autoMap") && issue.code === "opening.contact-auto-map",
      ),
    );
  });

  test("requires the camera-screen preset to use one required primary camera slot", () => {
    const cameraDevice = {
      id: "demo-camera-screen",
      model: "camera-screen",
      entitySlots: [
        {
          id: "demo-camera-entity",
          compatibleDomains: ["camera"],
          required: true,
          autoMap: "unique-compatible",
          deviceRole: "primary",
          presentation: { label: "Front camera", dashboardRole: "secondary" },
        },
      ],
      placement: {
        at: [1, 0.094],
        elevationMeters: 1.35,
        rotationYRadians: 0,
        support: { kind: "wall", wallId: "north-wall" },
      },
    };
    const valid = structuredClone(neutralDemoManifest);
    valid.floors[0].rooms[0].devices.push(cameraDevice);
    assert.deepEqual(
      validateHomeManifest(valid, { deviceModels: stableDeviceRegistry }).issues,
      [],
    );

    const invalid = structuredClone(valid);
    invalid.floors[0].rooms[0].devices[0].entitySlots[0].compatibleDomains = ["camera", "sensor"];
    invalid.floors[0].rooms[0].devices[0].entitySlots[0].required = false;
    const issues = validateHomeManifest(invalid, { deviceModels: stableDeviceRegistry }).issues;
    assert.ok(issues.some((issue) => issue.code === "device.camera-stream-slot"));
    assert.ok(issues.some((issue) => issue.code === "device.model-domain"));
  });

  test("splits a wall into inherited masonry around a window", () => {
    const floor = neutralDemoManifest.floors[0];
    const wall = floor.walls.find((candidate) => candidate.id === "north-wall");
    const runs = splitWallIntoRuns(
      wall,
      floor.openings,
      floor.coordinates,
      floor.defaultWallHeightMeters,
    );
    assert.equal(runs.length, 4);
    assert.ok(runs.some((run) => run.id.endsWith("-sill") && run.topMeters === 0.82));
    assert.ok(runs.some((run) => run.id.endsWith("-lintel") && run.bottomMeters === 2.07));
  });

  test("places openings correctly along arbitrary angled walls", () => {
    const floor = neutralDemoManifest.floors[0];
    const wall = { ...floor.walls[0], from: [0, 0], to: [3, 4] };
    const opening = {
      ...floor.openings[0],
      wallId: wall.id,
      offsetFromWallStartPlanUnits: 1,
      widthPlanUnits: 1,
    };
    const placement = openingWorldPlacement(wall, opening, floor.coordinates);
    assert.deepEqual(
      placement.start.map((value) => Number(value.toFixed(4))),
      [0.6, 0.8],
    );
    assert.deepEqual(
      placement.end.map((value) => Number(value.toFixed(4))),
      [1.2, 1.6],
    );
  });
});
