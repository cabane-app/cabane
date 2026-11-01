# Home Assistant runtime and privacy

The standalone browser app connects directly to the owner's normalized HTTPS HA origin (or paired loopback HTTP in development) through
`home-assistant-js-websocket`. OAuth is initiated by a user connection action;
callback handling removes auth parameters from the visible URL. Runtime state
covers unconfigured, disconnected, authenticating, connecting, connected,
reconnecting, expired authorization, and errors. Subscription teardown and stale
state marking keep old data from appearing authoritative after disconnection.

The native panel instead borrows Home Assistant's existing connection through
`HomeAssistantHostSessionProvider`. HA owns authentication, reconnection, and the
socket lifetime. Cabane attaches its registry/state subscriptions and guarded
service and camera clients only when the workspace selects the host origin.
Replacement or teardown releases Cabane's subscriptions, cancels pending work,
and rejects stale results; it never closes the host connection or logs HA out.
An origin mismatch requires explicit workspace selection and never remaps device
bindings silently. Native panels permit HTTP or HTTPS only when the page, host
session and selected workspace have the exact same origin (scheme, host and port).
This includes local-network HTTP without browser flags. HTTP remains unencrypted;
HTTPS is recommended. Treating an HTTP origin as a secure context does not encrypt it.
UUID generation uses getRandomValues when randomUUID is unavailable; SHA-256
content identities use the existing fallback without SubtleCrypto. Workspace and
model storage still require working IndexedDB. Storage failures retain the existing
recovery path rather than overwriting saved data; optional browser features such as
clipboard access retain their unavailable-feature guidance. Model synchronization
uses the borrowed authenticated WebSocket, including chunked GLB uploads.

Native initialization skips standalone legacy URL and authentication migration.
It does not read, copy, remove, or persist legacy OAuth material, write OAuth
return state, or consume the host URL's callback parameters. Ordinary workspace
initialization and browser-local project storage remain available. Demo providers
explicitly disable the host session. Before the first native welcome screen, a
read-only workspace-list request checks the host for saved homes; it does not
subscribe to devices, dispatch controls, read tokens, or create a connection.
Native settings and import offer a safe
connection retry without starting OAuth.

Embedded first-time sign-in opens HA authorization in a popup so HA does not
read the parent dashboard's query parameters. A static callback page returns only
the authorization code to the initiating Cabane frame using an exact target
origin. The frame checks the sender origin, popup identity, random state, and
current session before exchanging the code. Tokens stay in the frame's storage
context. Blocked, closed, cancelled, or timed-out popups allow retry; standalone
sign-in continues to use the existing redirect flow.

Standalone real-device deployments require browser-trusted HTTPS delivery of Cabane and
HTTPS/WSS Home Assistant connectivity. The UI and runtime reject unsupported
transport before sign-in, callback exchange, or stored-token restoration, with
actionable HTTPS guidance. Rejected callback parameters are removed from the URL.

HTTP development remains supported when both endpoints use HTTP loopback origins:
`localhost`, IPv4 `127.0.0.0/8`, or IPv6 `[::1]`, on the browser's machine.
Local demo and construction remain available over HTTP without HA. This exception
is local development, not encryption. Standalone LAN HTTP, private-tunnel bypasses,
HTTPS-to-HTTP, and loopback-HTTP-to-remote-HTTPS sessions are unsupported.

The client guard cannot protect JavaScript replaced during HTTP delivery.
Standalone production infrastructure must enforce HTTPS. Actual certificate, HTTP redirect
or rejection, and HA HTTPS/WSS behavior on the chosen release target remain a
launch gate; static builds do not complete Docker/LAN deployment acceptance.
See [transport acceptance](../transport-acceptance.md) for the required checks.

Switching homes disposes the prior runtime, clears its visible state, and ignores
stale connection completion. The library mounts an HA provider only while the
Home Assistant import source is open; native import uses the borrowed host session.
Each workspace stores its own server selection.

The runtime reads area/device/entity registries, subscribes to entity states, and
exposes refresh and connection errors. Supported service calls are scheduled and
guarded by the active connection and binding availability. Real commands belong
to explicit runtime controls. The command scheduler manages pending work; demo
and editor walkthrough contexts prevent real service mutation.

