import assert from "node:assert/strict";
import test from "node:test";
import { withStorageDom } from "./dom-test-environment.mjs";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { migrateSingleHomeStorage } = await load(
    "/apps/web/src/workspaces/migrate-single-home-storage.ts",
  );
  const { migrateOriginProfile } = await load("/apps/web/src/project-runtime.ts");
  const origin = "https://fixture.test";
  const clientId = "https://fixture-app.test";
  const tokens = {
    hassUrl: origin,
    clientId,
    expires: 123,
    refresh_token: "fixture-refresh",
    access_token: "fixture-access",
    expires_in: 1800,
  };
  const storageFixture = (initial) => {
    const values = new Map(Object.entries(initial));
    return {
      values,
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    };
  };
  const repositoryFixture = (entry) => {
    let done = false;
    return {
      read: async () => entry,
      migrationDone: async () => done,
      finishMigration: async () => {
        done = true;
      },
    };
  };
  test("the demo replacement preserves the legacy connected home", () =>
    withStorageDom(async (dom) => {
      const { initializeWorkspaces } = await load(
        "/apps/web/src/workspaces/initialize-workspaces.ts",
      );
      const { ownerHomeProject } = await load("/home/src/index.ts");
      dom.window.localStorage.setItem("cabane:ha-url:v1", origin);
      const { repository, migrationError } = await initializeWorkspaces(
        dom.indexedDB,
        dom.window.localStorage,
      );
      assert.equal(migrationError, undefined);
      const [entry] = await repository.list();
      assert.equal(entry.record.published.home.id, ownerHomeProject.home.id);
      assert.equal(entry.metadata.homeAssistantUrl, origin);
      assert.equal((await repository.readOnboarding()).demoWorkspaceId, null);
    }));
  test("one-shot token conversion retries failed destination writes without losing its source", async () => {
    const storage = storageFixture({
      "cabane:ha-url:v1": origin,
      "cabane:ha-auth:v1": JSON.stringify(tokens),
    });
    const repository = repositoryFixture(null);
    const originalSet = storage.setItem;
    storage.setItem = () => {
      throw new Error("Fixture storage full");
    };
    await assert.rejects(
      migrateSingleHomeStorage(repository, "fixture-home", storage),
      /storage full/,
    );
    assert.equal(await repository.migrationDone(), false);
    assert.ok(storage.getItem("cabane:ha-auth:v1"));
    assert.equal(storage.getItem("cabane:ha-url:v1"), origin);
    storage.setItem = originalSet;
    await migrateSingleHomeStorage(repository, "fixture-home", storage);
    assert.deepEqual(api.loadStoredAuthData(storage, origin, clientId), tokens);
    assert.equal(storage.getItem("cabane:ha-auth:v1"), null);
    assert.equal(storage.getItem("cabane:ha-url:v1"), null);
    assert.equal(await repository.migrationDone(), true);
    storage.getItem = () => {
      throw new Error("Completed migration must not read legacy storage");
    };
    await migrateSingleHomeStorage(repository, "fixture-home", storage);
  });
  test("corrupt auth remains recoverable and does not become a runtime fallback", async () => {
    for (const raw of ["{broken", JSON.stringify({ hassUrl: origin, clientId })]) {
      const storage = storageFixture({ "cabane:ha-auth:v1": raw });
      const repository = repositoryFixture(null);
      await assert.rejects(migrateSingleHomeStorage(repository, "fixture-home", storage));
      assert.equal(storage.getItem("cabane:ha-auth:v1"), raw);
      assert.equal(await repository.migrationDone(), false);
      assert.equal(api.loadStoredAuthData(storage, origin, clientId), null);
    }
  });
  test("retry after source cleanup failure reuses verified server authentication", async () => {
    const storage = storageFixture({ "cabane:ha-auth:v1": JSON.stringify(tokens) });
    const repository = repositoryFixture(null);
    const originalRemove = storage.removeItem;
    storage.removeItem = () => {
      throw new Error("Fixture cleanup denied");
    };
    await assert.rejects(
      migrateSingleHomeStorage(repository, "fixture-home", storage),
      /cleanup denied/,
    );
    assert.deepEqual(api.loadStoredAuthData(storage, origin, clientId), tokens);
    assert.ok(storage.getItem("cabane:ha-auth:v1"));
    storage.removeItem = originalRemove;
    await migrateSingleHomeStorage(repository, "fixture-home", storage);
    assert.equal(await repository.migrationDone(), true);
    assert.deepEqual(api.loadStoredAuthData(storage, origin, clientId), tokens);
  });
  test("current binding records win over old profiles and conversion preserves its source until persisted", async () => {
    const record = api.createSeedProjectRecord(
      api.createEmptyHomeProject("fixture-home", "Fixture"),
    );
    record.publishedAt = 0;
    record.draft.floors[0].footprint = [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ];
    record.published.floors[0].footprint = structuredClone(record.draft.floors[0].footprint);
    const profile = {
      schemaVersion: 1,
      homeId: record.homeId,
      roomAreaIds: {},
      entityIdsBySlotId: {},
    };
    const key = api.runtimeBindingProfileStorageKey(origin, record.homeId);
    const storage = storageFixture({ [key]: JSON.stringify(profile) });
    let stored;
    await assert.rejects(
      migrateOriginProfile(record, origin, storage, async () => {
        throw new Error("Fixture save failed");
      }),
      /save failed/,
    );
    assert.ok(storage.getItem(key));
    const migrated = await migrateOriginProfile(
      record,
      origin,
      storage,
      async (candidate, revision) => {
        assert.equal(revision, record.revision);
        stored = structuredClone(candidate);
        return candidate;
      },
    );
    assert.deepEqual(stored.bindings[origin].draft, profile);
    assert.deepEqual(migrated.bindings[origin].published, profile);
    storage.getItem = () => {
      throw new Error("Existing current bindings must win");
    };
    assert.equal(
      await migrateOriginProfile(migrated, origin, storage, async () => {
        throw new Error("Must not write");
      }),
      migrated,
    );
  });
  test("damaged owner records keep migration inputs intact without blocking another home", async () => {
    const storage = storageFixture({ "cabane:ha-auth:v1": JSON.stringify(tokens) });
    const repository = repositoryFixture({ error: "Fixture corrupt home" });
    await migrateSingleHomeStorage(repository, "fixture-home", storage);
    assert.equal(await repository.migrationDone(), false);
    assert.ok(storage.getItem("cabane:ha-auth:v1"));
  });
});
