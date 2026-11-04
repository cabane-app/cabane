# Connect LLM agent

An agent can inspect and edit the workspace open in Cabane's Home Assistant
panel. The Cabane integration relays commands to that editor over HA's existing
authenticated WebSocket connection. The editor remains the owner of the draft,
validation, history, browser storage and authenticated device connections.

Shipped agent pairing is available only in the HA panel. There is no localhost server,
browser-to-loopback request, CORS configuration or separate HA login for the agent.
The browser and agent may run on different devices that can reach the same HA.
Both the frontend and integration must include relay protocol version 3. An older
integration produces an update/reload message rather than falling back to localhost.

## Pairing and lifetime

From the panel's workspace menu, choose **Connect LLM agent**, then **Generate
pairing code**. The integration creates one in-memory session for that editor
connection and workspace. A code is valid for five minutes and can be used once:

```sh
npm run agent:pair -- --url https://your-home-assistant --code MCBN-CODE
```

Pairing returns a random Cabane token limited to this relay session. It is not a
Home Assistant access token and cannot call other HA endpoints or read the HA
workspace store. The CLI writes it to `~/.config/cabane/agent-session.json` with
owner-only permissions, and never prints it. Use `--session-file PATH` or
`CABANE_AGENT_SESSION` for separate sessions. Keep session files out of Git.

The panel displays when an agent pairs. Keep the editor open. Disconnecting from
the panel or CLI, closing/leaving the editor, losing its HA connection, or
replacing its session revokes the token and rejects pending requests. Reconnection
requires a new code. Sessions expire after eight hours; HA restarts discard all
sessions, codes and requests. Closing the pairing dialog alone keeps the session.

The HA-authenticated subscription is `cabane/agent/open`. Results return through
`cabane/agent/respond`, restricted to the owning WebSocket connection. The CLI
uses `/api/cabane/agent/{pair,request,status,disconnect}`. These HTTP endpoints
accept a one-use code for pairing and an `X-Cabane-Agent-Token` for subsequent
calls. Browser Origin headers are rejected. Requests have bounded sizes, queues
and lifetimes, and are never persisted or logged by the relay. Expired requests
are not retried automatically; an edit already accepted by the editor may still
finish, so inspect before repeating a timed-out mutation.

## Commands

```sh
npm run agent:request -- --method get_capabilities --pretty
npm run agent:request -- --method inspect_workspace --pretty
npm run agent:request -- --method execute_action \
  --params '{"action":{"type":"add-item","modelId":"kitchen-island"}}' --pretty
node apps/agent-cli/src/cli.mjs status
node apps/agent-cli/src/cli.mjs disconnect
```

`get_capabilities` describes each public action's domain and inputs. The other
read methods are `inspect_workspace`, `get_draft_diff`, `validate_draft`,
`list_catalog` and `list_binding_slots`. Inspection returns complete editable
geometry, scene items and publication diagnostics independent of the selected
tool. Connected entity candidates may appear in private results, never in
repository source or relay logs.

`execute_action` accepts an action and optional `expectedRevision`:

```json
{
  "action": {
    "type": "add-wall",
    "floorId": "floor-ground",
    "from": [0, 0],
    "to": [4, 0]
  },
  "expectedRevision": 12
}
```

The revision includes unsaved edits. Stale requests and edits while the editor is
busy or unsettled are rejected. Commands run serially, use shared UI actions and
flush accepted edits through ordinary workspace autosave. They decode wire input
without implementing parallel geometry, placement, model or mapping rules.
Successful creation results include `created`, with nonempty arrays of saved IDs
by kind: `floors`, `walls`, `rooms`, `openings`, `ceilings`, `hedges`, `pools`,
`outdoorPlatforms`, `floorZones`, `groundZones`, `stairs`, `items` and `groups`.
These describe identities newly present after the action, including duplicates
and derived rooms. Updates omit `created` when no identities were added.

Construct includes walls and invisible walls, openings and orientation, room
metadata/merges/finishes, floor zones, pools and platforms, floor duplication,
stairs, building/terrain settings and walk start points. Arrange includes atomic item and
multiple-item edits, groups, duplication/removal, placement repair, linked slots,
model metadata and lighting. File import/export and camera/tool gestures remain
UI operations. Mapping changes use the normal Connect helpers; room-area changes
that clear dependent slots require explicit `confirmClearedSlots: true` after
review. Save/publication and discard remain explicit commands.

## Ownership and verification

`apps/agent-cli/` handles pairing, a private session file and HTTP requests to HA.
`apps/web/src/agent-pilot/ha-agent-client.ts` owns subscription lifetime and serial
execution; `useAgentRelay.ts` binds it to the native host session. The existing
command executor and shared editor actions own all workspace behavior.

The integration's `agent_relay.py` owns ephemeral sessions and request futures;
`agent_transport.py` adapts authenticated HA subscriptions and scoped HTTP calls.
Tests cover pairing, scope, expiry, disconnect races, bounded requests, command
parity, history and persistence. The local HA stack accepts
`npm run ha:refresh -- --integration-source /path/to/integration-checkout` to test
matching frontend/backend changes without changing a household installation.

## Local development

Product development can use `npm run agent:dev -- start` to create a disposable
home without pairing, importing a workspace or driving editor controls. Add
`--room 6x4` to build and validate a starter room through four ordinary wall
commands. The
[`home-building-harness` skill](../../.agents/skills/home-building-harness/SKILL.md) describes
commands and fixture preparation. This is opt-in development tooling, separate
from the shipped HA relay. It requires the installed pinned Chromium.

