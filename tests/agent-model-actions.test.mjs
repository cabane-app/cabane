import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { executeModelAction } = await load("/apps/web/src/agent-pilot/agent-model-actions.ts");
  const { saveCustomModel } = await load("/apps/web/src/custom-models/custom-model-edits.ts");
  const { makeThreeFloorProject } = await load("/tests/fixtures/multiple-floors.ts");
  const model = {
    id: "custom:11111111-2222-4333-8444-555555555555",
    name: "Fixture chair",
    placement: "floor",
    profile: "furniture",
    asset: { sha256: "a".repeat(64), byteLength: 100 },
    normalization: {
      rotation: [0, 0, 0],
      scale: 1,
      offset: [0, 0, 0],
      size: [1, 1, 1],
      bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
    },
    complexity: { triangles: 12, visibleMeshes: 1 },
  };
  const light = { position: [0, 0.5, 0], color: "#ffffff", maxIntensity: 2, distance: 5 };
  function fixture() {
    const project = makeThreeFloorProject();
    project.customModels = [model];
    project.sceneItems = project.floors.map((floor, index) => ({
      id: `chair-${index}`,
      floorId: floor.id,
      modelId: model.id,
      kind: "furnishing",
      size: [1, 1, 1],
      placement: { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
    }));
    const commits = [];
    const replacements = [];
    let flushes = 0;
    const workspace = {
      snapshot: { project, bindings: {} },
      commit(next) {
        commits.push(next);
        this.snapshot = next;
      },
      async flush() {
        flushes++;
        return { status: "saved" };
      },
    };
    return {
      workspace,
      commits,
      replacements,
      replaceEditorsFromProject: (project) => replacements.push(project),
      get flushes() {
        return flushes;
      },
    };
  }

  test("agent and library metadata saves use one model update for copies on every floor", async () => {
    const ui = fixture();
    const agent = fixture();
    const changed = { ...model, name: "Updated chair", placement: "wall" };
    await saveCustomModel(ui.workspace, changed, (next) => ui.workspace.commit(next));
    await executeModelAction(agent, {
      type: "update-custom-model",
      modelId: model.id,
      changes: { name: changed.name, placement: changed.placement },
    });
    assert.deepEqual(agent.workspace.snapshot, ui.workspace.snapshot);
    assert.equal(agent.commits.length, 1);
    assert.equal(agent.flushes, 1);
    assert.equal(agent.replacements[0], agent.workspace.snapshot.project);
    assert.equal(agent.workspace.snapshot.project.customModels[0].asset, model.asset);
    assert.equal(agent.workspace.snapshot.project.sceneItems.length, 3);
    assert.ok(
      agent.workspace.snapshot.project.sceneItems.every((item) => item.modelId === model.id),
    );
  });

  test("shared lighting edits create copy relationships and reject malformed light data atomically", async () => {
    const controller = fixture();
    const before = controller.workspace.snapshot;
    await assert.rejects(
      executeModelAction(controller, {
        type: "update-model-lighting",
        modelId: model.id,
        light: {
          ...light,
          sources: [{ kind: "strip", start: [0, 0, 0], end: [0, 1], samples: 5 }],
        },
      }),
      /three finite coordinates/,
    );
    assert.equal(controller.workspace.snapshot, before);
    assert.equal(controller.commits.length, 0);
    await executeModelAction(controller, {
      type: "update-model-lighting",
      modelId: model.id,
      light,
    });
    const items = controller.workspace.snapshot.project.sceneItems;
    assert.ok(items.every((item) => item.lightSlotId));
    assert.equal(new Set(items.map((item) => item.lightSlotId)).size, items.length);
    assert.equal(controller.commits.length, 1);
    assert.equal(controller.flushes, 1);
    await executeModelAction(controller, {
      type: "update-model-lighting",
      modelId: model.id,
      light: null,
    });
    assert.ok(controller.workspace.snapshot.project.sceneItems.every((item) => !item.lightSlotId));
    assert.equal(controller.commits.length, 2);
  });

  test("metadata commands reject asset replacement, malformed normalization and removal of a used model", async () => {
    const controller = fixture();
    const before = controller.workspace.snapshot;
    for (const action of [
      {
        type: "update-custom-model",
        modelId: model.id,
        changes: { asset: { sha256: "b".repeat(64), byteLength: 100 } },
      },
      {
        type: "update-custom-model",
        modelId: model.id,
        changes: { normalization: { ...model.normalization, size: [1, 0, 1] } },
      },
      { type: "remove-custom-model", modelId: model.id },
      { type: "rename-custom-model", modelId: model.id, name: " " },
    ])
      await assert.rejects(executeModelAction(controller, action));
    assert.equal(controller.workspace.snapshot, before);
    assert.equal(controller.commits.length, 0);
    await executeModelAction(controller, {
      type: "rename-custom-model",
      modelId: model.id,
      name: "  Chair  ",
    });
    assert.equal(controller.workspace.snapshot.project.customModels[0].name, "Chair");
    controller.workspace.snapshot = {
      ...controller.workspace.snapshot,
      project: { ...controller.workspace.snapshot.project, sceneItems: [] },
    };
    await executeModelAction(controller, { type: "remove-custom-model", modelId: model.id });
    assert.deepEqual(controller.workspace.snapshot.project.customModels, []);
  });
});
