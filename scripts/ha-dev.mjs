import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = join(root, "test-results/ha-dev/custom_components/cabane");
const integrationCommit = "1a050ae19260f4f82995544c56029ffb419decf9";
const action = process.argv[2];
const sourceIndex = process.argv.indexOf("--integration-source");
const localSource = sourceIndex === -1 ? null : process.argv[sourceIndex + 1];
if (
  sourceIndex !== -1 &&
  (!localSource || !existsSync(join(localSource, "custom_components/cabane/__init__.py")))
)
  throw new Error("--integration-source must name a Cabane integration checkout.");
if (!["up", "refresh"].includes(action)) throw new Error("Expected up or refresh");
const run = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: root, stdio: "inherit", ...options });
const compose = (...args) =>
  run("docker", ["compose", "-f", "dev/home-assistant/compose.yaml", ...args]);
// Check Docker before downloading or building anything.
compose("config", "--quiet");
run("docker", ["info", "--format", "{{.ServerVersion}}"]);
if (action === "refresh" || !existsSync(join(target, "frontend/manifest.json"))) {
  const staging = await mkdtemp(join(tmpdir(), "cabane-ha-dev-"));
  try {
    const source = join(staging, "integration");
    if (localSource) {
      await cp(join(localSource, "custom_components"), join(source, "custom_components"), {
        recursive: true,
      });
    } else {
      run("git", ["init", source]);
      run("git", [
        "-C",
        source,
        "fetch",
        "--depth",
        "1",
        "https://github.com/cabane-app/cabane-home-assistant.git",
        integrationCommit,
      ]);
      run("git", ["-C", source, "checkout", "--detach", "FETCH_HEAD"]);
    }
    run(process.execPath, ["scripts/build-panel.mjs"], {
      env: { ...process.env, CABANE_PANEL_ALLOW_DIRTY: "1" },
    });
    const component = join(source, "custom_components/cabane");
    // The pinned upstream release gate stays intact everywhere except this
    // disposable local installation, with an explicit container-only opt-in.
    const bundlePath = join(component, "bundle.py");
    const bundle = await readFile(bundlePath, "utf8");
    const gate = 'if manifest.get("development"):';
    if (bundle.split(gate).length !== 2)
      throw new Error("Upstream development gate changed; review the local adapter.");
    await writeFile(
      bundlePath,
      "import os\n" +
        bundle.replace(
          gate,
          'if manifest.get("development") and os.environ.get("CABANE_LOCAL_DEVELOPMENT") != "1":',
        ),
    );
    await rm(join(component, "frontend"), { recursive: true, force: true });
    await cp(join(root, "apps/web/dist-panel"), join(component, "frontend"), { recursive: true });
    // Build first, then stop HA before changing its static asset directory.
    compose("stop", "homeassistant");
    await mkdir(join(target, ".."), { recursive: true });
    await rm(target, { recursive: true, force: true });
    await cp(component, target, { recursive: true });
    await writeFile(
      join(root, "test-results/ha-dev/integration-revision.txt"),
      (localSource ? "local-source" : integrationCommit) + "\n",
    );
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
compose("up", "-d", "--wait", "--wait-timeout", "360");
console.log(
  "Local Cabane panel: http://127.0.0.1:8123/cabane — reload the browser after rebuilding.",
);
