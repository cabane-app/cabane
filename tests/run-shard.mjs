import costs from "./test-costs.json" with { type: "json" };
import { selectVerificationTests } from "./verification-groups.mjs";
import { assignTestShards } from "./test-shards.mjs";
import { readdir, stat, readFile } from "node:fs/promises";
import { after, describe } from "node:test";
import { closeModules } from "./test-server.mjs";
import { closeBrowserTestEnvironment } from "./browser-test-environment.mjs";

// Node 24 provides a read-only navigator getter. Browser harnesses replace it
// with JSDOM's navigator, so restore the older test-process behavior first.
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
if (navigatorDescriptor && !navigatorDescriptor.writable && navigatorDescriptor.configurable) {
  delete globalThis.navigator;
}

export async function runShard(shardIndex, shardCount) {
  const testsDirectory = new URL(".", import.meta.url);
  let testFiles = (await readdir(testsDirectory))
    .filter((name) => name.endsWith(".test.mjs"))
    .sort();
  const group = process.env.CABANE_VERIFY_GROUP;
  if (group) {
    if (process.env.CABANE_TEST_SUITE)
      throw new Error("Focused groups require both unit and browser coverage.");
    const selection = selectVerificationTests(testFiles, group);
    testFiles = selection.files;
    if (shardIndex === 0) console.log(`${group}: ${testFiles.length} files. ${selection.reason}`);
  }
  const suite = process.env.CABANE_TEST_SUITE;
  if (suite && suite !== "unit" && suite !== "browser")
    throw new Error(`Unknown test suite: ${suite}`);
  // Use the same browser boundary for suite selection and shard assignment.
  // Unknown/new files retain a deterministic size fallback until profiled.
  const weightedFiles = await Promise.all(
    testFiles.map(async (name) => ({
      name,
      browser: /from ["'](?:playwright-core|\.\/browser-test-environment\.mjs)["']/.test(
        await readFile(new URL(name, testsDirectory), "utf8"),
      ),
      cost: costs[name] ?? (await stat(new URL(name, testsDirectory))).size / 50,
    })),
  );
  const shards = assignTestShards(
    weightedFiles.filter((file) => !suite || file.browser === (suite === "browser")),
    shardCount,
    { serialBrowser: process.env.CI === "true" },
  );

  // An explicit suite owns teardown. A process-level after hook waits for an
  // idle event loop, which a reusable Chrome connection never provides.
  return describe(`Test shard ${shardIndex + 1}`, async () => {
    after(closeBrowserTestEnvironment);
    after(closeModules);
    for (const testFile of shards[shardIndex]) await import(`./${testFile}`);
  });
}
