# Geometry, rendering, and navigation

## Visual styles

Settings → Orbital view offers Default and Sims styles, saved per
browser origin on this device. Default preserves the existing renderer. Sims
uses a continuous diffuse ramp, flat face normals, a stronger 24-hue material
palette, no drawn contours, and a stronger directional light with less ambient
fill. These model material changes apply inside the shared stylized scene and
retain batching. Arrange uses the same materials with its editor lighting;
Construct keeps its technical rendering. Geometry, authored materials, imported
GLB assets, connections, and project data are unchanged. Imported materials retain
their original shading and receive only the final color grade. The style adds no
render pass or assets, and does not reproduce the original game's assets or fixed
camera.

## Visual assets

Catalog and workspace previews copy the rendered WebGL drawing buffer through
explicit RGBA readback before resizing or encoding. This avoids GPU canvas-copy
channel swaps while retaining image orientation and transparent model cutouts.
Preview caches are disposable. Catalog previews follow the rendering revision;
workspace previews discard images from the older copy path.

Hosted and bundled textures and 3D models are allowed in product, catalog and
home-local renderers. Prefer version-pinned HTTPS asset URLs and retain required
license attribution. Isolate loading failures so the home remains usable.
Hosted assets require network availability and CORS support. Asset requests must
never contain HA credentials or household data. Scene lighting stays engine-owned;
authored geometry retains the toon vocabulary, while loaded models may retain
original materials. Engine-owned atmosphere may use soft particle materials.
Personal user-uploaded GLBs retain their self-contained validation; this asset
policy does not broaden the accepted upload format or allow executable user code.

Orbit room focus animates floor material colors and existing wall vertex colors.
Merged wall triangles are associated once with the room on their visible side;
selection does not regenerate their geometry, add draw calls or change live lights.
Walk and editor finishes retain their authored colors. See
[room navigation](dashboard-and-cameras.md) for framing and interaction behavior.

Runtime `HomeManifest` carries ordered floors. The building shares one origin and
meters-per-plan-unit scale; positive floor-to-floor heights determine elevations.
Floors marked `belowGround: true` form a bottom-to-top prefix before ground.
Ground remains at zero; basement elevations accumulate downward. Changing a
basement height moves that floor and deeper floors without moving ground.
With default flat terrain, basements are hidden in the whole-building view and visible when selected in
cutaway or entered in Walk. Basement cutaways hide terrain and floors above.
Optional home-wide corner heights slope the terrain between the ground/basement
building bounds, continuing level beyond each edge. Exterior views then include
basement facades. Grass, soil and outdoor finish zones follow the grade while
excavating indoor rooms and retaining pool/stair apertures through every layer.
Courtyards and outdoor platforms do not excavate indoor volumes. Floors,
platforms and pools retain their authored levels. Ground-floor boundaries outside
indoor or platform support follow the terrain along their solids and individual
plant roots. Boundaries on authored floor/platform support and upper floors retain
their levels. Plan overlays remain flat. Walk follows
rendered terrain and crosses near-level basement entrances with ordinary wall
and pool collision. Tool relocation retains conservative ground-level support.
All-zero or omitted heights preserve existing rendering. Apartment shells keep
their existing decorative ground and suspend custom terrain.
Footprint/room polygons, straight walls, explicit wall junctions, and wall-owned
openings define architecture. Junction/opening clearance uses the finite spans of
adjoining walls: a shallow-angle continuation extending away from an opening
does not obstruct it. Actual intersecting wall spans remain protected, with a
2 cm finish tolerance. Junction clearance only reserves spans where the adjoining
wall rises above the opening sill; windows above low partitions remain valid.
Exterior walls fade away from the building: a wall fades toward the side outside the
floor's footprint. An exterior wall wholly outside the footprint (a terrace's parapet or
side wall, drawn as an ordinary wall) fades away from an outdoor platform when only one
side borders the platform. Walls with platform on both sides or touching neither a
footprint nor a platform keep no outward fade direction.
Openings inherit wall thickness, orientation, fade,
and cutout behavior. Door/window orientation is relative to wall direction.
Doors support hinged/sliding variants, windows fixed/casement variants, and
passages rectangular/arched variants.
Walls may also own optional rectangular blind `niches[]`, with a stable ID,
left/right directed face, plan offset/width, bottom/height and depth in metres.
A niche cuts only the selected face and retains at least 20 mm of solid backing;
it must clear openings, other niches and wall junctions. Optional integral shelf
bottom heights are relative to the recess bottom, with 25 mm default thickness.
Shelves use the wall finish and are real connected slabs. Both standalone and
batched geometry derive the cavity from the same wall data; fades and shadows
remain wall-owned. Walk navigation retains the full wall barrier for these
shallow recesses, so they cannot create passage connections. Old walls omit
`niches` and retain their previous geometry and storage behavior.

