#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { build, preview } from "vite";
import { compareRuntimeReports, renderRuntimeReport } from "./scene-performance/runtime-report.mjs";
import { loadDevelopmentHome } from "./scene-performance/development-home.mjs";
import { replayTouchOrbit } from "./scene-performance/touch-replay.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildDirectory = resolve(repository, "test-results/performance/build");
const harnessPath = "/tests/performance-harness.html";
const profiles = {
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
const help = `Usage: npm run perf -- [options]
  --label NAME        Experiment name (default: baseline)
  --output PATH       JSON report (default: test-results/performance/NAME-TIMESTAMP.json)
  --baseline PATH     Compare with a report from the same machine and configuration
  --profile NAME      mobile (390x844, DPR 3, touch) or desktop (1440x960, DPR 1)
  --scenario NAME     dev-home (default, live local HA) or demo (bundled simulated home)
  --path NAME         orbit-v1 (direct camera) or touch-orbit-v1 (native touch drag)
  --cpu-rate N        Chromium CPU slowdown multiplier (default: 1, unthrottled)
  --seconds N         Measured motion per run, excluding warmup (default: 10)
  --runs N            Repetitions (default: 3)
  --headed            Show Chrome while measuring (default: headless)
  --check             Fail unless p95 ≤20ms, p99 ≤33.3ms and <1% over 33.3ms
  --cpu-profile       Save a diagnostic Chrome .cpuprofile beside the report
  --help              Print this help

Usage: npm run perf:serve -- [--host HOST] [--port PORT] [--scenario NAME]
  Build and serve the same production harness for a real phone.
  Default: http://127.0.0.1:4180${harnessPath}
  Use --host 0.0.0.0 explicitly to allow devices on your LAN.

Usage: npm run perf:compare -- BEFORE.json AFTER.json [--output PATH]
  Compare saved reports, including downloads from the same real phone.
  Writes test-results/performance/comparison.html by default.

Measuring requires local Chromium (npm run browser:install). Uses Chrome's normal GPU selection.
Mobile emulation and CPU slowdown do not simulate a phone GPU or thermal limits.`;

function parseOptions(args) {
  const options = {
    command: args[0] === "serve" ? args.shift() : "measure",
    label: "baseline",
    profile: "mobile",
    scenario: "dev-home",
    path: "orbit-v1",
    cpuRate: 1,
    seconds: 10,
    runs: 3,
    host: "127.0.0.1",
    port: 4180,
  };
  const names = {
    "--label": "label",
    "--output": "output",
    "--baseline": "baseline",
    "--profile": "profile",
    "--scenario": "scenario",
    "--path": "path",
    "--cpu-rate": "cpuRate",
    "--seconds": "seconds",
    "--runs": "runs",
    "--host": "host",
    "--port": "port",
  };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--help") return null;
    if (flag === "--headed" && options.command === "measure") {
      options.headed = true;
      continue;
    }
    if (flag === "--check" && options.command === "measure") {
      options.check = true;
      continue;
    }
    if (flag === "--cpu-profile" && options.command === "measure") {
      options.cpuProfile = true;
      continue;
    }
    const key = names[flag];
    const allowed =
      options.command === "serve"
        ? ["host", "port", "scenario"].includes(key)
        : key && !["host", "port"].includes(key);
    if (!allowed) throw new Error(`Unknown option: ${flag}`);
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    options[key] = value;
  }
  if (!Object.hasOwn(profiles, options.profile))
    throw new Error("--profile must be mobile or desktop.");
  if (!["dev-home", "demo"].includes(options.scenario))
    throw new Error("--scenario must be dev-home or demo.");
  if (!["orbit-v1", "touch-orbit-v1"].includes(options.path))
    throw new Error("--path must be orbit-v1 or touch-orbit-v1.");
  if (options.path === "touch-orbit-v1" && options.profile !== "mobile")
    throw new Error("Touch replay requires --profile mobile.");
  if (options.scenario === "dev-home" && !["127.0.0.1", "localhost", "::1"].includes(options.host))
    throw new Error(
      "The live dev HA benchmark must stay on loopback. Use --scenario demo for LAN sharing.",
    );
  for (const [key, minimum, maximum] of [
    ["cpuRate", 1, 20],
    ["seconds", 1, 60],
    ["runs", 1, 10],
    ["port", 1, 65535],
  ]) {
    options[key] = Number(options[key]);
    if (!Number.isFinite(options[key]) || options[key] < minimum || options[key] > maximum)
      throw new Error(`${key} must be from ${minimum} to ${maximum}.`);
    if (["runs", "port"].includes(key) && !Number.isInteger(options[key]))
      throw new Error(`${key} must be an integer.`);
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(options.label))
    throw new Error("--label must use 1–80 letters, numbers, dots, underscores or hyphens.");
  if (options.output && options.baseline && resolve(options.output) === resolve(options.baseline))
    throw new Error("Baseline and output must be different files.");
  return options;
}

async function buildHarness(source, scenario = "dev-home") {
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

async function serveHarness(options) {
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
    build: { outDir: buildDirectory },
    preview: { host: options.host, port: options.port, strictPort: true },
  });
}

