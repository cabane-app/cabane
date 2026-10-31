# Home dashboard, controls, and cameras

Home presents an orbital overview, room details, and walk mode. Orbital and editor 3D
wheel zoom responds immediately to normalized scroll distance, preserving the point
under the cursor. Small trackpad deltas stay precise; mouse-wheel steps use a
faster response. Pinch zoom retains its own sensitivity. In Orbit, selecting
a room smoothly centers its projected floor and wall bounds in the visible space
beside the controls, with fitted zoom and the same three-quarter angle for every
room. A critically damped transition retains velocity when another room is chosen
mid-flight. Dragging, pinching, scrolling or using camera buttons interrupts it;
selecting the same room again refocuses it. Reduced motion applies the destination
immediately. Returning to Overview, including Escape or Back, smoothly restores
the last manually chosen orbital view. The floor summary returns to that same view;
only Reset view restores default framing. Both floor pickers restore the selected
floor's remembered view, or default framing on its first visit.

The Orbit header combines the floor summary and room navigation in one top row.
The leading button uses the current floor name, connection indicator, session
information and home-presence summary. It replaces the separate heading and the
Overview label, scrolls in the same row as the rooms, and returns to the
remembered floor view when clicked. It also toggles a second row of floor pills.
Choosing a floor closes that row, clears the room selection, restores the new floor view
and updates the room list. Escape, an outside pointer press or selecting a room
closes the floor choices; Escape restores focus to the floor button. Empty floors
remain navigable. Scroll gutters leave room for pill shadows and focus outlines.

Room pills list only the active floor's rooms with their resolved HA names.
Pills, room surfaces, status labels and room shortcuts share selection behavior.
The selected pill is exposed to assistive technology and stays visible after
selection or resize. The strip is absent in Walk, roof view and device overlays,
which retain their contextual heading. Room details stay on the right on desktop;
narrow portrait layouts use a bottom sheet with a visible border and shadow.
The hero fills the sheet edge-to-edge and retains its sticky photo parallax.
Reorder and the labeled Walk inside icon sit on the left; Close sits on the right.
Only nested device details use Back to room, on the left. These actions overlay the hero, with reserved
space above wrapping room titles and status badges. The mobile room sheet occupies 54% of the
viewport, leaving the scene visible above it. Compact landscape keeps a side panel.
Dedicated device controls retain their existing modal layout.

In Orbit, clicking or tapping a connected light toggles its power directly.
Holding a dimmable light for 500 ms ramps its brightness between 1% and 100%,
reversing at either limit. Release stops the ramp without toggling power; the
next hold reverses direction. Dragging beyond the device's tap tolerance,
multi-touch camera gestures, cancellation, loss of focus, and leaving Orbit
cancel the press. Non-dimmable lights retain a simple power toggle. Unmapped or
unavailable lights and other devices keep their existing control-sheet behavior.
The same gestures control indoor and outdoor demo lights through the normal
in-memory runtime. Walk and draft Explore retain their existing interactions.

Interactive Orbit floors and wall faces use gently subdued base colors. Selecting
a room lifts its finishes and softens the others, without altering device lighting,
rebuilding geometry or adding render passes. Wall faces are associated with rooms
on their visible side, so the two sides of a shared wall can differ. Room changes
reset the panel's scroll position while retaining the panel itself.