Paired hinged and sliding door leaves meet at the center in the same depth plane when closed.

The engine constructs continuous walls and junction assemblies with interior and
exterior material groups. Wall face finishes retain each wall’s boundaries,
including continuous bands above doors and windows and each side of a corner.
Polygon clipping and numerical normalization prevent
near-coincident seams from destabilizing geometry. Opening cuts extend 1 mm
past both wall faces so diagonal walls cannot leave opaque slivers across the aperture.
Platform slab coverage and floor/ceiling apertures share the world-space clipping
precision grid, preserving holes and ceiling undersides where nearly coincident
terrace and lower-floor outlines meet. Numerical normalization affects derived
geometry without rounding saved outlines. Wall bases extend to outdoor
terrain, 5 cm below the indoor floor datum, without shifting openings or wall tops. Floor-level exterior doors and passages
have solid thresholds bridging that terrain-to-floor difference. Ceilings support flat and
sloped runtime surfaces. Project authoring has the narrower flat-ceiling schema.
The exterior roof is separate procedural geometry, visible in Home's roof view.
Connected ceiling areas merge at equal height, with higher floor coverage removed
from lower sections. Concave outlines, detached sections, and courtyard holes are
retained. Enclosed construction seams narrower than wall thickness plus 1 cm are
bridged. Each exposed flat section gets one gable using the shared ridge axis,
or a level roof with no gable rise when Flat is selected;
authored sloped ceiling planes retain their slope. Roof faces split at the ridge
before triangulation. The default pitch is 25 degrees, limited to a 2 m rise and
lowered where needed below taller neighboring ceiling tiers. Edges are flush with
the derived coverage, with an 8 cm roof skin. Infill below the roof continues
the supporting exterior wall finish, including per-wall and face-color overrides,
down across the slab depth. Corner infill uses the supporting wall’s junction
geometry rather than a fixed endpoint-distance cutoff. Batched walls, standalone
walls, and roof infill share face-override/exterior-override/palette precedence. Only the thin roof edge and underside use the trim
color. Interior ceiling slabs are hidden in exterior roof view and remain in
Walk and the existing cutaway views. This simple
model clips a gable to irregular outlines; it does not solve intersecting roof
valleys or expose pitch/overhang controls. Optional `home.roof` settings preserve
old projects through defaults.
Pools cut ground surfaces and contribute collision. Their translucent toon water
uses meter-scaled analytic ripples and a grazing-angle sheen, with no textures,
additional geometry, or reflection render targets. Ripple time advances only on
existing scene frames and pauses for reduced motion; idle demand rendering stays
idle. Water retains scene lighting and received shadows.
Floor finishes support solid
colors and the preset IDs exported by `FLOOR_PATTERN_PRESET_IDS`, including wood,
stone/tile, dirt, bark, and outdoor stone treatments. Ordered room/ground zones
compose finishes; implementation belongs to the engine finish modules.
Procedural wood retains its deterministic grain, palette and joints while
uploading the completed pixel buffer once per texture. Per-pixel canvas draw
commands must not block editor startup on software-rendered browsers.

