# Model lighting

Arrange → Properties → **Lighting** opens the shared visual editor for personal
GLBs and built-in models. Personal import and Edit model expose the same controls
in their Lighting section. Lighting is independent of a model's device profile:
furniture stays furniture and existing TV, sensor and other controls are retained.

A model has one lighting setup per home. Every placed copy uses that setup, with
its own Home Assistant connection. The dialog names the model, explains the scope,
and shows the number of affected copies on Save. Native settings override only
this home's catalog defaults; Reset to default removes that override. Personal
settings stay in their model definition and travel in model packs. No household
entity IDs enter these declarations.

## Authoring

Add points and LED strips to the same source list. Authored logical sources have
no per-model point limit or per-floor cutoff. Physical illumination uses the
bounded approximation described below. Duplicate source makes an offset copy, useful for
repeated shelves. Each strip has its own start, end and explicit sample count.
Adaptive strips may also declare a maximum physical spacing; the engine derives
the requested count after instance transforms so a longer copy receives more
emitters without rewriting the authored minimum. Fit along model spans the
longest model axis without replacing the chosen count. Suggest sample count
estimates a fixed count from its length; moving endpoints preserves it.
Total brightness is shared equally between logical sources, then between the
samples of each strip. Increasing samples smooths coverage without increasing
that strip's total brightness.

The dialog uses the available screen width. The preview supports Arrange-style
pan, orbit and zoom to cursor, plus 3D, Top, Front, Side, Fit and Focus source.
The inspector scrolls independently on desktop and stacks below the preview on
small screens. Night preview and preview brightness simulate illumination
locally, including off at 0%, without operating Home Assistant devices.

Select a source or preview marker, then drag its move gizmo. Strips expose separate
Start and End positions and a Rotate strip gizmo that preserves their midpoint,
length and sample count. Place on model enters surface placement explicitly;
camera drags do not place sources. Pick through glass, enabled initially, skips
transparent and transmitting materials. Turn it off to select the glass itself.
Visible X/Y/Z fields and step buttons support 1 mm, 1 cm and 10 cm movements.
Focus the preview and use arrow keys for X/Z, Page Up/Down for Y, and Shift for
ten times the selected step. Length fields use the ordinary measurement inputs.

Choose in preview selects glowing surfaces directly and highlights the surface
under the cursor. Click again to remove glow; existing named GLB material
selections can also be removed this way or in Surface list. Up to sixteen
surfaces/materials may glow. Show handles hides editor markers and gizmos without
changing saved lighting. Disabling Illuminate surroundings retains surface glow
and source settings. Default color, total brightness and range configure the
scene. Connected light entities supply their actual brightness and color;
switches use on/off plus the configured defaults.

## Connections and persistence

Existing primary light slots retain their identity and mappings. Other objects
receive an optional, independent Lighting relationship in Connect. All points,
strip samples and glowing surfaces on one copy follow this single relationship.
The original object's controls and readings remain independent. Duplication
creates a fresh relationship; removing lighting clears only its draft mapping.
Save, Undo, autosave, publication and HA workspace synchronization retain settings
and stable identities together.

Explicit source lists contain point and strip declarations in normalized support
space. Legacy single-point, multiple-point and single-strip declarations remain
readable without migration. Editing source layouts writes the explicit form.
Normalization, instance resizing and rotation transform every source and strip
endpoint consistently. Adaptive maximum spacing is measured after those
transforms, in world metres. Older clients reject unsupported fields rather than
stripping them.

## Rendering

Selected surfaces use instance-owned materials; geometry and texture resources
stay shared. Original built-in model glow implementations remain catalog-owned.

Native selections use `surface:key:<key>` in the existing `emissiveSurfaces` list.
A unique mesh name identifies a part; repeated names use an explicit
`userData.modelGlowKey` (`glowKey` on RoundedFurniturePanel). Keep these keys when
changing variants, state geometry or internal wrappers, and never reuse a key for
a different part. Unnamed, duplicate or multi-material native parts cannot be
selected. Absent targets and old native ordinals stay saved but inactive, with
removal/reselection in Surface list. Immutable personal GLBs retain their existing
ordinal and named-material behavior. The sixteen-total rule is unchanged. Older
panels must update before reading keyed native selections.

The engine's `model-lighting/execution.ts` owns physical expansion for imports,
the lighting editor and runtime. Each preview and active floor normally shares
64 point samples across room and dashboard lights, native defaults and personal
or customized copies. Sample counts are requests for
spatial resolution, not array sizes or guaranteed physical light counts. Saved
logical sources, counts, connections and total brightness are never truncated or
rewritten. Legacy point, points and strip forms use the same policy. No schema-version
change or data migration is required. Manifest validation imposes no separate
per-model emitter count limit and accepts empty, glow-only, zero-brightness and
zero-range output. Four strips with four samples remain sixteen physical lights
when the shared budget permits.

Malformed optional lighting in a runtime model extension disables illumination
for that model. Geometry and unrelated lights remain available. Lighting warnings
name the affected model in the editor's existing Issues panel; Select opens the
copy in Arrange for repair. Recovery changes only the runtime projection, never
the stored definitions or connections. Structural manifest errors and unsupported
saved fields still use their existing validation.
Models requesting more than 64 samples receive an approximation warning there
naming the model and shared budget. Saving remains available with warnings.

Within the budget, every requested sample renders. The engine first allocates
one emitter per logical source, then shares the remaining samples fairly among
strips up to their requested count. A strip receiving one slot uses its midpoint.
Two or more samples include both endpoints. Each strip retains its share of the
model's total brightness. Above 64 logical sources, nearby declarations share
emitters. Each group uses its strongest source's position and blends the
contributions in linear colour, preserving total brightness. The group can
change position when its strongest source changes.

Within 64 logical sources, dashboard slots stay mounted and sample locations
stay fixed through power, brightness and colour changes. The lighting editor
reuses the slots it has already allocated during that preview. Floor and preview
unmounts release their shadow resources.

Point emitters use [cached shadow maps](geometry-and-rendering.md).
Solid geometry blocks direct light. The atlas shares one depth texture across
the emitters, allowing the ordinary scene pass to render them together. The
catalog models place emitters outside opaque bulb covers or supports. Transparent
diffusers and marked emissive surfaces allow light to escape.

Strips approximate line illumination with samples and light both native toon and
imported PBR materials. Surface glow changes appearance and does not illuminate
receivers by itself. True rectangular area emission, area shadows and bloom are
not implemented. Three.js RectAreaLight does not support native toon materials.

Implementation: [shared editor](../../apps/web/src/model-lighting/ModelLightingEditor.tsx),
[dialog](../../apps/web/src/model-lighting/ModelLightingDialog.tsx),
[lighting owner](../../packages/engine/src/model-lighting),
[execution policy](../../packages/engine/src/model-lighting/execution.ts),
[scene illumination](../../packages/engine/src/HomeAssistantSceneLighting.tsx),
[active light pool](../../packages/engine/src/SceneLightPool.tsx).
