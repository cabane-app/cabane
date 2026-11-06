import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { withModules } from "./test-server.mjs";

test("initialization seeds Atelier and preserves saved workspaces on reopen", async () => {
  await withModules(async (load) => {
    const { initializeWorkspaces } = await load(
      "/apps/web/src/workspaces/initialize-workspaces.ts",
    );
    const indexedDB = new IDBFactory();
    const repository = await initializeWorkspaces(indexedDB);
    const [demo] = await repository.list();
    assert.deepEqual(
      demo.record.published.floors.map((floor) => floor.id),
      ["atelier-basement", "ground", "upper"],
    );
    assert.equal(demo.metadata.homeAssistantUrl, null);
    assert.equal((await repository.readOnboarding()).demoWorkspaceId, demo.metadata.id);

    const home = await repository.createBlank("Saved home");
    const connected = await repository.setConnection(
      home.metadata.id,
      home.record.revision,
      "https://fixture.test",
    );
    const reopened = await initializeWorkspaces(indexedDB);
    assert.deepEqual(await reopened.read(home.metadata.id), connected);
    assert.equal((await reopened.list()).length, 2);
  });
});
