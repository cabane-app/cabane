# Agent-generated home workflow

Repository instructions separate home generation from product development.
Source generation edits `home/`; the paired HA workflow edits only the selected
browser workspace through the [agent relay](agent-pilot.md). Changes to stable
web/engine/catalog packages require a product-development request. The accepted owner's home is
already furnished, so generation should not reset it to a neutral fixture.

The supported workflow skills cover bootstrapping, architectural floor layout,
room-by-room equipment, and reusable catalog presets. Layout work produces the
complete unfurnished floor, including wall-owned openings, junctions, ceilings,
assumptions, and derived-navigation validation. Room equipment follows accepted
architecture and supplies procedural furnishings, visible devices, and typed
local binding slots. Architecture corrections return to the layout review gate.

Generation keeps stable IDs across revisions, records inferred dimensions and
placements as assumptions, and uses one floor-coordinate transform. Plans and
photos are task inputs rather than checked-in runtime assets. Home-local visual
content follows the [visual asset contract](geometry-and-rendering.md#visual-assets),
which permits procedural geometry and hosted/bundled textures and models.
Stable catalog models are preferred where they fit; bespoke reusable geometry
belongs to domain-specific home extensions.

The public [`create-cabane-model` skill](../../.agents/skills/create-cabane-model/SKILL.md) is a distinct standalone authoring
route for users of hosted Cabane. It produces a standard GLB, recommends the
Cabane aesthetic, and respects an explicitly requested alternative style. It
requires no Cabane checkout or household HA information. Its self-contained upload validation remains separate from authored hosted
assets; see
[personal models](personal-models.md).

The paired workflow uses a workspace-scoped Cabane session; source generation
runs offline. Generation leaves HA device administration and household mapping
to separate user instructions in the authenticated browser. Source plans/photos, credentials,
registry exports, HA histories, camera images, and private household IDs must
not enter generated source. Attachments may be processed by the chosen agent
provider. These are workflow requirements, not claims about new runtime screens.

The prescribed review gates remain an unfurnished floor and each equipped room,
with normal overview/room/walk evidence appropriate to the change. The current
browser editor provides an additional implemented authoring route; its existence
does not remove generation's ownership or review rules.

Authority: [repository instructions](../../AGENTS.md).
Implementation/workflows: [home layout](../../home/src/layout.json),
[furniture and devices](../../home/src/items.json),
[layout validator](../../scripts/validate-floor.mjs),
[home verifier](../../scripts/verify-home.mjs),
[evidence capture](../../scripts/capture-visual-evidence.mjs).

[Back to product overview](../../PRODUCT_SPEC.md).
