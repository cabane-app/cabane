import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";
import {
  connectedManifestFixture,
  connectedProfileFixture,
  connectedRuntimeFixture,
} from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const {
    createSetupRecord,
    deriveSetupProgress,
    loadSetupRecord,
    saveSetupCollapsed,
    loadSetupCollapsed,
    setupStorageKey,
  } = await load("/packages/engine/src/setup-progress.ts");
  const manifest = connectedManifestFixture(neutralDemoManifest);

  const mapStorage = (initial = []) => {
    const values = new Map(initial);
    return {
      values,
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
  };

  test("loads fresh progress, validates stored records, and migrates returning owners", () => {
    const freshStorage = mapStorage();
    assert.deepEqual(loadSetupRecord(freshStorage, "fresh-home"), {
      record: createSetupRecord(),
      durable: true,
      migrated: false,
      warning: null,
    });

    const corruptStorage = mapStorage([[setupStorageKey("broken-home"), "{not-json"]]);
    const corrupt = loadSetupRecord(corruptStorage, "broken-home");
    assert.deepEqual(corrupt.record, createSetupRecord());
    assert.equal(corrupt.durable, false);
    assert.match(corrupt.warning, /may not survive reload/);

    const legacyStorage = mapStorage([
      ["smart-home-3d:onboarding:v1:returning-home", "complete"],
      ["smart-home-3d:modeling-nudge:v1:returning-home", "complete"],
    ]);
    const migrated = loadSetupRecord(legacyStorage, "returning-home");
    assert.equal(migrated.migrated, true);
    assert.deepEqual(migrated.record, {
      launch: {
        entry: null,
        introductionDismissed: true,
        starterConsumed: true,
        nudgeDismissed: true,
        firstControlConfirmed: false,
      },
      schemaVersion: 2,
      connectionStage: "connected",
      buildChoice: "deferred",
      activated: true,
    });
    assert.equal(legacyStorage.values.has("smart-home-3d:onboarding:v1:returning-home"), true);
    assert.equal(legacyStorage.values.has("smart-home-3d:modeling-nudge:v1:returning-home"), true);
    assert.equal(
      JSON.parse(legacyStorage.values.get(setupStorageKey("returning-home"))).activated,
      true,
    );

    const versionOneStorage = mapStorage([
      [
        setupStorageKey("version-one-home"),
        JSON.stringify({
          schemaVersion: 1,
          realSessionConnected: false,
          modelingStage: "floor-review",
          activated: false,
        }),
      ],
    ]);
    const versionOne = loadSetupRecord(versionOneStorage, "version-one-home");
    assert.equal(versionOne.migrated, true);
    assert.deepEqual(versionOne.record, {
      launch: {
        entry: null,
        introductionDismissed: true,
        starterConsumed: true,
        nudgeDismissed: true,
        firstControlConfirmed: false,
      },
      schemaVersion: 2,
      connectionStage: "not-started",
      buildChoice: "agents",
      activated: false,
    });
    assert.deepEqual(
      JSON.parse(versionOneStorage.values.get(setupStorageKey("version-one-home"))),
      versionOne.record,
    );
  });

  test("advances one current task at a time through connection and build choices", () => {
    const runtime = connectedRuntimeFixture({
      status: "unconfigured",
      configured: false,
      canMutate: false,
      origin: null,
      areas: [],
      devices: [],
      entityRegistry: [],
      entityStates: {},
    });
    const profile = { ...connectedProfileFixture(), roomAreaIds: {}, entityIdsBySlotId: {} };
    const fresh = createSetupRecord();
    assert.deepEqual(
      deriveSetupProgress({ manifest, runtime, profile, record: fresh }).steps.map(
        (step) => step.status,
      ),
      ["current", "pending", "pending", "pending"],
    );

    const connectionDeferred = { ...fresh, connectionStage: "deferred" };
    assert.deepEqual(
      deriveSetupProgress({ manifest, runtime, profile, record: connectionDeferred }).steps.map(
        (step) => step.status,
      ),
      ["deferred", "current", "pending", "pending"],
    );

    const buildSelected = { ...connectionDeferred, buildChoice: "construction" };
    const selectedProgress = deriveSetupProgress({
      manifest,
      runtime,
      profile,
      record: buildSelected,
    });
    assert.deepEqual(
      selectedProgress.steps.map((step) => step.status),
      ["deferred", "complete", "pending", "pending"],
    );
    assert.equal(selectedProgress.completedCount, 1);

    const connected = { ...buildSelected, connectionStage: "connected" };
    assert.deepEqual(
      deriveSetupProgress({ manifest, runtime, profile, record: connected }).steps.map(
        (step) => step.status,
      ),
      ["complete", "complete", "current", "pending"],
    );
  });

  test("keeps pre-activation collapse state session-scoped", () => {
    const storage = mapStorage();
    assert.equal(loadSetupCollapsed(storage, "fixture-home"), false);
    assert.equal(saveSetupCollapsed(storage, "fixture-home", true), true);
    assert.equal(loadSetupCollapsed(storage, "fixture-home"), true);
    assert.equal(saveSetupCollapsed(storage, "fixture-home", false), true);
    assert.equal(loadSetupCollapsed(storage, "fixture-home"), false);
  });

  test("activates from one valid room and one resolved controllable modeled device", () => {
    const runtime = connectedRuntimeFixture();
    const profile = connectedProfileFixture();
    const record = {
      ...createSetupRecord(),
      connectionStage: "connected",
      buildChoice: "deferred",
    };
    const progress = deriveSetupProgress({ manifest, runtime, profile, record });
    assert.equal(progress.roomComplete, true);
    assert.equal(progress.deviceResolvedNow, true);
    assert.equal(progress.activationReached, true);
    assert.equal(progress.shouldPersistActivation, true);
    assert.equal(progress.completedCount, 3);
    assert.equal(progress.roomIdForDeviceMapping, "demo-room");
    assert.equal(progress.steps.find((step) => step.id === "modeling").status, "deferred");
  });

  test("counts a compatible cross-area entity with or without optional diagnostic slots", () => {
    const singleDeviceManifest = structuredClone(manifest);
    singleDeviceManifest.floors[0].rooms[0].devices = [
      singleDeviceManifest.floors[0].rooms[0].devices[0],
    ];
    const runtime = connectedRuntimeFixture();
    runtime.entityRegistry.find((entry) => entry.entity_id === "light.demo_ceiling").area_id =
      "outside";
    const record = { ...createSetupRecord(), connectionStage: "connected" };

    assert.equal(
      deriveSetupProgress({
        manifest: singleDeviceManifest,
        runtime,
        profile: connectedProfileFixture(),
        record,
      }).deviceResolvedNow,
      true,
    );

    singleDeviceManifest.floors[0].rooms[0].devices[0].entitySlots.push({
      id: "fixture-light-diagnostic",
      compatibleDomains: ["sensor"],
      required: false,
      autoMap: "manual",
      deviceRole: "diagnostic",
      presentation: { label: "Light diagnostic", dashboardRole: "diagnostic" },
    });
    assert.equal(
      deriveSetupProgress({
        manifest: singleDeviceManifest,
        runtime,
        profile: connectedProfileFixture(),
        record,
      }).deviceResolvedNow,
      true,
    );
  });

  test("rejects stale, duplicated, sensor-only, and roomless activation candidates", () => {
    const record = { ...createSetupRecord(), connectionStage: "connected" };
    const baseRuntime = connectedRuntimeFixture();
    const baseProfile = connectedProfileFixture();
    const oneDeviceManifest = structuredClone(manifest);
    oneDeviceManifest.floors[0].rooms[0].devices = [
      oneDeviceManifest.floors[0].rooms[0].devices[0],
    ];

    const staleRuntime = connectedRuntimeFixture({
      entityStates: {
        ...baseRuntime.entityStates,
        "light.demo_ceiling": { ...baseRuntime.entityStates["light.demo_ceiling"], stale: true },
      },
    });
    assert.equal(
      deriveSetupProgress({
        manifest: oneDeviceManifest,
        runtime: staleRuntime,
        profile: baseProfile,
        record,
      }).deviceResolvedNow,
      false,
    );

    const duplicateProfile = {
      ...baseProfile,
      entityIdsBySlotId: {
        ...baseProfile.entityIdsBySlotId,
        "demo-coffee-slot": "light.demo_ceiling",
      },
    };
    assert.equal(
      deriveSetupProgress({
        manifest: oneDeviceManifest,
        runtime: baseRuntime,
        profile: duplicateProfile,
        record,
      }).deviceResolvedNow,
      false,
    );

    const sensorManifest = structuredClone(oneDeviceManifest);
    sensorManifest.floors[0].rooms[0].devices[0].entitySlots[0].compatibleDomains = ["sensor"];
    assert.equal(
      deriveSetupProgress({
        manifest: sensorManifest,
        runtime: baseRuntime,
        profile: baseProfile,
        record,
      }).deviceResolvedNow,
      false,
    );

    const diagnosticOnlyManifest = structuredClone(oneDeviceManifest);
    diagnosticOnlyManifest.floors[0].rooms[0].devices[0].entitySlots[0].deviceRole = "diagnostic";
    assert.equal(
      deriveSetupProgress({
        manifest: diagnosticOnlyManifest,
        runtime: baseRuntime,
        profile: baseProfile,
        record,
      }).deviceResolvedNow,
      false,
    );

    const roomlessProfile = { ...baseProfile, roomAreaIds: {} };
    const roomless = deriveSetupProgress({
      manifest,
      runtime: baseRuntime,
      profile: roomlessProfile,
      record,
    });
    assert.equal(roomless.roomComplete, false);
    assert.equal(roomless.deviceResolvedNow, false);
    assert.equal(roomless.activationReached, false);
  });

  test("keeps activation complete through a later real disconnection", () => {
    const record = {
      ...createSetupRecord(),
      connectionStage: "connected",
      buildChoice: "agents",
      activated: true,
    };
    const runtime = connectedRuntimeFixture({
      status: "disconnected",
      canMutate: false,
      entityStates: {},
    });
    const progress = deriveSetupProgress({
      manifest,
      runtime,
      profile: connectedProfileFixture(),
      record,
    });
    assert.equal(progress.activationReached, true);
    assert.equal(progress.roomComplete, true);
    assert.equal(progress.deviceComplete, true);
    assert.equal(progress.completedCount, 4);
    assert.equal(progress.steps[0].status, "attention");
  });
});