Clicking a room floor or an inward-facing wall surface opens that room in orbit mode;
dragging to orbit does not select a room. Shared walls select the room on the clicked side. Room floors, interior wall faces,
and status overlays share a pointer cursor, floor highlight, and overlay hover effect. Room selection,
status overlays, device interaction targets, and application-owned controls
connect the scene to room/device control sheets. Scene session preferences retain
mode, selected room, and wall fading. The per-home action bar starts with Build, Walk, Night, Weather, and View,
in that order. Owners can remove, reorder, or replace every item and add direct links to current rooms
and modeled devices that have a room sheet, or the All lights off action. Room and device
icons share the built-in slot dimensions; rooms use Home Assistant photos or initials, and
devices use cached procedural model previews. Build groups Construct, Arrange, and Connect; View
groups wall fading, roof visibility, Top-down, Reset view, and Lock view. Room and device links select the correct floor and open the
room view or device sheet, including when leaving Walk. The bar shows the items that fit at usable
size and puts the rest under More actions. An intentionally empty layout hides the bar; Customize
action bar remains in Home's More options menu.
On mobile, device control sheets fill the viewport in portrait and compact landscape,
including when opened from an action-bar shortcut. Desktop device sheets remain centered.
Desktop hover opens trays above the dock; touch toggles them with a tap. Keyboard
users can open Build with B and View with V, use Arrow Up to enter a tray, and
dismiss with Escape. R toggles the roof; C, A, Shift+C, W, N, S, and L retain
the direct editor, walk, lighting, walls, and all-lights actions.
Saved legacy shortcut arrays are retained for file compatibility but never configure
the bar. An absent action-bar configuration gets the five starting items without a
storage reset; an explicit empty list stays empty. The existing direct keyboard
shortcuts remain available after an item is removed from the bar. Keyboard shortcuts also work in room view; walking keeps
its movement keys. Draft walkthroughs retain their dedicated exit controls and use the same dashboard
and walking controller as Home. Explore starts with the editor’s selected floor
(or the configured walk starting point) in an isolated floor-navigation scope;
crossing floors does not switch the hidden editor’s floor or rebuild its draft.

The floor picker uses directly selectable diamond layers at the bottom right in
Orbit, Construct, and Arrange. Hover or keyboard focus spreads the stack upward
and fades in floor names; the bottom layer stays anchored. On touch, the first
tap expands the stack and the next selects a floor. Expanded labels are also
click targets. Escape and outside taps dismiss the stack. Existing floor shortcuts
and unavailable walking-entry guards still apply. Show roof / Hide roof is available
in the action bar’s View group (R), and is disabled while walking. Roof view shows all floors, keeps walls solid,
hides room status overlays, and preserves the current camera position, angle, target, and zoom.
The diamond floor picker restores per-floor views in Orbit and preserves the camera in Construct and Arrange. Selecting a floor restores the
cutaway; entering Walk exits roof view, while retaining roofs and ceilings in the walking scene. Stair traversal preserves the physical camera
elevation while the active floor selection updates, including frames before that update commits. Construct exposes its existing floor actions
through Manage floors. Mobile placement clears the editor inspector, and reduced
motion disables the expansion and fade transitions.

Orbital position, target, orientation, zoom and Lock view are remembered per home
and floor in this browser's local storage. These preferences stay outside project
exports and HA sync, so devices keep independent views. Manual pan, orbit, zoom,
and camera buttons update the remembered view. Room-focus animations and Walk do
not. Reloading or returning from the editor or Walk restores the saved view, even
when a room remains selected. Viewport changes scale zoom to retain the visible
area; malformed, unsupported, or far-outdated poses fall back to normal framing.
Blocked storage keeps preferences in memory for the visit and retries on changes.

Top-down frames the floor from above. Reset view explicitly restores its default
three-quarter framing. Both actions remain available while locked. Lock view
returns to the remembered view and prevents camera gestures, wheel/double-tap
zoom, and compact camera buttons from moving it. Room and device selections keep
their controls without reframing. Unlocking resumes manual camera navigation.
These preferences do not restrict Construct, Arrange, Connect, or Walk cameras.

In Home overview and room focus, a compact cream toolbar beside the floor picker
provides zoom out, zoom in, and a 90° camera turn around the current orbit target.
Zoom respects the existing camera limits. Buttons have 44px touch targets and
keyboard labels; walk mode keeps its existing movement controls.

