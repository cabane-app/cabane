---
name: home-building-harness
description: Build and modify local test homes for Cabane editor coding sessions. Use proactively for editor feature development, bug reproduction and verification whenever a scene helps. Prefer this to workspace imports or UI-driven fixture setup. Owner-home authoring uses build-floor-layout or equip-room.
---

# Home-building harness

Prepare the smallest scene needed through the shared editor agent. The real app
owns validation, placement, undo and IndexedDB autosave. Commands need no extra
LLM call, HA pairing, workspace import or UI navigation.

## Fast path

1. **Reuse** a running fixture when useful. The session is checkout-local at
   `test-results/dev-agent/session.json`. Inspect only when current state matters.
2. **Start** from the repo root as a persistent process:
   `npm run agent:dev -- start --room 6x4`. This builds a validated room in metres
   and opens the saved draft with its camera fitted. Omit `--room` for a blank home;
   add `--headed` for interactive review. Use installed dependencies and pinned
   Node/npm. If Chromium is missing, run `npm run browser:install` once.
3. **Edit** directly, for example:

   ```sh
   node scripts/dev-agent.mjs request --method execute_action \
     --params '{"action":{"type":"add-item","modelId":"white-shell-dining-chair","at":[2,2]}}'
   node scripts/dev-agent.mjs validate
   ```

   Use `get_capabilities` for action inputs and `list_catalog` for model IDs.
   Creation results include `created.items`, `created.walls`, `created.rooms`, etc.
   Reuse those saved IDs instead of inspecting the whole workspace after each add.
   For several changes, write a JSON array of `{method, params}` requests and use
   `node scripts/dev-agent.mjs batch --file test-results/dev-agent/changes.json`.
   Include `validate_draft` as the last request to check the result in the same call.
   Give a request `"as":"chair"`, then use
   `{"$ref":"chair.created.items.0"}` as a later action's `itemId`. References can
   also supply `expectedRevision`, room/wall IDs and arrays for grouping. They are
   scoped to one batch. A [worked example](../../../docs/product/agent-pilot.md#local-batches)
   shows creation and configuration together.

4. **Verify** rendering through commands:

   ```sh
   node scripts/dev-agent.mjs capture --item ITEM_ID
   node scripts/dev-agent.mjs frame --item ITEM_ID --view low-front
   ```

   `capture` fits the rendered bounds and saves front-right, back-left, top and low
   views as clean canvas PNGs plus a JSON manifest. Review the images. Use
   `--views front,right,back,left` or `--output DIRECTORY` when useful. For pools or
   other named geometry, use `--object pool-POOL_ID`; omit the target to frame the
   active floor. An item's floor is selected automatically. Capture restores the
   prior camera pose; `frame` leaves it ready for interactive review. The helper
   waits for tracked assets, deferred geometry and completed render frames.

   For UI checks, import
   `startDevAgent` from the absolute `scripts/dev-agent-server.mjs` path and call
   `await startDevAgent({room: "6x4"})` in a persistent Node REPL when available,
   or an ignored `.mjs` script. The returned `request(method, params)` and
   `batch(requests)` send commands directly, with the same compact results and
   references as the CLI. `frame(options)` and `capture(options)` provide the same
   camera workflow without page scripting. Use the returned `page` for UI checks
   and `close()` for cleanup. `screenshot` in the CLI also captures the
   same editor to an ignored PNG; review it for visual checks. Browser control is
   available when testing actual UI behavior. Fixture creation alone is not proof
   of the fix.

## Keep the loop small

Mutations return created IDs, revision and issue counts. Use `--full` only for their complete
inspection. `inspect` returns the project and generated IDs in `results[0]`.
Redirect large inspections/catalogs to ignored JSON and print relevant fields.
Use `expectedRevision` for state-dependent edits. Select a floor before editing it.
Batches run serially, up to 100 requests, and stop on the first error. Earlier edits
remain applied. After failure or timeout, inspect before repeating a mutation.
Startup requires permission to listen on loopback and launch Chromium. Use the
approved execution mode described in [verification](../../../docs/product/verification-and-delivery.md).

The isolated browser is disconnected from HA, and its storage differs from other
browsers opening the printed URL. HMR keeps the fixture available during code
changes. Drafts survive reloads within this session; stopping discards the home.
Use the explicit `publish-draft` action only when publication is part of the test.

Run `node scripts/dev-agent.mjs stop` when finished; leave it running when review
continues and report that. All commands accept `--session-file PATH` for separate
sessions. Remove a stale file only after verifying its runner is gone. Keep
fixtures, tokens and screenshots in ignored `test-results/` and preserve `home/src/`.

Transport details:
[`agent-pilot.md`](../../../docs/product/agent-pilot.md#local-development).
