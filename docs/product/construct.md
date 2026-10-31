# Construct

Construct is an implemented 2D plan editor. Two-finger trackpad scrolling pans
the plan without clicking or changing tools, including during construction.
Pinch (or Ctrl/Command-scroll) zooms around the cursor. After Select, the toolbar orders
Wall, Openings, Floor and Stairs, followed by Measure and Decorations. Wall groups
Wall, Invisible wall and Outdoor space; Openings groups Door, Passage and Window.
Hover, click/tap or keyboard activation reveals each group in a floating disclosure.
Existing tool shortcuts and tutorial actions still select the individual tools directly. Users can edit wall endpoints and
positions, choose wall finishes and thicknesses, identify rooms, place and resize
openings, and change supported opening models/orientations. The floor inspector
also controls default wall/ceiling settings. Select a door, window, or passage and
its shared Properties inspector opens automatically to edit width and height. Passage Properties also
controls rectangular/arched shape and arch rise. Valid width and height edits update
the scene immediately. Sizes that do not fit report an error; leaving the field
restores the accepted value. These edits use the ordinary
preview, undo/redo, autosave, and Apply flow.

Doors, windows, passages, and walls (including invisible walls) expose a Name field
above Dimensions in Properties. Unnamed items display their existing identifier.
Enter or leaving the field commits a trimmed name; Escape cancels the edit.
Clearing the field restores the identifier fallback. Names persist through history,
reopening, export/import and Apply. Door/window connection labels use the custom
name while architectural identifiers, binding slots and existing mappings stay unchanged.

Add floor above/below opens a dialog with an empty-plan default and a
“Duplicate this floor” option for the selected floor. Copies are appended above
the top floor or below the lowest basement, and retain the source floor's height,
architecture and finishes. Every copied identity and internal architectural
reference is remapped. Furniture, devices, Connect profiles and private Home
Assistant mappings are never copied. Connecting stairs and building-wide settings
remain unchanged. Cancel leaves the workspace untouched;
adding a floor is one undoable workspace edit using existing persistence formats.

Niche uses the same wall placement preview, single-shot selection, dragging,
width handles, marquee, duplication and deletion system as doors/windows.
Decorations groups Niche, Boundary and Pool in a floating disclosure outside the
scrolling tool strip. Mouse hover, click/tap and keyboard activation open it;
Escape or clicking outside closes it. Select Niche, then click the desired wall
face. Properties exposes width, height, depth and height from floor, with a wall-face
switch and optional shelf settings. Depth is capped at the current wall thickness
minus 20 mm so the backing remains solid, including when moving to a thinner wall
or reducing its thickness. Resizing a wall removes niches whose width or height
no longer fits; Undo restores the wall and its recesses together.
The old wall-sidebar add form is removed. Recesses remain wall-owned in persistence;
full workspace import/export preserves existing niche IDs and shelves. External
plan generation still excludes optional niches. These changes use ordinary
preview, validation, undo/redo, autosave and Save.

The “Have a floor plan?” sidebar block is temporarily disabled by
`PLAN_IMPORT_ENABLED` in `EditorWorkspace.tsx`. Its implementation is retained for
reintroduction; the following describes that currently hidden workflow.

Generate from a plan opens copyable instructions for the user's preferred external
AI tool. The instructions include a complete JSON Schema for the single-floor,
unfurnished subset of HomeProject V2, scale calibration, geometry rules, and
assumption reporting. Only the current workspace ID is included; Cabane does not
upload images, call an AI service, or collect an API key. The dialog explains that
the chosen AI provider processes the plan. Users attach the plan in that tool and
save the resulting project JSON.

The adjacent Import JSON action accepts a file or pasted JSON through the same
validated draft-import path as Connect's import. It replaces the entire current
draft, rather than merging a floor; the UI recommends a blank home and explains
the replacement before import. Failed imports retain the existing draft and show
an error the user can send back to their AI tool. Successful imports are undoable
and still require review in Construct/Explore and ordinary Apply. Editor keyboard
shortcuts do not operate behind an open dialog.