Room and device sheet module titles use the bound Home Assistant device’s custom
name, then its default name, then the primary entity’s name when available.
The modeled label remains the fallback when HA names are unavailable.
Room names use the mapped HA area name, falling back to the local modeled name when
the area is unmapped or unavailable. Those rooms show a broken-chain Connect icon
in overview labels and the room/walk heading, and a “Not connected” status pill
alongside temperature and humidity in room heroes.
On mobile, hide the room selection pills and keep the current floor pill and its
expandable floor choices. Rooms remain selectable in the scene.

Room and device controls use content-sized cards with wrapping titles and compact
sliders, toggles, and thermostat dials. Shared spacing stays compact across all
module domains while action targets remain at least 44px high.
Room controls derive from resolved typed slots. Implemented domains include
lights, switches/input booleans, climate (including Versatile Thermostat
presentation), covers, fans, media players, humidifiers, water heaters, vacuums,
locks, alarms, valves, sirens, selects, numbers, buttons, cameras, and sensors.
Domain controls inspect supported features and state attributes; not every HA
entity supports every possible action. Sensor-only content is read-only.
Optimistic commands reconcile with confirmed state and expose pending/error
feedback. Invalid or stale bindings limit mutation.

When multiple single-entity light modules share the exact same HA light entity,
the room overview shows its first module once. Individual scene devices and
their focused controls remain available. This also works for HA Light Groups
without discovering or storing group membership; distinct member entities and
modules with additional functions retain their own controls. Blocking connection
diagnostics remain visible.

Versatile Thermostat modules place a circular power button between the temperature
step controls when the entity supports the off HVAC mode. It toggles off/on;
turning on selects cool above the target temperature and heat otherwise, falling
back to a supported active mode. It shares optimistic state, command guards, and
feedback with the mode picker.

In the desktop climate card's two-column layout, selector menus expand below
their controls inside the card, keeping all choices reachable in the scrollable
panel. Compact layouts retain their upward-opening menus.

Presence and room-status summaries derive from runtime entities. Device-specific
sheets, room sheets, and camera viewing share the normal dashboard surface.
Visible scene lights respond to compatible light slots. Bound opening states
control their visual state outside Walk proximity. Every door opens locally near
the walker regardless of detector or cover state, so that state never blocks passage.
On departure or leaving Walk, the door resumes its bound state. Proximity never
sends a Home Assistant command. Missing HA data keeps the architectural scene usable.
The demo leaves door contacts and door covers unbound so doors, including the
garage door, open on approach and close on departure in Walk. Other supported
device controls and window contacts retain their simulated bindings. Real HA
opening bindings use the same local proximity override.

Televisions accept either a primary media-player binding for controls or a camera
binding for scene video and the camera viewer. Only camera entity bindings request
streams; existing media-player bindings remain valid. Camera-capable models select
a primary camera slot. Requirements are deduplicated
by entity. The stream coordinator manages sessions, document visibility, posters,
first-frame readiness, failure state, and cleanup. WebRTC is attempted where
supported, with HLS handling in a separate transport implementation. Camera
screens and the dedicated viewer consume the resulting media. Actual playback
depends on the HA camera integration, browser capabilities, and network access;
fixture coverage is not a claim that all household cameras have been accepted.

Implementation: [dashboard](../../packages/engine/src/CabaneDashboard.tsx),
[room controls](../../packages/engine/src/home-assistant-dashboard/RoomModule.tsx),
[control primitives](../../packages/engine/src/home-assistant-dashboard/control-primitives.tsx),
[room status](../../packages/engine/src/room-status/model.ts),
[stream coordinator](../../packages/engine/src/CameraStreamCoordinator.tsx),
[camera viewer](../../packages/engine/src/CameraViewer.tsx).

[Back to product overview](../../PRODUCT_SPEC.md).

