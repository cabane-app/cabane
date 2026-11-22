import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  contractFingerprint,
  validateContractRelease,
} from "../scripts/ha-contract/source-contract.mjs";
import { portableContract } from "../scripts/ha-contract/compatibility-manifest.mjs";
import {
  integrationReleasePlan,
  contractRequiresRelease,
} from "../scripts/ha-contract/release-plan.mjs";

test("explicit compatibility detects portable fields but excludes runtime and catalog edits", () => {
  const root = mkdtempSync(join(tmpdir(), "cabane-contract-"));
  const entries = { project: ["types.ts", "Project"], record: ["types.ts", "WorkspaceRecord"] };
  const source =
    'import { models } from "./catalog"; import { intensity } from "./renderer"; export interface Project { id: string; kind: "wall" | "door"; modelId: string; } export interface WorkspaceRecord { draft: Project; published: Project; revision: number; }';
  try {
    mkdirSync(join(root, "docs"));
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true, types: [] } }),
    );
    writeFileSync(join(root, "types.ts"), source);
    writeFileSync(join(root, "renderer.ts"), "export const intensity = 1;");
    writeFileSync(join(root, "catalog.ts"), 'export const models = ["old-device"];');
    const manifest = {
      manifestVersion: 1,
      formats: { project: { version: 2 } },
      semantics: { validationRevision: 1 },
      portableTypes: portableContract(root, entries),
    };
    const save = () =>
      writeFileSync(join(root, "docs/ha-compatibility.json"), JSON.stringify(manifest));
    save();
    const before = contractFingerprint(root, entries);
    assert.deepEqual(before.sources, ["docs/ha-compatibility.json"]);
    writeFileSync(join(root, "renderer.ts"), "export const intensity = 1;");
    writeFileSync(join(root, "catalog.ts"), 'export const models = ["new-device"];');
    writeFileSync(
      join(root, "types.ts"),
      "// Cosmetic comment\n" +
        source.replace('id: string; kind: "wall" | "door";', 'kind: "door" | "wall"; id: string;'),
    );
    assert.equal(contractFingerprint(root, entries).fingerprint, before.fingerprint);
    rmSync(join(root, "catalog.ts"));
    writeFileSync(join(root, "renderer.ts"), "export const intensity = 99;");
    assert.equal(contractFingerprint(root, entries).fingerprint, before.fingerprint);
    writeFileSync(
      join(root, "types.ts"),
      source.replace("id: string;", "id: string; edgeColor?: string;"),
    );
    assert.throws(() => contractFingerprint(root, entries), /Portable fields changed/);
    manifest.portableTypes = portableContract(root, entries);
    save();
    const after = contractFingerprint(root, entries).fingerprint;
    assert.notEqual(after, before.fingerprint);
    assert.throws(
      () => validateContractRelease({ revision: 1, fingerprint: before.fingerprint }, after),
      /Persisted contract changed/,
    );
    assert.throws(
      () =>
        validateContractRelease(
          { revision: 2, fingerprint: after, summary: "", breakingChanges: [] },
          after,
        ),
      /compatibility impact/,
    );
    validateContractRelease(
      {
        revision: 2,
        fingerprint: after,
        summary: "Wall colors",
        breakingChanges: ["Update older panels."],
      },
      after,
    );
    manifest.semantics.validationRevision++;
    save();
    assert.notEqual(contractFingerprint(root, entries).fingerprint, after);
    writeFileSync(join(root, "types.ts"), source.replace("draft: Project;", "draft: string;"));
    assert.throws(() => contractFingerprint(root, entries), /Portable fields changed/);
    writeFileSync(join(root, "types.ts"), source.replace("id: string;", "id: number;"));
    assert.throws(() => contractFingerprint(root, entries), /Portable fields changed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("switching detectors establishes a baseline without publishing cosmetic releases", () => {
  const previous = { revision: 7, fingerprint: "old-tree" };
  const release = {
    revision: 7,
    fingerprint: "explicit",
    baseline: { ...previous, compatibilityFingerprint: "explicit" },
  };
  assert.equal(contractRequiresRelease(previous, release), false);
  assert.equal(integrationReleasePlan("0.3.10", previous, release), null);
  assert.equal(
    contractRequiresRelease(previous, { ...release, fingerprint: "changed-without-bump" }),
    true,
  );
  assert.equal(contractRequiresRelease({ ...previous, fingerprint: "unrelated" }, release), true);
  assert.equal(
    contractRequiresRelease(previous, { ...release, revision: 8, fingerprint: "changed-fields" }),
    true,
  );
  assert.equal(contractRequiresRelease(undefined, release), true);
});

test("patch releases are idempotent, reject downgrades and retain intervening upgrade notes", () => {
  const release = {
    revision: 3,
    fingerprint: "new",
    summary: "Wall colors",
    breakingChanges: ["Update to retain edgeColor."],
    history: [
      { revision: 2, summary: "Platforms", breakingChanges: ["Update before loading platforms."] },
    ],
  };
  const plan = integrationReleasePlan("0.3.4", { revision: 1, fingerprint: "old" }, release);
  assert.equal(plan.tag, "v0.3.5");
  assert.match(plan.notes, /Platforms/);
  assert.match(plan.notes, /Wall colors/);
  assert.match(plan.notes, /HACS/);
  assert.match(plan.notes, /restart Home Assistant/);
  assert.equal(integrationReleasePlan("0.3.5", release, release), null);
  assert.throws(
    () => integrationReleasePlan("0.3.6", { revision: 4, fingerprint: "future" }, release),
    /newer integration contract/,
  );
  assert.throws(
    () => integrationReleasePlan("0.3.5-beta", undefined, release),
    /stable integration version/,
  );
});

test("the weekly panel release uses shipped file hashes and keeps the current contract", () => {
  const contract = { revision: 3, fingerprint: "current", summary: "Wall colors" };
  const previous = { source_commit: "a".repeat(40), files: { "cabane-panel.js": "old" } };
  const current = { source_commit: "b".repeat(40), files: { "cabane-panel.js": "new" } };

  assert.equal(
    integrationReleasePlan("0.3.5", contract, contract, {
      previous,
      current: { ...current, files: { ...previous.files } },
    }),
    null,
  );
  assert.equal(integrationReleasePlan("0.3.5", contract, contract), null);

  const plan = integrationReleasePlan("0.3.5", contract, contract, { previous, current });
  assert.equal(plan.tag, "v0.3.6");
  assert.equal(plan.contractChanged, false);
  assert.match(plan.notes, /Workspace contract revision 3 is unchanged/);
  assert.ok(plan.notes.includes(`${previous.source_commit}...${current.source_commit}`));
  assert.throws(
    () =>
      integrationReleasePlan("0.3.5", { ...contract, revision: 4 }, contract, {
        previous,
        current,
      }),
    /newer integration contract/,
  );
});
