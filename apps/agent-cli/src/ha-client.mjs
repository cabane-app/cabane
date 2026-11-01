import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const PROTOCOL_VERSION = "3";
export function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}
export function requiredOption(args, name) {
  const value = option(args, name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function sessionPath(args) {
  return resolve(
    option(args, "--session-file") ??
      process.env.CABANE_AGENT_SESSION ??
      join(homedir(), ".config", "cabane", "agent-session.json"),
  );
}
function haUrl(value) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Use the Home Assistant HTTP(S) URL without credentials, query or fragment.");
  return url.href.replace(/\/$/, "");
}
async function post(url, operation, body, token, timeoutMs = 35_000) {
  let response;
  try {
    response = await fetch(`${haUrl(url)}/api/cabane/agent/${operation}`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Cabane-Agent-Token": token } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
      throw new Error(
        "Timed out waiting for Home Assistant. Inspect the draft before retrying an edit.",
        { cause: error },
      );
    throw new Error("Could not reach Home Assistant. Check its URL, connection and certificate.", {
      cause: error,
    });
  }
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new Error(
      "Home Assistant did not return a Cabane relay response. Update the integration.",
    );
  if (!response.ok || result.ok === false)
    throw new Error(result.error?.message ?? `Home Assistant returned HTTP ${response.status}.`);
  return result;
}
export async function pairAgent(args) {
  const url = haUrl(requiredOption(args, "--url"));
  const result = await post(url, "pair", { code: requiredOption(args, "--code") });
  if (
    result.protocolVersion !== PROTOCOL_VERSION ||
    typeof result.token !== "string" ||
    !result.token ||
    typeof result.sessionId !== "string" ||
    typeof result.workspaceId !== "string" ||
    !Number.isFinite(result.expiresIn) ||
    result.expiresIn <= 0
  )
    throw new Error(
      "The Cabane relay protocol is incompatible. Update the integration and CLI together.",
    );
  const file = sessionPath(args);
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(
      temporary,
      JSON.stringify({
        url,
        sessionId: result.sessionId,
        workspaceId: result.workspaceId,
        token: result.token,
        expiresAt: Date.now() + result.expiresIn * 1000,
      }),
      { mode: 0o600, flag: "wx" },
    );
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
  return { paired: true, workspaceId: result.workspaceId, sessionFile: file };
}
async function readSession(args) {
  const file = sessionPath(args);
  let session;
  try {
    if (process.platform !== "win32" && (await stat(file)).mode & 0o077)
      throw new Error("Session file is readable by other users. Set its permissions to 600.");
    session = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT")
      throw new Error("Pair from the Home Assistant Cabane panel first using cabane-agent pair.", {
        cause: error,
      });
    throw error;
  }
  if (
    !session ||
    typeof session.token !== "string" ||
    typeof session.sessionId !== "string" ||
    typeof session.workspaceId !== "string" ||
    !Number.isFinite(session.expiresAt) ||
    session.expiresAt <= Date.now()
  )
    throw new Error(
      "The agent session expired. Generate a new code in the Cabane panel and pair again.",
    );
  const url = haUrl(session.url);
  const override = option(args, "--url");
  if (override && haUrl(override) !== url)
    throw new Error("This session belongs to a different Home Assistant URL. Pair again.");
  return { ...session, url };
}
export async function sessionOperation(args, operation) {
  const session = await readSession(args);
  const result = await post(
    session.url,
    operation,
    { sessionId: session.sessionId, workspaceId: session.workspaceId },
    session.token,
  );
  if (operation === "disconnect") await rm(sessionPath(args), { force: true });
  return result;
}
export async function requestAgent(args, method, params) {
  if (!params || typeof params !== "object" || Array.isArray(params))
    throw new Error("--params must be a JSON object.");
  const timeoutMs = Number(option(args, "--timeout-ms") ?? 35_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000)
    throw new Error("--timeout-ms must be an integer from 1 to 60000.");
  const session = await readSession(args);
  const result = await post(
    session.url,
    "request",
    { sessionId: session.sessionId, workspaceId: session.workspaceId, method, params },
    session.token,
    timeoutMs,
  );
  if (result.ok !== true || !Object.hasOwn(result, "result"))
    throw new Error("The editor returned an invalid command response.");
  return result.result;
}