Held orbital dimming uses a continuous-value brightness channel: the scheduler
delivers the latest requested value at most once every 250 ms, including the
final level after release. Power actions cancel pending values. Other value
controls retain their 500 ms debounce and 2 s device throttle. Both real and
demo controls resolve one fresh, available primary light and recheck binding
errors and mutation permission before issuing commands.

Demo simulation is isolated under `packages/engine/src/onboarding/demo/`, behind
the existing `DemoHomeAssistantSession` entry point and runtime value interface.
It derives synthetic IDs from local slots, handles supported commands only in
memory, including fan power, valve open/close, media-player power, play/pause and volume for the simulated demo
speaker and television, lock/unlock, and alarm home/away/disarm. Classless status
sensors start idle, and simulated lights start on when the demo opens in night
lighting, following the saved preview mode or local time. Visitors can still turn
them off independently.
Fans start on at 50% speed and valves start fully open, activating the existing
fan and sprinkler animations. Their normal power, speed and valve controls update
only the in-memory demo state; reduced motion still suppresses animation.
Outdoor devices receive bindings without an area. It resets when remounted or given a different manifest. It never writes
projects/authentication or opens a network connection. Import checks restrict
access to its internals and its dependencies. Dashboard controls and real HA
networking contain no new simulation logic.

In standalone mode, OAuth auth data, including tokens, is persisted in browser localStorage when
available; storage failure can leave it session-only. Tokens are not encrypted
by an application server. The configured origin and client identity are checked
when reusing stored auth. Authentication keys include normalized server origin
and OAuth client identity. Homes using the same server can reuse sign-in. Explicit
sign-out removes that server's authentication; deleting a workspace or changing
its configured server does not revoke other homes' credentials. Existing global
keys are adopted once through the isolated workspace migration.

Project data lives in IndexedDB. Runtime mappings and private backups can contain
household area/entity IDs. Public project data and generated home code use typed
local slots. Backup/export formats deliberately omit OAuth credentials and
callback data; they are not a general browser-storage dump. Private mapping
exports remain private household data even without credentials.