Desktop Walk requires pointer lock. Explore requests it directly from the entry
click; if the browser refuses it, the editor shows a permission error. Mouse
motion turns the view and keyboard input moves only while the pointer is locked.
Acquiring or resuming pointer lock focuses the scene so keyboard input reaches the
native HA panel. Active walk keys stay inside Cabane instead of triggering HA shortcuts.
Space triggers a jump on desktop while pointer lock is active and device controls
are closed. Walking and sprinting continue during a jump; holding Space or
pressing it while airborne does not trigger another jump. The jump follows floor
and stair elevation. Its tucked-leg clearance can pass over low furniture, hedges,
and authored balcony railings or low walls while full walls and pool edges remain
solid. Leaving an elevated outdoor platform over rendered terrain transitions into
a fall to the ground floor. Catalog furniture can opt a flat top into Walk support;
the walker lands without horizontal correction, can move and jump on the top, and
falls naturally after stepping off. Mobile controls remain unchanged.
Escape or Back to editor exits the draft walkthrough.

Room selection updates finish emphasis independently of procedural architecture
and furnishing models. Opening or closing room details does not change lighting or
shadows; room and device point lights retain the overview shadow behavior. Scene callbacks, per-floor
manifests, and derived open-opening sets retain identity when their inputs are
unchanged. The development benchmark is
`node scripts/measure-room-opening-performance.mjs http://127.0.0.1:4173`.
It measures both the panel and the deferred React Three Fiber commit using an
isolated Chrome profile. On the bundled home at 1440×960, Chrome 152, five warm
samples reduced median scene React work from 82.3 ms to 8.3 ms and the final scene
commit from 117.7 ms to 38.1 ms. These are local development measurements, not a
universal device or end-to-end 10× speed guarantee.

Closing device controls while walking keeps the current walk camera and pose.
Browser pointer-lock loss or refusal pauses mouse input without changing views;
clicking the scene resumes mouse control. Explicit walk-mode exit remains available.
The Home menu opens Settings in the editor. Settings → Explore offers Invert Y axis
for mouse and touch look controls, preserving its existing browser-local preference.
Settings → Orbital view contains visual style, room overlays, lighting and weather.
The former Preferences dialog is removed.

The More options menu uses aligned action rows for Switch workspace, Send feedback,
and contextual connection actions. Send feedback opens the Cabane
GitHub issue template chooser in a new tab. Disconnect identifies Home Assistant in secondary
text. Browser-data export remains in Connect. The trigger and actions use pointer
cursors, visible keyboard focus, and 44px minimum action targets.

In the Shortcuts editor, clicking or tapping a shortcut selects it for editing.
The selected shortcut keeps its outlined style and edit controls when the pointer
moves away or over another shortcut; hover and focus alone do not change selection.
Native keyboard activation also selects a shortcut.

Shortcuts also offers searchable Scene and Script choices from the connected HA
runtime, with recognizable names and unavailable choices disabled. Both reuse
selection, replacement, reordering, removal, history, Save and overflow behavior.
Their Home buttons show pending requests and expose unavailable reasons; they do
not indicate an on/off state. Portable imports retain unmapped buttons and can be
reconnected in Shortcuts.
The web host offers an optional **Laser** action in Shortcuts → Add action,
alongside Lights off and View. It is absent from the default bar. Save the shortcut,
enter Walk, and select Laser to equip or unequip a procedural cartoon laser gun.
Leaving Walk unequips it. Desktop pointer lock enables center-screen aim and
left-click or F to fire; touch uses the existing sticks and two right-side icon buttons for zap and portal.
The initiating pointer-lock click does not fire. Overlays, hidden documents, and
paused mouse control disable firing. Stowing the tool restores ordinary device-panel interaction.

Shots raycast at trigger time. The first visible surface blocks the shot, including
walls and furniture; gun/effect geometry does not intercept it. Only a single valid,
available, fresh light binding can toggle, through the normal guarded runtime call
and demo adapter. Unsupported, ambiguous, or unmapped controls do not highlight the crosshair or issue commands; failed calls do not open a device panel or retry. Shots have a 300 ms
cooldown and cannot overlap a pending control. Reduced motion retains the targeting crosshair while removing recoil, the traveling pulse, muzzle flash, and impact burst. The experimental package
owns visuals and firing input; the engine owns generic tool installation and light
activation.

