---
name: build-catalog-presets
description: Build or revise reusable Cabane catalog presets from short item descriptions, product names, links, or reference photos, individually or in batches. Use for catalog model authoring and Arrange availability, not for placing items in a home or equipping a room.
---

# Build Catalog Presets

Turn the requested items into reusable, procedural Cabane models with public
exports, complete registry metadata, and numeric verification. Complete the
requested batch; do not impose a room-by-room approval workflow.

**Review policy:** inspect supplied product references when needed, but check
rendered models visually only when the user asks. Do not start a browser, take
screenshots, build a review scene, or require visual approval by default.
Numeric scene inspection through the test renderer is part of verification.

## Establish the batch

- Work in the current Cabane checkout. Read its `AGENTS.md`, relevant product
  contract, Git status, `packages/catalog/README.md`, and the applicable registry
  before editing. Use installed dependencies and current repository commands.
- This is catalog product development: models belong in `packages/catalog`.
  Preserve the owner's `home/` files and placements. Do not invoke equip-room
  or its room-stage review gate to build catalog entries.
- Form a compact inventory for the whole batch: requested identity, stable model
  ID, furnishing/device kind, dimensions, finish, defining features, placement
  origin, and any material assumptions. Reuse an existing preset if it already
  fits; preserve its ID when revising it. Keep separately requested items
  independently placeable rather than baking them into a furniture set.
- Infer ordinary missing heights and proportions without blocking the batch.
  Record inferred values separately from provided measurements. Ask only when
  ambiguity would substantially change the product identity or requested scope;
  continue unambiguous items meanwhile.
- For a named product or link, consult the exact manufacturer's page/specification
  and relevant reference images. Match the requested variant and distinguish
  overall, usable, and packaged dimensions. If the source cannot be accessed,
  disclose what is missing rather than inventing verified specifications.
  Generic descriptions do not need a product-research detour.

## Model and integrate

Read [the catalog contract](references/catalog-contract.md) when implementing
models or registry entries. It identifies the integration points and the
geometry/metadata details that commonly cause rework.

- Prioritize silhouette, proportions, requested counts, and construction:
  three seat cushions, a curved back, four legs, or one drawer must be modeled
  as described. Use the user's style and colors; the existing oak/beige batch
  is an example, not a mandatory palette.
- Use code-native primitives, the engine's public `ToonMaterial` and `Outlines`,
  and real low-segment bevels/curves where the silhouette needs them. Reuse the
  catalog's narrowly named construction components when suitable. Hosted/bundled models and textures follow the repository visual asset contract.
  Keep scene lights engine-owned.
- Aim for clean, softly shaped forms with restrained, material-colored contours
  and quiet surface detail. Read the
  [cel-shaded modeling guidance](references/catalog-contract.md#cel-shaded-modeling-and-outlines)
  before authoring geometry/materials. Preserve the requested object's palette
  and construction while applying this visual hierarchy.
- Give each model family and meaningful subcomponent its own file and local
  barrel. Share actual construction, such as a four-leg table frame, without
  introducing a universal furniture renderer or one-off duplication.
- Make supports connect: arms need brackets, shelves need a case, and feet must
  meet the floor. Include handles, tilted backs, wheels, headboards, and other
  protrusions in the overall envelope. Keep source/product measurements intact.
- Derive slanted beams from their intended endpoints and the primitive's local
  long axis. Cylinders/capsules and tall boxes run along local Y; roof panels
  often run along X, so copying their Euler angles can invert a frame. Prefer
  midpoint, endpoint distance, and a quaternion mapping the local axis onto
  the endpoint direction. For Euler rotations, verify the axis and sign on
  both mirrored sides: an A-frame must converge at the top, with feet spread
  below; roof rafters must meet the ridge above the eaves.
- Verify structural connections numerically on the mounted scene: transform
  each beam's local endpoints through its world matrix and check them against
  the intended supports, allowing only intentional joint overlap. Check both
  mirrored frames and supported resizing. Overall bounds cannot detect an
  upside-down V or disconnected beams. For orientation fixes, add a regression
  test of endpoint contacts and convergence, not a test of angle constants.
- Prevent z-fighting: compute exposed face coordinates (center ± half-size)
  for layered details such as rug bands, drawer fronts, and handles against
  every underlying solid, including the case. Never overlap coplanar visible
  faces. Recess the support or provide several millimetres of real separation,
  accounting for bevels, outlines, and supported resizing. Keep attached parts
  connected and preserve the declared envelope by adjusting underlying geometry.
  Do not hide conflicts with renderOrder, disabled depth testing, or arbitrary
  polygon offsets. Record face-clearance arithmetic during verification; the
  numeric bounds helper cannot detect inter-part z-fighting.
- Add public component exports and a registry entry for every new preset. Arrange
  derives cards, thumbnails, search, and placement from the effective registries;
  do not add a parallel UI catalog or hand-authored thumbnail assets.
- Ordinary furniture uses the furnishing registry. When the user requests a
  supported smart-device preset, follow the conditional device guidance in the
  contract. Do not add fake binding slots to make static furniture selectable.
- Integrate the batch once: update applicable inventory expectations, room-filter
  assertions, and catalog documentation together. Record product sources and
  important inferred dimensions in catalog documentation, not household facts.

## Verify without a browser

For new or changed furnishings, run the bundled helper against selected IDs:

```sh
node <skill-directory>/scripts/inspect-furnishings.mjs --project <cabane-root> <model-id> [more-model-ids...]
```

It mounts registry components in memory and reports bounds, extents, toon-mesh
counts, and triangle counts. It exits nonzero for missing models, invalid bounds,
size disagreement beyond 1 mm, non-toon surface materials, or exceeded declared
complexity. It does not inspect appearance, GPU-expanded outlines, inter-part
contacts, or every resized pose; use the repository tests and geometric reasoning
for those. Fix geometry or metadata according to the intended object, not merely
to silence a failure.

Run the relevant existing checks once for the batch. The current furnishing
baseline is:

```sh
npm run typecheck
npm run verify:boundaries
npm run verify:furnishing-surfaces
node --test --test-concurrency=1 tests/owner-home-project.test.mjs tests/arrange-catalog.test.mjs tests/arrange-catalog-ui.test.mjs tests/catalog-structure.test.mjs tests/editor-furnish-preview.test.mjs tests/home-project.test.mjs
npm run build
```

Confirm those commands still exist. Adjust the test selection for device changes
or a changed integration surface. Preserve coverage when a formerly empty room
filter gains entries. Follow the [catalog preset test policy](../../../docs/test-guidelines.md#choose-the-cheapest-meaningful-check)
when deciding whether a specific new behavior needs coverage; ordinary preset
and variant additions use the existing shared checks. Use focused
checks while fixing a failure, then complete the applicable batch checks. Do not
run room-stage evidence commands or repeatedly rebuild after each item.

## Deliver

Report the new/reused IDs, where they appear in Arrange, important dimension or
product-reference assumptions, and the checks actually run. State that visual
review was not performed unless requested and completed. Do not leave the batch
waiting on optional visuals. Follow the user's current commit/push instructions;
this skill does not prescribe a branch or authorize deployment.