async function sourceMetadata(scenario) {
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

async function measure(options) {
  const baseline = options.baseline
    ? JSON.parse(await readFile(resolve(options.baseline), "utf8"))
    : null;
  const source = await sourceMetadata(options.scenario);
  await buildHarness(source, options.scenario);
  let server, browser;
  try {
    server = await serveHarness(options);
    browser = await chromium.launch({ channel: "chromium", headless: !options.headed });
    const context = await browser.newContext({ ...profiles[options.profile], timezoneId: "UTC" });
    const page = await context.newPage();
    page.setDefaultTimeout(120_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    if (options.cpuRate !== 1) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: options.cpuRate });
    }
    await page.exposeFunction("__cabanePerfTouch", ({ seconds }) =>
      replayTouchOrbit(cdp, profiles[options.profile].viewport, seconds),
    );
    await page.goto(`http://127.0.0.1:${options.port}${harnessPath}`);
    await page.waitForFunction(
      () =>
        window.__cabanePerf?.ready() === true ||
        [...document.querySelectorAll("button")].some(
          (button) =>
            button.textContent?.trim().startsWith("Explore the demo") &&
            button.getClientRects().length,
        ),
    );
    const demo = page.getByRole("button", { name: /^Explore the demo/ });
    if (await demo.isVisible()) await demo.click();
    await page.waitForFunction(() => window.__cabanePerf?.ready() === true);
    console.log(
      `Measuring ${options.runs} × ${options.seconds}s of ${options.path} (${options.profile}, CPU ×${options.cpuRate})…`,
    );
    if (options.cpuProfile) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.start");
    }
    const report = await page.evaluate((configuration) => window.__cabanePerf.run(configuration), {
      seconds: options.seconds,
      runs: options.runs,
      label: options.label,
      path: options.path,
    });
    const cpuProfile = options.cpuProfile ? (await cdp.send("Profiler.stop")).profile : null;
    if (errors.length) throw new Error(`Browser errors during measurement:\n${errors.join("\n")}`);
    report.label = options.label;
    report.measuredAt = new Date().toISOString();
    report.source = source;
    Object.assign(report.configuration, {
      profile: options.profile,
      cpuRate: options.cpuRate,
      build: "production",
    });
    Object.assign(report.environment, {
      browser: browser.version(),
      cpuRate: options.cpuRate,
      platform: `${platform()} ${release()}`,
      cpu: cpus()[0]?.model ?? "unavailable",
      headless: !options.headed,
    });
    let comparisonError;
    if (baseline) {
      try {
        report.comparison = compareRuntimeReports(report, baseline);
      } catch (error) {
        comparisonError = error;
        report.comparisonError = error.message;
      }
    }
    const timestamp = report.measuredAt.replace(/[:.]/g, "-");
    const output = resolve(
      options.output ?? `test-results/performance/${options.label}-${timestamp}.json`,
    );
    const htmlOutput = output.replace(/\.json$/i, "") + ".html";
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(htmlOutput, renderRuntimeReport(report));
    if (cpuProfile)
      await writeFile(output.replace(/\.json$/i, "") + ".cpuprofile", JSON.stringify(cpuProfile));
    console.log(
      `FPS ${report.summary.fps.toFixed(1)} · frame p95 ${report.summary.frameMsP95.toFixed(1)}ms · >33ms ${report.summary.over33MsPercent.toFixed(1)}%`,
    );
    console.log(`JSON: ${output}\nHTML: ${htmlOutput}`);
    if (comparisonError) throw comparisonError;
    if (
      options.check &&
      (report.summary.frameMsP95 > 20 ||
        report.summary.frameMsP99 > 1000 / 30 ||
        report.summary.over33MsPercent >= 1)
    )
      throw new Error(
        "Smoothness target missed: p95 ≤20ms, p99 ≤33.3ms, <1% over 33.3ms. Report saved.",
      );
  } finally {
    await browser?.close();
    await server?.close();
  }
}

async function serve(options) {
  await buildHarness(undefined, options.scenario);
  const server = await serveHarness(options);
  const urls = [...(server.resolvedUrls?.local ?? []), ...(server.resolvedUrls?.network ?? [])];
  console.log("Performance harness ready:");
  for (const url of urls) console.log(`  ${url.replace(/\/$/, "")}${harnessPath}`);
  console.log("Run and download measurements in the browser. Press Ctrl+C to stop.");
  const stop = async () => {
    await server.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
  await new Promise(() => undefined);
}

async function compare(args) {
  if (args.includes("--help")) {
    console.log(help);
    return;
  }
  const before = args.shift(),
    after = args.shift();
  if (!before || !after || before.startsWith("--") || after.startsWith("--"))
    throw new Error("Usage: npm run perf:compare -- BEFORE.json AFTER.json [--output PATH]");
  let output = "test-results/performance/comparison.html";
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--output" || args[1].startsWith("--"))
      throw new Error("Expected --output PATH after the two report paths.");
    output = args[1];
  }
  output = resolve(output);
  if ([before, after].some((path) => resolve(path) === output))
    throw new Error("Comparison output must differ from both input reports.");
  const [baseline, report] = await Promise.all(
    [before, after].map(async (path) => JSON.parse(await readFile(resolve(path), "utf8"))),
  );
  report.comparison = compareRuntimeReports(report, baseline);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, renderRuntimeReport(report));
  const signed = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
  console.log(
    `Frame p95 ${signed(report.comparison.frameMsP95.delta)}ms · >33ms ${signed(report.comparison.over33MsPercent.delta)} percentage points`,
  );
  console.log(`HTML: ${output}`);
}

try {
  const args = process.argv.slice(2);
  if (args[0] === "compare") await compare(args.slice(1));
  else {
    const options = parseOptions(args);
    if (!options) console.log(help);
    else if (options.command === "serve") await serve(options);
    else await measure(options);
  }
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
