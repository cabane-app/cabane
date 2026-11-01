import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright-core";
import {
  authorizeDevAgent,
  compactDevAgentResult,
  devAgentRoomRequests,
  devAgentRequests,
} from "./dev-agent-protocol.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

export async function startDevAgent({
  root = repositoryRoot,
  sessionFile = join(root, "test-results/dev-agent/session.json"),
  headed = false,
  name = "Development home",
  room,
} = {}) {
  const roomRequests = devAgentRoomRequests(room);
  const cacheDir = await mkdtemp(join(tmpdir(), "cabane-dev-agent-"));
  const token = randomUUID();
  let server, browser, page, session;
  let sessionWritten = false;
  let busy = false;
  let closing = false;
  const execute = (command) =>
    page.evaluate(
      (command) => {
        if (!window.cabaneDevAgent) throw new Error("The development editor is not open.");
        return window.cabaneDevAgent(command);
      },
      { requestId: randomUUID(), ...command, params: command.params ?? {} },
    );
  const waitForEditor = () =>
    page.waitForFunction(() => typeof window.cabaneDevAgent === "function", undefined, {
      timeout: 60_000,
    });
  const close = async () => {
    if (closing) return;
    closing = true;
    if (sessionWritten) await rm(sessionFile, { force: true });
    try {
      await browser?.close();
    } finally {
      await server?.close();
      await rm(cacheDir, { recursive: true, force: true });
    }
  };
  try {
    const json = (response, status, body) => {
      response.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(body));
    };
    const handleRequest = async (request, response, next) => {
      const path = request.url?.split("?")[0];
      if (!path?.startsWith("/__dev-agent/")) return next();
      if (!session || !authorizeDevAgent(request, token, new URL(session.url).host)) {
        json(response, 403, { error: "This endpoint requires the local development session." });
        return;
      }
      if (request.method !== "POST") {
        json(response, 405, { error: "Use POST." });
        return;
      }
      if (busy || closing) {
        json(response, 409, {
          error: "A request is in progress or the session is closing. Inspect before retrying.",
        });
        return;
      }
      busy = true;
      const results = [];
      try {
        if (path === "/__dev-agent/stop") {
          response.once("finish", () => void close());
          json(response, 200, { stopped: true });
          return;
        }
        if (path === "/__dev-agent/screenshot") {
          const png = await page.screenshot();
          response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
          response.end(png);
          return;
        }
        if (path !== "/__dev-agent/request") throw new Error("Unknown development operation.");
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (Buffer.byteLength(body) > 1_048_576) throw new Error("Request exceeds 1 MiB.");
        }
        const input = JSON.parse(body);
        const requests = devAgentRequests(input.requests);
        for (const command of requests) {
          const result = await execute(command);
          results.push(input.full ? result : compactDevAgentResult(result));
        }
        json(response, 200, { results });
      } catch (error) {
        json(response, 400, { error: error.message, completed: results.length, results });
      } finally {
        busy = false;
      }
    };
    server = await createServer({
      root: join(root, "apps/web"),
      configFile: join(root, "apps/web/vite.config.ts"),
      cacheDir,
      define: { "import.meta.env.VITE_CABANE_DEV_AGENT": JSON.stringify("1") },
      plugins: [
        {
          name: "cabane-dev-agent-control",
          configureServer(vite) {
            vite.middlewares.use(handleRequest);
          },
        },
      ],
      server: { host: "127.0.0.1", port: 0, open: false },
    });
    await server.listen();
    const address = server.httpServer.address();
    const url = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ channel: "chromium", headless: !headed });
    browser.on("disconnected", () => void close());
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
    await page.goto(url);
    const workspaceId = await page.evaluate(
      async ({ name, engineUrl }) => {
        const { createWorkspaceRepository } = await import(engineUrl);
        const { ownerProjectRegistries } = await import("/src/project-runtime.ts");
        const repository = createWorkspaceRepository(window.indexedDB, ownerProjectRegistries);
        const entry = await repository.createBlank(name);
        return entry.metadata.id;
      },
      { name, engineUrl: `/@fs${join(root, "packages/engine/src/index.ts")}` },
    );
    await page.goto(`${url}/workspaces/${encodeURIComponent(workspaceId)}/construct`);
    await waitForEditor();
    for (const request of roomRequests) await execute(request);
    if (roomRequests.length) {
      const validation = await execute({ method: "validate_draft" });
      if (!validation.valid)
        throw new Error(`Starter room is invalid: ${JSON.stringify(validation.issues)}`);
      // Reopen the saved draft so the initial camera fits the completed room.
      await page.reload();
      await waitForEditor();
    }
    session = { url, workspaceId, root, token };
    await mkdir(dirname(sessionFile), { recursive: true });
    await writeFile(sessionFile, JSON.stringify(session), { mode: 0o600, flag: "wx" });
    sessionWritten = true;
    process.once("SIGINT", () => void close());
    process.once("SIGTERM", () => void close());
    console.log(JSON.stringify({ ready: true, url: page.url(), workspaceId, sessionFile, headed }));
    return { close, page, server };
  } catch (error) {
    await close();
    throw error;
  }
}