The Roof disclosure controls the building-wide gable ridge direction (left–right
or front–back in plan, or Flat for no gable rise), roof color, and trim color. Gable and slab infill inherit
the adjoining exterior wall finishes; trim color applies only to the thin roof
edge and underside. It uses the normal workspace
history, autosave, export/import, and Apply flow. After Apply, Home's Show roof
action displays the result. Pitch, thickness, and flush overhang are automatic;
per-section controls and roof drawing are not exposed.

Wall drawing snaps to the grid, endpoints, wall segments, and angle references;
Alt bypasses snapping. Alignment guides match unfinished opposite sides, including
rotated rectangles. Editing a corner uses fixed neighboring edges for the same
45°/90° assistance, considering both incident edges without snapping to the moving
geometry. Attaching a segment to another wall retains the assisted angle by
intersecting that direction with the destination wall; when no assisted direction
is reachable, a nearby perpendicular attachment is offered. Endpoint magnets,
finite wall bounds, and Alt bypass still apply. Walls, hedges, pools, and custom
floor outlines share this assistance.
The first click establishes the starting anchor without adding a segment; a drag
past the activation threshold or a subsequent click places the wall. Closing a
loop ends the drawing chain. Topology derives
rooms, interior/exterior wall runs, junctions, footprint regions, and ceilings
from the editable wall graph while retaining room identities where possible.
Incomplete shells and ambiguous room merges produce actionable diagnostics.
Rooms exist only inside wall-enclosed areas, so an open plan with several named
areas separates them with `virtual` walls. Topology treats a virtual wall like any
other boundary and preserves the flag through draft creation and re-derivation.
Choose Wall → Invisible wall to use the same endpoint, click/drag, snapping, measurement,
loop-closing and history flow as physical walls. Invisible boundaries appear as dashed
lines in Construct and remain selectable and editable, but have no physical finish,
opening or item support. Arrange ignores them when snapping items; project validation
rejects attachments to them. Physical opening clearance ignores their junction arms.

Selection includes individual targets and Shift-drag marquee selection. Drag
activation distinguishes a click from an actual move. Opening placement avoids
occupied spans and enforces wall support. Placement previews, moves, resizing,
and duplication share the validator’s junction clearance calculation, using
current wall intersections and the opening sill height. Copy/paste duplicates openings within
the current mode. Delete and history shortcuts ignore text inputs and unsettled
gestures. Selected rooms also expose an on-canvas Delete action. Room deletion
removes exclusive boundary spans and their openings, preserves walls shared with
unselected rooms, and splits source walls where only part is removable. Shared
boundaries incidentally touched by a room marquee remain; wall-only deletion
still removes a directly selected wall. A room enclosed entirely by shared walls
explains that its walls must be edited. In Properties, the separate Actions
section provides deletion. The Room section starts with **Use as room**, enabled
by default for enclosed spaces. Turning it off fills the space as a structural
block for cupboards, shafts or pillars, keeping its walls and saved room identity. Name, accent, floor finish and ceiling
controls are hidden until room use is restored. Solid spaces have a neutral plan fill
without a room label, remain selectable in Construct, and render at the floor's
default wall height. They are excluded from Home room navigation, room status,
Connect area mapping and walk connectivity diagnostics. Connect keeps them visible
as muted structural blocks in the plan with a Not a room key, without room
labels, selection or mapping actions. Their boundaries block
walking even where an opening exists. Toggling back restores the saved name,
finishes, ceiling and room profile through ordinary undo/redo and save flows. Removing the final room clears its floor
preview instead of keeping the last closed shape. Deletion is one undoable edit.
Tool shortcuts include V/W/D/N/A/F/P/M; Escape cancels the active drawing
or selection state. Measure displays lengths and supports copying a result.

Floor painting supports a whole room, a custom room zone, and outdoor ground
zones. Selected rooms and outdoor platforms expose the same floor finish palette
directly in Properties. Changing a room's finish there applies immediately,
preserves custom floor zones, and supports ordinary undo/redo. Repainting a room
with the Floor tool asks whether to keep or replace existing zones.
Polygon drawing has local undo/redo and cancel behavior. Pools are
outdoor polygon basins with validation, collision, and rendered cutouts.

