import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test(
  "the runner reports assertion failures and crashed workers as failed CI runs",
  { timeout: 10_000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "cabane-runner-"));
    const failure = join(directory, "failure.test.mjs");
    const crash = join(directory, "crash.test.mjs");
    const reportPath = join(directory, "report.json");
    const environment = {
      ...process.env,
      CABANE_TEST_CONCURRENCY: "2",
      CABANE_TEST_REPORT: reportPath,
    };
    delete environment.NODE_TEST_CONTEXT;
    try {
      await writeFile(
        failure,
        "import test from 'node:test'; import assert from 'node:assert/strict'; test('healthy', () => {}); test('failure', () => assert.fail('runner failure sentinel'));",
      );
      await writeFile(crash, "import test from 'node:test'; test('crash', () => process.exit(7));");
      const { code, output } = await new Promise((resolve, reject) => {
        execFile(
          process.execPath,
          ["scripts/run-tests.mjs", failure, crash],
          { env: environment, signal: t.signal },
          (error, stdout, stderr) => {
            if (error && typeof error.code !== "number") reject(error);
            else resolve({ code: error?.code ?? 0, output: stdout + stderr });
          },
        );
      });
      assert.equal(code, 1, output);
      assert.match(output, /runner failure sentinel/);
      assert.match(output, /exitCode: 7/);

      const report = JSON.parse(await readFile(reportPath, "utf8"));
      assert.equal(report.passed, false);
      assert.equal(report.workers.length, 2);
      for (const worker of report.workers) assert.equal(worker.code, 1);
      const failed = report.workers.find((worker) => worker.file === failure);
      assert.equal(failed.passed, 1);
      assert.match(failed.failures[0].diagnostic, /runner failure sentinel/);
      const crashed = report.workers.find((worker) => worker.file === crash);
      assert.match(crashed.failures[0].diagnostic, /exitCode: 7/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
