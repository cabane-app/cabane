import { tmpdir } from "node:os";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { browserTestPreflight } from "./browser-test-preflight.mjs";

// Node buffers cross-file reporter events in file order. Give each existing
// shard its own streaming reporter. Small software-rendering CI runners can
// serialize shards without changing their coverage or browser assertions.
const concurrency = Number(process.env.CABANE_TEST_CONCURRENCY ?? 4);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
  throw new Error("CABANE_TEST_CONCURRENCY must be an integer from 1 to 4.");
const files = process.argv.slice(2);
const shards = files.length
  ? files
  : Array.from({ length: 4 }, (_, index) => `tests/shards/shard-${index}.test.mjs`);
if (!files.length && process.env.CABANE_TEST_SUITE !== "unit") await browserTestPreflight();
const children = new Set();
const startedAt = performance.now();
const reportPath = process.env.CABANE_TEST_REPORT;
const reportDirectory = reportPath ? await mkdtemp(join(tmpdir(), "cabane-test-report-")) : null;
const workers = [];
let nextShard = 0;
let interrupted = false;
const stop = (signal) => {
  interrupted = true;
  for (const child of children) {
    try {
      if (process.platform === "win32") child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
};
const interrupt = () => stop("SIGINT");
const terminate = () => stop("SIGTERM");
process.on("SIGINT", interrupt);
process.on("SIGTERM", terminate);
let failed = false;
try {
  const queue = [...shards];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length && !interrupted) {
        const file = queue.shift();
        const shardIndex = nextShard++;
        const status = await new Promise((resolve) => {
          const environment = {
            ...process.env,
            CABANE_TEST_SHARED_MODULES: files.length ? "0" : "1",
            CABANE_TEST_SHARD: files.length ? "" : file,
          };
          delete environment.NODE_TEST_CONTEXT;
          delete environment.CABANE_TEST_REPORT;
          delete environment.CABANE_TEST_REPORT_DIRECTORY;
          if (reportDirectory) environment.CABANE_TEST_REPORT_DIRECTORY = reportDirectory;
          const child = spawn(
            process.execPath,
            [
              "--no-experimental-global-navigator",
              "--test",
              "--test-reporter=./scripts/agent-test-reporter.mjs",
              file,
            ],
            { env: environment, stdio: "inherit", detached: process.platform !== "win32" },
          );
          children.add(child);
          child.on("error", (error) => {
            console.error(error);
            resolve(1);
          });
          child.on("close", (code, signal) => {
            children.delete(child);
            workers.push({ pid: child.pid, shardIndex, file, code, signal });
            if (code !== 0 || signal)
              console.error(
                `Test worker ${file} (pid ${child.pid}) exited: code=${code ?? "null"}, signal=${signal ?? "none"}`,
              );
            resolve(code ?? 1);
          });
        });
        if (status !== 0) failed = true;
      }
    }),
  );
} finally {
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", terminate);
}
if (reportDirectory) {
  try {
    const reports = await Promise.all(
      workers.map(async (worker) => {
        try {
          return {
            ...worker,
            ...JSON.parse(await readFile(join(reportDirectory, `${worker.pid}.json`), "utf8")),
          };
        } catch (error) {
          failed = true;
          return { ...worker, reportError: error.message };
        }
      }),
    );
    await mkdir(dirname(resolve(reportPath)), { recursive: true });
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          version: 1,
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          concurrency,
          ci: process.env.CI === "true",
          suite: process.env.CABANE_TEST_SUITE ?? "all",
          group: process.env.CABANE_VERIFY_GROUP ?? null,
          elapsedMs: performance.now() - startedAt,
          passed: !failed && !interrupted,
          workers: reports,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await rm(reportDirectory, { recursive: true, force: true });
  }
}
process.exitCode = failed || interrupted ? 1 : 0;