G equips or stows Laser while walking when its shortcut is on the bar, including
while the mouse is captured. The key does nothing in a text field or overlay.

Laser visuals use a layered ivory/brass procedural blaster with cyan energy details.
A short tapered pulse travels to the hit instead of leaving a full-length beam
suspended in the room. Its muzzle flash follows the gun and its impact burst
expands and fades at the collision point. The generated toolbar icon matches
the blaster and the existing sculpted action icons; it is never a scene texture.

Each accepted zap or portal shot also pops a short, ink-outlined **PEW!**, **ZAP!**, or **POW!** above
the moving muzzle. Procedural vector lettering, jagged cel-color bursts, and
outward speed marks vary in color, silhouette, tilt, size, and drift between
shots, with no adjacent palette repeat for primary fire. Portal bursts match the
blue or gold portal being fired. The compact effect is 30% smaller than its initial
size. Feedback replaces the previous pop on
rapid fire and never intercepts input. Reduced motion keeps a stationary,
briefly fading PEW without the pop, drift, or speed marks.

The blaster includes a matching padded glove. Idle breathing and speed-driven walk/sprint sway move the hand and weapon together; reduced motion disables these offsets. A text-free four-tick crosshair becomes cyan corner brackets only over an eligible light, using the same host-owned authorization guards as firing.

Shots now include a 300 ms flickering blue electrical arc with short branches, a slower bright traveling pulse, and a 550 ms blue impact burst. Surface-normal-aligned scorch patches cool from blue fissures to dark char and fade over 3.2 seconds. Up to twelve recent shots can coexist; these cosmetic marks never modify home geometry or device state.

With Laser equipped and mouse capture active on desktop, right-click alternates
between a blue and gold portal. A linked pair transports the walker from either
entrance to the other exit, including between floors when both landings are clear.
Portals fit on broad flat interior/exterior walls, indoor floors, outdoor slabs,
and terrain with supported exits; wall portals align to standing height. Terrain
landings reuse the rendered ground and its cutouts, require support across the
player radius, and retain obstacle checks. Upper-floor exits still require slabs. Invalid or overlapping placements leave the pair and next color unchanged.
Once paired, the oval shows a live perspective view through its partner, clipped
at the exit surface so its supporting wall does not obstruct the view. Unpaired
portals retain the energy membrane. The destination rim/ripple is excluded from
its own capture to avoid overlapping fragments during movement. Views are one
level deep, skip back-facing/off-screen openings, and use targets capped at 1024
pixels per side; reduced motion preserves perspective tracking. Arrival protection avoids
immediate return trips, and controls/overlays pause traversal. Stowing Laser or
leaving Walk hides the pair; equipping restores it from the home, including after reload.
Either fire action aimed at an existing entrance removes it and plays a short inward
collapse. Removal immediately disables travel; nearer geometry occludes the shot.
Reduced motion uses a brief still confirmation. Positions and next color autosave,
and failed writes restore the prior pair with a storage error. This first version is grounded travel: no ceiling
portals, retained launch momentum or flinging. Touch supports both actions and portal travel without pointer lock.
Successful portal placement fires the same electrical zap as primary fire, tinted
blue or gold to match its destination. Each portal blooms from zero with a brief
overshoot, settling rim and dissipating energy ripple; replacement replays it.
Reduced motion shows the completed portal immediately without the zap or bloom.
Travel between portals briefly covers the view in energy before the position change,
then eases open in the exit portal's color, with a small bounded lens effect.
Pausing or stowing cancels pending travel and restores the camera. Reduced motion
keeps only a short gentle tint and skips the lens/ring animation.
The desktop gun crosshair includes text-free primary/secondary fire cues: a left
zap glyph and right portal glyph, with matching highlighted mouse buttons. The
portal cue shows the next blue/gold placement color. In landscape touch Walk,
two right-side icon buttons fire zap and portal on contact. The portal button
shows its next color; the central targeting reticle and movement/look sticks remain.

