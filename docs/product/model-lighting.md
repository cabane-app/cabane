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
repeated shelves. Each strip has its own start, end and sample count. Fit along
model spans the longest model axis without replacing the chosen count. Suggest
sample count estimates a count from its length; moving endpoints preserves it.
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
endpoint consistently. Older clients reject unsupported fields rather than
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
the lighting editor and runtime. Each preview and active floor has a budget of
64 unshadowed point lights. Room/dashboard lights, native defaults and personal
or customized copies share the floor budget. Sample counts are requests for
spatial resolution, not array sizes or guaranteed physical light counts. Saved
logical sources, counts, connections and total brightness are never truncated or
rewritten. Legacy point, points and strip forms use the same policy. Portable
types and migrations are unchanged. Manifest validation imposes no separate
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

Within the budget, every requested sample renders as before. Above it, each
positive-intensity logical source first receives one slot, and strips fairly
share the remaining slots up to their requested count. Two or more retained
samples include both endpoints; a strip receiving one slot uses its midpoint.
Each strip retains its share of the model's total brightness. If logical sources
alone exceed 64, median partitions along the widest spatial axis group nearby
source midpoints. Every source contributes its whole intensity to its group's
weighted position and linear color. Range uses the widest member range (including
unbounded range). Nothing is discarded by source order or copy order. This
approximation can soften or move coverage, including near walls; it does not
guarantee the same illumination at every receiver. Glow and logical editing
handles remain independent. The editor explains the shared budget and reports
when its model preview is approximated. Other active copies may need a coarser
approximation than a model viewed alone.

Expansion allocates at most 64 physical emitters, even for safe-integer requests
such as 4,294,967,296 or 9,007,199,254,740,991. Processing still scales with the
number of authored declarations/copies, never with their expanded sample request.
Glow-only, zero-brightness and off sources request no active physical slots.
Native defaults and dashboard sources may prewarm spare zero-intensity slots,
preserving their first-activation shader reuse. Active sources always take
priority, and prewarming shares the same 64-slot bound.
The pool grows only to its bounded peak. Turning sources off retains those
zero-intensity slots for reuse; subsequent state changes within that capacity do
not recompile shaders. Reducing demand after a peak does not release those slots
until the floor or preview unmounts.

The budget is a practical resource bound, not a universal FPS guarantee. A
640×360 Chromium probe with twenty mixed toon/PBR box receivers on Apple M5 Pro
(ANGLE Metal, 1,024 fragment uniform vectors) compiled successfully at 16, 32, 64
and 128 points. At 256 points both shaders failed with
`FRAGMENT shader uniforms count exceeds MAX_FRAGMENT_UNIFORM_VECTORS(1024)`;
the failed layout persisted after switching off or returning to sixteen sources.
The bounded implementation keeps that same workload at 64 slots, including after
peak use. The existing browser smoke now covers twenty receivers, eight copies
with two points and two seven-sample strips each, then sixty-four copies with
4,294,967,296 requested samples per strip, off, and one ordinary copy. It verifies
valid shaders, conserved brightness and reused light/program identities within
the ten-second test budget on that host.

The same host's furnished demo was also sampled with the existing
`scripts/scene-performance/browser-probe.mjs` motion probe, ten measured frames
after eight warmup frames per state. A local browser route override added compact
lighting declarations (two points and two strips per copy) to the real floor
pool, without adding geometry. The 1440×960 viewport produced a 1800×1200 canvas
at DPR 1.25. Each run retained the same 1,435 visible meshes and 289 draw calls;
submitted triangles ranged from 173,594 to 261,587 during camera motion.

| Physical budget | Peak CPU p95 | Added copies off after peak | Ordinary copies again |
| --------------- | ------------ | --------------------------- | --------------------- |
| 64              | 16.1 ms      | 12.5 ms                     | 16.2 ms               |
| 96              | 32.3 ms      | 36.1 ms                     | 33.0 ms               |
| 128             | 75.6 ms      | 62.2 ms                     | 62.4 ms               |

Ordinary demand was four added lighting copies with seven samples per strip;
peak demand was sixty-four with 4,294,967,296 requested samples per strip. The
floor also contained twenty-two active native emitters. The 64-light run retained
64 slots and the same 22 shader programs through all states; all shaders were
valid, with no GL errors or new batch buffers. This measured retained cost is why
the execution budget is 64 rather than the larger shader compilation ceiling.
More aggressive approximation trades spatial detail for bounded recurring work.
These are instrumented single-host observations, not GPU frame times, a stable
FPS target, or mobile acceptance. This furnished scene exceeds the separate
opt-in draw/triangle budgets at every tested light count; this change does not
claim to address that geometry cost.

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
