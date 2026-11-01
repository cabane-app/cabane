# Verification, delivery, and known limits

Follow [the test guidelines](../test-guidelines.md) when changing coverage or test tooling.

The persisted contract is explicitly defined by `docs/ha-compatibility.json`,
with release revisions in `docs/ha-contract.json`, and checked by
`verify:ha-contract` inside `verify:fast`. Portable field/type changes require a reviewed manifest snapshot; compatibility
changes require a revision and upgrade notes. Rendering/UI and catalog model
additions/deletions do not trigger automatic releases. Behavioral validation and
migration changes require an explicit semantic revision. The GitHub `Home Assistant contract release` workflow checks
PRs and pushes, then publishes a verified matching integration patch release once
daily at 23:00 Europe/Paris when contract changes are pending, using its scoped
deploy key. An explicit manual dispatch on main can publish an urgent release.
See [contract releases](../ha-contract-releases.md)
for the source coverage, Codex reminder hook, credential and retry behavior.

The root package defines the executable checks. Run `npm run verify:fast` for
Prettier, typed ESLint with React Hooks rules, strict TypeScript, Knip, and
package-boundary checks. Rendering and asset ownership conventions are reviewed
against [coding standards](../../CODING_STANDARDS.md#rendering-and-asset-ownership).
`npm run verify` also runs all tests,
furnishing-surface checks, and the production build. The contract-release workflow
builds and publishes the matching panel. The `Verification` GitHub workflow runs
the full gate on pull requests and pushes to main. Local verification depends on
the [repository workflow](../../AGENTS.md#workflow). CI uses pinned tooling and synthetic local fixtures without
household credentials. Configure the `Verify` check and maintainer review as
required branch rules when the public repository is created; a workflow file
alone does not enforce merge protection.

Standalone and native panel distributions include the Cabane licence,
project third-party notices, and licences for bundled dependencies and CSS-loaded
fonts. See [publication](../publication.md) for the import and release boundaries.

`npm ci` installs the tracked `.githooks/pre-push` hook through `prepare` (CI and
source archives skip installation). The hook only requires a clean checkout
matching the pushed commit; it launches no tests or builds. Deletion-only pushes
skip these checkout checks. Choose and run local checks before committing according
to the task; a push does not trigger another verification run. Existing custom hook configurations
are preserved and must be integrated explicitly. Linked worktrees share the Git
configuration; each checkout must contain the tracked hooks. Git hooks are local
and can be bypassed, so this is a developer guardrail, not server enforcement.

For Codex execution, full verification, focused domain verification, and browser tests
require localhost listening and Chromium child processes. Pushes require network
and Git write access. In a restricted session, request approved execution for the complete
command from the first invocation (`sandbox_permissions: "require_escalated"`
when that tool option is available). Keep ordinary reads and edits sandboxed.
Use the existing Verify local-environment action for a user-run terminal check.
Do not retry the browser suite in the same denied execution mode or treat an
infrastructure failure as a product regression. Shell children inherit their
parent's restrictions; changing a Node flag cannot grant OS permissions.

Before starting the full/browser test shards, the runner checks localhost binding
and pinned Chromium launch once. Restricted agent environments need approved
local-server and browser-process permissions; a failed preflight stops before
shards start. Unit-only runs do not need these capabilities.

Vercel Git deployments are enabled only for `main` in `vercel.json`. Branch and
pull-request previews are disabled; GitHub verification still runs on PRs.

## Choose local verification

Local check selection and result reuse follow [AGENTS.md](../../AGENTS.md#workflow).
This document describes available commands and their execution requirements.

`npm run verify:help` lists the maintained domain groups. These optional broader
checks include the static gate and their Node and browser tests. Individual test
files are available for smaller changes. When adding
or renaming tests, maintain `tests/verification-groups.json`: unclassified tests
conservatively trigger the full suite, and stale entries fail visibly.

## Toolchain and test execution

Node 24.11.1 and npm 11.6.2 are the pinned local baseline. The `engines` and
`devEngines` checks accept Node `>=24.11.1 <25` and npm `>=11.6.2 <12`, so managed
hosts can install security updates within those major versions. Do not enforce an
exact patch version through `devEngines`: Vercel selects the Node major and updates
its minor/patch version independently of the local pins. Install with `npm ci`, then
`npm run browser:install` to install Playwright's matching Chromium build; tests
use modern headless Chromium rather than an independently updated system browser.
Linux environments without browser libraries can use
`npm run browser:install -- --with-deps`. Reinstall the browser after Playwright upgrades.
The Verification job pins GitHub's Ubuntu 24.04 image, which already includes
Chrome's system libraries, and installs only the matching Playwright browser.
It avoids per-job apt/font downloads. Missing libraries still fail the browser
preflight before any shard starts.

Dependency changes also require a clean `npm ci` with the managed host's npm version.
Keep required peer dependencies of optional platform packages in the portable
lockfile, even when the local platform does not install those packages. The
lockfile regression check covers these references; a successful build against
existing `node_modules` does not establish clean-install compatibility.

The application checker uses native TypeScript 7 (`typescript-native` alias).
Typed ESLint uses the TypeScript 6 compiler API, which typescript-eslint currently
supports. Both versions are locked; remove the alias when the lint ecosystem
supports the native compiler API. Strict checks include exact optional properties,
explicit overrides, complete return paths, and switch fallthrough protection.
`noUncheckedIndexedAccess` remains a separate migration; geometry algorithms need
real length invariants, not blanket non-null assertions.

Panel-capable web and engine UI use `useCabaneDom().root` for focus and
`useCabaneDom().events` for application input listeners. The `cabane/panel-dom`
ESLint rule rejects direct global document focus and global input listeners,
including computed property access. Host bootstrapping is exempt. Browser-wide
lifecycle notifications (such as resize, visibility and pointer lock) retain their
global targets; explicitly injected local targets remain supported.

Knip tracks the workspace exports and Vite harness imports as entry points.
Keep those entry points explicit when adding runtime-loaded modules. The engine's
Roboto font dependency is retained because CSS imports are outside this analysis.

The test command runs four cost-balanced shards with shared harness modules and a
compact agent reporter per worker. Under `CI=true`, one shard owns all Chromium
cases and Node/DOM files use the other three. Unit-only selections use all four.
Local runs keep parallel browser shards for hardware-accelerated graphics.
The launcher keeps four independent worker
processes so Node cannot buffer a later shard's failures behind an earlier shard.
Set `CABANE_TEST_CONCURRENCY` to an integer from 1 to 4 to limit simultaneous
workers on constrained local machines. All four
shards still run, with identical tests and assertions. `npm test` always includes both Node and Chromium coverage.
Hosted CI runs one shard at a time. Browser files still share one worker and its
Vite/Chromium processes; concurrent cold Node/DOM setup can starve browser startup
on software graphics. It retains the test report and
any browser failure screenshots, traces and errors as `verification-diagnostics`
artifacts for seven days.
Set `CABANE_TEST_PROGRESS=1` to print each starting test when diagnosing slow work.
`npm run test:unit` runs the Node/DOM tests without Chromium or listening HTTP servers;
`npm run test:browser` runs the browser journeys. Individual files remain available
through `node --no-experimental-global-navigator --test tests/<name>.test.mjs`.
The flag lets older JSDOM fixtures install their own navigator, as the shard
runner does. Set `TEST_PROFILE=1` to report slow tests. For repeatable measurements use
`npm run test:profile -- --runs 3 --output test-results/baseline.json`, then repeat
with a different output path and `--baseline test-results/baseline.json`. Reports
include median wall time, per-file mean cost, every original test name/status,
worker durations, concurrency and Node/platform metadata. Set `CI=true` to profile
the hosted browser-isolation schedule locally. Comparison refuses
failed runs or changed test inventories/statuses; intentional test migrations need
an explicit coverage review rather than a like-for-like speed claim. Run benchmarks
without other verification or development work competing for CPU. The profiler
stops on failure and preserves the failed report; it never retries a failed test.
For one run of any normal or focused command, set `CABANE_TEST_REPORT` to a JSON
output path. `tests/test-costs.json` contains reviewed scheduling weights; use the
profile's per-file costs to refresh it after a major suite change. Unknown files
retain deterministic source-size weights and are never dropped. Failures are printed as soon
as Node emits completion, including the original test/file, error and a shell-safe
focused rerun command; successful tests remain dots. Failure output retains the complete wrapper error
and its cause, including exit codes and signals. Worker failures name the last
started test when available. JSON worker reports retain the failure diagnostics;
the launcher also reports and records each worker's exit code and signal.

Storage, migration, restore, native startup states, and HA settings/sync cases run against the real
repository and React components in Node, with an isolated `fake-indexeddb` factory
per scenario. DOM checks wait for state or transaction completion; asynchronous browser storage
reads use `tests/async-condition.mjs`, since the pinned Playwright `waitForFunction`
treats a returned Promise as truthy before its result is available; sync tests drive
interval callbacks explicitly. Keep Chromium for browser-specific behavior: real
IndexedDB through the application, minimal file imports, selected responsive editor
controls, and representative rendered scenes. Browser-specific coverage is selective,
not a requirement to exercise every feature in Chromium.

Browser tests reuse Vite and Chromium within each shard, with fresh browser contexts
for each test/session and teardown even after failure. Each Vite browser server
owns a temporary dependency cache; it cannot race another shard or the development
server over optimized modules. File watchers are disabled in test servers. New
browser tests should use `tests/browser-test-environment.mjs`; the runner detects
that import (or a direct Playwright import) when selecting `test:browser`.
Wrap browser test callbacks in `withBrowserDiagnostics` from
`tests/browser-test-diagnostics.mjs`. It retains session contexts until the callback
finishes, captures failures before teardown, and always closes contexts. Keep the
original `node:test` registration so failures identify the correct source file.
Failure artifacts are saved under ignored `test-results/browser/<test>-<unique>/`:
per-page screenshots, per-context Playwright traces, and `errors.json` with recent
console warnings/errors and uncaught page errors. The reporter prints the absolute
artifact directory. Successful traces are discarded; failure evidence stays local
until removed. A manually closed page/context cannot be captured afterward. Open a
trace with `npx playwright-core show-trace <path-to-trace.zip>`.

GLB import starts from the library, avoiding an unrelated villa render. The
representative personal-model scene retains 20 rooms and 100 bindings in a smaller
viewport. Gun input waits for pointer lock and the Walk toolbar before equipping;
shader checks wait for rendered pulse/impact completion rather than 45 frames.
Gun fixtures keep a 240-by-180 scene canvas inside the desktop UI so software
graphics exercise the same shaders and normal input without a full-window pixel
workload. HA settings boundaries and receiving-link routing run in Node/DOM with
the real components and isolated IndexedDB. The browser keeps backup file/download
wiring and native first-launch persistence. The floor-menu browser smoke checks
the actual component's CSS overflow and native focus in a narrow viewport; floor
editing, deletion constraints, persistence and undo remain in Node/DOM.

The optional portal gun has exactly one Chromium smoke: enter Walk, equip the
installed gun and create a visible portal. Placement, targeting, traversal at
multiple frame rates, persistence, restore failures, closing and reduced-motion
behavior remain in `gun-portals`, `portal-persistence`, `portal-transition` and
`portal-view` Node tests. Full mobile travel and pixel-readback portal journeys are
intentionally no longer part of the automatic gate; visual review remains separate.
Standalone startup's zero/one/multiple-home and invalid OAuth identity matrices
also run against the real React application and isolated IndexedDB in Node. The
standalone navigation/reload/OAuth browser journey has been removed.

Home-specific commands include `home:validate-floor`, `home:verify`, and layout,
room, and scale fixture verification. Fixtures exercise a representative target
of about 20 rooms and 100 bindings. There are rendering, geometry, editor,
persistence/conflict, mapping, command, camera, and dashboard tests. A passing
fixture is evidence for that scenario, not proof of household runtime acceptance.

Normal UI evidence capture is available for architecture, furnished rooms, walk
mode, and fixtures. Manual visual review remains distinct from type checking and
unit tests. Responsive controls, reduced-motion handling, and automated DOM/scene
checks exist; final cross-browser and comprehensive accessibility acceptance are
not established by their presence alone.

`npm run measure:scene` measures main-canvas draw calls and submitted triangles
for the bundled home's default Orbit, Walk, Construct, and 3D Arrange views in
an isolated Chromium session. JSON reports include steady samples, a forced shadow
refresh, and optional baseline comparisons. The opt-in `--check` gate requires
each measured peak to stay below 50 calls and 100,000 triangles; it is separate
from `verify`. These viewpoint-specific counts do not establish an FPS target or
a whole-building worst case. See the [README measurement instructions](../../README.md#measure-scene-rendering-performance).

`npm run dev` starts Vite on loopback port 4173. Production builds produce
`apps/web/dist`. The repository includes a Vercel configuration with SPA rewrites.
The [local HA test stack](../local-home-assistant.md) provides a loopback-only
Docker Compose server with official demo entities and persistent test data.
It installs a pinned Cabane companion integration with the current local panel
for native hosting and sync. `ha:refresh` rebuilds and restarts the test instance;
a container-only adapter accepts development-marked bundles without changing
release validation. A build or hosting
configuration does not prove a deployed service, secured private access, or a
working network route from every client to HA.

The native panel has a separate build: `npm run build:panel` produces
`apps/web/dist-panel/cabane-panel.js`, scoped CSS, local assets, license notices,
and `manifest.json` with the source commit and SHA-256 file inventory. Release
builds require a clean committed tree. `CABANE_PANEL_ALLOW_DIRTY=1` permits local
development builds and marks the manifest as development-only.

After building, `node scripts/verify-panel.mjs` serves the production artifact
under a nested local asset path and opens a synthetic Home Assistant host in
Chromium (`CHROME_PATH` can override the executable). It exercises the real
workspace/editor UI, host-session selection, HA import/storage, reconnect and
detach behavior, and local asset loading while retaining the host URL. The only
external asset allowed is the documented, commit-pinned weather cloud texture
and its matching CDN redirect; all other external requests remain errors. The browser
fixture uses HA's auto-height wrapper with safe-area padding and verifies
content bounds beside the sidebar at desktop, portrait and landscape sizes.
Set `CABANE_PANEL_BUNDLE` to verify an extracted release's frontend directory
instead of the local build. Unit and browser regressions additionally cover
origin mismatch, demo isolation, stale
connection work, token-storage traps, and standalone migration compatibility.
These fixtures use fake HA data and do not establish live household acceptance
or deploy the artifact to Home Assistant.

Uncompleted acceptance/deployment concerns remain explicit:

- Household binding completeness and real-device/camera acceptance require an
  owner's authenticated runtime review.
- Private deployment/network hardening and container delivery are not completed
  product features.
- Cabane-hosted workspace synchronization and a shared account
  backend are not implemented.
- Browser-local authoring does not update Git. Optional HA synchronization can
  transfer saved workspaces and personal assets between authenticated clients.

Implementation: [commands](../../package.json),
[test harness](../../tests/test-server.mjs),
[home verifier](../../scripts/verify-home.mjs),
[bundle report](../../scripts/verify-bundle-budget.mjs),
[hosting configuration](../../vercel.json).

[Back to product overview](../../PRODUCT_SPEC.md).

`node scripts/verify-multiple-floor-ui.mjs` checks upper-floor paint persistence
and visible patterns, Explore with mandatory pointer lock, keyboard movement, mouse
look, and return to Construct using an isolated synthetic building.

`node scripts/verify-ha-shortcuts.mjs` exercises the normal Shortcuts editor and
Home action bar against a synthetic runtime: scene/script mapping, unavailable
choices, history, Save, pending and failed commands, disconnection, mobile
overflow, and IndexedDB reload. It makes no household service calls. Screenshots
are written to `/tmp/cabane-ha-shortcuts` by default (`CABANE_SHORTCUT_EVIDENCE`
overrides the destination).

Personal GLB coverage uses `tests/personal-models.test.mjs`,
`tests/personal-models-browser.test.mjs`, and `tests/ha-model-assets.test.mjs`.
One normal Arrange browser smoke imports a textured GLB into My models. A separate scene check retains
20 rooms, 100 simulated bindings and shared textured resources. Node tests cover
Blender/Three.js skill exports, material/format validation, support normalization,
elevation/resize history transactions, resource lifetimes and archive integrity.
The generation guide runs in DOM tests, including unavailable/rejected clipboard
handling and focus restoration. Installation and
generation are verified independently in the public skill repository. Storage
fixtures exercise missing/corrupt files, transaction failures, deduplication,
interruptions, origin/session isolation, old integrations, and two-client revision
conflicts. Companion integration tests cover authenticated blocks, integrity,
reference checks, and delayed cleanup. These checks use synthetic data and do not
contact household devices. Cabane and the integration must be delivered together;
publishing and deployment remain separate actions.

The wall-normalized GLB regression checks the reported negative surface gap
through composition and legacy manifest validation. Placement bounds, refused
edits, and Issues repair/removal run in Node/DOM tests with real project
validation and workspace history. Removal checks draft mapping cleanup and
preservation of published mappings. These fixtures do not establish acceptance
of the reporter's original GLB or live HA workspace.

Browser coverage omits journeys for model-pack
replacement, reference-plan tracing, six weather previews, standalone navigation and
OAuth, north/solar preview, rug dimensions, room-control reordering, and imported
basement viewing/walking. GLB import no longer includes publication, reload, gestures
or archive transfer. Existing Node/DOM suites retain schema, repository, model-pack,
archive, reference-plan, weather and startup behavior; they do not establish equivalent
end-to-end UI coverage. No replacement browser journeys or duplicate unit matrices
are added. The floor-menu smoke and representative-scale GLB scene remain.

Wall face editing uses Node/DOM tests for labels, preview targeting, color edits,
reset and history, renderer tests for face colors, and isolated IndexedDB tests for
publication and reopening. The coordinate-driven wall-color browser journey is
removed; pointer picking and rendered highlight appearance remain manual review.

### Coplanar surface checks

`verify:furnishing-surfaces` runs during `verify`. Run it locally for changes to
furnishing/device geometry or surface layering; CI includes it in the full gate.
It checks every furnishing variant (including retired entries)
and every device variant in active, inactive, unavailable, and disconnected
states. Devices without layered artwork are included automatically. The checker
also validates declared layers even when their material settings are invalid.
Geometry inspection runs offline and adds no production frame work.

Pass model IDs to audit specific devices/furnishings; `--all-devices` remains a
compatibility alias for the default full scan. Diagnostics name the model, state,
surface, plane, and overlapping area. Shared-edge fixtures and known bad
synthetic meshes protect the detector from false positives and missed duplicate
faces. The gate samples static reduced-motion poses; it does not prove all
animation poses, near-coplanar depth precision, or shader stability. The separate
orbit-rendering test guards the toon-gradient camera regression.

Legacy device displays, grilles, controls, and cover hardware use physically
separated front faces. Backing shells are recessed within their existing placement
envelopes; the camera HUD status ring sits ahead of its reticle. Do not restore
flush overlapping faces to recover nominal casing thickness.
