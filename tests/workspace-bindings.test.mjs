import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const {
    composeHomeManifest,
    createEmptyRuntimeBindingProfile,
    createSeedProjectRecord,
    parseHomeProjectRecord,
    reconcileWorkspaceBindings,
    removeWorkspaceSlotReferences,
    serializeHomeProject,
    validateWorkspaceBindings,
  } = await load("/packages/engine/src/index.ts");
  const { ownerHomeProject, homeExtensions } = await load("/tests/fixtures/bundled-home.ts");
  const { stableDeviceRegistry } = await load("/packages/catalog/src/device/index.ts");
  const { stableFurnishingRegistry } = await load("/packages/catalog/src/furnishing/index.ts");

  const registries = {
    furnishingModels: { ...stableFurnishingRegistry, ...homeExtensions.furnishingModels },
    deviceModels: { ...stableDeviceRegistry, ...homeExtensions.deviceModels },
  };

  const fixture = () => {
    const project = structuredClone(ownerHomeProject);
    const manifest = composeHomeManifest(project, homeExtensions);
    const empty = createEmptyRuntimeBindingProfile(project.home.id);
    return { project, manifest, empty };
  };

  test("normalizes V1 records into V2 envelopes without putting bindings in HomeProject JSON", () => {
    const { project } = fixture();
    const v1 = createSeedProjectRecord(project, 1000);
    delete v1.revision;
    delete v1.bindings;
    const parsed = parseHomeProjectRecord(JSON.stringify(v1), registries);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.record.revision, 0);
    assert.deepEqual(parsed.record.bindings, {});
    const projectJson = JSON.parse(serializeHomeProject(project));
    assert.equal("bindings" in projectJson, false);
    assert.equal("revision" in projectJson, false);
  });

  test("validates two origins, profile shape, domains, uniqueness, and camera sharing", () => {
    const { project, manifest, empty } = fixture();
    const roomId = project.floors[0].rooms[0].id;
    const slots = manifest.floors[0].rooms.flatMap((room) => [
      ...room.dashboardSlots,
      ...room.devices.flatMap((device) => device.entitySlots),
    ]);
    const nonCameraSlot = slots.find((slot) => slot.compatibleDomains.includes("light"));
    const cameraSlot = slots.find(
      (slot) => slot.compatibleDomains.length === 1 && slot.compatibleDomains[0] === "camera",
    );
    assert.ok(nonCameraSlot);
    assert.ok(cameraSlot);
    const profile = {
      ...empty,
      roomAreaIds: { [roomId]: "fixture-area" },
      entityIdsBySlotId: { [nonCameraSlot.id]: "light.fixture" },
    };
    const valid = {
      "https://one.fixture.test": {
        draft: structuredClone(profile),
        published: structuredClone(profile),
        manualRoomIds: [],
        manualSlotIds: [],
      },
      "https://two.fixture.test": {
        draft: structuredClone(profile),
        published: structuredClone(profile),
        manualRoomIds: [],
        manualSlotIds: [],
      },
    };
    assert.deepEqual(validateWorkspaceBindings(valid, manifest, manifest), []);

    const invalid = structuredClone(valid);
    invalid["https://one.fixture.test"].draft.entityIdsBySlotId = {
      [nonCameraSlot.id]: "sensor.wrong_domain",
      "unknown-slot": "light.fixture",
    };
    invalid["https://one.fixture.test"].draft.roomAreaIds["unknown-room"] = "fixture-area";
    invalid["https://one.fixture.test"].draft.unexpected = "secret";
    invalid["https://one.fixture.test"].manualRoomIds = [roomId, roomId];
    invalid["https://one.fixture.test"].manualSlotIds = [nonCameraSlot.id, nonCameraSlot.id];
    const issues = validateWorkspaceBindings(invalid, manifest, manifest);
    assert.ok(
      issues.some((issue) => issue.code.includes("unknown") || issue.code.includes("profile-key")),
    );
    assert.ok(issues.some((issue) => issue.code.includes("domain")));
    assert.ok(issues.some((issue) => issue.code.includes("duplicate")));

    const cameraManifest = {
      ...manifest,
      floors: manifest.floors.map((floor) => ({
        ...floor,
        rooms: floor.rooms.map((room) => ({ ...room, devices: [...room.devices] })),
      })),
    };
    const cameraRoom = cameraManifest.floors[0].rooms.find((room) =>
      room.devices.some((device) => device.entitySlots.some((slot) => slot.id === cameraSlot.id)),
    );
    const sourceCamera = cameraRoom.devices.find((device) =>
      device.entitySlots.some((slot) => slot.id === cameraSlot.id),
    );
    const secondCameraSlotId = "fixture-shared-camera-slot";
    cameraRoom.devices.push({
      id: "fixture-shared-camera-screen",
      model: "camera-screen",
      entitySlots: [{ ...sourceCamera.entitySlots[0], id: secondCameraSlotId }],
    });
    const sharedCameraProfile = {
      ...empty,
      roomAreaIds: { [cameraRoom.id]: "fixture-camera-area" },
      entityIdsBySlotId: {
        [cameraSlot.id]: "camera.fixture_shared",
        [secondCameraSlotId]: "camera.fixture_shared",
      },
    };
    const cameraShared = {
      "https://fixture-camera.test": {
        draft: structuredClone(sharedCameraProfile),
        published: structuredClone(sharedCameraProfile),
        manualRoomIds: [],
        manualSlotIds: [],
      },
    };
    assert.equal(
      validateWorkspaceBindings(cameraShared, cameraManifest, cameraManifest).some((issue) =>
        issue.code.includes("duplicate"),
      ),
      false,
    );
  });

  test("removes selected draft slot references across origins without touching published or unrelated mappings", () => {
    const { project, empty } = fixture();
    const roomId = project.floors[0].rooms[0].id;
    const bindings = Object.fromEntries(
      ["https://one.fixture.test", "https://two.fixture.test"].map((origin) => [
        origin,
        {
          draft: {
            ...structuredClone(empty),
            roomAreaIds: { [roomId]: `${origin}-area` },
            entityIdsBySlotId: {
              "removed-primary": "media_player.shared",
              "removed-secondary": "sensor.removed",
              "retained-slot": "media_player.shared",
            },
          },
          published: {
            ...structuredClone(empty),
            entityIdsBySlotId: { "removed-primary": "media_player.published" },
          },
          manualRoomIds: [roomId],
          manualSlotIds: ["removed-primary", "retained-slot", "removed-secondary"],
        },
      ]),
    );
    const original = structuredClone(bindings);
    const next = removeWorkspaceSlotReferences(bindings, ["removed-primary", "removed-secondary"]);

    assert.deepEqual(bindings, original, "input remains immutable");
    for (const [origin, state] of Object.entries(next)) {
      assert.deepEqual(state.draft.roomAreaIds, original[origin].draft.roomAreaIds);
      assert.deepEqual(state.draft.entityIdsBySlotId, { "retained-slot": "media_player.shared" });
      assert.deepEqual(state.manualRoomIds, [roomId]);
      assert.deepEqual(state.manualSlotIds, ["retained-slot"]);
      assert.deepEqual(state.published, original[origin].published);
    }
    assert.equal(removeWorkspaceSlotReferences(bindings, ["unknown-slot"]), bindings);
    assert.equal(removeWorkspaceSlotReferences(bindings, []), bindings);
  });

  test("reconciles only draft targets and rejects corrupt migration profiles", () => {
    const { project, manifest, empty } = fixture();
    const roomId = project.floors[0].rooms[0].id;
    const profile = {
      ...empty,
      roomAreaIds: { [roomId]: "fixture-area", "gone-room": "gone-area" },
      entityIdsBySlotId: { "gone-slot": "light.gone" },
    };
    const bindings = {
      "https://fixture-ha.test": {
        draft: profile,
        published: structuredClone(profile),
        manualRoomIds: [roomId, "gone-room"],
        manualSlotIds: ["gone-slot"],
      },
    };
    const reconciled = reconcileWorkspaceBindings(bindings, manifest);
    assert.deepEqual(reconciled["https://fixture-ha.test"].draft.roomAreaIds, {
      [roomId]: "fixture-area",
    });
    assert.deepEqual(reconciled["https://fixture-ha.test"].draft.entityIdsBySlotId, {});
    assert.deepEqual(reconciled["https://fixture-ha.test"].published, profile);
    assert.deepEqual(reconciled["https://fixture-ha.test"].manualRoomIds, [roomId]);
    assert.deepEqual(reconciled["https://fixture-ha.test"].manualSlotIds, []);
  });
});