Diagnostics are contextual to the current tool and share the editor-wide issue
panel. Canvas errors use compact error-icon and number badges. Hover or keyboard
focus opens a readable, wrapping popover with every grouped error and its recovery
suggestion; Escape dismisses it. Locate selects and focuses the offending editable
object, including individual openings and niches, rather than the error marker. Apply uses the full issue set, including project,
topology, dependent placement, and walk-navigation errors, regardless of which
issues are currently displayed. Explore opens an eye-level draft preview with
non-operative HA controls. Editor changes remain browser-local until exported;
Apply changes the browser's Home view.

Boundary (H) draws connected segments with the shared drag and snapping controller.
Choose Clipped box, Rounded, Bushy, Tall mixed hedge (oleander and evergreen
laurel), or Ivy-covered wall from a thumbnail grid using Arrange’s shared preview
renderer and cache. New styles use suitable default dimensions; restyling an
existing hedge retains its height and width. Both dimensions remain editable. Select a
hedge to move it or drag either endpoint; deletion, undo/redo, project export,
and Apply preserve boundaries. The picker retains all five hedge styles and adds Picket fence, Privacy fence, Post and rail, Metal fence, and Low masonry wall. Existing `hedges` records, IDs, style IDs and dimensions remain unchanged; new styles use the same record and lifecycle. Restyling retains dimensions. All styles are procedural toon geometry and block walking across their continuous segment envelope, including gaps between rails or bars. Leave explicit segment gaps for entrances; garden and driveway gates are deferred.

Wall, hedge, pool, and custom floor outlines share segment drawing gestures, snapping,
angle references, and edge measurements. Pool and floor outline editing shares
a dedicated drag controller and outline measurement presentation.

Implementation: [construction controller](../../apps/web/src/editor-preview/construct/useConstructEditor.ts),
[pointer interaction](../../apps/web/src/editor-preview/construct/ConstructionEditLayer.tsx),
[tool settings](../../apps/web/src/editor-preview/construct/ConstructionInspector.tsx),
[selected-object properties](../../apps/web/src/editor-preview/construct/ConstructionSelectionProperties.tsx),
[topology](../../packages/engine/src/home-editor/construct/topology.ts),
[floor drawing](../../apps/web/src/editor-preview/construct/useFloorZoneDrawing.ts),
[contextual validation](../../apps/web/src/editor-preview/construct/contextual-validation.ts).

[Back to product overview](../../PRODUCT_SPEC.md).

The shared floor picker supports Construct, Arrange, Connect, Walk, and Orbit.
Construct and 2D Arrange show the selected floor. Construct can independently show faint guides from the immediately adjacent floors
above and below. Both default on when a neighbor exists, including basement levels.
Enabled guides supply wall alignment snaps; hidden guides do not. The same
reference list drives toggles, drawing, and snapping. 3D Arrange and Orbit show floors through the selected level; Orbit
also offers Show roof for an exterior view of the complete building. Connect retains bindings for every floor.

Construct supports adding above and below, renaming, and changing floor height.
“Add floor below” creates an empty lowest basement, named Floor −1, Floor −2,
and so on. Only the top above-ground floor or lowest basement can be removed,
with confirmation and undo. Ground cannot be removed. Reordering and duplication
remain excluded.

A compact row above the Construct sidebar introduction keeps the current floor
visible independently of the active tool. Its styled menu lists floors from top to
bottom, marks the current floor, and ends with “Add floor above” and “Add floor below”,
which create and select an empty top floor or lowest basement. The adjacent Floor settings icon opens the existing name and floor-height
dialog. The row shares navigation, edit locks, and undo history with the retained
corner floor picker; adding or switching does not copy rooms or furnishings.
The menu supports arrow keys, Home/End, Escape, and outside-click dismissal.
Settings use labeled editor fields and neutral Cancel / primary Save actions.
Settings also expose Delete floor, which opens the existing removal confirmation
and remains undoable. The action is disabled with an explanation for the ground
floor, above-ground floors with another floor above, and basements with another
basement below. Removal includes connecting stairs, items, and private draft mappings.

Separator walls may end freely, inside or outside a room, without a closure error or blocking Apply. A floor still needs at least one closed room; individual walls do not. Separator walls retain their geometry, openings, and collision behavior across save and reload.