Laser opts into the default shortcuts through installed-tool metadata. All homes
using the default bar receive it, and Shortcuts → Restore defaults includes it.
Explicitly customized bars remain exactly as saved. The engine does not hardcode
a gun ID or import the optional gun package.

Orbit controls retain their pointer listeners across dashboard updates, including
updates during a gesture. One-finger panning, two-finger rotation/pinch zoom, and
desktop drags must continue through re-renders and release cleanly for the next
gesture. Manual input still interrupts a room-camera transition.

Room overlay preferences are available from More options in overview, room view,
Walk, and draft Explore. Temperature, humidity, heating, cooling, lights, presence,
and open-door indicators each default to enabled. Choices persist in browser-local
preferences and affect overview labels, accessibility text, and decluttering, while
room detail sheets retain all available information. The dialog scrolls on short screens.
Temperature and humidity prefer a usable sensor explicitly selected on the mapped
HA area, then fall back to the first usable mapped room sensor of that device class
in resolved order (primary, secondary, diagnostic, then modeled devices).
Unknown, unavailable, and stale readings are skipped; unbound area sensors are not
fallback candidates. This does not create bindings or change HA configuration.

Room panels offer Reorder devices beside Walk inside when at least two modules are visible. Reorder mode displays a compact list with pointer/touch drag handles and keyboard-accessible up/down buttons. Done or Escape returns to controls. Each move saves browser-local order per home and room using local module IDs; new modules append in default order and missing modules are ignored. Ordering does not change bindings or call Home Assistant services. The normal grid follows the saved sequence without dense gap filling.

Weather shares the Build/View tray interaction: desktop hover or click, touch tap,
Arrow Up to enter, arrow-key navigation, and Escape to dismiss with focus restored.
The action and six submenu choices use sculpted illustrations matching the existing dock.
Build and Weather reuse the same SceneActionButton component, slot face, tray layout, and styling.
Live (the default with an available weather entity) restores the configured HA source.
Without weather entities, Sunny is selected by default and Live is disabled. Sunny, Cloudy, Rain,
Thunderstorm (with rain), and Snowy are scene-only previews, available without HA.
HA continues to resolve every supported condition, including the finer weather variants
not exposed in the compact preview menu. The active
selection lasts through camera/floor changes but resets when leaving or reloading
the home. Sunny uses clear weather and never changes time of day. Weather is removable/reorderable; saved
custom bars, including empty bars, retain their layout. There is no weather hotkey.

### Room cleaning

The room sheet offers **Clean** beside Walk when an enabled, visible HA vacuum
supports `CLEAN_AREA` and maps that room's HA area to nonempty vacuum segments.
Cabane uses the explicit Connect room-to-area binding, never room-name matching
or the vacuum's dock area. No modeled vacuum device or per-room vacuum slot is required.
It reads `options.vacuum.area_mapping` with `config/entity_registry/get` on demand;
registry updates and reconnects invalidate those readings. Mapping failures show a
retry action and cannot issue a cleaning command. Missing mappings hide Clean.

One matching robot can be started directly; multiple matches require choosing one.
Disconnected, unavailable, stale, or pending controls cannot dispatch. The command is
`vacuum.clean_area`, targeting only the chosen vacuum, with
`cleaning_area_id: [areaId]`. HA owns translation to segments and robot integration
behavior. Acceptance shows “Cleaning requested”; failures remain visible for retry.
There is no whole-home or manufacturer-specific fallback. Older integrations without
area-cleaning support retain their existing vacuum device controls.

Demo vacuum slots expose synthetic area coverage and accept the same command in
memory. Neither coverage nor real HA IDs are added to the portable home project.

