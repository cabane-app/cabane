# Connect and binding profiles

Home Assistant connection settings and full workspace file backups live on
`/workspaces/:workspaceId/home-assistant`. The Connect sidebar only handles
room/device mapping, with a Connection settings button linking to that page.
The settings page validates full URLs through inline application feedback, including
missing schemes and unsupported HTTP transport. Address and sign-in preparation
errors appear beside the connection controls; preparation, runtime progress,
connection success, and runtime failures remain visible.
The settings page supports changing the URL, disconnecting, full backup export,
and importing a same-home backup into the draft for review. Connection-only
profile imports/exports are no longer exposed in the UI.

Connect separates room-to-HA-area mapping from device/entity-slot mapping. A
plan view exposes room connection status, area names/icons, and device summaries;
inspectors expose the selected relationship and compatible choices. A modeled
multi-slot device groups its primary and secondary relationships. Dashboard-only
slots and opening contacts also participate in mapping.

Two-finger trackpad scrolling pans the plan and pinch (Ctrl/Cmd-wheel) zooms
around the cursor, matching Construct and Arrange's 2D view. Zoom buttons and
pointer dragging remain available.

A runtime profile contains a home ID, schema version, room-to-area IDs, and
slot-to-entity IDs. Each workspace has independent profiles keyed by normalized HA origin. Duplicate
retains the server and mappings; subsequent changes remain independent. Manual
room/slot choices suppress automatic remapping for those targets. Stored IDs are
validated against the home and, when available, runtime registries and states.
Missing, hidden, disabled, unavailable, or incompatible candidates
produce diagnostics rather than crashing the home.

Automatic matching uses unique normalized room/area names and unique compatible
entity candidates. Ambiguous matches stay unresolved. Domain/device-class rules,
and area ownership constrain candidates. Automatic mapping remains one-to-one.
Explicit manual mapping may share a compatible entity across several slots; each
relationship is retained and follows the same entity state. Camera slots can use
the supported cross-area exception.

HA Light Group helpers (`light.*`) use the normal light picker and controls;
they do not need a physical HA device. Create and manage membership in
[Home Assistant](https://www.home-assistant.io/integrations/group/), then map each
modeled pendant to the same group entity in Connect. Helpers without an area
appear under **Other lights → No area** for single-slot light devices. Cabane
keeps each pendant in the scene; all mapped pendants follow the group's reported
state and brightness. Separate member bindings remain independent. Cabane does
not create groups or infer membership. Legacy `group.*` entities are not lights;
use a Light Group exposing a `light.*` entity.

Devices placed outside every room appear under **Outside rooms** in the Devices
location picker, separately for each floor. This is a device group, not an
architectural room, and does not require a room-to-area mapping. Its devices can
be manually linked to compatible entities from any HA area or without an area;
these mappings survive Apply, export/import, and drive live device state.
Automatic matching remains limited to mapped architectural rooms.

Manual candidates use a central domain-compatibility policy. Lighting slots accept
`switch` entities as on/off alternatives, after direct `light` matches. Single-device
pickers show current-room lights first, then collapsed “Other lights” and
“Other switches · on/off only” sections, each containing collapsed HA-area groups
(including “No area”). Search reveals matching groups; the saved selection stays
visible in its expanded group.
Automatic matching excludes fallback domains. Validation, import, runtime resolution,
and scene lighting retain the same mapping; controls use the actual entity domain
and capabilities, so a plug does not gain dimming controls.

Refreshing registries and matching profiles are read-only operations against HA.
Editing a mapping stages local data; it does not call a device service.

Sign-in flushes the draft before leaving the page and saves a return request.
Changing HA origin saves the workspace connection setting and adopts its new
revision before proceeding. The return request carries the workspace ID. Disconnected state
keeps saved relationships available for inspection. Profile import validates
shape and rejects extraneous private data; backup import stages a draft. Export
of a connection profile uses its published slice. Apply publishes mappings with
the project, so Home never mixes a new layout with an old draft mapping slice.

Implementation: [Connect controller](../../apps/web/src/editor-connect/useConnectEditor.ts),
[Connect inspector](../../apps/web/src/editor-connect/ConnectInspector.tsx),
[profile API](../../packages/engine/src/runtime-binding-profile.ts),
[workspace bindings](../../packages/engine/src/home-project/workspace-bindings.ts),
[resolver](../../packages/engine/src/home-assistant-resolver.ts),
[transfer](../../apps/web/src/editor-connect/profile-transfer.ts).

[Back to product overview](../../PRODUCT_SPEC.md).

Doors and windows appear as optional objects in each room’s Devices list under
Openings. The plan and room-area mapping flow remain unchanged. Composition
provides a stable manual contact slot for every opening except passages, while
preserving explicit profile slot IDs and polarity. Unbound openings produce no
missing-binding warning and do not count toward room connection progress.
Manual selection offers only binary sensors classified as door, window, opening,
or garage_door, across all areas including sensors without an assigned area.
Existing uses of that sensor are preserved. Opening cards and their inspector
use the shared cached thumbnail renderer with the actual procedural opening model.

In device mapping, the room picker is labeled “Show devices in” to make its filtering role explicit; in room mapping it is labeled “Room to connect”. Both use standard form controls below the shared mode introduction.

Roll-up doors are architectural openings with optional garage-class cover slots
in addition to optional contacts. Both appear in the Openings mapping group with
the actual opening preview. Cover selection supports all areas, including entities
without an assigned area. The cover drives position; a valid contact supplies a
binary fallback when cover position is unknown. Unmapped opening slots do not
make a room look unfinished. Changing to a conventional door removes its cover
profile and browser mapping through ordinary draft reconciliation and history.

Event entities (`event.*`), including Hue remote buttons, can be mapped to newly
placed Wall switches or personal models with the Event profile. Existing slots
retain their saved compatible domains; place a new Wall switch when an older
slot does not offer events. Each slot still maps to one entity. General multiple
entity editing remains separate. Event bindings are read-only.