Straight stairs share Construct’s initial-click anchor, drag threshold, and subsequent-click
segment completion with walls and hedges. Drawing and endpoint editing use grid,
wall, angle, and alignment snapping from both connected floors; Alt bypasses snapping.
Completion selects the staircase. On either connected floor, drag its body to move,
either endpoint to change length/direction, or either side handle to resize width
symmetrically. Measurements update throughout the gesture. Escape and interrupted
gestures cancel; each completed gesture is one undoable edit.

Stairs also support L-shaped and spiral connections between adjacent floors. Choose
Straight, L-shaped, or Spiral before drawing from the left sidebar's procedural 3D
preview palette, styled like the door picker, or in the selected stair's properties.
During placement, the sidebar groups the previews, shape-specific instructions, and
Cancel stairs action; no floating placement panel covers the plan.
Changing shape retains its ID, connected floors, and lower entrance position.
Existing stairs without an explicit shape remain straight. Stair properties offer Railings: Both sides (default), Left side, Right side, or None. Sides follow the route while walking upstairs, including turns. Changes use existing autosave and undo. The setting controls flight and landing side rails; guards around an upper-floor opening are derived separately from the supported floor edge.

Multiple staircases may connect the same adjacent floors. The Stairs tool always
starts a new placement; select an existing staircase to edit it. Each connection
has its own shape and dimensions. Overlaps are advisory and do not block Save.

L-shaped stairs use two perpendicular flights and a square level landing. Click the
bottom, landing center, and upper endpoint; the final point chooses the left/right
turn. Width, lower and upper flight lengths, and turn are editable. Endpoint,
landing, and width handles adjust the shape; dragging the body moves it.

Spiral stairs use a center point and an outer-edge point for placement. Diameter,
rotation, clockwise/counterclockwise direction, and total turn (greater than zero,
at most 360 degrees) are editable. Diameter handles resize around the fixed center;
the orientation handle rotates the entrance. A fixed 0.1 m radius central support
sets the inner edge of the usable width. New spirals default to 2 m diameter and a
360-degree clockwise turn. New L-shaped stairs default to 1 m width, equal flight
runs of 0.75 times the floor height, and a right turn.

During stair drawing, movement, and resizing, a labeled, noninteractive guide shows the
other connected floor’s footprint, walls, openings, and pools. The active floor and saved
Show floor below preference remain unchanged. Diagnostics update during gestures at most
every 100 ms, with immediate validation of the release point. Nondegenerate stairs remain editable in the autosaved draft. Width and slope are
not modeling restrictions. Physical intersections and unsupported landings produce
nonblocking warnings; malformed dimensions and invalid floor connections still block
Apply. Spiral diameter must exceed its 0.2 m core diameter and turn remains in (0, 360].
Numeric fields show local correction messages while retaining the last renderable geometry.

Selected outline handles take pointer priority over overlapping plan objects. Outside
the handle hit targets, ordinary scene picking keeps its distance order.

The canvas shows measurements, never paragraphs of stair errors. Placement warnings
are collapsed behind a count in the placement panel. Selected-stair warnings also
appear in Properties; the shared Issues tray retains all contextual draft diagnostics. Warning-only stairs
remain publishable directly through Save. This tool models a home; its
warnings are not construction-code certification.

Resizing a wall deletes doors and windows whose full width or height no longer
fits the wall. Undo restores the wall and its removed openings together.

The side panel can set, move, or reset one home-wide walk starting point. Click
inside the active floor to place its Construct-only pointer; Escape cancels. The
point follows workspace history, autosave, export/import, and Apply. Walk entry
uses its floor and position, with the default facing direction. Without a point,
existing automatic spawn behavior remains. A blocked point reports an error
until moved or cleared; deleting its floor resets it.

New blank homes open with Wall selected. Construct displays a noninteractive,
world-aligned grid with 1 m divisions and 0.1 m subdivisions matching snapping;
fine lines fade at lower zoom. The initial blank floor shows drawing guidance
instead of the expected empty-floor/walls-required diagnostics. Only presentation
is deferred: Apply continues to reject an empty layout and retains the complete
validation list.

