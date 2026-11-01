# Layout in the paired HA editor

Use this workflow for architecture in a native Home Assistant workspace.
The browser draft is the output; repository home files stay unchanged.

## Pair and inspect

1. Use a Cabane checkout with its supported Node.js/npm versions. The CLI talks
   to HA directly, so a local Cabane development server is not required.
2. Check the existing CLI session with `node apps/agent-cli/src/cli.mjs status`.
   If pairing is needed, open Cabane from the HA sidebar, choose the intended
   workspace's **Connect LLM agent → Generate pairing code**, and run
   `npm run agent:pair` with that HA URL and code. Pass them as shell-quoted
   argument values; a code must be `MCBN-` followed by sixteen hexadecimal digits.
   Use `--session-file` outside Git when keeping multiple sessions. The user
   supplies a Cabane pairing code, never a HA access token.
3. Run the following and confirm the returned workspace name, workspace ID and
   active floor match the user's target before the first edit:

   ```sh
   npm run agent:request -- --method get_capabilities --pretty
   npm run agent:inspect -- --pretty
   ```

   Use the reported action inputs rather than reading engine internals. Retain
   an in-memory baseline of architecture, scene items and the draft revision.
   Keep the panel open; leaving the editor or losing its HA connection requires
   fresh pairing. Both the integration and frontend must support protocol 3.

## Construct the floor

1. Apply the evidence model in the existing project coordinate system. Convert
   measured meters to plan units using the inspected origin and scale. Preserve
   the shared transform when adding floors.
2. Reuse the selected floor or select/add the requested floor with the public
   floor actions. Preserve existing walls and stable IDs during corrections;
   replacing an existing layout requires the user's instruction.
3. Send `execute_action` requests sequentially, using the latest
   `inspection.draftRevision` as `expectedRevision`. Start from inspection's
   `draftRevision`; on a stale revision, inspect again and reconcile UI edits.
   For example, replacing the illustrative floor ID and revision:

   ```sh
   npm run agent:request -- --method execute_action --params '{"action":{"type":"add-wall","floorId":"ground-floor","from":[0,0],"to":[4,0]},"expectedRevision":0}'
   ```

4. Use Construct wall actions to close every requested room. Add shared walls
   once. The editor derives footprint regions, room polygons, junctions and
   ceilings from its topology. Inspect returned IDs and geometry before adding
   metadata or attachments; let these shared operations own geometric rules.
5. Use the discovered room, wall and opening actions to set names, wall heights,
   thicknesses, supported finishes, and each wall-owned door, window or passage.
   Retain endpoint direction when editing directed wall colors. Use floor/stair
   and walk-start actions only where required by the evidence.
6. After a timeout, inspect before repeating a mutation: an accepted edit may
   already have completed. If the public action cannot express a required
   architectural feature, report the missing operation and leave the draft
   reviewable rather than editing browser storage or repository engine code.

## Verify and leave for review

Run `validate_draft`, `get_draft_diff` and `inspect_workspace` through
`agent:request`. Check the room count, names, dimensions, shared boundaries,
opening ownership and heights against the evidence model. Resolve introduced
architecture errors. Identify unrelated pre-existing diagnostics separately.
Compare scene items with the baseline. Send only architecture actions and report
any effects on existing mappings indicated by the draft diff.

Inspect the actual Construct/Arrange and Explore views for topology, openings,
junctions, head clearance and walk routes. The relay does not operate the camera;
use ordinary browser controls or ask the user to inspect the unavailable views.

Confirm accepted mutations report `persisted: true` and final inspection reports
`autosaveStatus: "saved"`. Autosave keeps the browser draft; publication and HA
storage synchronization are separate. Leave the unfurnished floor in draft for
review and follow the skill's handoff. Source-only `FLOOR_VALID` and
`LAYOUT_REVIEW_REQUIRED` markers do not apply to this browser workflow.