The runner starts its own loopback Vite server and isolated Chromium context,
creates a blank workspace through `createWorkspaceRepository.createBlank`, then
opens the normal editor. Its development-only bridge calls `executeAgentRequest`
on that editor's controller. The bridge requires both a development build and
`VITE_CABANE_DEV_AGENT=1`, which the runner supplies to its own Vite instance.
Production builds omit the bridge. Ordinary `npm run dev` leaves it disabled.

The CLI's loopback HTTP endpoints require a random token held in an owner-only,
ignored session file. They reject browser Origin/fetch-metadata headers and
unexpected Host headers. There is no HA connection or household storage access.
Requests and batches execute one at a time. A batch stops on its first failure;
prior edits remain applied, and no mutation is retried automatically. Compact
mutation responses omit the repeated home inspection; explicit reads remain full.
Draft persistence, history and validation use the same editor owners as the HA
relay. Stopping removes the session file, browser context and Vite cache. It does
not retain the synthetic home across runner sessions. Screenshots and optional
headed interaction use the same isolated page, whose storage is separate from
other browsers. This workflow prepares fixtures; it does not replace checking
the actual feature or bug.

### Local batches

Batch requests may name a result with `as` and reference its compact fields from
later parameters using an object containing only `$ref`. Dot-separated paths
include array indices. Names must be unique within the batch and references must
point to an earlier request. Invalid names/references are checked before editing;
a missing result field stops execution at that request and preserves earlier edits.
References use compact results even with `--full`. They do not persist across batches.
This is a local development transport feature; HA requests use the returned IDs directly.

For example, save this JSON under ignored `test-results/dev-agent/changes.json`,
then run `node scripts/dev-agent.mjs batch --file test-results/dev-agent/changes.json`
in a running room:

```json
[
  {
    "method": "execute_action",
    "as": "bin",
    "params": { "action": { "type": "add-item", "modelId": "indoor-bin", "at": [2, 2] } }
  },
  {
    "method": "execute_action",
    "params": {
      "expectedRevision": { "$ref": "bin.draftRevision" },
      "action": {
        "type": "update-item",
        "itemId": { "$ref": "bin.created.items.0" },
        "patch": { "variant": "office", "color": "#728b99" }
      }
    }
  },
  { "method": "validate_draft" }
]
```

Scripts can use the same path without HTTP or browser-control boilerplate:

```js
import { startDevAgent } from "./scripts/dev-agent-server.mjs";

const runner = await startDevAgent({ room: "6x4" });
try {
  const added = await runner.request("execute_action", {
    action: { type: "add-item", modelId: "white-shell-dining-chair", at: [2, 2] },
  });
  console.log(added.created.items[0]);
  console.log(await runner.request("validate_draft"));
} finally {
  await runner.close();
}
```

`runner.batch(requests)` returns the result array and supports the same named
references. Both helpers accept `{full: true}` as their final options argument.
They serialize with CLI requests through the runner's busy check; a concurrent
request is rejected. Errors carry `completed` and `results` so callers can inspect
partial progress before deciding how to continue. The returned `page` remains
available for testing editor controls and rendered appearance.

### Local camera and capture

The dev runner can frame an item or save multiple rendered views without agent
browser control:

```sh
node scripts/dev-agent.mjs frame --item ITEM_ID --view front-right
node scripts/dev-agent.mjs capture --item ITEM_ID --views front-right,back-left,top,low-front
node scripts/dev-agent.mjs capture --object pool-POOL_ID --output test-results/pool-review
```

The equivalent script calls are `runner.frame({itemId, view: "front-right"})` and
`runner.capture({itemId})`. These operations select the item's floor, enter 3D
Arrange and clear the selection overlay. Omit the target for the active floor,
or pass `floorId` explicitly. `objectName` targets an existing named scene group,
including `pool-<id>`. Supplying an item on a different explicit floor is rejected.

Framing uses the target's rendered world bounds and the existing orthographic
camera/controls. Captures wait for tracked assets, geometry LOD preparation and
completed main-canvas frames after each camera change. Pixels are read from that
completed frame over the editor's background color, so PNGs exclude DOM overlays
and sidebars. This does not freeze
model animations or remove surrounding objects; review the images for occlusion,
appearance and angle-dependent defects.

The default capture views are `front-right`, `back-left`, `top` and `low-front`.
Other presets are `front`, `right`, `back`, `left`, `back-right` and `front-left`.
Angles refer to world axes: front looks from +Z, right from +X, and top from above.
Scripts can supply `views: [{name: "grazing", azimuth: 60, elevation: 8}]` in degrees,
or one custom `view` for `frame`. CLI `--params JSON` accepts the same options.
`padding` defaults to 1.2 (range 1.05–3), and `timeoutMs` defaults to 30000
(range 1000–60000) for readiness across the sequence. Camera restoration has a
separate five-second allowance.

`capture` returns PNG paths, bounds, camera poses and a `capture.json` manifest
under a unique ignored `test-results/dev-agent/captures/` directory by default.
`directory` selects another output location. It restores the previous camera pose
and limits after the sequence, including on failure; `restore: false` leaves the
last view. `frame` leaves the fitted pose and inspection zoom limits active.
The chosen floor, Arrange mode and cleared selection remain active. Neither
operation changes the saved home or adds undo entries. Failures retain completed
capture paths on the error. The existing local token and busy checks protect the
HTTP endpoints and serialize them with scene edits. These helpers are dev-only,
separate from the Home Assistant agent protocol.