Newly enclosed rooms receive the first available “Unnamed room N” name, avoiding
existing room names across all floors (ignoring case and surrounding whitespace).
Existing room names are preserved. Room names are editable directly on the plan, including an explicit “Name room”
control for unnamed rooms. Enter or blur commits a nonempty trimmed name; Escape
cancels. Naming uses ordinary undo/redo and autosave and is disabled during active
gestures. Unnamed rooms are valid saved drafts; they still require names to Apply.

The Spawn area disclosure in the Construct sidebar groups the Explore starting-point controls. The sidebar sections appear in this order: Reference plan, Roof, Spawn area, Scale & heights, and Tutorial. Each has an outline icon and a short description visible while collapsed. Scale & heights contains the former Floor settings controls. The Advanced structure-data section is no longer shown.

Door offers six catalog presets: Panel wood, Panel white, French, Full glass,
Sliding wood, and Garage door. Its sidebar follows the Floor palette hierarchy,
with cached procedural 3D thumbnails shared with Arrange and Connect. Presets
set motion, style, finish, applicable leaves, and metre-based dimensions; manual
edits remain available and unmatched configurations read Custom. Only attributes
are saved, never a preset identifier. The session retains the next placement
configuration, and placement returns to Select. Selected-door properties use the
same picker; replacements preserve identity and offset, reject sizes that do not
fit, and commit through ordinary undo/redo. Roll-up doors have an installation
side but no hinge, slide direction, or leaf count.

## Reference plans

Construct offers a persistent Reference plan disclosure below the introduction
and active tool settings. Selected-object properties occupy the right inspector;
contextual diagnostics occupy the shared Issues tray.
Its expanded contents include a Show reference plan checkbox and opacity slider. Roof, Spawn area, Scale & heights, and Tutorial remain below those properties. The
active tutorial retains its floating desktop placement. New or restarted
tutorials begin with an optional Add a reference plan step; Skip proceeds to
walls, which remains step 1 of 6. Accepting a reference, or beginning wall
construction, advances this optional introduction. Existing tutorials do not
rewind to it.

One PNG, JPEG, WebP, or SVG reference can be selected or dropped onto each floor.
Files are limited to 20 MB and 32 megapixels. SVGs are decoded as images, with
scripts, external resources, and unsupported embedded content rejected. Importing
an image does not generate architecture or activate the separate AI/JSON import.

The reference starts centered at 80% of the current viewport with 50% opacity.
Adjust offers canvas drag movement, proportional corner resizing, and rotation. Set scale uses two image
points and a known positive distance in metres, holding the first point fixed.
Done locks the reference and restores drawing interaction; Cancel restores the
previous reference. Escape cancels a gesture before exiting adjustment. Switching
floor or editor mode cancels unfinished adjustments. Pan and zoom remain usable.

The browser image sits between a camera-synchronized grid/floor background and
the architecture foreground; it remains readable after rooms close. It never
becomes a home texture or appears in Arrange, Explore, or Home. Visibility and
opacity are independent of the floor-below guide. Reference adjustments use the
same session Undo/Redo timeline as architecture, without changing published home
data. Storage errors appear in the section with Retry.

U-shaped stairs use two adjacent parallel flights and a flat 180° landing. They share
the L-shaped stair controls: lower/upper flight lengths, width, and left/right turn.
Place the bottom, lower-flight landing center, then the returning upper endpoint.
The landing depth equals the flight width; curved half-turn stairs remain unsupported.

Wall → Outdoor space draws the existing outdoor platforms for same-level terraces and
balconies. The Floor tool keeps whole-room and custom-area finish painting. Close an
independent polygon using the ordinary snapping, measurements, local drawing
undo/redo and cancel gestures. Choose Railing (1 m), Low wall (0.3 m), or Open
from procedural thumbnail cards before drawing; exposed edges inherit that
configuration. Select the finished platform to move it, edit or insert/remove
corners, repaint its finish, or delete it. Select an edge on the plan or in the
inspector to override its style and height, or restore the platform default.
Corner movement preserves edge IDs and overrides. Inserting a corner retains
the leading edge and downstream identities; the new edge inherits the platform
default. House-facade runs suppress platform barriers, including doorway spans.

