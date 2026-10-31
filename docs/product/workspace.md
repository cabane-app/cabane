# Workspaces, persistence, and Apply

Unsupported fields and newer schema versions remain blocked to protect saved
data from older editors. Errors explain the possible newer-client mismatch and
the HACS update, HA restart and browser/Companion reload steps; raw diagnostics
remain available. Failed parsing leaves existing local and HA copies unchanged.
Rejected workspace records list blocking errors before warnings, so an unavailable
model warning cannot hide the actual reason an import or restore failed.

`HomeProject` V2 is pure JSON: schema version, seed revision, home identity and
palette, shared coordinates, ordered floors, straight/L-shaped/spiral stairs, scene items, room/opening profiles, legacy shortcuts, optional action-bar configuration, and
assumptions, and an optional `customModels` catalog. Layout rooms carry empty device/dashboard arrays; runtime bindings
are composed from profiles and scene items. Outdoor platforms optionally persist `useAsRoom` and `roomName`. Their room ID
is derived as `<platform-id>:room`; the polygon and finish remain platform-owned.
The runtime adds these rooms for bindings and navigation without persisting
duplicate layout rooms or creating ceilings or roofs. Existing projects need no
migration; omitted options keep the prior platform behavior. Older clients reject
the new fields until updated. Disabling or deleting the platform removes its room
profile and reconciles room-area mappings while retaining explicit device mappings.

The layout project accepts flat
ceilings; the broader runtime manifest also supports sloped ceilings.

Scene items refer to registered models by ID, carry an explicit floor ID and size, an optional `variant` ID, and use
absolute, wall-relative, or ceiling-relative placement. Device items declare
typed entity slots with exactly one primary role. No React components or HA
credentials belong in this serialized project. Runtime manifest composition
resolves registered implementations separately. Omitted variants resolve to the model's
first choice (or `default` for models without explicit choices). Unknown furnishing
and device variant IDs remain saved and produce warnings; rendering uses the
model's default choice until the requested variant becomes available. Import,
reload and Save remain available when only catalog models or variants are missing.
An unknown furnishing or device model
ID is retained as a warning and renders as an editable generic placeholder with
the saved size and placement, so a JSON project can be imported before its
personal model pack is available.

