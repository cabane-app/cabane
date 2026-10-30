# Arrange and catalog placement

Arrange edits declarative furnishing/device items in 3D or top view. In 2D,
two-finger trackpad scrolling pans the plan and pinch (Ctrl/Cmd-wheel) zooms
around the cursor, matching Construct. Its catalog
supports searching and room-category browsing, visual model previews, and
creation from supported registry entries. Its initial category view uses room cards
with item counts on desktop and mobile, plus All items, Devices and My models.
Choosing a category opens a full-width model grid with a Categories back action.
Non-empty searches cover all items,
including devices and personal models, regardless of the selected category.
Clearing the search restores that category. Clicking furniture or a device on a visible
lower floor in 3D switches to that floor and selects the item. Selection exposes rotate, duplicate,
delete and, for devices with slots, Connect actions. On desktop, selection automatically opens
the shared right Properties inspector while the catalog remains available on the
left. On phones, selection enables Properties in the compact bottom dock. Add items
and Properties open the full-screen panel only on request; a successful catalog
placement closes it so the newly added object is visible on the canvas. Properties edit
dimensions and placement. In 3D, a matching elevation button beside the rotation
controls raises or lowers the selected item while dragged vertically. Release
commits one undo step; Escape, pointer cancellation, or focus loss restores its
initial placement. Elevation preserves horizontal position, rotation, and wall or
ceiling support. A matching resize button scales the current dimensions proportionally:
upward dragging enlarges the item, downward dragging shrinks it. It preserves
placement and uses the same commit/cancel history behavior. Fixed-size models
hide this control; other model resize policies still constrain allowed dimensions.
All built-in furnishings expose independent width, height,
and depth controls, including previously fixed-size presets. Resizing scales the
procedural model, so extreme dimensions can stretch its details. Device and
home-local extension controls follow their declared resize policies. Variant is a standard saved attribute for both
furniture and devices. Properties shows a Variant selector only when the model has
multiple choices; the first choice is the default for older items.
An unavailable saved variant renders using that default with a warning while
retaining the original variant ID for a later catalog update. It does not block Save.
Variant changes
keep identity, size, placement and bindings, participate in undo/redo and duplication,
and are published on Apply. Lights also expose a State selector: Always off,
Always on, Night only, or Connected (the default). Night only follows the sun's
above/below horizon state when available and otherwise uses local time (18:00–06:00).
The scene's Day and Night previews override this automatic choice. This
persisted scene override controls bulb appearance and illumination without
sending HA commands; Connected follows the
bound entity. Changes participate in draft history and take effect in Home on Apply.

The **Placed items** disclosure above the catalog lists every stored item on the active
floor, including occluded items and unavailable models. Items are grouped by room,
including outdoor areas, with an Outside rooms group for unassigned items. Search
matches item and room names; instance IDs are not displayed. Choosing an entry selects that existing item and opens the normal
Properties inspector, including when it was collapsed. Focus stays on the list.
Selection alone changes no item data or undo history. **Select items** reveals
checkboxes for touch and keyboard multi-selection. Cmd/Ctrl-click also toggles
items in the list or canvas. Saved groups appear as one selectable row, with a
count and expandable, descriptive member names. Search also matches group and
member names. Groups are listed by their shared placement center. The list
includes items outside rooms.

Selected items have crisp forest-green bounds with an ivory contrast stroke and
emphasized corners. Stroke widths stay constant on screen as the camera zooms.
Multi-selection frames each selected item or saved group, with a light tint on
its members; saved groups share one frame. The overlay remains visible through
scene geometry and never intercepts picking or dragging.

Multi-selection exposes **Group**, **Duplicate**, and **Delete** in the same
floating action bar used for single items, with matching Properties actions.
Group immediately creates a named, flat assembly on the active floor. Selecting
or starting a drag on any member selects or moves the whole group, including
after reopening the workspace. A single boundary and the existing rotation,
movement and elevation controls operate on the assembly. Properties edits its
name, shared horizontal position, elevation and rotation. Rotation uses a stable
member-anchor centroid, preserving relative spacing, yaw and heights. There is
no group resizing or individual member editing: **Ungroup** removes membership
without changing placement, dimensions, lighting, identities or connections,
and leaves the items selected for further edits or regrouping. Double-clicking a
group or member does not enter a separate editing mode.

