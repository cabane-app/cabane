import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const contract = await load("/apps/web/src/agent-pilot/agent-command-contract.ts");

  test("describes one generic action boundary without exposing UI-only actions", () => {
    const actionTypes = contract.AGENT_ACTIONS.map((action) => action.type);

    assert.equal(new Set(actionTypes).size, actionTypes.length);
    assert.ok(contract.AGENT_CAPABILITIES.includes("execute_action"));
    assert.deepEqual(contract.AGENT_READ_METHODS, [
      "inspect_workspace",
      "get_draft_diff",
      "validate_draft",
      "list_catalog",
      "list_binding_slots",
    ]);
    assert.ok(actionTypes.includes("add-wall"));
    assert.ok(actionTypes.includes("add-item"));
    assert.ok(actionTypes.includes("apply-binding"));
    assert.ok(!actionTypes.includes("dispatch_construct"));
    assert.ok(!actionTypes.includes("dispatch_arrange"));
    assert.ok(!actionTypes.includes("set-tool"));
    assert.ok(!actionTypes.includes("replace-draft"));
  });

  test("gives agents the input context needed for geometry and catalog actions", () => {
    const addWall = contract.AGENT_ACTIONS.find((action) => action.type === "add-wall");
    const addItem = contract.AGENT_ACTIONS.find((action) => action.type === "add-item");

    assert.match(addWall.input, /from: PlanPoint/);
    assert.match(addWall.input, /to: PlanPoint/);
    assert.match(addItem.input, /modelId: string/);
    assert.match(addItem.description, /custom/);
  });
});
