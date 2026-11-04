import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeDevAgent,
  compactDevAgentResult,
  devAgentRoomRequests,
  devAgentRequests,
  executeDevAgentBatch,
} from "../scripts/dev-agent-protocol.mjs";

test("development requests reject malformed batches before any action is run", () => {
  const action = { method: "execute_action", params: { action: { type: "undo" } } };
  assert.deepEqual(devAgentRequests(action), [action]);
  assert.deepEqual(devAgentRequests([action, { method: "validate_draft" }]), [
    action,
    { method: "validate_draft" },
  ]);
  for (const input of [
    [],
    Array(101).fill(action),
    null,
    {},
    { method: "" },
    { method: "execute_action", params: [] },
    [action, { method: "execute_action", params: null }],
  ])
    assert.throws(() => devAgentRequests(input));
});

test("starter rooms use four connected editor walls and reject invalid dimensions", () => {
  const requests = devAgentRoomRequests("6x4");
  assert.equal(requests.length, 4);
  for (const [index, request] of requests.entries()) {
    assert.equal(request.method, "execute_action");
    assert.equal(request.params.action.type, "add-wall");
    assert.deepEqual(
      request.params.action.to,
      requests[(index + 1) % requests.length].params.action.from,
    );
  }
  assert.equal(requests[1].params.action.to[0], 6);
  assert.equal(requests[1].params.action.to[1], 4);
  assert.deepEqual(devAgentRoomRequests(undefined), []);
  for (const size of ["0x4", "6x-4", "6xNaN", "6x4x2", "6"])
    assert.throws(() => devAgentRoomRequests(size));
});

test("compact acknowledgements preserve mutation outcome and issue counts without copying the home", () => {
  const validation = [
    { severity: "warning", message: "Check placement" },
    { severity: "fatal", message: "Unfinished room" },
  ];
  const result = {
    changed: true,
    persisted: true,
    itemId: "chair",
    inspection: {
      draftRevision: 4,
      activeFloorId: "ground",
      project: { private: "fixture" },
      validation,
    },
  };
  assert.deepEqual(compactDevAgentResult(result), {
    changed: true,
    persisted: true,
    itemId: "chair",
    draftRevision: 4,
    activeFloorId: "ground",
    errorCount: 1,
    warningCount: 1,
  });
  const inspection = { draftRevision: 4, project: { floors: [] } };
  assert.equal(
    compactDevAgentResult(inspection),
    inspection,
    "explicit read methods retain their complete result",
  );
});

test("development endpoint requires the session token and exact loopback host, rejecting browser origins", () => {
  const host = "127.0.0.1:4173";
  const headers = { host, authorization: "Bearer secret" };
  const authorized = (changes) =>
    authorizeDevAgent({ headers: { ...headers, ...changes } }, "secret", host);
  assert.equal(authorized({}), true);
  for (const changes of [
    { authorization: undefined },
    { authorization: "Bearer other" },
    { host: "other.test:4173" },
    { origin: "https://other.test" },
    { origin: "http://127.0.0.1:4173" },
    { "sec-fetch-site": "cross-site" },
  ])
    assert.equal(authorized(changes), false);
});

test("named batch results configure newly created items without a workspace inspection", async () => {
  const seen = [];
  const requests = [
    { method: "execute_action", as: "chair", params: { action: { type: "add-item" } } },
    {
      method: "execute_action",
      params: {
        expectedRevision: { $ref: "chair.draftRevision" },
        action: { type: "update-item", itemId: { $ref: "chair.created.items.0" } },
      },
    },
    { method: "validate_draft" },
  ];
  const result = await executeDevAgentBatch(requests, async (request) => {
    seen.push(request);
    await Promise.resolve();
    return seen.length === 1
      ? {
          changed: true,
          created: { items: ["new-chair"] },
          inspection: { draftRevision: 1, activeFloorId: "ground", validation: [] },
        }
      : { valid: true };
  });
  assert.equal(result.results.length, 3);
  assert.deepEqual(seen[1].params, {
    expectedRevision: 1,
    action: { type: "update-item", itemId: "new-chair" },
  });
  assert.equal(result.results[0].inspection, undefined);
  assert.deepEqual(result.results[0].created, { items: ["new-chair"] });
});

test("batches validate aliases before editing and retain partial results after runtime failures", async () => {
  const add = { method: "execute_action", as: "chair" };
  let calls = 0;
  for (const input of [
    [add, add],
    [{ ...add, as: "bad.name" }],
    [add, { method: "execute_action", params: { itemId: { $ref: "unknown.created.items.0" } } }],
    [{ method: "execute_action", params: { itemId: { $ref: "chair.created.items.0" } } }, add],
    [add, { method: "execute_action", params: { itemId: { $ref: "chair", extra: true } } }],
  ]) {
    const result = await executeDevAgentBatch(input, async () => calls++);
    assert.ok(result.error);
    assert.equal(result.completed, 0);
  }
  assert.equal(calls, 0);
  const result = await executeDevAgentBatch(
    [add, { method: "execute_action", params: { itemId: { $ref: "chair.created.items.0" } } }],
    async () => {
      calls++;
      return { changed: false };
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.completed, 1);
  assert.deepEqual(result.results, [{ changed: false }]);
  assert.match(result.error, /chair.created.items.0/);
  const inherited = await executeDevAgentBatch(
    [add, { method: "execute_action", params: { itemId: { $ref: "chair.constructor" } } }],
    async () => ({}),
  );
  assert.equal(inherited.completed, 1);
  assert.match(inherited.error, /chair.constructor/);
});