No hosted account backend or cloud workspace synchronization is implemented.
An optional owner-installed HA custom integration provides instance-local
workspace and personal GLB asset storage. Any authenticated user of that HA instance can read or
change its shared Cabane copies. Those copies can contain private area/entity
IDs and draft layouts but omit OAuth tokens, callback data, preview caches,
camera media, and onboarding state. A browser keeps working when this optional
integration or HA is unavailable. The integration is not a Cabane-hosted
service, and real owner-instance deployment acceptance remains pending.
Personal assets contain only imported model files, addressed and verified by
SHA-256. Authenticated transfer is bound to its HA origin/session; files arrive
before revision-checked documents, and interruptions retain the previous copy.
Old integrations request an update for GLB homes. The shared asset store cleans
unreferenced files after 24 hours. See [personal models](personal-models.md).
The public `https://cabane.my` deployment uses Vercel Web Analytics to count
application page views through React Router, including personal-home and editor
routes. Workspace IDs in `/workspaces/:id` and `/open/:id` are replaced with `:workspaceId`; query strings and
fragments are stripped. No names, project contents, HA data, or custom events
are sent. OAuth routes and URLs containing authentication parameters are excluded
both before loading analytics and before sending a page view. Automatic SDK route
tracking is disabled; React Router owns page navigation. The site uses a
no-referrer policy to avoid forwarding private URLs.
The actual `/welcome`, `/demo`, and `/build` routes distinguish introduction,
demo exploration, and build entry in these ordinary page views. Counts include
direct visits, revisits, and visitors who explore and then build; they do not
represent mutually exclusive first choices or a sequenced conversion funnel.
Closing Welcome also opens Demo. No synthetic page views are emitted.
Vercel provides aggregate counts using a request-derived visitor hash with a
24-hour lifetime; this measures site usage, not unique active households.
Analytics requires a production build with `VITE_PUBLIC_ANALYTICS_ORIGIN` exactly
matching the HTTPS origin. `vercel.json` sets it to `https://cabane.my`; local
builds, previews, and self-hosted installations are disabled by default.
Network reachability and HA authorization
remain deployment concerns. Hosted visual assets follow the [visual asset contract](geometry-and-rendering.md#visual-assets),
separately from authenticated camera media; requests never include HA credentials
or household data. Personal GLB decoding remains in the dedicated import owner
with self-contained validation and no user-script execution.

Implementation: [runtime provider](../../packages/engine/src/HomeAssistantRuntime.tsx),
[auth storage](../../packages/engine/src/home-assistant-auth.ts),
[command scheduler](../../packages/engine/src/command-scheduler.ts),
[service descriptions](../../packages/engine/src/home-assistant-controls.ts),
[browser transfer](../../packages/engine/src/browser-data-transfer.ts),
[workspace backup](../../apps/web/src/workspaces/workspace-transfer.ts).

[Back to product overview](../../PRODUCT_SPEC.md).

Onboarding selects simulation only for the explicit installation demo identity.
It never falls back to simulation in personal workspaces. The first-control
observer wraps the existing normal call promise and reads the existing runtime
state; it does not command devices independently or add subscriptions. Both
promise-before-state and state-before-promise orderings are supported. A failed
call, stale reading, changed workspace/origin or disconnection cannot activate
onboarding. Guidance progress contains local room/device/slot references, not
exported household identifiers or histories.

Architectural roll-up doors use the existing guarded cover controls in room
controls. Scene selection opens those controls; local proximity and editor
previews never send services. Valid cover percentage takes precedence, followed
by explicit cover open/closed state and valid contact state. Unknown or stale
state retains the last known pose for that binding during the session, or starts
closed. Changing home, opening, or binding identity discards retained state.

Cross-device and dashboard links contain a workspace ID and HA origin only;
credentials, household mappings, and workspace documents never enter the URL.
They require HA authentication before storage reads. HA dashboard iframes reuse
the existing origin/source/state-checked popup OAuth handoff. A blocked popup
reports the existing retry instruction; no HA authentication page is embedded in
its own iframe. Storage operations do not call HA device services. Real household
and cross-browser iframe acceptance still require testing on the owner's setup.

Scene and script shortcuts select entities from the authenticated runtime's states,
using registry names and friendly names. Selection never invokes a service.
Activation uses the existing guarded runtime `callService` and command scheduler
with an exact entity target and `scene.turn_on` or `script.turn_on`. These are
one-shot actions, never toggles. Duplicate clicks are suppressed until the service
request settles, pending state is visible, and request rejection shows an error.
Missing, stale, disabled, unavailable or disconnected targets cannot dispatch.
A scene's initial `unknown` state is allowed because scenes have no on/off state.
Script completion is not tracked: pending ends when HA accepts the start request;
errors later inside the script belong to Home Assistant.

Implementation: [action resolution](../../packages/engine/src/action-bar/ha-action-shortcuts.ts),
[command feedback](../../packages/engine/src/action-bar/useHaActionShortcuts.ts),
[private profile](../../packages/engine/src/runtime-binding-profile.ts).
HA contracts: [scenes](https://www.home-assistant.io/integrations/scene/),
[scripts](https://www.home-assistant.io/integrations/script/).

Weather reads current weather entity snapshots through the existing subscription,
without new connections, polling, forecast requests or HA service calls. Automatic
uses exactly one non-disabled weather entity; unavailable candidates still count.
Multiple candidates require a Settings → Orbital view selection. Missing, disconnected, stale,
unknown or unavailable readings return to neutral atmosphere; explicit selections
remain stored and are never silently replaced. Unknown/exceptional conditions are
reported without inventing effects. Optional wind/cloud/visibility attributes are
validated and normalized; precipitation density is an artistic condition preset.

Settings → Orbital view offers Automatic, Off, and named HA weather sources. `weatherSource`
is an optional private binding-profile field (absent means Automatic), scoped to
home and HA origin and included in existing private backup and synchronization.
Its revision-checked write changes only that field in draft and published profiles,
not other unpublished work. Public projects omit the entity identifier. Save failures
retain the previous committed source. Action-bar weather previews are local React
state and never saved to HA or the binding profile.