Native and repository-generated home content uses procedural geometry, toon materials, and restrained
outlines. Engine-owned in-memory floor finish textures remain part of the stable
product. Shared lighting, fading, and outline behavior stay engine-owned.
Personal GLB instances preserve original materials and embedded textures; their
foreground pixels are excluded from compulsory contours. Imported resources are
owned, shared, and disposed by the dedicated import module and use ordinary
draws. Floor imports add a simple envelope collider. The exception does not
permit asset loading in native models or generated home extensions. See
[personal models](personal-models.md).
Physical lights render only on the active floor. Room, dashboard and device
emissions share the [bounded model-lighting execution policy](model-lighting.md#rendering),
which preserves authored declarations and total brightness within 64 physical
point lights. Only positive-intensity sources need active slots; native and
dashboard declarations prewarm spare bounded slots for first-activation reuse. Allocated slots
stay mounted at zero intensity while off or unavailable. Device and dashboard
updates within the existing peak capacity change uniforms without changing shader
light counts. First growth to a larger bounded peak can compile shaders. Device emitters, including
fallbacks from resolved bindings, are scoped to their owning floor so stair
transitions never recreate another storey’s light at the active floor’s elevation. Indoor sources close to an
opaque wall retain their unshadowed point source at the bulb. The beauty pass
masks that source's contribution beyond the nearest wall's inner face, preserving
upward illumination and the space between the bulb and wall. Native toon batches
and imported lit materials share the mask; camera and floor transforms move its
plane with the wall. Toon materials prepare their shader hook before extension
effect warmup so first use retains the precompiled programs. Sources at openings, above low walls, and farther from walls
remain unrestricted. Moving across the near-wall threshold changes a uniform,
without changing the light type or shader light count. This avoids lighting
through the wall without allocating point-light shadow maps. The nearest-plane
mask remains an approximation rather than full shadow or finite-wall ray tracing.
Explore and Arrange use four flat toon bands, warm key light and cool sky fill.
The shared in-memory gradient repeats each band across 64 texels and linearly
filters only the narrow boundaries. This keeps stationary surfaces from flashing
between brightness bands when camera rotation perturbs a view-space light dot
product at a threshold; broad band interiors retain their original levels. A single multisampled HDR scene render supplies color and depth
for camera-dependent, approximately one-CSS-pixel occlusion contours. The pass
subtracts the opposite depth slope to suppress lines on continuous slanted
surfaces; it does not detect normal, material or triangle edges. Transparent
surfaces retain their existing depth-write behavior. Decorative mesh shells are
suppressed inside this scene pipeline; interaction highlights stay separate.
Construct remains an unprocessed plan, and standalone model previews keep their
existing mesh outlines. GPU contour regressions run with
`npm run verify:scene-contours` (local Chrome required). The implementation uses
Three.js [depth textures](https://threejs.org/docs/pages/DepthTexture.html) and
[multisampled render targets](https://threejs.org/docs/pages/RenderTarget.html);
MSAA follows the scene quality setting.

Construct batches compatible wall/opening strokes, item footprints, and floor
outlines by drawing style. Stair plan markings use instanced boxes. Invisible
editor picking surfaces keep their meshes and raycasting but disable material
rendering; selected and preview highlights remain visible. This reduces draw
calls without changing the architecture or selection geometry.

Walk adds a procedural clear sky with a soft horizon gradient and restrained sun
disk. It reads the current interpolated solar light direction, color, and sky-fill
intensity, including live data, forced day/night, and daylight fallback. The
direction-only background has no translation parallax, depth writes, shadows, or
interaction targets. It preserves architectural occlusion and the contour pass.
Other camera modes keep their existing solid backgrounds.

Device rendering resolves stable models before compatible local extensions.
Devices without a resolved room binding, including outdoor scene items, remain
visible. Supplied bindings must still match the item identity and model.
Always-on scene items emit light at their actual placement even outside rooms
and without HA bindings; other unbound devices show their disconnected state.
Garden lanterns use a short, warm inverse-square falloff to softly illuminate
nearby ground in night mode.

Walk collision derives from walls, openings, junctions, pools, and boundaries. Boundary styles (including open fences) use a continuous hedge segment collider at their authored width; visible rail gaps do not create walk apertures. Terrain-following boundaries use short connected collider runs with vertical ranges matching the local grade and boundary height, including the grass datum. Furniture, hedge, and outdoor-platform barrier colliders retain their world vertical extent so a sufficiently high jump can clear them. Walls and pool edges remain full-height blockers. Explicitly marked furniture collider tops act as landing surfaces without turning other collider bounds into walkable platforms. Navigation derives optional clear spawn points and checks room connectivity; rooms without
a safe spawn (such as small cupboards) do not produce a validation diagnostic.
Walk entry still requires a safe spawn and skips rooms without one. Navigation
does not maintain a second hand-authored collision plan. Walk controls support keyboard/mouse and touch
input, pitch limits, collision resolution, and automatic unbound door opening.
Mobile fullscreen/orientation requests are capability-dependent. Reduced-motion
and document-visibility state affect behavior.

Catalog rounded boxes reuse up to 64 recently generated CPU geometry templates.
Each mounted mesh owns independent buffers; eviction and disposal cannot modify
another instance. Bevel subdivisions, UVs, crease normals, materials, shadows,
and contours retain their existing settings. The orbital camera points at its
initial target before the first frame, without resetting subsequent user orbit
when opening room controls.

The normal scene uses demand rendering outside walk mode and suspends rendering
when hidden. Mobile quality can adapt to performance changes; editor scenes use
their own demand-rendered preview settings. These mechanisms do not establish a
universal FPS or browser-compatibility guarantee.

Implementation: [contracts](../../packages/engine/src/types.ts),
[architecture scene](../../packages/engine/src/ArchitectureScene.tsx),
[wall geometry](../../packages/engine/src/architecture-geometry.ts),
[navigation](../../packages/engine/src/navigation.ts),
[floor finishes](../../packages/engine/src/floor-finishes/index.ts),
[quality settings](../../packages/engine/src/performance.ts).

[Back to product overview](../../PRODUCT_SPEC.md).

Straight, L-shaped, and spiral stairs derive treads, landings, guards, floor/ceiling apertures, and walk
ramps from adjacent levels. A terrain connection instead stores one floor and which
route end meets the ground; its elevation and rise derive from the current grade.
It retains the same shape geometry, guards and continuous Walk route. Terrain
connections cut grass, soil and outdoor finish zones without making indoor slab or
ceiling apertures. Floor and terrain landings must both be supported for exit advice
to treat the connection as usable. Walking updates the selected floor at landings.
Concrete and Stone stairs use solid tread bodies down to their base elevation;
Stone adds separate tread caps. Their structural clearance uses the full solid
body, while their walking route and apertures match the open-tread versions.

Only ground-floor walls extend to the terrain datum. Shared-level wall caps are
clipped where the neighboring wall continues, preserving exposed terrace caps.
Exterior finish continues across structural slab depth up to the next level,
while interior ceiling heights and opening dimensions remain authored values.

The shared stylized renderer uses opaque toon batching and cached automatic
meshoptimizer LOD in Orbit, Walk, and Arrange. Static transforms/colors are baked
into persistent batch buffers; camera LOD and fading changes retain those buffers.
Moving/recolored and incompatible meshes retain ordinary draws. Source meshes
remain the picking surface, and existing InstancedMesh objects retain all instances.
LOD simplification runs in a worker; unavailable workers keep full detail.
Shadow invalidation inspects authored geometry before LOD substitution, avoiding
camera-only LOD redraws. Devices without native multi-draw keep ordinary draws.
The reusable performance script includes camera-motion timings and batch-buffer
churn checks. Real-device verification remains necessary for mobile fluidity.

Roll-up doors own ordinary floor-level wall apertures. Their fixed header and
jambs fit inside the opening envelope, and slats retract upward using normalized
opening position. Geometry and Walk share the header, travel, and clear-width
calculation. Walk requires eye height plus a 0.18 m head margin and current jump
elevation; jambs remain collidable. Reported positions apply directly, without
an independent animation timeline. All doors open locally on approach in Walk,
including bound doors reporting closed or unavailable. This temporary visual and
collision override never commands the real device or replaces its retained state.
Departure or leaving Walk restores the reported/retained pose.

L-shaped stair elevation rises along each flight and remains constant across its
square landing; the risers are split proportionally between the two runs. Spiral
stairs use wedge treads around a fixed central support, an outer rail, a circular
aperture, and a guarded upper bridge to the surrounding floor. The shared derived
route drives continuous Walk elevation. Stair advice intersects tread and landing
clearance volumes with physical wall slices and registered, scaled, rotated model
bounds. Walls share their height slices and opening cuts with the renderer; closed
door state does not fill these structural apertures. Bounds retain model-origin
offsets and vertical clearance, including the spiral bridge. Unknown model bounds
are not guessed; missing-model validation remains authoritative. Whole landing
polygons are checked against floor regions. Stair-to-stair advice compares rendered
tread slabs and rendered spiral upper bridges at their building elevations, so
vertically separated flights may share a stairwell without an overlap warning. Width and slope are unrestricted. Full-turn
spirals retain the current route elevation at their coincident entrance and exit.
Shaped plan strokes and guard rails are instanced; each model family has its own
renderer. Legacy straight-stair geometry and stored records remain supported.
An active Walk traversal owns its stair ID even through overlapping footprints;
entry ties use stable IDs. Unsupported or obstructed exits stop movement, and stairs
narrower than the walker remain modelable without allowing traversal.

U-shaped stairs use two adjacent parallel flights and a flat 180° landing. They share
the L-shaped stair controls: lower/upper flight lengths, width, and left/right turn.
Place the bottom, lower-flight landing center, then the returning upper endpoint.
The landing depth equals the flight width; curved half-turn stairs remain unsupported.

Optional `FloorSpec.outdoorPlatforms` stores an independent polygon and finish,
a default edge configuration, and an ordered edge record for every polygon edge.
Platform and edge IDs share the architecture identity namespace. Missing platforms
mean none in existing projects; no version migration is needed. Procedural toon
slabs and railing/low-wall barriers render at the floor's existing level. Platform
coverage participates in scene bounds, placement support, stair landing support,
walk spawn and elevated-floor boundary checks; Open removes its barrier while
retaining the elevated-floor support boundary. Barriers share their facade-aware
geometry with walk collision, so existing door apertures remain usable.

Platform footprints clip lower roofs without acquiring their own roofing. Upper coverage also clips the supporting lower wall tops, so a platform drawn to a wall centerline does not leave an exterior gable strip in front of its railing; this extension is restricted to wall solids and preserves exposed room roofs. Slabs
above enclosed rooms retain the authored ceiling underside and replace overlapping
lower ceiling slab coverage. A separate unshadowed liner keeps that underside
visually identical to an indoor ceiling without changing the shadowed platform
surface above; remaining slab regions use 0.16 m thickness. Higher
floors cover their actual indoor and outdoor support footprints. Explicit low
exterior walls retain their height when another floor exists, while full-height
facades continue across the real inter-floor slab.

Stair `railings` optionally selects `both`, `left`, `right`, or `none`, relative to ascent; omission preserves both sides. Spiral stairs retain their central support and apply side selection to the outer rail and exit bridge. Upper-opening guards are clipped to actual floor/platform support outside the opening, including partial and disconnected floor regions; exterior flights never acquire floating opening guards. All stair shapes share this guard geometry.

Solar lighting reads Home Assistant's available, fresh `sun.sun` azimuth and elevation.
Geographic azimuth is clockwise from north; home-wide `northAngleDegrees` rotates
north clockwise from plan up (−Z), defaulting to zero. Sun shadows and the Walk sky
share this direction. No GPS or local astronomical calculation is used. Auto falls
back to browser-local time (night from 18:00 to 06:00) if the state or angles are
unusable; preferences identify the active Auto source. Forced day/night remain
exterior-lighting previews, independent of lamp state. Solar shadow framing encloses
the building's floor scene bounds, walls, storey elevations and roof allowance,
including translated and scaled plans. Luminaires remain unshadowed.

Wall caps and opening reveals use the optional `WallSpec.edgeColor` override.
When absent, matching authored left/right colors extend onto these surfaces;
otherwise an authored exterior color is used, falling back to the general interior wall finish. Standalone and batched wall
rendering share this rule. Shared horizontal junction surfaces use the general
finish when their participating walls disagree, without changing geometry,
collision, shadows or fade ownership.

An optional `WallSpec.virtual` wall divides rooms without being built: it adds no
geometry, collision, shadow, lighting plane, roof seam, or opening host, and junctions
keep only their physical walls (dropped below two). Rooms and ceilings are unchanged.
Validation requires a boolean flag and rejects openings and supported scene items on a
virtual wall. Arrange uses the public `physicalFloor()` projection for wall support and
corner snapping. Shared opening-clearance intervals ignore virtual incident walls.
Construct alone draws these boundaries as dashed plan strokes, without filled joints.

Interior right-angle endpoint junctions use filled corner footprints. Architectural planes retain exact geometry during LOD changes and shadows during camera cutaways.

Construct’s floor palette includes Square tile, Rectangular tile (staggered), and
Checkerboard tile. Their Tile color picker changes the ceramic color while keeping
neutral grout (and the checkerboard’s cream alternate tiles). Reset color restores
the preset default. Optional six-digit hex `color` on these preset finishes survives
history, draft reload, Save, duplication, and import/export; omitted color preserves
existing projects. Patterns are generated in memory and rendered with toon materials.

Horizontal caps are partitioned by finish ownership before triangulation so adjacent
wall colors do not bleed across their boundary. Overlapping junction ownership
with different edge finishes retains the general interior finish.

`DEFAULT_WALL_COLORS` is the public engine source for default exterior and interior
wall colors. New homes, previews, geometry, roof infill and generation prompts
reuse it; renderers honor the project palette and authored wall finishes.

Interior walls ignore any stale exteriorColor metadata when resolving Auto edges;
matching face colors still extend onto caps, while differing colors use the
home interior palette. Explicit edgeColor continues to take precedence.

Dark walnut and both light-oak directions use a 3.6 m repeating procedural pattern with 22.5 cm boards,
staggered end joints, restrained species-specific tone variation and fine lengthwise grain.
Each 512 px in-memory canvas retains the existing toon lighting and shadow behavior.

Weather in Home adds Drei textured particle clouds and instanced shader-driven
rain, snow, hail, exterior mist and wind wisps. It applies after solar resolution:
sun direction, explicit day/night overrides, source labels and night-only devices
remain unchanged. Walk sky reads an explicit solar daylight factor instead of
inferring time from hemisphere brightness. Clouds dim direct light while retaining
diffuse indoor fill. Conditions blend over approximately four seconds. Storms use
slow, low-contrast cloud emission pulses at least twenty seconds apart, not bolts,
scene lights, screen flashes or sound. No accumulation, wet materials or forecasts
are modeled. Editor previews remain weather-neutral.

Weather shelter derives from all floors' roof surfaces and slabs independently of
cutaway visibility. The roof renderer and shelter share the same height function;
a cached conservative height field keeps particles out of covered space while
retaining courtyards. Particle fragments are depth-tested, do not write depth and
do not receive contour ink. Cloud particles stay out of static batching, write no depth and cast
no shadows. Drei Clouds uses a version-pinned hosted texture in one instanced draw,
with isolated loading and error handling. Our weather clock controls drift and
foreground fading. A single far-depth atmospheric backdrop adds layered cloud banks,
peripheral shading and distant rain behind architecture in overview and Walk. Its
palette follows solar daylight and weather darkness; it writes no depth or shadows,
and reduced motion freezes its drift and removes distant rain. Precipitation uses shared instanced buffers and frame uniforms. Quality tiers bound detail and particle counts;
clear/off weather returns to demand rendering and hidden pages suspend animation.
Reduced motion retains static clouds and lighting without precipitation or pulses.
Real mobile performance and complete cross-browser weather acceptance require
measurements on those devices; fixture success does not establish them.

## Layered flat surfaces

Use the public engine `LayeredSurface` for opaque, planar artwork such as screen
illustrations and labels. Supply XY geometry as its child and a `layer` integer
from 0 through 64; higher layers cover lower layers. Transform the complete stack
using parent groups. Disjoint patches can reuse a layer; overlapping patches
must use different layers. The component owns depth testing, depth writing,
opaque toon material, and bounded polygon bias. A small local Z separation matches
the paint order; callers do not supply material depth overrides. Colours and
emissive colour/intensity remain configurable. Physical surfaces can opt into
`castShadow` and `receiveShadow`; both default to false for flat artwork.
This is not a transparent-glass or
volumetric-overlay primitive, and depth bias does not replace physical clearance
between separate objects.

The geometry audit validates local planarity and actual material state before
accepting declared layers. It rejects duplicate triangles within a mesh, duplicate
meshes, competing exposed coplanar finishes, and overlapping patches sharing a
layer. Shared edges, hidden support faces, and identically shaded opaque structural
joins are not conflicts. Detection uses transformed triangle geometry, material
groups, and draw ranges. It is a model-space diagnostic, not a guarantee against
all camera precision, transparency-sorting, animated intersections, or shader
instability; the toon camera-motion regression covers the separate lighting case.

## Engine UI styles

`@cabane/engine/styles.css` is the single public stylesheet used by both the web
app and the Home Assistant panel. Its ordered imports load global tokens, base
rules, accessibility and animation defaults from `packages/engine/src/styles/`,
and feature styles beside their owning React components. Keep the entry point's
import order explicit: it preserves the existing cascade across component rules
and layout overrides, independently of React mounting order.

Room controls and device fields own their styles in `home-assistant-dashboard/`;
status badges and overlays live in `room-status/`, scene actions in `action-bar/`,
and mapping controls in `home-assistant-mapping/`. Root-level components retain
adjacent stylesheets, including `camera-viewer.css` and `walk-preferences.css`.
The `dashboard-*-layout.css` and `dashboard-compact-chrome.css` files beside
`CabaneDashboard.tsx` coordinate multiple surfaces at existing breakpoints.
`room-navigation/room-navigation.css` owns the coordinated room-focus frame,
sheet placement and navigation overrides. Read it alongside the room sheet files
when changing room-focus layout. Global reduced-motion overrides remain in
`styles/reduced-motion.css`; feature-specific motion rules stay with their feature.

Stylesheet extraction preserves selectors, declarations, conditions and source
order. Responsive and reduced-motion behavior changes are separate product work.
