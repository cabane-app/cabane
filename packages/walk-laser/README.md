# Optional walk laser

Install `laserWalkTool` from `@cabane/walk-laser` in the host's `walkTools` list and
pass the same list to the shortcut editor. Cabane's engine never imports this package.
Remove the entry in `apps/web/src/walk-tools.ts` to disable the experiment.

The public module exports one definition. Its lazy scene owns the toy, HUD, raycast,
input listeners, recoil, beam, and shot gate. `activateTarget` is dependency injection:
the host resolves modeled targets and returns feedback, without exposing HA clients
or entity IDs. The gun uses a small separate scene rendered after Cabane's scene
pass, preserving its own depth and preventing walls from clipping the view model.
All visible geometry is procedural and uses the engine's public toon material.

Add Laser through Customize action bar, Save, then equip in Walk. Click or F fires
with mouse capture; touch uses the right-side zap button. The host restricts activation to valid lights.
No state is persisted except the shortcut's tool ID. Unequipping unmounts the scene,
removes input listeners, cancels visual timers, and suppresses late result updates.

G equips or stows Laser while walking when its shortcut is on the bar, including
while the mouse is captured. The key does nothing in a text field or overlay.

The current blaster is split into receiver, barrel, grip, and muzzle-flash models
under `src/laser-gun/`. Ivory armor, graphite/plum recesses, brass trim, and cyan
reactors inform the simplified action icon in `src/assets/laser-icon.svg`. The
authored vector keeps the action bar’s broad shaded planes, with the blaster’s
cream shell, plum chassis and grip, gold trim and cyan side reactor.
The icon is a UI-only vector. Scene models remain procedural; portal views use only in-memory captures of the existing toon scene.

Shot visuals travel at 180 m/s with an at-most 0.8 m tapered luminous tail. They
never fill the muzzle-to-hit distance. A 45 ms muzzle flash follows the actual
model emitter; the hit creates an expanding, fading 120 ms spark/ring burst.
No impact is drawn for misses. Reduced motion suppresses all firing effects.

The icon is the silhouette reference for the rounded redesign: sculpted, beveled
side profiles replace stacked rectangular panels. A lathed open gold muzzle,
domed reactors, three slanted vents, swept grip, curved guard, and soft ivory
heel preserve its distinctive shapes. These models remain procedural and toon-shaded.

The blaster includes a matching padded glove. Idle breathing and speed-driven walk/sprint sway move the hand and weapon together; reduced motion disables these offsets. A text-free four-tick crosshair becomes cyan corner brackets only over an eligible light, using the same host-owned authorization guards as firing.

Shots now include a 300 ms flickering blue electrical arc with short branches, a slower bright traveling pulse, and a 550 ms blue impact burst. Surface-normal-aligned scorch patches cool from blue fissures to dark char and fade over 3.2 seconds. Up to twelve recent shots can coexist; these cosmetic marks never modify home geometry or device state.

Secondary fire (desktop right-click or the right-side touch portal button)
places a blue portal, then a gold portal, alternating only
on successful placement. Aim at a broad flat wall or floor, right-click with the
mouse captured or tap the portal button, and walk into either linked oval to emerge from its partner.
Indoor floors, outdoor slabs, terrain, and exterior walls are supported when the
full oval fits and the exit is clear. The navigation adapter checks the existing
terrain mesh for ground-storey support, retaining pool holes and edge clearance;
upper floors still need slab support.
Walls align the oval to standing height. The whole oval must fit; ceilings, devices,
furniture, overlapping portals and unsupported/blocked exits are rejected. An unpaired
portal has a toon energy membrane; a linked pair shows the live scene beyond its
partner, with perspective tracking as the walker moves.
Portal positions and the next color autosave with the home. Stowing or leaving Walk
unmounts their visuals; re-equipping restores the saved pair, including after reload.
Either fire action aimed at an existing entrance removes it, with a 400 ms inward
collapse (a short still confirmation under reduced motion). The entrance stops
transporting immediately. Nearer scene geometry blocks removal shots.

The engine exposes only `WalkToolStorage`, a namespaced JSON read/write adapter.
The web host saves opaque tool state to both home slices through the existing
revision-checked repository, without publishing pending editor changes. The gun
package owns its versioned codec, support revalidation, targeting and lifecycle.
Portable exports, workspace copies and private backups retain portal state.
Failed writes report a host storage error and restore the previous pair. Damaged
anchors are ignored; entrances whose support or landing no longer fits are pruned
when the gun is equipped.

`src/portals/` owns the feature: placement geometry, alternating pair state,
traversal, desktop input, the coordinating hook, and the procedural surface each
have a dedicated file. Its only movement dependency is the injected generic
`WalkToolNavigation`: `resolveLanding` checks supported feet positions;
`teleport` rechecks the exit and atomically commits position, facing and floor.
The engine owns collision and resets jump/velocity state; it knows nothing about
portal colors, triggers or pairing. Traversal pauses when controls are unavailable,
requires entry from the front, and blocks the arrival portal until the player moves
clear. This version uses grounded travel, without momentum/flinging or ceiling portals.

Successful portal shots reuse the primary electric arc/pulse/impact through
`useLaserShots`, tinted with the same blue or gold as the new portal. They do not
leave a scorch on its membrane. `usePortalAppearance` owns a 550 ms bloom from zero,
a brief overshoot and settling rim, plus an 800 ms expanding energy ripple.
Replacing a portal replays the arrival. Reduced motion suppresses the zap and
arrival movement while preserving the fully formed portal and travel.

Portal travel uses a package-local transition coordinator: a 95 ms energy veil
covers one rendered frame before relocation, then reveals the exit over 320 ms.
A bounded 3° field-of-view easing adds a slight sense of passage; no camera path
crosses intervening geometry. Cancellation restores the original lens and discards
pending travel. The controller revalidates the exit at the covered cut; a rejected
exit reveals the original view. Reduced motion relocates immediately with a gentle
120 ms tint and no lens/ring movement. Transition timing, the React hook and the
screen-space veil each live in a dedicated portal file; the engine is unchanged.

The desktop crosshair shows a zap glyph on the left and a portal glyph on the
right, each with its corresponding mouse button highlighted. The portal glyph
uses the next placement's blue/gold color; successful placement updates it from
the pair's own alternating state. These cues contain no visible text, preserve
the central light-target highlight, and are omitted on touch devices.

Live portal views stay entirely in `src/portals/`: `portal-view-camera` owns the
rigid doorway transform and oblique exit clipping; `portal-view-renderer` owns
bounded GPU captures with the host renderer/scene injected; `usePortalView` owns
frame ordering and cleanup; `PortalView` owns projective display. Captures run
after camera updates and before the main scene pass, skip back-facing/off-screen
portals, and cap each target at 1024 pixels on its longest side. The exit's own
rim/ripple is excluded to avoid moving overlap artifacts. Other portals show
only their membrane in the capture (one level, no recursive hall of mirrors).
Renderer state and temporary visibility changes are restored even on failure;
stowing disposes both targets. Reduced motion retains live perspective tracking.
The view reuses the host's current toon geometry and lighting; it does not
activate extra floor lights or run another contour postprocessing pass.

Touch uses two separate right-side icon buttons for zap and portal, with the next
portal color shown on its button. Both fire on contact without taking over a
second finger on the movement/look sticks. Portal travel does not require pointer
lock on touch; disabled controls and overlays still prevent firing and relocation.

The exported tool definition sets `defaultShortcut: true`, so the host's generic
action-bar resolver includes Laser in default/restored bars without gun-specific
core logic. Explicit custom configurations are preserved.
