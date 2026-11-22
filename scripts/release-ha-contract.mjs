import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { integrationReleasePlan } from "./ha-contract/release-plan.mjs";
import { contractFingerprint, validateContractRelease } from "./ha-contract/source-contract.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const integration = resolve(process.argv[2] ?? "");
if (!process.argv[2])
  throw new Error(
    "Usage: node scripts/release-ha-contract.mjs INTEGRATION_CHECKOUT [--weekly] [--push] [--skip-tests]",
  );
const run = (command, args, cwd = integration) =>
  execFileSync(command, args, { cwd, stdio: "inherit" });
const git = (...args) => execFileSync("git", args, { cwd: integration, encoding: "utf8" }).trim();
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const release = json(resolve(root, "docs/ha-contract.json"));
validateContractRelease(release, contractFingerprint(root).fingerprint);
const artifact = json(resolve(root, "apps/web/dist-panel/manifest.json"));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (
  artifact.development ||
  artifact.source_commit !== sourceCommit ||
  artifact.workspace_contract?.fingerprint !== release.fingerprint
)
  throw new Error("Build a clean panel from this exact contract and source commit first.");
if (git("status", "--porcelain")) throw new Error("Use a clean integration checkout.");
if (git("branch", "--show-current") !== "main")
  throw new Error("Release from the integration main branch.");
if (
  !/^(?:git@github\.com:|https:\/\/github\.com\/)cabane-app\/cabane-home-assistant(?:\.git)?$/.test(
    git("remote", "get-url", "origin"),
  )
)
  throw new Error("The release target must be cabane-app/cabane-home-assistant.");
const manifestPath = resolve(integration, "custom_components/cabane/manifest.json");
const manifest = json(manifestPath);
const prior = json(resolve(integration, "custom_components/cabane/frontend/manifest.json"));
const weeklyPanel = process.argv.includes("--weekly")
  ? { previous: prior, current: artifact }
  : undefined;
const plan = integrationReleasePlan(
  manifest.version,
  prior.workspace_contract,
  release,
  weeklyPanel,
);
if (!plan) {
  if (process.env.GITHUB_OUTPUT)
    writeFileSync(process.env.GITHUB_OUTPUT, `tag=v${manifest.version}\n`, { flag: "a" });
  console.log("The integration already contains the requested update.");
  process.exit(0);
}
if (process.env.GITHUB_OUTPUT)
  writeFileSync(process.env.GITHUB_OUTPUT, `tag=${plan.tag}\n`, { flag: "a" });
run("python3", ["scripts/vendor_frontend.py", resolve(root, "apps/web/dist-panel")]);
writeFileSync(manifestPath, JSON.stringify({ ...manifest, version: plan.version }, null, 2) + "\n");
mkdirSync(resolve(integration, "docs/releases"), { recursive: true });
writeFileSync(resolve(integration, `docs/releases/${plan.tag}.md`), plan.notes);
if (!process.argv.includes("--skip-tests")) {
  run("python3", ["-m", "unittest", "discover", "-s", "tests", "-v"]);
  run("node", ["scripts/verify_workspace_import.mjs", root]);
}
run("python3", ["scripts/package_release.py", "--version", plan.tag]);
if (!process.argv.includes("--push")) {
  console.log(
    `Prepared ${plan.tag}. Review the integration diff. No commit, push or release was made.`,
  );
  process.exit(0);
}
run("git", [
  "add",
  "custom_components/cabane/frontend",
  "custom_components/cabane/manifest.json",
  `docs/releases/${plan.tag}.md`,
]);
const releaseSubject = plan.contractChanged
  ? `workspace contract ${release.revision}`
  : "app updates";
run("git", ["commit", "-m", `Release ${plan.tag} for ${releaseSubject}`]);
run("git", ["tag", "-a", plan.tag, "-m", `Cabane ${releaseSubject}`]);
// A concurrent maintainer push rejects atomically. Rerun from a fresh checkout.
run("git", ["push", "--atomic", "origin", "HEAD:main", `refs/tags/${plan.tag}`]);
console.log(`Pushed ${plan.tag}; the integration release workflow packages and publishes it.`);
