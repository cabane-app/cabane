# Connect and binding profiles

Home Assistant connection settings live in Settings → Home Assistant at
`/workspaces/:workspaceId/settings/home-assistant`. File transfers live in Settings → Backups. The Connect sidebar only handles
room/device mapping, with a Connection settings button opening that section.
The settings page validates full URLs through inline application feedback, including
missing schemes and unsupported HTTP transport. Address and sign-in preparation
errors appear beside the connection controls; preparation, runtime progress,
connection success, and runtime failures remain visible.
Settings supports changing the URL, disconnecting, portable design and full backup export,
and importing a same-home backup into the draft for review. Connection-only
profile imports/exports are no longer exposed in the UI.

Connect separates room selection from device/function mapping. Existing room-to-area
associations provide context for suggestions and conservative automatic matching. A
plan view exposes room connection status and device summaries; the selected room
opens its objects and compatible source choices. A modeled
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
relationship is retained and follows the same entity state. Explicit compatible choices
can cross areas without requiring a room-to-area association.

HA Light Group helpers (`light.*`) use the normal light picker and controls;
they do not need a physical HA device. Create and manage membership in
[Home Assistant](https://www.home-assistant.io/integrations/group/), then map each
modeled pendant to the same group entity in Connect. Helpers without an area
appear in the flat compatible source list with **No area** as their location. Cabane
keeps each pendant in the scene; all mapped pendants follow the group's reported
state and brightness. Separate member bindings remain independent. Cabane does
not create groups or infer membership. Legacy `group.*` entities are not lights;
use a Light Group exposing a `light.*` entity.

Devices placed outside every room appear under **Outside rooms** as a separate choice beside the house
plan, separately for each floor. This is a device group, not an
architectural room, and does not require a room-to-area mapping. Its devices can
be manually linked to compatible entities from any HA area or without an area;
these mappings survive Apply, export/import, and drive live device state.
Automatic matching remains limited to mapped architectural rooms.

The Connect editor retains the standard editor sidebar in both plan and selected-room
views. The sidebar lists rooms with their connected/total device counts, including
Outside rooms when present, and provides **House plan** and **Refresh from Home Assistant**.
Selecting a room opens its searchable device list beside the sidebar. No device is
selected automatically; choosing one reveals its connections and readings. The wide
source picker opens only after choosing a connection or starting Add reading.
Switching rooms clears device and connection selection. Outside rooms,
opening contacts, covers and dashboard sources remain available in the same flow.
There is no room dropdown, workspace back-to-plan link or HA-area control. Existing
room-area associations can influence suggestions but do not limit explicit compatible choices.
The floor picker is hidden while a room is open and remains available on House plan.

Each declared function has its own connection row and Connect or Change action.
Optional sensor readings are separate from device functions. Connection, source
availability and display on the model are independent states; an unavailable source
remains connected. A connected reading does not hide an unconfigured primary control or count that device
as complete. The plan and sidebar share the same connected/total counts.
Changing a source retains the object and its other mappings.

Manual candidates use the central domain/device-class compatibility policy. All
functions and independent readings search all HA areas, even before the room has
an area mapping.
Suggestions favor the current HA device and room, followed by one flat eligible list.
Search covers source names, parent device names, areas and exact entity IDs across
every candidate. Type filters apply to suggestions and the full list together.
Lists start with twenty results and offer more explicitly; filtering always searches
the complete candidate set. Source values and units help distinguish matches;
disabled, hidden, unavailable and shared sources retain their explicit status.

Lighting slots accept switch entities as on/off alternatives, after direct light
matches. Automatic mapping excludes fallback domains and remains area-scoped.
Controls follow the selected entity's actual domain and capabilities, so a plug
never acquires dimming controls. Manual shared mappings remain supported.

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
Openings. Opening controls use the same plan-to-room workspace. Composition
provides a stable manual contact slot for every opening except passages, while
preserving explicit profile slot IDs and polarity. Unbound openings produce no
missing-binding warning and do not count toward room connection progress.
Manual selection offers only binary sensors classified as door, window, opening,
or garage_door, across all areas including sensors without an assigned area.
Existing uses of that sensor are preserved. Opening cards and their inspector
use the shared cached thumbnail renderer with the actual procedural opening model.

Roll-up doors are architectural openings with optional garage-class cover slots
in addition to optional contacts. Both appear in the Openings mapping group with
the actual opening preview. Cover selection supports all areas, including entities
without an assigned area. The cover drives position; a valid contact supplies a
binary fallback when cover position is unknown. Unmapped opening slots do not
make a room look unfinished. Changing to a conventional door removes its cover
profile and browser mapping through ordinary draft reconciliation and history.

Auxiliary readings declared in Arrange Properties are optional, manual secondary sensor slots. They can map to separate HA devices or entities in any area, including entities without a device. Existing shared-entity mappings and usage indications remain. Furniture readings appear separately by their reading names in the room’s Devices list, or under Outside rooms when placed outside room polygons. Devices retain one primary control and list attached readings under Readings. Changing the primary HA device preserves its independently mapped readings.

Connect and Arrange Properties share a sensor-first **Add reading** flow. The user
chooses a sensor/binary sensor, then confirms a prefilled reading name and **Show
on model**. Creation adds the local slot and private draft mapping in one history
step, including furniture with no existing slots. Existing attachments are marked
Added. Cancel makes no changes; disconnected sessions cannot add a source. Undo
removes both the slot and mapping together, and redo restores both. Replacing the
editor's item state before committing keeps new readings present across mode changes.
Save publishes them through the normal workspace flow.

On mobile, device selection, connection selection and source search use successive
views with explicit returns. The House plan action remains available from the room.

TV models offer a manual smart-plug switch alternative for on/off control, including TVs created before this feature. This is a model-specific compatibility rule, not an unrestricted entity-filter override. Commands follow the actual mapped switch domain; camera or media controls remain available for their corresponding entities.

Room-device, device-connection and source headings share the same type, line height
and top alignment. The sidebar inherits standard editor typography. Intermediate
widths retain the room sidebar and device list while showing connections or sources
in succession. Mobile keeps the standard Tools panel for rooms below the work area.
