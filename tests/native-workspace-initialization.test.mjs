import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { withModules } from "./test-server.mjs";

test("fresh demo uses Larch with a clear welcome tour and working simulated hall lights", async () => {
  await withModules(async (load) => {
    const { initializeWorkspaces } = await load(
      "/apps/web/src/workspaces/initialize-workspaces.ts",
    );
    const { composeOwnerProjectManifest } = await load("/apps/web/src/project-runtime.ts");
    const { firstOnboardingLight } = await load(
      "/apps/web/src/workspaces/first-onboarding-light.ts",
    );
    const { onboardingDemoRoomId } = await load("/apps/web/src/onboarding-config.ts");
    const { createWelcomeWalkLoop, sampleWelcomeWalkLoop } = await load(
      "/packages/engine/src/onboarding/preview/welcome-walk-loop.ts",
    );
    const { createWelcomeWalkNavigation } = await load(
      "/packages/engine/src/onboarding/preview/welcome-walk-navigation.ts",
    );
    const { deriveStairFlight } = await load("/packages/engine/src/stairs/flight-geometry.ts");
    const { deriveDemoSessionDefinition, applyDemoServiceCall } = await load(
      "/packages/engine/src/DemoHomeAssistantSession.tsx",
    );
    const factory = new IDBFactory();
    const storage = {
      getItem: () => null,
      setItem() {},
      removeItem() {},
    };
    const { repository } = await initializeWorkspaces(factory, storage);
    const onboarding = await repository.readOnboarding();
    const entry = await repository.read(onboarding.demoWorkspaceId);
    assert.equal(entry.record.published.home.name, "Larch Observatory");
    const manifest = composeOwnerProjectManifest(entry.record.published);
    const floor = manifest.floors.find((floor) => floor.id === manifest.home.walkStart.floorId);
    const loop = createWelcomeWalkLoop(manifest, floor);
    assert.ok(loop, "Larch offers the walking preview instead of falling back to orbit");
    const navigation = createWelcomeWalkNavigation(manifest, floor);
    const stairs = manifest.stairs.map((stair) => deriveStairFlight(manifest, stair));
    for (let seconds = 0; seconds < loop.durationSeconds; seconds += 0.02) {
      const pose = sampleWelcomeWalkLoop(loop, seconds);
      const [x, y, z] = pose.position;
      assert.ok(navigation.isClear({ x, y, z }), `Tour is clear at ${seconds}s`);
      for (const stair of stairs) {
        const xs = stair.footprintWorld.map((point) => point[0]);
        const zs = stair.footprintWorld.map((point) => point[1]);
        const dx = Math.max(Math.min(...xs) - x, 0, x - Math.max(...xs));
        const dz = Math.max(Math.min(...zs) - z, 0, z - Math.max(...zs));
        assert.ok(Math.hypot(dx, dz) >= 0.8, `Tour stays away from ${stair.id} at ${seconds}s`);
      }
      assert.ok(Number.isFinite(pose.yaw));
    }
    const light = firstOnboardingLight(manifest, onboardingDemoRoomId);
    assert.equal(light.roomId, "ground-floor:room-1");
    const definition = deriveDemoSessionDefinition(manifest);
    const entityId = definition.profile.entityIdsBySlotId[light.slotId];
    const state = definition.runtime.entityStates[entityId];
    const updated = applyDemoServiceCall(state, {
      domain: "light",
      service: state.state === "on" ? "turn_off" : "turn_on",
      target: { entity_id: entityId },
    });
    assert.notEqual(updated.state, state.state);

    const original = await repository.readRaw(entry.metadata.id);
    await initializeWorkspaces(factory, storage);
    assert.equal(await repository.readRaw(entry.metadata.id), original);
  });
});

test("native initialization never reads or migrates legacy connection storage", async () => {
  const indexedDB = new IDBFactory();
  await withModules(async (load) => {
    const result = await (async () => {
      const { initializeWorkspaces } = await load(
        "/apps/web/src/workspaces/initialize-workspaces.ts",
      );
      const accesses = [];
      const trap = Object.fromEntries(
        ["getItem", "setItem", "removeItem"].map((operation) => [
          operation,
          (key) => {
            accesses.push([operation, key]);
            throw new Error("Native mode accessed standalone storage");
          },
        ]),
      );
      const native = await initializeWorkspaces(indexedDB, trap, { skipLegacyMigration: true });
      const entries = await native.repository.list();
      const nativeResult = {
        accesses: [...accesses],
        error: native.migrationError ?? null,
        count: entries.length,
        origins: entries.map((entry) => entry.metadata.homeAssistantUrl),
        migrationDone: await native.repository.migrationDone(),
      };
      const standalone = await initializeWorkspaces(indexedDB, {
        getItem(key) {
          accesses.push(["getItem", key]);
          return null;
        },
        setItem() {},
        removeItem() {},
      });
      return {
        ...nativeResult,
        standaloneReads: accesses.map((entry) => entry[1]),
        standaloneMigrationDone: await standalone.repository.migrationDone(),
      };
    })();
    assert.deepEqual(result.accesses, []);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);
    assert.deepEqual(result.origins, [null]);
    assert.equal(result.migrationDone, false);
    assert.ok(result.standaloneReads.includes("cabane:ha-auth:v1"));
    assert.equal(result.standaloneMigrationDone, true);
  });
});