Mapped robot-vacuum models hover around 1.5 model-space meters while their confirmed,
available state is cleaning, with a smooth rise and fall bounded between 1.11 and
1.89 meters, gentle tilt and lateral drift, a rotating hull, ascending beam rings
and dust. The beam stretches with the hull height while staying anchored at the
floor. Reduced motion resets to a level, stationary 1.5-meter pose. A successful Cabane room-clean request records
its destination in session memory so the modeled robot moves to that room on its
rendered floor. It returns to its authored placement when cleaning stops. This is
a decorative status visualization, not robot localization: external cleaning has
no inferred destination and remains at the authored location. The destination is
not persisted or written to HA. The activity studio includes a simulated vacuum.

Item state visibility offers Always, Never, and Only if present. Existing true/false choices retain Always/Never behavior. Only if present requires a fresh, available state: booleans must be true/on, numbers must be greater than zero, and text must be nonempty and active (not off, closed, absent, idle, standby, unknown, unavailable or none). Missing, stale and unavailable values are hidden in this mode.

Room labels, connection states and attached readings share one screen-space collision check and the existing viewport-dependent overlay limit. Card dimensions include multiple readings and wrapped labels; the layout follows camera movement, floor elevation and viewport resizing.

Opted-in item readings appear above the furniture or device in the 3D map, with the authored label, state and reported unit. Unavailable, stale and unconnected readings show status text instead of a last-known value. These badges are non-interactive and hidden in Walk and editor previews. Auxiliary fridge/freezer telemetry does not become the room’s ambient temperature or presence. Map visibility and dashboard visibility are independent.

## Walk tool extensions

Optional walk tools are installed by the web host through `CabaneDashboard.walkTools`.
The engine exposes `WalkToolDefinition`, `WalkToolProps`, and `raycastWalkScene` at
its public root. A definition supplies an ID, label, icon, and scene module; its
injected `activateTarget` accepts a modeled target and returns user-facing success
or unavailable feedback. Runtime entity resolution and authorization remain in
the engine. Tools receive no HA client, credentials, or household entity IDs.

`packages/walk-laser` is an optional experiment, installed only in
`apps/web/src/walk-tools.ts`. Its scene, model, effects, input, and CSS load when
first equipped. Equipping prepares and retains the weapon and shot-effect shader
programs, including the host’s offscreen render variant, before trigger input.
The engine, catalog, and home never import it. Removing that
registration and dependency removes the feature; stored `walk-tool` shortcuts
remain readable and render as unavailable. The generic shortcut schema retains
unknown tool IDs to preserve portable projects between hosts with different tools.

Walk tools also receive `WalkToolNavigation`, a generic injected relocation
interface. `resolveLanding` finds a clear supported floor near a world-space feet
position; `teleport` revalidates that landing and updates the authoritative walker,
camera, selected floor and room, resetting velocity and jump state. The controller's
adapter lives in `walk-tools/useWalkToolNavigation.ts`; support/collision resolution
lives in `navigation/walk-landing.ts`. Its optional terrain-support query reads the
existing ground mesh (including pool/stair cutouts) to admit clear outdoor exits
on the ground storey; ordinary spawn defaults are unchanged. Portal placement, pairing, traversal, input,
and rendering remain private to `walk-laser/src/portals/`. Live destination views
use package-private camera transforms, exit clipping, and bounded scene captures
with the existing renderer and scene supplied by the canvas. No portal rendering
contract or dependency is added to the engine, catalog, or home.

The first gun equip shows a compact introduction styled like the editor tutorial.
It explains device toggling and paired portal shortcuts with mouse or touch controls.
Users dismiss it with Got it (or Enter while the pointer is captured); dismissal
stays in browser-local storage, with a session fallback if storage is unavailable.

Gun targeting supports lights, fans, AC climate modes, televisions/media players,
and sprinkler switches or valves. One unambiguous, available binding is required;
explicit slot targets remain scoped to that slot. Shots switch power on/off or
open/close valves through the existing guarded runtime commands.
