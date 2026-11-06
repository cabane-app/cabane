import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { withModules } from "./test-server.mjs";

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
      assert.deepEqual(
        entries[0].record.published.floors.map((floor) => floor.id),
        ["atelier-basement", "ground", "upper"],
      );
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