Platforms do not create enclosed rooms, ceilings, roof sections, or house walls.
Select a platform and enable **Use as room** in Properties to name an outdoor room.
It shares the switch, help-text layout and committed name input with enclosed
spaces. Both keep the saved identity when room use is turned off; platforms
keep their outdoor geometry rather than becoming structural blocks.
It can map to an HA area in Connect, match its devices automatically, and take part
in room navigation, focus, status and shortcuts. The option is off for existing
and new platforms. Disabling it keeps the platform and name, removes its room
from Connect and navigation, and returns its devices to Outside rooms. A top
floor can consist of platforms without enclosed rooms. Same-level room/platform
and platform/platform interior overlaps are errors; shared boundaries are valid.
These edits use ordinary workspace history, autosave, export/import and Save.
Basements, split-level decks, supports, pergolas and converting rooms to platforms
remain outside this tool.

The North disclosure opens a compass dial around the active floor plan, with four
cardinal directions, five-degree ticks and longer fifteen-degree marks. Dragging
rotates the whole dial while architecture remains fixed. Arrow keys rotate five
degrees (one with Shift); Home resets the preview to zero. Confirm direction makes
one undoable home-wide edit; Cancel or Escape discards the preview. Other editor
controls and shortcuts are suspended during the session. The plan temporarily
fits inside the dial and restores its previous camera pose on exit. The setting
uses ordinary autosave, import/export and Save; only Save publishes it to Home.

Wall Finish includes Edge color: Auto (the default, omitted in JSON) or Custom.
Custom persists `WallSpec.edgeColor` and applies to end caps, top/bottom caps
and opening reveals. Auto inherits the two authored face colors when they match;
otherwise it inherits an authored exterior color, falling back to the general interior wall finish. Different face colors remain unchanged.
Shared horizontal junction caps retain the general finish when owner edge finishes
disagree. The setting participates in undo/redo, autosave and workspace import/export.

Construct’s floor palette includes Square tile, Rectangular tile (staggered), and
Checkerboard tile. Their Tile color picker changes the ceramic color while keeping
neutral grout (and the checkerboard’s cream alternate tiles). Reset color restores
the preset default. Optional six-digit hex `color` on these preset finishes survives
history, draft reload, Save, duplication, and import/export; omitted color preserves
existing projects. Patterns are generated in memory and rendered with toon materials.

Selected doors and windows expose Finish color in Properties, including garage,
sliding, glass, and steel-arched designs. The optional six-digit hex `color`
override paints the door leaf and frame or window frame/muntins; glass and
hardware retain their original finishes. Reset color removes the override and
restores the original multi-tone palette. Color follows ordinary opening
history, autosave, Apply, and import/export. Passages have no color picker.

Horizontal caps are partitioned by finish ownership before triangulation so adjacent
wall colors do not bleed across their boundary. Overlapping junction ownership
with different edge finishes retains the general interior finish.

Wall Finish exposes Exterior and Interior for exterior walls. Interior walls use
one Wall color by default; Different colors on each side reveals independently
editable faces. Side labels use adjacent room names when unambiguous, otherwise
Side A / Side B. Hovering or focusing a color control highlights the corresponding
wall face on the plan. Turning the toggle off copies Side A's color to both faces.
Reset removes that face's override and restores the home's palette; resetting
Exterior also removes a pre-existing override on its exterior face. These edits
use the existing faceColors metadata, undo/redo, autosave and Save/import/export.
The two-sided disclosure is editor state; differing stored face colors reopen it.
Interior walls with differing faces use the general interior finish for Auto edges,
even if an old exteriorColor value remains from their drawing history.

The Construct floor menu places **Setup apartment floor** directly below **Add floor below**.
Its dialog sets the storey where the lowest modeled floor starts (0–100, with 0
preserving the original appearance). The setting follows normal draft, undo and
publication behavior. Positive values repeat a muted shell of the lowest floor's
footprint underneath the home, using its floor-to-floor height and simple facade
windows. These instanced shells have no rooms, devices, selection or Walk surfaces
and never appear in floor navigation. Plan views omit them; ordinary camera framing
continues to use only the real floors. The decorative ground sits below the stack.
