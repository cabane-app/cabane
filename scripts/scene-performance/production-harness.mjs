import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build, preview } from "vite";
import { loadDevelopmentHome } from "./development-home.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultBuildDirectory = resolve(repository, "test-results/performance/build");
export const harnessPath = "/tests/performance-harness.html";
export const performanceProfiles = {
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
};

export async function buildHarness(
  source,
  scenario = "dev-home",
  buildDirectory = defaultBuildDirectory,
) {
  source ??= await sourceMetadata(scenario);
  if (scenario === "dev-home") await loadDevelopmentHome(repository);
  console.log("Building the production performance harness…");
  await build({
    root: repository,
    configFile: false,
    envDir: "/tmp/cabane-no-runtime-env",
    publicDir: resolve(repository, "apps/web/public"),
    plugins: [react()],
    define: {
      __THUMBNAIL_REVISION__: JSON.stringify("performance-harness"),
      __PERFORMANCE_SOURCE__: JSON.stringify(source),
      __PERFORMANCE_SCENARIO__: JSON.stringify(scenario),
    },
    build: {
      target: "es2022",
      outDir: buildDirectory,
      emptyOutDir: true,
      chunkSizeWarningLimit: Infinity,
      sourcemap: true,
      rollupOptions: { input: resolve(repository, `.${harnessPath}`) },
    },
  });
}

export async function serveHarness(options) {
  const host = options.host ?? "127.0.0.1";
  if (options.scenario === "dev-home" && !["127.0.0.1", "localhost", "::1"].includes(host))
    throw new Error(
      "The live dev HA benchmark must stay on loopback. Use --scenario demo for LAN sharing.",
    );
  return preview({
    root: repository,
    configFile: false,
    envDir: "/tmp/cabane-no-runtime-env",
    plugins: [
      {
        name: "performance-harness-routes",
        configurePreviewServer(server) {
          // The fixture enters normal app routes. Reload must return to
          // this dedicated entry, since this build has no root index.html.
          server.middlewares.use((request, _response, next) => {
            if (
              request.method === "GET" &&
              /^\/(?:workspaces(?:\/|$)|demo(?:[/?]|$))/.test(request.url ?? "")
            )
              request.url = harnessPath;
            next();
          });
          if (options.scenario === "dev-home")
            server.middlewares.use("/__performance/dev-ha", async (request, response) => {
              if (
                request.method !== "GET" ||
                !/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(request.headers.host ?? "")
              ) {
                response.writeHead(403).end("Loopback benchmark only.");
                return;
              }
              try {
                const session = await loadDevelopmentHome(repository);
                response.writeHead(200, {
                  "Content-Type": "application/json",
                  "Cache-Control": "no-store",
                });
                response.end(JSON.stringify(session));
              } catch (error) {
                response.writeHead(503, {
                  "Content-Type": "text/plain",
                  "Cache-Control": "no-store",
                });
                response.end(error.message);
              }
            });
        },
      },
    ],
    build: { outDir: options.buildDirectory ?? defaultBuildDirectory },
    preview: { host, port: options.port ?? 4180, strictPort: true },
  });
}

export async function sourceMetadata(scenario) {
  const homeFiles =
    scenario === "dev-home"
      ? [await readFile(resolve(repository, "home/showcase/furnished.project.json"), "utf8")]
      : [await readFile(resolve(repository, "home/showcase/atelier.project.json"), "utf8")];
  return {
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repository,
      encoding: "utf8",
    }).trim(),
    dirty: Boolean(
      execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
        cwd: repository,
        encoding: "utf8",
      }).trim(),
    ),
    homeHash: createHash("sha256").update(homeFiles.join("\n")).digest("hex"),
  };
}
