import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { scopePanelCss } from "./panel-build-tools.mjs";
import { contractFingerprint, validateContractRelease } from "./ha-contract/source-contract.mjs";
import { bundledDependencyNotices } from "./distribution-notices.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const web = join(root, "apps/web");
const outDir = join(web, "dist-panel");
const contract = JSON.parse(await readFile(join(root, "docs/ha-contract.json"), "utf8"));
validateContractRelease(contract, contractFingerprint(root).fingerprint);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const dirty = Boolean(
  execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim(),
);
if (dirty && process.env.CABANE_PANEL_ALLOW_DIRTY !== "1") {
  throw new Error(
    "Native release builds require a clean committed frontend tree. For local tests only, set CABANE_PANEL_ALLOW_DIRTY=1; development artifacts cannot be released.",
  );
}
const result = await build({
  root: web,
  configFile: join(web, "vite.config.ts"),
  base: "./",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    minify: true,
    // The custom element is a deployed app. Library mode preserves formatting
    // and embeds every imported image in JavaScript, even multi-megabyte assets.
    rolldownOptions: {
      input: join(web, "src/panel/main.tsx"),
      output: {
        format: "es",
        entryFileNames: "cabane-panel.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith(".css"))
            ? "cabane-panel.css"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
});
const styles = scopePanelCss(await readFile(join(outDir, "cabane-panel.css"), "utf8"));
await writeFile(join(outDir, "cabane-panel.css"), styles.css);
await writeFile(join(outDir, "cabane-fonts.css"), styles.fonts);
// Copy only the public UI assets used by Cabane, never OAuth callbacks or site HTML.
await cp(join(web, "public/cabane-icon.png"), join(outDir, "cabane-icon.png"));
await cp(join(web, "public/onboarding"), join(outDir, "onboarding"), { recursive: true });

// Retain the same dependency and CSS-font notices as standalone builds.
const chunks = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output ?? []);
await writeFile(join(outDir, "THIRD_PARTY_LICENSES.txt"), bundledDependencyNotices(chunks));
await cp(join(root, "LICENSE"), join(outDir, "LICENSE"));
await cp(join(root, "THIRD_PARTY_NOTICES.md"), join(outDir, "THIRD_PARTY_NOTICES.md"));
const files = {};
async function inventory(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inventory(path);
    else
      files[path.slice(outDir.length + 1)] = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
  }
}
await inventory(outDir);
await writeFile(
  join(outDir, "manifest.json"),
  JSON.stringify(
    {
      schema_version: 1,
      kind: "cabane-native-ha-panel",
      element: "cabane-panel",
      entrypoint: "cabane-panel.js",
      source_commit: sourceCommit,
      workspace_contract: { revision: contract.revision, fingerprint: contract.fingerprint },
      ...(dirty ? { development: true } : {}),
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Native panel: ${Object.keys(files).length} files from ${sourceCommit}${dirty ? " (development only)" : ""}`,
);