A stored record contains draft and published projects, timestamps, revision, and
origin-keyed draft/published binding slices with manual-mapping exclusions.
An optional Cabane custom integration can hold a versioned copy of this full
private workspace on the connected Home Assistant instance. Manual Save to HA
and Restore from HA work with sync disabled. Enable sync uploads and enables per-workspace synchronization in one explicit action; local IndexedDB saves remain immediate and
offline edits remain local until HA reconnects. Remote version checks stop
concurrent browsers from silently overwriting each other. All signed-in HA
users share the instance's Cabane library. The library Delete dialog offers direct Remove locally and Delete permanently
actions when an HA copy exists. Remove locally keeps the saved HA copy. Delete permanently removes the current browser copy and the saved
copy on the selected HA server, with no undo; other devices may retain browser
copies. Local-only homes use a simple permanent-delete confirmation. Download
backup is a secondary action that keeps the dialog open. HA-only library cards
and the HA import list allow backup and confirmed deletion without restoring the
home, including mismatched origins and damaged documents. Deletion uses the
observed remote version and never requires parsing the home or loading its GLBs;
concurrent changes preserve the local copy and require review. An unavailable HA
server leaves local removal available. Removing a local workspace clears its sync
cursor. Installation and the integration source are maintained in
[the dedicated repository](https://github.com/cabane-app/cabane-home-assistant).
Storage controls live on the workspace-specific Home Assistant page. The library
shows saved/sync indicators on ordinary workspace cards; Open from Home Assistant is a direct library action (the legacy Import → From Home Assistant route remains supported). Opening a saved home restores its exact identity and enables sync, while divergent local copies require explicit review. In the native HACS panel, healthy saved homes that are absent from this browser
appear as dotted cards at the end of the same workspace grid. They share ordinary
card sizing and open in one click through the existing identity-preserving,
conflict-checked restore with sync enabled. Discovery uses only the authenticated
host connection, refreshes on library entry and browser focus, and never imports
automatically. Already-local IDs and damaged remote copies are excluded from
suggestions; damaged copies remain accessible through Import. Workspace server
addresses and the From Home Assistant import option use the official HA mark; the
import dialog labels file and import actions with the editor icon set. Failed listing or
opening offers retry and preserves existing homes. There is no separate HA library section.
IndexedDB uses the `cabane-projects-v2` database with project records, workspace
metadata, and persistent initialization state. Metadata contains the name, HA
origin, creation time, and applied status. Related writes share a transaction. The
repository handles parsing, migration, revision conflicts, and recovery; the
lifecycle determines what autosave and Apply may publish.

Personal GLB binaries occupy the immutable SHA-256 `model-assets` object store.
Record writes verify referenced assets and publish asset references and project
data atomically. Snapshots and undo history contain metadata only. Draft,
published, and active history assets remain available; duplicates share bytes
without sharing project identity. Complete exports use `.cabane` ZIP archives
with the portable/private JSON document and deduplicated GLBs. Legacy JSON stays
readable. Import restores and verifies assets before exposing the home. HA asset
transfer precedes the revision-checked document write; see
[personal models](personal-models.md) for limits and the companion protocol.
Arrange → My models can exchange a model-only ZIP pack (`manifest.json` plus
`assets/<sha256>.glb`) independently of a workspace JSON or `.cabane` backup.

Construct and Arrange use a shared panel layout. The left sidebar holds tools,
placement choices, catalog and home settings. Selecting architecture, stairs,
furniture or devices on desktop opens the same right Properties inspector automatically,
without moving keyboard focus. Changing selection replaces its fields; clicking
empty canvas clears it. Collapse retains selection and exposes a reopen button;
a different selection opens it again. Group selection offers its count and existing
group actions. Tool defaults and selected-object attributes use separate surfaces.
Panels use continuous warm surfaces, aligned fields and spaced semantic groups,
without nested cards or decorative section rules. Relevant fields group dimensions,
placement and appearance; advanced controls remain accessible through one disclosure level.

On desktop, Properties overlays the canvas as a full-height right sidebar. Opening
or collapsing it never resizes the canvas or shifts the camera projection; floating
floor and status controls move aside to stay accessible. Undo and Redo share the
top-right project actions with Reset and Save, separated by a divider. The Construct
toolbar contains construction tools; Arrange has no separate history toolbar.
On phones, Construct and Arrange start with a compact bottom dock and no open panel.
Build tools or Add items opens a full-screen panel; Properties is available after
selection, and Issues appears when needed. Panel tabs share that single surface.
Done and Escape dismiss it while preserving selection and restoring focus to the
dock. Canvas selection does not open a mobile panel automatically. Choosing a
construction tool, starting a canvas task, successfully adding an item or locating
an issue returns to the canvas. Failed catalog placements retain the open panel
and their recovery message. The same full-screen pattern applies in phone landscape.
Connect retains its existing compact surface. Settings keeps section navigation visible, with a horizontally scrolling menu on phones. Panel changes wait
for active drawing, dragging and marquee gestures to settle. Panel state is
presentation-only and is not exported or added to history.

Draft Issues lives in a separate tray below the canvas in every editor mode.
It starts collapsed with error/warning counts, expands to a scrollable list capped
at 30% of the desktop viewport height, and disappears when empty. Messages retain
full recovery guidance and Locate actions. New issues update counts quietly;
expansion persists across mode changes during the editor session. Locate opens the
affected object's Properties, including when that inspector was collapsed.
Scene-item rows identify the model and group **Select**, **Reset placement**, and
**Remove item** as matching buttons inside each issue. Repairs use the shared workspace
history, including draft mapping cleanup on removal. Geometric item-placement
diagnostics are warnings; they do not prevent opening or saving the home.
Schema, identity and structural-reference errors retain their blocking behavior.

Autosave preserves schema-valid intermediate drafts. Geometry or semantic issues
can remain visible while editing. Item removal clears its primary, reading and
independent lighting draft connections even when another floor is unfinished,
preserving published mappings and Undo. The shared validation panel stays available in
Construct, Arrange, Connect, and Settings whenever the draft has visible issues.
Locate selects and focuses the affected editable object, switching floor and mode
when needed; attachment errors select the attachment rather than its supporting
wall or diagnostic marker. Workspace history spans construction,
arrangement, and connections; pending gestures are settled before committing.
Settings is an editor tab beside Construct, Arrange, and Connect. Its sidebar navigates Home Assistant, Shortcuts, Backups, Orbital view, Editor, and Explore. The Home menu opens this same Settings screen instead of a Preferences dialog. Home Assistant contains connection and cross-device storage controls. Backups exports the live draft as a portable design or full private archive and restores same-home files into shared undo history after downloading a safety backup. Import never publishes. Orbital view contains visual style, room overlays, lighting, and weather source. Editor contains measurement units; Explore contains Invert Y axis. Device preferences retain their existing browser storage keys and apply immediately. Weather sources retain their origin-scoped revision-checked save in draft and published profiles. Section changes preserve the current draft and history; legacy Home Assistant and Shortcuts URLs still open the corresponding section.

Settings → Shortcuts displays
the draft action bar with the same slot visuals and overflow as Home. Hovering, focusing,
or selecting a slot exposes actions to add a built-in action, room, modeled device, HA scene, or HA script;
filled slots can also be replaced, moved, or removed. A searchable grid fills the canvas
for each choice. Room icons use the mapped Home Assistant photo when available, then
initials; device icons use cached procedural previews. These edits use the same history and autosave as other
draft changes. Missing room or device targets are shown in the panel and block Apply
until repaired. The published Home bar changes only after Apply. Portable exports,
imports, and workspace duplication preserve the ordered per-home configuration;
private HA entity IDs are never part of an action-bar target. Scene/script targets
contain only their kind; `RuntimeBindingProfile.actionEntityIdsByShortcutId` maps
the stable shortcut ID to an exact entity in each origin's private draft/published
profile. Project edits and mapping edits share one history transaction. Removing
or replacing a shortcut prunes incompatible draft mappings, leaving published
mappings intact until Save. Existing profiles without this optional map remain valid.
Automatic room/device matching preserves these explicitly chosen mappings.
Private backups, duplication and HA workspace sync carry the private map; portable
exports carry unmapped action placeholders which owners can replace in Shortcuts.
Offline or missing action targets remain saved, with unavailable controls rather
than blocking unrelated project publication.
Undo does not rewind already published content. Leaving the editor flushes the draft;
it does not implicitly Apply. Apply validates the project and binding slices,
blocks errors, and writes the new published project and mappings together.
A failed write leaves the previous Home intact.

The library creates blank homes and imports files as new independent identities.
Duplicate copies draft and published data, mappings, and the configured connection;
only home identity changes, retaining room/device IDs. Rename changes both stored
project names without applying draft geometry. Delete requires confirmation and
removes the record and metadata atomically. Revision checks prevent stale tabs
from overwriting changes or recreating a deleted workspace.

Recovery can download rejected raw data, reset to an empty home, or remove items
whose models are unavailable. Recovery compares the exact rejected record. A
valid project with unresolved model IDs does not enter recovery; its placeholders
remain editable until a model pack or replacement GLB is imported.
Portable exports omit private bindings and connection settings. Versioned private
backups include both project slices, mappings, and configured server, never
credentials. Library imports allocate a new home ID; portable imports start
unapplied, while private backups retain their draft/published boundary. Existing
portable and bare private files remain supported transfer formats. Editor imports
explicitly target the current draft and require Apply before affecting Home.

Onboarding records an explicit seeded-demo identity and welcome/nudge dismissal
in the existing workspace-state store. Existing initialized stores without that
state are conservatively treated as returning users. Each of the Connect and
Build paths has a persistent destination ID. Creation and the destination write
share the project/metadata/state transaction; concurrent entries resume one home.
Deleted destinations are not recreated without an explicit user action.

Onboarding Connect creates a clean copy from the demo's published slice. It does
not copy draft edits, bindings or the HA origin. Ordinary Duplicate still copies
those private settings by design. The designated demo cannot be assigned a real
HA origin; connection entry creates/resumes a personal workspace instead.

One-time browser adoption is isolated in `migrate-single-home-storage.ts`.
Current-store initialization is permanent; conversion and retired key readers
are scheduled for removal after the owner confirms their existing data survived
rollout. There is no steady-state dual-write migration contract.

Implementation: [workspace repository](../../packages/engine/src/home-project/workspace-repository.ts),
[initialization](../../apps/web/src/workspaces/initialize-workspaces.ts),
[workspace transfer](../../apps/web/src/workspaces/workspace-transfer.ts),
[project types](../../packages/engine/src/home-project/types.ts),
[schema](../../packages/engine/src/home-project/schema.ts),
[repository](../../packages/engine/src/home-project/repository.ts),
[lifecycle](../../packages/engine/src/home-project/lifecycle.ts),
[workspace hook](../../apps/web/src/editor-preview/useEditorWorkspace.ts),
[transfer](../../apps/web/src/editor-connect/profile-transfer.ts).

[Back to product overview](../../PRODUCT_SPEC.md).

V1 projects and browser records migrate to V2 while retaining IDs and bindings.
Empty upper floors are recoverable drafts and block Apply until valid.

Workspace cards show a browser-local cached 3D overview after the dashboard has
rendered. Previews refresh while viewing the overview, exclude dashboard UI and
camera media, and are optional when storage is unavailable. Deleting a workspace
clears its preview and last-opened preference. These caches are not exported.

An unnamed room is accepted by draft schema parsing and can autosave/reload while
its owner is still constructing the home. Full layout validation requires a
nonempty room name for Apply. This does not change the HomeProject wire format.
The optional per-home build tutorial is browser setup data, excluded from project
exports, workspace duplication, and undo history.

The editor separates Back navigation on the left from Reset and primary Save
actions on the right. Save validates and
atomically publishes the draft, closes the editor, and opens Home.
Save proceeds immediately when validation has only warnings or no issues; the
review dialog remains available for errors and failed saves. Back returns to
Home and preserves draft edits; it is disabled until the first successful Save.
Reset asks for confirmation, restores the published project and connection
bindings, and clears draft undo history. Before the first Save it restores the
initial unpublished baseline. Reset is disabled when the draft matches that baseline.

Construct and Arrange share ordered 3D, 2D, and Explore controls with subtle
Shift+1, Shift+2, and Shift+3 hints on desktop. Construct keeps 3D visible but
disabled and 2D selected. Shift+1/2 returns from Explore to the corresponding
available editor view; Shift+3 uses the same pointer-lock flow as the Explore
button. These shortcuts ignore typing, repeated/composing keys, additional
modifiers, unfinished gestures, other dialogs, Connect, and Settings.

Reference plans are browser-only editor assets in the separate
`cabane-reference-plans-v1` IndexedDB database. Image blobs are keyed by home and
asset ID; per-floor records contain placement and image dimensions, with separate
visibility/opacity preferences. Session history retains only metadata and asset
IDs, never blob copies. Reference-only edits do not dirty or autosave the home
project, trigger HA sync, or enter portable exports/private backups.

Removing a floor hides its reference while session undo can restore it. Reset
retains references for surviving floors; clearing history or leaving the editor
cleans unused assets. Deleting a workspace removes its reference records and
blobs. Duplicated and imported homes begin without references. Failed local writes
retain in-memory changes and allow Retry; a rejected image replacement leaves the
previous reference intact.

Availability is independent of device connection. Cards use cached storage state
and label enabled sync without claiming remote freshness. The open workspace
reports verified Synced with HA, Changes pending, Sync interrupted, or Sync needs
attention. Manual save/load and remote deletion remain under Manage saved copy.
Opening remote copies checks both the requested home ID and authenticated HA
origin; corrupt or divergent browser records cannot be silently overwritten.

Stair intersections and unsupported landings are warning-only project diagnostics.
Warnings retain their severity through validation, draft reload, import/export, and
Save review; only errors make a project invalid. Existing stair JSON and IDs are
unchanged, and no data migration is required.

Outdoor platforms and their edge IDs/configurations belong to each floor's project
slice. Schema-shaped intermediate polygon errors can autosave and reload; geometry
validation blocks Save until repaired. Portable exports, imports, project
history, duplication and Apply retain platform finishes and per-edge overrides.

Basement floors persist optional `belowGround: true` in the existing V2 floor records.
They must form a contiguous prefix with at least one non-basement (ground) floor.
Omitted classification preserves existing projects. Import/export, drafts, and
undo/redo retain this flag; derived negative preview elevations are not persisted.

Optional `home.terrain` stores `topLeftMeters`, `topRightMeters`,
`bottomLeftMeters` and `bottomRightMeters`, each finite and within −100 to 100 m.
Heights are offsets from the ground-floor datum, with the existing 5 cm outdoor
drop retained. Corners follow the unrotated plan's building bounds. Drafts,
publication, workspace sync, import/export and undo/redo retain the settings.
Omission or four zeros preserves flat terrain; older clients reject the new
field until updated. Architectural floor elevations and `belowGround` stay unchanged.

Optional `toolState` is namespaced pure JSON in each home project. Tool packages own
its versioned contents and validation; the engine only exposes the injected
`WalkToolStorage` interface. Live tool changes save to both draft and published
slices through the existing revision-checked repository, preserving unrelated
draft edits. They survive reload, duplication, portable exports and private
backups, and use the same workspace sync path. No separate browser store is used.

Optional `home.northAngleDegrees` is finite and in [0, 360), measured clockwise
from plan up. Omission means zero for existing V1/V2 projects; no migration or
architecture rotation is needed. All floors share it.

Walls may persist an optional `edgeColor` CSS color for caps and opening reveals.
An absent value is Auto; returning to Auto removes the override from exported
JSON. Existing projects need no migration. Draft conversion, topology edits,
undo/redo and import/export preserve explicit overrides.

### Measurement units

Settings → Editor → Units selects Metric (m, m²) or Imperial (ft, ft²).
The browser-local preference applies immediately to editor lengths and areas,
including construction guides and copied measurements, room/pool/platform areas,
properties, stairs, object placement, reference calibration and model imports.
Lengths accept decimal commas or points and explicit m, cm, mm, ft, in, or feet
and inches (for example `5' 6"`). Bare numbers use the selected unit. Imperial
length adjustments use one inch, with Shift multiplying by ten. Angles, counts,
scale multipliers and Home Assistant temperatures retain their existing units.
Plan-coordinate inputs account for the floor's metres-per-plan-unit scale.
Changing display units never rescales the project or rewrites its stored geometry;
portable project formats retain their existing units. Blocked browser storage
retains the preference for the current session.

Furniture may declare optional `entitySlots` containing manual, non-required secondary sensor or binary sensor attachments. Devices retain exactly one primary control; optional read-only attachments are validated independently of the model’s control domains. `presentation.showInScene` is opt-in map visibility. Older documents omit both fields and keep their prior behavior. Older panels reject documents containing the new fields; preserve that rejection and update the matching HACS panel before transfer.

Leaving the editor for Home, Workspaces or another workspace saves the draft first. Home Assistant settings now stays within the editor session. A failed save cancels that navigation attempt so a later click can retry. Storage errors show their reason and an explicit retry. Revision conflicts keep both the newer saved record and the current in-memory draft intact, and offer a complete `.cabane` draft backup containing the current project, private mappings and verified imported GLBs, including staged imports, before the user reopens the saved workspace. Backup failures retain the draft and show a retryable error.
