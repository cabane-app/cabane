import { access, readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = process.cwd();
const sourceRoots = ["apps", "packages", "home"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const documentedPackageExports = new Set([
  "@cabane/walk-laser",
  "@cabane/pet",
  "@cabane/engine",
  "@cabane/engine/styles.css",
  "@cabane/catalog/architecture",
  "@cabane/catalog/furnishing",
  "@cabane/catalog/device",
  "@cabane/home",
]);

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "dist-panel")
      continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(path)));
    else if (sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const errors = [];
const demoRoot = "packages/engine/src/onboarding/demo/";
const demoFacade = "packages/engine/src/DemoHomeAssistantSession.tsx";
const demoValueImports = new Map([
  ["react", null],
  ["packages/engine/src/HomeAssistantRuntime", new Set(["HomeAssistantRuntimeValueProvider"])],
  ["packages/engine/src/binding-slot-descriptors", new Set(["collectBindingSlots"])],
]);
const files = (
  await Promise.all(sourceRoots.map((sourceRoot) => filesBelow(join(root, sourceRoot))))
).flat();
const fixturePath = join(root, "tests/fixtures/agent-home.tsx");
try {
  await access(fixturePath);
  files.push(fixturePath);
} catch {
  // A standalone policy fixture may intentionally omit the repository fixture.
}

for (const file of files) {
  const source = await readFile(file, "utf8");
  const displayPath = relative(root, file);
  // Narrow dependency rules supplement the existing package-boundary scan.
  // Explicitly allow erased contract types and the context provider only.
  const declarations = [
    ...source.matchAll(/(?:import|export)\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/g),
  ];
  for (const match of declarations) {
    const target = match[3].startsWith(".")
      ? relative(root, resolve(dirname(file), match[3])).replace(/\.(tsx?|jsx?|mjs)$/, "")
      : match[3];
    if (
      target.startsWith(demoRoot) &&
      !displayPath.startsWith(demoRoot) &&
      displayPath !== demoFacade
    ) {
      errors.push(`${displayPath}: demo internals must be accessed through the onboarding facade`);
    }
    if (!displayPath.startsWith(demoRoot) || target.startsWith(demoRoot)) continue;
    const typeOnly = Boolean(match[1]);
    const contractTypes = [
      "packages/engine/src/types",
      "packages/engine/src/RuntimeBindingSetup",
      "packages/engine/src/home-assistant-controls",
    ];
    if (typeOnly && contractTypes.includes(target)) continue;
    const allowed = demoValueImports.get(target);
    const body = match[2].trim();
    const named = body.startsWith("{") && body.endsWith("}");
    const names = body
      .replace(/^\{|\}$/g, "")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name && !name.startsWith("type "))
      .map((name) => name.split(/\s+as\s+/)[0]);
    if (
      !demoValueImports.has(target) ||
      (allowed && (!named || names.some((name) => !allowed.has(name))))
    ) {
      errors.push(`${displayPath}: demo may not depend on ${target}`);
    }
  }
  if (displayPath.startsWith(demoRoot)) {
    if (
      /\b(?:fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|indexedDB)\b/.test(source)
    ) {
      errors.push(`${displayPath}: demo must not use network or persistence APIs`);
    }
    if (/\bimport\s*(?:\(|["'])|\brequire\s*\(/.test(source)) {
      errors.push(`${displayPath}: demo uses only explicit static imports`);
    }
  }
  const imports = [...source.matchAll(/(?:from\s+|import\s*\(|import\s+)(["'])([^"']+)\1/g)].map(
    (match) => match[2],
  );
  for (const specifier of imports) {
    if (specifier === "@cabane/walk-laser" && !displayPath.startsWith("apps/web/")) {
      errors.push(`${displayPath}: only the web host may install experimental walk tools`);
    }
    const resolvedImport = specifier.startsWith(".")
      ? relative(root, resolve(dirname(file), specifier))
      : specifier;
    if (
      resolvedImport.startsWith("packages/walk-laser/") &&
      !displayPath.startsWith("packages/walk-laser/")
    ) {
      errors.push(
        `${displayPath}: walk-laser internals are private; use its public package export`,
      );
    }
    if (
      resolvedImport.startsWith(demoRoot) &&
      !displayPath.startsWith(demoRoot) &&
      displayPath !== demoFacade
    ) {
      errors.push(`${displayPath}: demo internals must be accessed through the onboarding facade`);
    }
    if (displayPath.startsWith("packages/") && specifier === "@cabane/home")
      errors.push(`${displayPath}: stable packages may not import the home package`);
    if (specifier.startsWith("@cabane/") && !documentedPackageExports.has(specifier))
      errors.push(`${displayPath}: deep stable-package import ${specifier} is forbidden`);
    if (displayPath.startsWith("packages/engine/") && specifier.startsWith("@cabane/catalog/"))
      errors.push(`${displayPath}: engine may not import the model catalog`);
    if (
      (displayPath.startsWith("packages/catalog/src/architecture/") ||
        displayPath.startsWith("packages/catalog/src/furnishing/")) &&
      specifier === "@cabane/catalog/device"
    )
      errors.push(
        `${displayPath}: architecture and furnishing presets may not import device behavior`,
      );
    const generatedHome =
      displayPath.startsWith("home/") || displayPath === "tests/fixtures/agent-home.tsx";
    if (generatedHome && specifier.startsWith("../packages/"))
      errors.push(`${displayPath}: home must use documented package exports`);
    if (
      generatedHome &&
      !specifier.startsWith(".") &&
      ![
        "@cabane/engine",
        "@cabane/catalog/architecture",
        "@cabane/catalog/furnishing",
        "@cabane/catalog/device",
      ].includes(specifier)
    )
      errors.push(`${displayPath}: generated home may import only documented stable package roots`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Import boundaries are valid.");
}
