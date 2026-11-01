import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { inspect } from "node:util";

const quote = (value) => `'${value.replaceAll("'", "'\"'\"'")}'`;
const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function failure(data, lastStarted) {
  const file = data.file ? relative(process.cwd(), data.file) : null;
  const error = data.details?.error;
  const command = file
    ? `node --no-experimental-global-navigator --test --test-reporter=./scripts/agent-test-reporter.mjs --test-name-pattern=${quote(escapePattern(data.name))} ${quote(file)}`
    : null;
  const sharedEnvironment = ["CABANE_TEST_SUITE", "CABANE_VERIFY_GROUP"]
    .filter((name) => process.env[name])
    .map((name) => `${name}=${quote(process.env[name])}`);
  const shard = process.env.CABANE_TEST_SHARD;
  // An isolated pass cannot rule out state leaked by earlier files. Preserve
  // the full shard and selection without filtering out its setup tests.
  const sharedCommand =
    process.env.CABANE_TEST_SHARED_MODULES === "1" && shard
      ? `CABANE_TEST_SHARED_MODULES=1 ${sharedEnvironment.length ? `${sharedEnvironment.join(" ")} ` : ""}node --no-experimental-global-navigator --test --test-reporter=./scripts/agent-test-reporter.mjs ${quote(shard)}`
      : null;
  return `\nFAIL ${data.name}\n  ${file ?? "unknown file"}:${data.line ?? "?"}:${data.column ?? "?"}\n${inspect(error, { colors: false, depth: 8, customInspect: false, maxArrayLength: 20, maxStringLength: 8000 })}\n${lastStarted && lastStarted.name !== data.name ? `Last started: ${lastStarted.name} (${lastStarted.file ? relative(process.cwd(), lastStarted.file) : "unknown file"}:${lastStarted.line ?? "?"})\n` : ""}${command ? `Rerun: ${command}\n` : ""}${sharedCommand ? `Shared-shard rerun: ${sharedCommand}\n` : ""}`;
}

export default async function* agentTestReporter(source) {
  const startedAt = performance.now();
  const summary = { passed: 0, failed: 0, skipped: 0, todo: 0, durations: [], failures: [] };
  let dots = 0;
  let lastStarted;
  const output = new Map();
  for await (const { type, data } of source) {
    if (type === "test:dequeue") lastStarted = data;
    if (type === "test:dequeue" && process.env.CABANE_TEST_PROGRESS === "1") {
      yield `\nRUN ${data.name}\n`;
      dots = 0;
    }
    // complete is emitted on completion; fail/pass can wait for earlier siblings.
    if (type === "test:complete") {
      const error = data.details?.error;
      if (
        !data.details?.passed &&
        !data.todo &&
        !data.skip &&
        error?.failureType !== "subtestsFailed"
      ) {
        const captured = output.get(data.file);
        if (captured) {
          yield `\n${captured}`;
          output.delete(data.file);
        }
        const diagnostic = failure(data, lastStarted);
        summary.failures.push({ name: data.name, file: data.file, diagnostic });
        yield diagnostic;
        dots = 0;
      }
    }
    if (type === "test:stdout" || type === "test:stderr") {
      if (data.message.includes("Browser failure artifacts:")) {
        yield `\n${data.message}`;
        dots = 0;
      } else {
        output.set(data.file, ((output.get(data.file) ?? "") + data.message).slice(-16_384));
      }
    }
    if (type !== "test:pass" && type !== "test:fail") continue;
    const suite = data.details?.type === "suite";
    const aggregate = data.details?.error?.failureType === "subtestsFailed";
    if (aggregate || (suite && type === "test:pass")) continue;
    if (data.todo) summary.todo += 1;
    else if (data.skip) summary.skipped += 1;
    else if (type === "test:pass") summary.passed += 1;
    else summary.failed += 1;
    if (typeof data.details?.duration_ms === "number")
      summary.durations.push({
        duration: data.details.duration_ms,
        name: data.name,
        file: data.file ? relative(process.cwd(), data.file) : null,
        status: data.todo
          ? "todo"
          : data.skip
            ? "skipped"
            : type === "test:pass"
              ? "passed"
              : "failed",
      });
    if (type === "test:pass" || data.todo || data.skip) {
      yield data.todo ? "T" : data.skip ? "-" : ".";
      if (++dots === 80) {
        yield "\n";
        dots = 0;
      }
    }
  }
  if (process.env.CABANE_TEST_REPORT_DIRECTORY)
    await writeFile(
      join(process.env.CABANE_TEST_REPORT_DIRECTORY, `${process.pid}.json`),
      JSON.stringify({ ...summary, elapsedMs: performance.now() - startedAt }),
    );
  const durationSeconds = ((performance.now() - startedAt) / 1_000).toFixed(2);
  const details = [
    `${summary.passed} passed`,
    `${summary.failed} failed`,
    summary.skipped ? `${summary.skipped} skipped` : null,
    summary.todo ? `${summary.todo} todo` : null,
  ]
    .filter(Boolean)
    .join(", ");
  yield `${dots ? "\n" : ""}${details} in ${durationSeconds}s\n`;
  if (process.env.TEST_PROFILE === "1") {
    const slowest = summary.durations
      .sort((left, right) => right.duration - left.duration)
      .slice(0, 15);
    yield `Slowest tests:\n${slowest.map(({ duration, name }) => `  ${duration.toFixed(1)}ms  ${name}`).join("\n")}\n`;
  }
}
