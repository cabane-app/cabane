# Personal GLB models

Arrange exposes personal-model tools only inside **My models**, identified by
a cube icon. This section offers **Import model (.glb file)** and **Generate a
custom model**. A single preview grid lists the home's models, with download and
unused-model removal icons on preview hover or keyboard focus, and always visible
on touch devices. Clicking a model's name renames it; there is no second management
list. The generation guide explains use of any AI tool, installation
of the public skill through the Skills CLI in Codex or Claude Code, and generation from a real
photo or description, with an illustrative photo-to-model image. A GitHub repository link and a copyable installation command appear in that
guide, not in the general Arrange catalog. No skill ZIP is bundled in the app. Its bundled
UI illustration and exact public repository navigation URL are owned by
`ModelGenerationGuide`. The catalog
belongs to the active home. Import asks for Name, Preferred placement
(Floor, Wall, Ceiling), and Profile (Furniture by default). The preview permits
orientation corrections and uniform resizing in metres. Floor models contact
the ground at their bottom, wall models contact the wall at their back, and
ceiling models contact their support at their top. Placement, selection,
rotation, uniform resizing, duplication, history, Reset, and Save use the normal
editor paths. Floor instances have a simple bounding-envelope walk collider.

Original GLB materials, colours, and embedded textures are preserved. Personal
models receive scene lighting without compulsory toon conversion or contours.
Native procedural models retain their materials, batching, LOD, and outlines.
Animations remain in their initial pose; embedded cameras and lights are ignored
with preview notices. Visual variants driven by HA state are outside this version.
Only the import owner may load personal GLB resources; catalog/home generation
follows the [visual asset contract](geometry-and-rendering.md#visual-assets).

Only self-contained GLB 2.0 files are accepted. Images must be embedded; external
and data-URI references are rejected. Unsupported required extensions produce an
explicit error. The loader's supported material/texture extensions are accepted;
required Meshopt, Draco and KTX2 compression are outside the initial import profile.
Resource limits are 10 MiB per file, 100 MiB of distinct assets retained by a
home, 100,000 triangles, and 128 visible meshes per model. These checks impose
no aesthetic restrictions. Invalid files and storage failures leave the scene
and the preceding persisted workspace usable.

Every import allocates an independent `custom:<UUID>` model, including repeated
imports of identical bytes. Identical files share their immutable SHA-256 asset.
Models can be renamed or downloaded; deletion requires no remaining draft
instances. Published and active history references retain their assets even when
a draft removes the corresponding model. Instances share loaded geometry,
materials, and textures while retaining independent transforms and skeletons.
The final resource lease disposes the cache after previews or scenes close.

`HomeProject` V2 optionally contains `customModels`: name, support, existing
profile, asset hash/byte length, normalization, bounds, complexity, and optional
Light source. Projects without it have an empty personal catalog. The public
engine resolves definitions per project before validation and composition;
custom IDs never become a global catalog registration. Binaries occupy the
separate IndexedDB `model-assets` store and never enter project/history JSON.
Asset availability and record publication share one transaction. Draft,
published, and active history references are preserved across edits and Reset.

Device profiles reuse existing HA domains and controls. Each placed or duplicated
device receives a fresh primary local slot. Exact entity IDs remain in private,
origin-scoped binding profiles. Light adds a configurable point source and reuses
brightness, colour, availability, and local scene-light rules. Camera opens the
existing viewer. Sensor, Cover, and the other profiles retain static geometry.
Import and preview never inspect or operate household devices.

The Event (remote / button) profile accepts `event.*`. Room modules show the last
event type and the time in the entity state, formatted in the browser's locale.
They never send toggle or press commands. Unknown means no event has been received;
unavailable and disconnected states remain explicit. Restored history is shown
without an activity pulse, timer or additional subscription.

Portable projects and private backups download as ZIP `.cabane` archives:
`project.json` plus deduplicated `assets/<sha256>.glb` files. Private documents
retain draft/published boundaries and mappings but exclude credentials. Legacy
JSON remains readable. Imports verify all hashes, sizes, GLB resources, and
references before atomically making the home available; missing files are errors.

Arrange → My models also imports and exports a model-only ZIP pack. A pack has a
`manifest.json` with format, version, and the complete `customModels` definitions,
plus the referenced `assets/<sha256>.glb` files. Model IDs are retained, so a
pack can be imported after a JSON project and resolve its placeholders without
editing scene-item records. The editor can also import one GLB and replace all
scene items that currently point at a selected missing model ID. Pack imports
reject unknown files, unreferenced assets, hash/size mismatches, and conflicting
IDs; a same-ID model is accepted only when it points to the same asset.

JSON projects and workspace imports preserve unknown furnishing and device model
IDs as warnings. The scene shows an editable generic cube with the saved size
and placement until the model is imported or replaced. Structural errors still
block the import, and missing assets in a complete `.cabane` archive remain
errors because that archive promises a self-contained workspace.

The companion HA integration advertises asset protocol version 1 and 256 KiB
blocks through authenticated `cabane/assets/capabilities`. Presence, upload
begin/block/finish, and download commands use SHA-256 addressing. Absent files
upload before the workspace document; later placement edits only update the
document. Documents retain the 5 MiB limit and revision conflict checks. A failed
or interrupted upload does not replace the preceding document. Download verifies
files locally before restoring the record. Storage calls remain bound to the
authenticated session and HA origin. SHA-256 verification also works in native
HTTP panels without SubtleCrypto, using the same content identities as HTTPS.
Older integrations continue to support
native homes and ask for an update for homes containing GLB references.
Unreferenced remote files and abandoned transfers expire after 24 hours; cleanup
preserves assets referenced by any stored draft or published home.

The public [`create-cabane-model` skill](https://github.com/cabane-app/agent-skills/tree/main/skills/create-cabane-model) contains `SKILL.md`, export guidance,
standalone Blender and Three.js examples, and a local Python validator. It emits
a standard GLB without Cabane source or an additional manifest. Simplified
proportions, a restrained palette, and Cabane-like finishes are defaults; explicit
style preferences take precedence. Final validation also uses the Cabane import
preview. Reference photos and household HA data are not deliverables. Install with
`npx skills add cabane-app/agent-skills --skill create-cabane-model`. This public
repository is the single source of the skill; Cabane does not keep a second copy.

Implementation: [import owner](../../packages/engine/src/imported-models/index.ts),
[Arrange library](../../apps/web/src/custom-models/CustomModelLibrary.tsx),
[HA asset client](../../apps/web/src/workspaces/ha-model-assets.ts),
[portable skill](https://github.com/cabane-app/agent-skills/tree/main/skills/create-cabane-model).

[Back to product overview](../../PRODUCT_SPEC.md).