Selecting one saved group with loose items offers **Add to group**. Selecting
multiple saved groups offers **Combine groups**, retaining the first group's
name and flattening membership. Groups never nest or span floors. Each member
stores the same optional `group` ID and name; no runtime transform hierarchy or
shared HA entity is introduced. Group creation, renaming, movement, rotation,
duplication, deletion and ungrouping share ordinary Undo/Redo, Save, publication
and project import/export. Duplicate groups receive a new group ID and fresh
member/slot IDs, with no copied household mappings. Multi-item duplicates use
one common offset. Invalid group transforms or duplicates are refused in full.

Placement resolves a feasible start near the camera target (or floor center),
using model support and outdoor-only model constraints. Furnishings and devices
may be placed outside the house or in areas without a room; neither condition
creates a validation issue. Absolute, wall, window-aware, and ceiling placement
have dedicated resolution paths. Window-aware models may opt into full-glass
sliding doors as well as windows; the architecture keeps those glazed doors
classified as doors. The integrated roller shutter declares exterior-recessed window fitting: it fits
on the outside of glazing while its controls belong to the indoor room across
the supporting wall. The same derived assignment groups placed items, Connect,
dashboard state and device shortcuts, including beside outdoor room platforms.
Only a unique indoor wall side is used; roomless or ambiguous openings cannot be
automatically fitted. There is no saved room override. Free placement uses actual
position. Closed opening clearance can move the assembly forward on shallow
walls; window edits use the ordinary refit workflow. Dragging previews a
transaction; release commits it, cancel restores it, and history records the
finished operation. Cmd-drag (Mac) or Ctrl-drag (Windows/Linux) draws a selection rectangle in either view and selects
items whose placement anchors lie inside it. Shift-drag remains available for
camera rotation in 3D, including when starting over an item. Dragging any selected item moves the
group with a shared grid-snapped offset (Alt disables snapping), preserving spacing,
height, and rotation. Group movement uses free placement and is one undo step;
Escape or pointer cancellation restores every item. Clicking empty space clears
the selection. Delete or Backspace removes the entire selection in one undo step. Duplicating preserves model configuration while allocating
fresh UUIDs for the item and each device slot. Catalog placement and preset
creation also use UUIDs, independently of model names. Existing and imported IDs
are preserved, and undo/redo restores the original generated IDs. Placement and
duplication additionally reserve the complete project's
identity namespace across every floor, including architecture and implicit opening
slots. Catalog models and room display names may repeat; instance IDs must remain
unique. Identity-conflict errors distinguish rooms, items, and device slots and
identify their floors with recovery guidance. Failed placement reports a catalog error.

Arrange checks placement changes, duplication, group movement, and resizing against the same
support diagnostics as saved projects. An invalid change is refused with a
visible message and creates no undo step. Bounds account for the model's origin
and the placed copy's scale: a wall-normalized model may move freely when its
bottom stays above the floor. Preferred placement does not restrict an existing
copy to one support kind.
Checks run against each queued edit's result. Window fitting changes size and
placement together in one validated undo step. Native ceiling devices retain
their existing recessed mounting convention; personal GLBs use their explicit
normalized bounds for ceiling clearance.

Existing geometric placement problems are warnings, so the home remains visible
and editable. Issues names the affected model and offers **Select**,
**Reset placement**, and **Remove item**. Reset places that copy on a supported floor,
preserving its dimensions, identity, horizontal anchor and rotation where
possible. If the anchor has no floor support, it searches for a valid starting
position. A failed repair leaves the item unchanged and explains how to continue.
Repairs share workspace Undo/Redo; removing a device clears its draft mappings
in the same step. Model definitions, normalization and other copies are unchanged.
Malformed data, identity conflicts, and missing floor/wall/room references remain
blocking structural errors. The new repair actions run only when explicitly chosen.

