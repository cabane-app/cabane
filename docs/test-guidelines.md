# Test guidelines

Read this before adding or changing tests, test infrastructure, or verification
commands. Command setup and required delivery gates live in
[verification and delivery](product/verification-and-delivery.md).

## Choose the cheapest meaningful check

- Prefer unit tests. Use Node/DOM integration tests for React behavior, routing,
  history, persistence, migrations, and error handling. Use the real repository
  with isolated fake IndexedDB when storage behavior matters.
- Inspect existing coverage first. Do not duplicate a behavior matrix in Chromium
  when Node already verifies it. Minor features generally need no browser test.
- Catalog presets use the existing shared geometry, registry, resizing, and surface
  checks. Add a preset-specific test only for a specific new behavior or a concrete
  behavioral regression. Adding a preset or variant, changing its appearance, or
  restating its metadata and dimensions does not justify a dedicated test.
- Reserve Chromium for a concrete browser-only risk, such as file-picker wiring,
  WebGL resource behavior, or native host integration. State that risk in the test.
  Keep one simple smoke per risk; avoid multi-feature journeys, repeated navigation,
  and combinations of import, edit, save, reload, export and recovery in one test.
- Preserve meaningful assertions and representative scale where relevant. Optimize
  expensive setup or geometry work without dropping boundary cases silently.
  Record intentional coverage removals in the PR; unit coverage is not equivalent
  to end-to-end browser coverage.

## Flaky-test review

Before repairing a flaky test, question its value, scope, and boundary. Compare its
assertions with existing coverage. Use judgment: delete low-value duplicates, move
behavior to unit/DOM tests, or retain a small browser case for a concrete browser-only
risk. Preserve meaningful behavior coverage and document intentional removals.
Diagnose timing or synchronization only after deciding that the test belongs there.

## Browser time budget

- Never introduce a browser test that takes more than **10 seconds**. Measure the
  complete case, including its setup and teardown, in a focused run; assess
  representative worker contention when relevant.
  Require every observed run to stay below the budget, with room for variation.
- Measure new or expanded browser coverage under its relevant workload. Use full-suite
  profiles when investigating contention or suite-wide performance. Set new browser
  cases' test timeout to at most `10_000` milliseconds as a
  backstop; a timeout alone is not measurement evidence.
- If a case exceeds the budget, simplify it or move assertions to Node. Do not split
  the same long journey into several browser tests merely to evade the limit, raise
  the timeout, or add retries. Existing slower cases are debt, not precedent; do
  not extend them. Report them separately when profiling.

## Reliable setup and waiting

- Reuse `browser-test-environment.mjs` and wrap cases in `withBrowserDiagnostics`.
  Share Vite/Chromium processes but isolate browser contexts and Node storage per
  case. Always tear down resources and retain failure diagnostics.
- Wait for the actual observable state or completed transaction, not arbitrary
  sleeps. Wait for the final route after redirects, not an intermediate URL.
- Never pass an async predicate to Playwright `waitForFunction`: the pinned version
  treats the returned Promise as truthy. Use `waitForAsyncCondition` around an
  awaited read, or a synchronous browser predicate. Propagate read errors.
- Seed only the minimal synthetic fixture needed. Keep screenshots and traces in
  ignored `test-results/`; routine tests must not rewrite tracked evidence.

## Measure and maintain the suite

- For suite-wide performance work, use
  `npm run test:profile -- --runs 3 --output test-results/profile.json`.
  Capture a baseline before changes and report median wall time, browser/Node case
  counts, and summed execution costs. Sum of test durations is not elapsed time.
- Compare on the same machine, runtime and worker count without competing work.
  Use `--baseline` only for matching inventories; disclose coverage changes and
  upstream additions rather than claiming a like-for-like speedup.
- Keep the existing four-worker shared harness. Increasing concurrency requires
  measured improvement without contention or reliability regressions.
- Update `verification-groups.json` when tests change and refresh `test-costs.json`
  after substantial cost changes. Preserve visible failures and all required
  static/build gates; never obtain speed by hiding failures, skips, or retries.
