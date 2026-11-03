# Startup, navigation, and setup

The browser initializes a local workspace library, adopting existing saved home
data once. On a fresh installation the furnished demo is an ordinary workspace.
Deleting it, including deleting the last workspace, does not recreate it.
Loading failures are actionable; corrupt homes offer recovery independently.
Unexpected render and route failures in both the standalone app and embedded
panel show a generic reload page instead of error messages or stack traces.
The original errors remain logged in the browser console; reloading can lose
unsaved changes. A top-level boundary also covers failures outside the router.

Each workspace owns its draft, published home, mappings, and HA connection.
Home renders published data; the editor reads the draft. Routes are:

| Route                                                                      | Surface                                                                                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                        | Opens the last successfully opened workspace; the demo resolves to Welcome or Demo according to saved welcome dismissal; falls back to the sole workspace or library |
| `/welcome`                                                                 | Introduction over the browser's existing demo, with Explore and Build choices                                                                                        |
| `/demo`                                                                    | Published demo with simulated controls and the introduction closed                                                                                                   |
| `/build`                                                                   | Construct for the browser's Build destination; creates that destination on a first direct visit, or shows mobile editor guidance on phones                           |
| `/workspaces`                                                              | Library: New, Import, Open, Rename, Duplicate, Export, Delete                                                                                                        |
| `/open/:workspaceId?ha=<origin>`                                           | Authenticate, open the exact HA-saved home, and enable sync in this browser; optional `view=dashboard` identifies a dashboard link                                   |
| `/workspaces/:workspaceId`                                                 | Published Home; unapplied homes open Construct                                                                                                                       |
| `/workspaces/:workspaceId/settings/:section`                               | Settings with sidebar navigation for HA, shortcuts, backups, orbital view, editor and Explore                                                                        |
| `/workspaces/:workspaceId/construct`                                       | 2D architecture editing                                                                                                                                              |
| `/workspaces/:workspaceId/arrange`                                         | Furniture and device placement                                                                                                                                       |
| `/workspaces/:workspaceId/mobile-editor?mode=construct` or `?mode=arrange` | Compatibility redirect into Construct or Arrange                                                                                                                     |
| `/workspaces/:workspaceId/connect`                                         | Resolves the initial mapping view                                                                                                                                    |
| `/workspaces/:workspaceId/connect/rooms`                                   | Room-to-area mapping                                                                                                                                                 |
| `/workspaces/:workspaceId/connect/devices`                                 | Device and entity-slot mapping                                                                                                                                       |

Legacy workspace `/home-assistant`, `/shortcuts` and `/action-bar` URLs open their matching Settings section. `/settings` opens Home Assistant.

Old unscoped editor paths are not aliases. Missing local workspace IDs offer Open from Home Assistant and the library; absence in this browser is not described as remote deletion. Refresh retains the workspace URL. Mode changes retain edit history within
a home. Leaving for Home, the library, or another workspace flushes the draft;
a failed save keeps the editor open. Home offers Workspaces in its three-dot
scene menu. In Construct, Arrange, Connect, and Settings, the current workspace name beneath
Cabane links back to the library, using the same guarded save-on-exit flow.
In the library, the whole home card opens its workspace; its three-dot menu keeps
management actions separate. Each card has separate, non-clickable Connection and Storage rows. The library reports “HA configured” for a stored URL, never a live connection. Storage distinguishes Local only, Saved to HA · sync off, Sync enabled, and Changes pending; the library does not contact HA. Draft and recovery labels remain independent.

In the standalone app, OAuth return state includes the workspace ID, mapping
target, selected item, and Arrange camera. Callback identity is validated before
a home's runtime opens. The library mounts a connection only while its Home
Assistant import source is open.

