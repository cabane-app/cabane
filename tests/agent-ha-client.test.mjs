import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  pairAgent,
  requestAgent,
  sessionOperation,
  option,
} from "../apps/agent-cli/src/ha-client.mjs";
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "cabane-agent-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "session.json"),
    requests = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url, init, body });
    if (url.endsWith("/pair"))
      return Response.json({
        protocolVersion: "3",
        sessionId: "session",
        workspaceId: "home",
        token: "private-relay-token",
        expiresIn: 60,
      });
    return Response.json(
      url.endsWith("/request") ? { ok: true, result: { revision: 4 } } : { ok: true },
    );
  });
  const args = ["--session-file", file];
  await pairAgent([...args, "--url", "https://ha.test", "--code", "MCBN-TEST"]);
  return { args, file, requests };
}
test("pairing stores a restricted session without printing its token and requests go only to HA", async (t) => {
  const f = await fixture(t);
  const data = JSON.parse(await readFile(f.file, "utf8"));
  assert.equal(data.token, "private-relay-token");
  if (process.platform !== "win32") assert.equal((await stat(f.file)).mode & 0o777, 0o600);
  assert.deepEqual(await requestAgent(f.args, "inspect_workspace", {}), { revision: 4 });
  const last = f.requests.at(-1);
  assert.equal(last.url, "https://ha.test/api/cabane/agent/request");
  assert.equal(last.init.redirect, "error");
  assert.equal(last.init.headers["X-Cabane-Agent-Token"], "private-relay-token");
  assert.equal(last.init.headers.Authorization, undefined);
  assert.deepEqual(last.body, {
    sessionId: "session",
    workspaceId: "home",
    method: "inspect_workspace",
    params: {},
  });
});
test("a URL override cannot send the saved token to another server", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    requestAgent([...f.args, "--url", "https://other.test"], "inspect_workspace", {}),
    /different Home Assistant/,
  );
  assert.equal(f.requests.length, 1);
});
test("disconnect revokes remotely and removes the saved session", async (t) => {
  const f = await fixture(t);
  await sessionOperation(f.args, "disconnect");
  await assert.rejects(readFile(f.file), { code: "ENOENT" });
  assert.ok(f.requests.at(-1).url.endsWith("/disconnect"));
});
test("missing sessions, unsafe files and invalid parameters fail before sending a command", async (t) => {
  const f = await fixture(t);
  await assert.rejects(requestAgent(f.args, "inspect_workspace", []), /object/);
  await assert.rejects(
    requestAgent([...f.args, "--timeout-ms", "NaN"], "inspect_workspace", {}),
    /timeout-ms/,
  );
  if (process.platform !== "win32") {
    await chmod(f.file, 0o644);
    await assert.rejects(requestAgent(f.args, "inspect_workspace", {}), /permissions/);
  }
  assert.equal(f.requests.length, 1);
  assert.throws(() => option(["--method"], "--method"), /requires a value/);
});
test("editor failures and timeout errors do not automatically retry commands", async (t) => {
  const f = await fixture(t);
  let count = 0;
  t.mock.method(globalThis, "fetch", async () => {
    count++;
    return Response.json({ ok: false, error: { message: "Busy" } }, { status: 409 });
  });
  await assert.rejects(requestAgent(f.args, "execute_action", {}), /Busy/);
  assert.equal(count, 1);
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("Timed out", "TimeoutError");
  });
  await assert.rejects(requestAgent(f.args, "execute_action", {}), /Inspect the draft/);
});
