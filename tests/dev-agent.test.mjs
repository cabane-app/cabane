import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeDevAgent,
  compactDevAgentResult,
  devAgentRoomRequests,
  devAgentRequests,
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