The native Home Assistant panel uses the same workspace and editor routes in a
memory router. Internal navigation, import selection, and dialogs do not change
Home Assistant's browser URL or interpret its query parameters as OAuth callbacks.
The panel mounts inside a shadow root, scopes portals, focus, and input handling
to that root, and resolves bundled UI assets beside its module. The HA menu
control opens the host navigation; Cabane's workspace navigation stays internal.
The panel stays in normal document flow beside HA's sidebar. Its height fills the
viewport below its measured top edge, reserving the host's bottom safe area;
it does not depend on HA's auto-height wrapper resolving a percentage height.
Viewport resize and remount recalculate the available content area.

Personal workspaces explicitly select “Use this Home Assistant” to borrow the
current host session. A workspace configured for another origin shows the
mismatch and requires that same explicit action; existing mappings remain keyed
to their original instance. Settings identify sign-in as managed by Home Assistant.
“Disconnect workspace” clears only that workspace's selection and detaches its
runtime. “Retry connection” retries a failed borrowed session without OAuth.
Home Assistant import uses the host session directly. The demo never borrows
that session and continues to use simulated devices.

On the first native-panel launch, a browser with only its untouched demo checks
for homes saved on the host HA instance. Saved homes open **Import a workspace**
with the host library and explicit Open choices; nothing is imported automatically.
Create a new home and Explore the demo remain available. An empty result opens
the usual welcome screen; errors or a timed-out check offer retry instead of
claiming there are no saved homes. Existing local homes and dismissed welcome
flows retain their usual startup, and standalone startup does not query HA.

Otherwise, a genuinely fresh installation opens `/welcome` over the default furnished villa
with two immediate choices. Explore (or closing the introduction) navigates to
`/demo`. Build creates a blank workspace and opens Construct at `/build` without
authentication. These URLs render real surfaces, not tracking-only redirects.
Refresh resumes the same local Build destination; editor mode changes continue
on its existing workspace-scoped URLs. Direct Welcome/Demo visits never recreate
a deleted demo, and missing Build workspaces retain the usual recovery link.
Browser Back to Welcome reopens the introduction even after it was dismissed.
The scene remains visible; portrait layouts omit previews to keep actions clear.

The demo is identified by installation metadata, not its editable name or a
missing HA connection. Only it receives the isolated memory-only simulation.
Personal homes display real, unconnected or unavailable states; disconnection
never switches them to simulated data. All demo Connect routes create/resume the
Build destination in Construct. Leaving a demo editor for Connect
uses its existing draft flush guard. The demo can still be edited or deleted;
it is never silently reseeded.

The first successful simulated interaction offers a dismissible invitation to
build a personal home. Welcome and nudge dismissal are installation-wide. Existing
and migrated installations remain returning users even without older progress.
The root resumes the last opened workspace; the library remains directly accessible.
Manual Getting started opens `/welcome` over the demo; personal onboarding homes
offer Continue setup.

Creation and the per-path destination reference are committed in the same
IndexedDB transaction. Repeated actions, refresh, and concurrent tabs resume the
same home. A deleted destination requires an explicit creation action. The
ordinary library New and Duplicate actions retain their existing semantics.

Connection uses the existing authentication, mappings and Apply. A published
mapped light opens its room with a prompt to try it. Success requires a normal
successful control command and a fresh matching state update, not just mapping
or Apply. The observer adds no commands or subscriptions and cancels on failure,
disconnection or workspace change. Build uses existing intermediate drafts,
validation, autosave, Arrange and Apply; no starter-replacement mechanism remains.

Privacy copy explains browser-local homes, mappings and sign-in material, direct
browser-to-HA communication, private backups and browser-data clearing. Source
and self-hosting navigation stays disabled until its destinations are public.

Implementation: [library host](../../apps/web/src/workspaces/WorkspaceApplication.tsx),
[workspace host](../../apps/web/src/workspaces/WorkspaceHost.tsx),
[routes](../../apps/web/src/editor-routes.ts),
[product host](../../apps/web/src/ConnectedProduct.tsx),
[routed editor](../../apps/web/src/RoutedHomeEditor.tsx),
[setup experience](../../packages/engine/src/onboarding/OnboardingExperience.tsx),
[setup progress](../../packages/engine/src/setup-progress.ts),
[demo session](../../packages/engine/src/DemoHomeAssistantSession.tsx).