Wall and ceiling dependencies are evaluated against the edited architecture.
Shortening a collinear wall preserves attached items at their original anchors
when their width still fits the retained wall; unsupported items are deleted.
Other support changes can produce actionable issues. The editor's
preview resolves typed slots without substituting live entity state. Selecting
an item's Connect action carries its relationship into the connection workspace.
The Explore preview uses the edited manifest but disables service mutation.

The source registries, not a hard-coded count in this document, determine which
items are available. A model definition and a placed item are separate concepts:
native model geometry is code, personal model geometry is a GLB asset; item
identity, size, placement, and slots are data.

**My models**, marked with a cube icon, contains the active home's imported GLBs
and their management actions. Import, generation guidance and model management
are shown only in this section. **Import model (.glb file)** opens the
normalization and profile preview. **Generate a custom model** opens an
illustrated guide for describing an object or using a reference photo with the
user's AI tool. It links to the public skill repository and provides a copyable
Skills CLI installation command for Codex, Claude Code and other supported agents.
A single preview grid contains model management: download and unused-model
removal icons appear on preview hover or keyboard focus, and remain visible on
touch devices. Click the model name to rename it.
Personal models preserve file materials and expose uniform resizing. Their
metadata and instances share history/publication with native items; geometry is
an immutable asset. See [personal models](personal-models.md).

Catalog model thumbnails are cached across Arrange sessions. Cache keys include
the model preview revision so changed models invalidate earlier previews. After its
first visit, the editor retains Arrange’s hidden 3D scene and WebGL resources
across Construct/Connect visits. Hidden architecture does not rebuild for draft
edits; returning to Arrange updates it from the current draft. Closing the editor
releases the retained scene. The initial visit still builds the 3D models.

Implementation: [catalog UI](../../apps/web/src/editor-preview/furnish/catalog/ArrangeCatalog.tsx),
[catalog enumeration](../../apps/web/src/editor-preview/furnish/catalog/catalog.ts),
[start placement](../../apps/web/src/editor-preview/furnish/placement/catalog-start-placement.ts),
[furnishing controller](../../apps/web/src/editor-preview/furnish/useFurnishingEditor.ts),
[dependency evaluation](../../apps/web/src/editor-preview/construct/scene-item-dependencies.ts),
[item renderer](../../packages/engine/src/SceneItemRenderer.tsx).

[Back to product overview](../../PRODUCT_SPEC.md).

Curtain presets (single-window, children's paired, and motorized), the 3-seat
sofa, and the sectional sofa offer a Fabric color picker and Reset color in
Arrange Properties. A six-digit hex `color` override is optional item data and
survives undo/redo, duplication, Apply, and project import/export. Omission
preserves each model's original multi-tone palette. Overrides recolor fabric;
tracks, wood, motor housings, and decorative throw cushions retain their finishes.
Only descriptors declaring `defaultColor` offer this control.

Numeric object attributes accept decimal commas and points, preserving incomplete text until Enter or blur. Escape restores the saved value. Arrow keys and adjustment buttons step by 0.1 (1 degree for rotation); Shift multiplies steps by ten. Invalid values show an inline error; dimensions require at least 0.01 m. External updates and object selection changes reset drafts.

Properties separates **Connections** from optional **Readings**. Each row shows its source and connected/unavailable status with a direct Connect or Change action. These open the corresponding connection in Connect. **Show state on model** and **Show on model** explicitly toggle only the badge above the object, independently of mapping and dashboard visibility. Reading menus contain Rename, Disconnect and Remove. **Add reading** opens a separate sensor picker and asks for its name and display setting only after source selection; no add form remains in Properties. Reading edits use ordinary undo/redo, duplication and Save; duplicates get fresh slot identities and no household mappings.

Properties exposes **Lighting** for personal and built-in models. Shared settings
apply to every copy in this home while each copy retains its own connection.
The visual editor and persistence rules are defined by [model lighting](model-lighting.md).
