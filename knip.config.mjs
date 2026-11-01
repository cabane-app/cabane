import { existsSync, globSync, readFileSync } from "node:fs";

// Vite's SSR loader and browser evaluate() calls are runtime imports. Mark only
// the source modules named by these harnesses as entry points, preserving their
// test-facing exports without hiding unrelated orphan files.
const harnesses = globSync(["tests/**/*.mjs", "scripts/**/*.mjs", "tests/**/*harness.tsx"]);
const runtimeEntries = new Set();
for (const harness of harnesses) {
  const source = readFileSync(harness, "utf8");
  for (const match of source.matchAll(
    /["'`](\/(?:apps\/web|packages\/[^/]+|home|tests)\/[^"'`]*?\.(?:tsx?|mjs))["'`]/g,
  )) {
    const path = match[1].slice(1);
    if (existsSync(path)) runtimeEntries.add(path);
  }
}
const entriesFor = (workspace) =>
  [...runtimeEntries]
    .filter((path) => path.startsWith(`${workspace}/`))
    .map((path) => path.slice(workspace.length + 1))
    .filter((path) => !/^src\/(?:index|(?:architecture|furnishing|device)\/index)\.ts$/.test(path));
export default {
  ignoreBinaries: ["ioreg", "pmset"], // Optional macOS hardware benchmark metadata.
  ignoreUnresolved: [
    /^\/src\//,
    /^\/tests\//,
    /^\/apps\//,
    // Existing Vite module URLs, verified above and exercised by their harnesses.
    ...[...runtimeEntries].map((path) => `/${path}`),
  ],
  workspaces: {
    ".": {
      entry: [
        "scripts/*.mjs",
        "tests/**/*.test.mjs",
        "tests/*harness.tsx",
        "tests/fixtures/**/*.{ts,tsx}",
        "tests/fixtures/browser-diagnostics-probe.mjs", // Executed in a child test process.
        "tests/*.types.ts",
        ".agents/skills/**/scripts/*.mjs",
      ],
      project: ["scripts/**/*.mjs", "tests/**/*.{mjs,ts,tsx}", ".agents/skills/**/scripts/*.mjs"],
    },
    "apps/web": {
      entry: ["src/panel/main.tsx", ...entriesFor("apps/web")],
      project: ["src/**/*.{ts,tsx}"],
    },
    "packages/engine": {
      entry: ["src/architecture-scene/index.ts", ...entriesFor("packages/engine")],
      project: ["src/**/*.{ts,tsx}"],
      ignoreDependencies: [
        "@fontsource/roboto",
      ] /* Imported by styles.css; Knip does not follow CSS imports. */,
    },
    "packages/catalog": { entry: entriesFor("packages/catalog"), project: ["src/**/*.{ts,tsx}"] },
    "packages/walk-laser": {
      entry: entriesFor("packages/walk-laser"),
      project: ["src/**/*.{ts,tsx}"],
    },
    home: { project: ["src/**/*.{ts,tsx}"] },
  },
};
