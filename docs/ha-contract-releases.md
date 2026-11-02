# Home Assistant contract releases

`docs/ha-compatibility.json` is the explicit compatibility manifest. It records
portable project/record/binding field shapes, types and enums, supported format
versions, archive paths, and semantic revisions for validation and migrations.
Only this manifest is fingerprinted. The gate resolves the portable TypeScript
interfaces and rejects stale field snapshots, without hashing runtime functions,
rendering implementations, catalog registrations or model/variant IDs.

Cosmetic edits (geometry, lighting, animations and UI) and catalog additions or
deletions do not trigger automatic HA releases. Catalog lifecycle compatibility
will be handled separately. Unknown saved fields remain blocked.

For parser, migration or archive behavior changes that alter compatibility
without changing a TypeScript field, explicitly bump the corresponding
`semantics` revision. Review format-version/path changes in `formats` as well.
The type snapshot guard checks field/type/enum changes; it does not infer arbitrary
validation semantics or migration behavior from executable code.

For a changed fingerprint, record the change before completing the task:

```sh
npm run contract:record -- --summary "Describe the contract change" --breaking-change "Explain which older clients need an update and why"
```

The record command refreshes portable field snapshots in `docs/ha-compatibility.json`
and bumps the release revision in `docs/ha-contract.json`. Review both files and
the cumulative compatibility notes.
Run the affected checks and the full product verification gate locally. Commit both
manifests with the implementation. A PR validates the fingerprint and notes;
publication runs once daily at 23:00 Europe/Paris from `main`, or through an
explicit manual workflow dispatch on `main` for an urgent release. The schedule
follows daylight saving time; GitHub Actions may start it later when runners are
busy. Pushes and PRs validate the contract without publishing. The daily run
combines all pending contract revisions into one patch release and skips
publication when the integration already has the current contract.
Keep incompatible imports blocked. Never strip unknown data to make them load.

Full producer, panel and integration tests run locally before pushing a contract
change. The separate Verification workflow also runs the full producer gate on
pull requests and main. The contract-release workflow validates the contract, builds and packages the clean native
panel, adds the contract revision to its artifact metadata, and checks out the
integration with a repository-scoped SSH deploy key. It advances the integration
patch version, vendors the complete bundle, commits upgrade notes under `docs/releases/`, and pushes the commit and
tag atomically. The integration's release workflow publishes releases carrying
these reviewed notes; ordinary manual tags retain their draft-release flow.
The producer then checks the public ZIP contains the expected contract.

The one-time baseline in the release manifest recognizes the previously shipped
dependency-tree fingerprint at the same revision, so switching detectors does
not itself publish a release. A subsequent compatibility revision cannot use that
exception.

The workflow serializes releases. A matching contract skips another bump. A
newer integration contract blocks a downgrade. A rejected concurrent push fails
without changing remote refs; rerun the producer workflow from a fresh checkout.
If a tag was pushed but publication failed, rerun the integration's failed
`Package release` workflow first, then rerun the producer workflow. The build is
not considered delivered while the public release is missing.

The producer repository needs `CABANE_INTEGRATION_DEPLOY_KEY`. Its public
key belongs to the integration repository's write-enabled deploy keys; the
private key belongs only to that Actions secret. This grants Git access to the
integration alone and does not copy a maintainer's personal GitHub token.

For a local preparation with the existing authenticated checkout:

```sh
npm run build:panel
npm run release:ha-contract -- /path/to/clean/cabane-home-assistant
```

This prepares and tests the integration diff without committing or pushing it.
After the required producer checks, `--push` also commits and pushes the main
update/tag, which starts the integration release workflow. Actions uses
`--skip-tests` because tests are a local delivery gate; it retains contract, clean
source provenance, package integrity and published ZIP checks.

`.codex/hooks.json` adds a Stop hook that continues the agent once when the
contract manifest is stale. Codex requires the user to review and trust the hook
definition in its hooks UI before it runs. This is a local reminder; GitHub
Actions and `verify:fast` enforce the same check independently. The hook does not
launch a separate chat, publish on a file save, or bypass a user pause/cancel.

Unknown project fields and newer schema versions remain errors. Their messages
explain that the copy may come from a newer Cabane, give HACS update/restart/reload
steps, and retain the precise unsupported field in the diagnostic. File imports,
HA imports, sync and local record recovery share these parser messages.
