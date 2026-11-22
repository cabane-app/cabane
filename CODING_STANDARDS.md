# Coding standards

Read during code review, rendering or model authoring, and when designing or splitting model modules. The
[architecture guide](docs/product/architecture.md) routes to authoritative product
contracts. Check those contracts for cross-file behavior and compatibility.

## Editor controls

Order inspector controls by what people do most often. Keep everyday edits together
and place occasional settings at the bottom of the panel, grouped by their effect.
Use the same component as comparable controls in the editor. For an on/off setting,
use `EditorSwitch` with a clickable label that describes what enabling it does.
For example, “Hide when the roof is hidden” belongs under “Dashboard visibility”
because the item stays visible while editing.

Open the real editor with a representative selection. Check the control in the
surrounding panel at its normal width, including its order, size and label wrapping.
Operate it with the pointer and keyboard and verify both states. When showing the
change for review, capture enough of the panel to show where the control sits.

## Model cohesion

Give each procedural model family and model-specific part a focused module named
for its responsibility. Group related files in domain directories with a local
barrel exposing supported entry points. Separate unrelated door, window,
furniture, and device families. Extract reused behavior under the concrete
responsibility it owns; a catch-all module hides that ownership.

## Responsibility and size

ESLint enforces source-size ceilings. When a module exceeds its ceiling, extract
cohesive behavior behind a small interface rather than fragmenting code merely
to satisfy the count. Lower or remove existing exceptions when refactoring;
raising a ceiling is not a fix.

## Rendering and asset ownership

Use the engine's `ToonMaterial` for procedural furnishings and devices in catalog
and home-local models. The engine also owns the materials for architectural
surfaces, glazing, and joinery. Default uses light-responsive materials and
bundled scans for selected finishes. Sims uses the shared toon materials. Use
`ArchitecturalGlass` for panes and `JoineryMaterial` for joinery in catalog openings.
Keep lighting, fade, and outline behavior in the engine. Models declare emitter
metadata for the engine to render. Procedural floor textures, including
`CanvasTexture` creation, belong in the engine's floor-finish modules.

Follow the [visual-asset contract](docs/product/geometry-and-rendering.md#visual-assets)
for hosted and bundled assets and engine atmosphere. Loaded models may preserve
their original materials. Personal GLBs go through the validated import owner
described in [personal models](docs/product/personal-models.md).

Review actual resource loading, credential handling, and failure behavior.
Navigation links and example URLs need no per-URL allowlist. Review these ownership
conventions in context rather than enforcing global URL or material-name bans.

## Contract review

Check ownership, interfaces, geometry/collision agreement, saved-project
compatibility, and verification coverage across the diff. Confirm the architecture
guide still points to the relevant code and contracts when responsibilities move.
Update the authoritative product contract when behavior changes.
Automated lint, type, boundary, and behavior checks complement this review.

For test changes, apply the [test guidelines](docs/test-guidelines.md), including
the judgment about whether a flaky test needs its current boundary and scope.
