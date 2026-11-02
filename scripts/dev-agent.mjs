import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { option } from "../apps/agent-cli/src/ha-client.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const [command, ...args] = process.argv.slice(2);
const sessionFile = resolve(
  option(args, "--session-file") ?? "test-results/dev-agent/session.json",
);

async function main() {
  if (!command || command === "--help") {
    console.log(`Usage: npm run agent:dev -- <command>
  start [--room 6x4] [--headed] [--name "Feature test"]
  request --method METHOD [--params JSON] [--full]
  batch --file requests.json [--full]
  inspect | validate
  screenshot [--output test-results/dev-agent/screenshot.png]
  stop
All commands accept --session-file PATH. Start stays running until stop or Ctrl+C.
Batches run serially and stop on the first error; earlier edits remain applied.
Mutation results are compact by default; --full includes their complete inspection.`);
    return;
  }
  if (command === "start") {
    if (existsSync(sessionFile))
      throw new Error(
        `A session file already exists: ${sessionFile}. Reuse it or stop that session first.`,
      );
    const { startDevAgent } = await import("./dev-agent-server.mjs");
    await startDevAgent({
      root,
      sessionFile,
      headed: args.includes("--headed"),
      name: option(args, "--name") ?? "Development home",
      room: option(args, "--room"),
    });
    return;
  }
  if (!["request", "batch", "inspect", "validate", "screenshot", "stop"].includes(command))
    throw new Error(`Unknown command: ${command}. Use --help.`);
  const session = JSON.parse(await readFile(sessionFile, "utf8"));
  const url = new URL(session.url);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || session.root !== root)
    throw new Error("The session must belong to this checkout's loopback development runner.");
  let requests;
  if (command === "batch") {
    const file = option(args, "--file");
    if (!file) throw new Error("batch requires --file PATH.");
    requests = JSON.parse(await readFile(file, "utf8"));
  } else if (["inspect", "validate", "request"].includes(command)) {
    const method =
      command === "inspect"
        ? "inspect_workspace"
        : command === "validate"
          ? "validate_draft"
          : option(args, "--method");
    if (!method) throw new Error("request requires --method METHOD.");
    requests = { method, params: JSON.parse(option(args, "--params") ?? "{}") };
  }
  const operation = command === "stop" || command === "screenshot" ? command : "request";
  let response;
  try {
    response = await fetch(`${url.origin}/__dev-agent/${operation}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests, full: args.includes("--full") }),
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    throw new Error(`${error.message}. Inspect the draft before repeating a mutation.`, {
      cause: error,
    });
  }
  if (response.ok && command === "screenshot") {
    const path = resolve(option(args, "--output") ?? "test-results/dev-agent/screenshot.png");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
    console.log(JSON.stringify({ screenshot: path }));
    return;
  }
  const result = await response.json();
  console.log(JSON.stringify(result, null, args.includes("--pretty") ? 2 : 0));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