[Back to product overview](../../PRODUCT_SPEC.md).

Each newly created blank home, through New workspace or Build, starts a compact
six-step tutorial: close the first room, add a door, add a window, name the room
on the plan, arrange it, and open Connect. Objectives follow the actual draft,
including out-of-order work and undo/redo. Doors and windows must belong to the
target room's boundary. Tool and mode changes are offered as explicit actions;
the tutorial never changes them automatically. Arrange has an “I’m ready” action
without a required furniture/device count. Opening Connect completes the tutorial
and hands off to the existing connection setup, without signing in automatically.

Skip step and Dismiss tutorial remain available, with Restart tutorial in the Construct sidebar’s Build tutorial disclosure. Progress, skipped steps, target room/floor, readiness, and dismissal
are stored in the optional buildTutorial field of the per-home browser setup
record, outside project history and exports. Existing homes, imports, and duplicates
do not automatically enroll. Storage failure retains progress for the session
and shows a nonblocking warning. Deleting the target room adopts another room or
returns guidance to drawing walls. The tutorial scrolls with the full-screen tools panel
on phones so the complete catalog and inspector remain accessible.

Desktop editor modes keep the workspace sidebar with a consistent mode title and short task description. Construct and Arrange on phones use a compact dock to open Tools, Properties or Issues full screen on demand. The panel header supplies the mode and floor context, and Done returns to the canvas.

Phones enter Construct and Arrange directly. The former `/workspaces/:workspaceId/mobile-editor` guidance route redirects to the requested editor mode, preserving old links.

On desktop, active build tutorial guidance floats at the editor canvas’s top right,
below the toolbar; on phones it stays in the full-screen tools panel. The
2D/3D and Explore controls sit at the canvas’s bottom left, above the bottom dock on portrait mobile layouts.

Home Assistant settings are linked from each workspace menu, below Edit the home
in the dashboard menu, and from Connection settings in the Connect footer. Leaving
the editor for this page uses the same guarded draft flush as other exits.

The library groups primary New workspace and secondary Import workspace beside
the title. Import workspace offers From file and From Home Assistant; legacy
HA import links open the same dialog with that source selected. A quieter
Add Cabane to Home Assistant action sits separately above the homes. Setup targets the sole
eligible home directly or asks which home to use; demo and damaged homes are
excluded. An empty eligible library offers creation. The existing three-dot
menu includes Home Assistant settings, Sync with Home Assistant, Add to Home
Assistant, and Open on another device. These destinations open the same per-home
settings page with preserved intent, including across OAuth.

Setup uses three states: Install, Sync your home, and Open Cabane. After sign-in,
Cabane checks storage and the read-only HA panel registry independently, without
uploading. Only the integration-owned custom cabane-panel at /cabane counts as
installed; storage-only installations and failed checks do not imply readiness.
Install guidance links to the configured instance's HACS and integration settings,
explains custom repository installation, restart, and activation, and offers a
manual-install guide. Opening a link never marks installation complete.

Enable sync performs the first save and enables ongoing sync in one explicit
action. After successful sync and verified panel discovery, Open in Home
Assistant opens that instance's /cabane sidebar panel. Mobile-app directions are
optional disclosure content; no app installation is required. A missing-home
fallback explains opening the saved home from the panel's HA library, including
older releases' Import flow. The native panel retains its borrowed host session and first-launch saved-home
picker. Its library hides the already-completed Add Cabane action. Releasing an
updated integration bundle remains a separate delivery step.

Manual Webpage cards and other-device links remain under Other ways to open this
home. Both require successful synchronization before copying. Receiving standalone
sessions authenticate normally (popup OAuth inside iframes), restore the exact
home, enable sync, and navigate to it. Conflicts offer Review copies and Open
browser copy; invalid links offer the HA library. No public account or public
sharing is implied.
