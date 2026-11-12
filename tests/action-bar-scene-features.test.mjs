import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { createEmptyHomeProject, parseHomeProjectSchema } = await load(
    "/packages/engine/src/home-project/index.ts",
  );
  const { validateActionBarTargets } = await load(
    "/packages/engine/src/home-project/action-bar-validation.ts",
  );
  const { resolvePublishedActionBarItems, resolveActionBarItems } = await load(
    "/packages/engine/src/action-bar/action-bar-config.ts",
  );
  const { resolveDashboardActionTargets } = await load(
    "/packages/engine/src/action-bar/dashboard-action-targets.ts",
  );
  const feature = { id: "call-pet", target: { kind: "scene-feature", featureId: "example.pet" } };
  test("scene-feature shortcuts round-trip unknown installations without entering defaults or HA", () => {
    const project = createEmptyHomeProject("home", "Home");
    project.actionBar = { items: [feature] };
    const result = parseHomeProjectSchema(JSON.parse(JSON.stringify(project)));
    assert.equal(result.valid, true, JSON.stringify(result.issues));
    assert.deepEqual(resolvePublishedActionBarItems(project.actionBar), [feature]);
    const issues = [];
    validateActionBarTargets(project, issues);
    assert.deepEqual(issues, []);
    assert.equal(
      resolveActionBarItems().some((item) => item.target.kind === "scene-feature"),
      false,
    );
    assert.deepEqual(resolveDashboardActionTargets([feature]), {});
  });
  test("scene-feature IDs are validated and duplicate targets rejected", () => {
    const project = createEmptyHomeProject("home", "Home");
    for (const featureId of [undefined, null, "", "  ", 3]) {
      project.actionBar = { items: [{ ...feature, target: { kind: "scene-feature", featureId } }] };
      assert.equal(parseHomeProjectSchema(project).valid, false);
      assert.notEqual(
        resolvePublishedActionBarItems(project.actionBar)[0].target.kind,
        "scene-feature",
      );
    }
    project.actionBar = { items: [feature, { ...feature, id: "duplicate" }] };
    const issues = [];
    validateActionBarTargets(project, issues);
    assert.ok(issues.some((issue) => issue.code === "project.action-bar-target-duplicate"));
    project.actionBar = {
      items: [{ ...feature, target: { ...feature.target, modelUrl: "private.glb" } }],
    };
    assert.equal(
      parseHomeProjectSchema(project).valid,
      false,
      "portable shortcuts store only a stable feature ID",
    );
  });
});
