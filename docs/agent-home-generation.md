# Home-generation agent workflow

Read before setting up, generating, or equipping an owner home. Product
development uses the engineering map and product contracts instead.

## Choose the authoring target

For a home in the native HA panel, prefer the paired agent workflow in
[`build-floor-layout`](../.agents/skills/build-floor-layout/SKILL.md). The agent
uses editor commands; architecture, history and draft persistence stay in the
browser. Inspect the chosen workspace before editing and keep the panel open.
Browser edits do not rewrite repository files. Review the unfurnished layout
before publishing or furnishing it.

For an explicitly requested source-authored home or floor JSON, follow the
repository workflow below. Keep these outputs separate from browser drafts.

## Current repository baseline

- The bundled home is the accepted two-floor South Garden Villa with eighteen
  furnished interior rooms. `home/src/layout.json`, `items.json`, and `project.json`
  assemble into the same `HomeProject` schema used by workspace import/export.
- Keep architecture in `layout.json`, furniture/device instances in `items.json`,
  and home metadata/profiles/assumptions in `project.json`. Do not recreate the
  retired per-room TypeScript specs, React compositions, or placement factories.
- The fitted kitchen and its cabinet lighting are the two home-local extension
  examples. Reuse catalog presets for all other supported model families. Inspect
  the public registries before creating a new model.
- A valid browser-edited floor may override the bundled floor for one browser
  origin/device. That browser-local record does not update Git or become the
  source of truth for repository generation. Durable architecture changes
  still update the accepted floor in `home/src/layout.json` and pass the layout
  review gate.
- Private deployment hardening and complete owner-runtime acceptance are not
  finished. Do not describe Docker/Compose support, a fully reviewed household
  binding profile, or final cross-browser/accessibility acceptance as complete
  until the corresponding checks exist and pass.

## Task routing

`$bootstrap-cabane`, `$build-floor-layout`, and `$equip-room` are skills we
provide to project users for building their own homes. Invoke them only when
helping a user set up, build, or equip their home with Cabane. Do not invoke
these skills when developing, debugging, or improving the Cabane product
itself, even when the task involves setup, architecture, furniture, or devices.

For disposable homes needed during product development, use
[`home-building-harness`](../.agents/skills/home-building-harness/SKILL.md). It prepares a local
editor through agent commands for feature testing or bug reproduction.

For user home-building tasks only:

- For initial setup or starting the app to build a home, use `$bootstrap-cabane`.
- For a floor plan, footprint, room polygon, wall, door, window, ceiling, or
  architectural collision task, use `$build-floor-layout`.
- For room photos, furniture, decor, visible devices, placement, contact slots,
  or dashboard slots, use `$equip-room`.
- If furnishing reveals a structural error, stop equipping and return to
  `$build-floor-layout`. Re-verify and obtain layout approval before resuming.

Within this scope, these skills may be selected from natural language or
invoked explicitly. Do not furnish multiple rooms or continue from layout to
furnishing without a new user instruction.

## Shared generation invariants

- Treat the user's written correction as authoritative when it conflicts with
  an ambiguous plan or photo.
- Inspect all task attachments relevant to the current stage. Plans and photos
  remain task inputs; do not copy them into the repository.
- Record material inferred dimensions, scale, topology, and placements in the
  handoff; source-authored homes also keep them in the home manifest assumptions.
- Preserve stable floor, room, wall, junction, opening, device, and slot IDs across
  corrections. Rename only when the user changes the represented concept.
- V2 projects and manifests use ordered `floors[]`, a shared building coordinate
  transform, explicit item `floorId`, and adjacent-floor `stairs[]`. V1 single-floor
  inputs migrate without changing IDs. Generate only the floors requested by the
  user; the bundled owner home has two floors.
- Walls are the architectural source of truth. Openings are owned by a wall
  and inherit its thickness, exterior treatment, fade behavior, and collision
  semantics. Walk collision is derived from architecture, never maintained as
  a second hand-authored plan.
- Declare every real corner, T-junction, and crossing once in
  `FloorSpec.wallJunctions`, with its exact point and complete participating
  wall-ID set. Door and window jambs are openings, not junctions. Junction
  geometry, finish, fade, shadows, and collision remain engine-owned.
- Hosted and bundled textures and 3D models are allowed in product code,
  native catalog models, and generated home extensions. Follow the
  [visual asset contract](product/geometry-and-rendering.md#visual-assets).
  Personal user-uploaded GLBs still use the validated public import APIs owned
  by `packages/engine/src/imported-models/`. Their self-contained validation and
  prohibition on executable user code remain unchanged.
  The standalone [create-cabane-model skill](../.agents/skills/create-cabane-model/SKILL.md)
  is maintained in this repository and can be installed without a Cabane checkout.
- Use the engine's public toon materials and restrained outlines for authored
  home geometry. Hosted models may retain their original materials; engine-owned
  atmospheric effects may use suitable particle materials.
- Use stable catalog models when they fit. Put bespoke reusable geometry or
  devices in `home/src/extensions/`; keep room-specific item records in
  `home/src/items.json`.
- Keep the UI English-only and preserve the built-in UI style. Preserve the existing Construct, Arrange, and Connect editor modes. Do not add
  a debug studio, hosted service, telemetry, or an additional V1 mode without
  an explicit product-development request.

## Home Assistant safety and privacy

The paired workflow uses only Cabane's scoped relay session for the selected
workspace. Source generation runs offline. Neither workflow requires HA API
credentials or registry exports. Generated code declares typed local slots;
exact household mapping belongs to Connect in the authenticated browser.

Keep generation separate from HA device administration. Do not inspect or
control devices, call services, change configuration, create
automations, modify exposure, or use runtime service endpoints. Runtime
automatic mapping and rescans are read-only registry operations and must never
call HA services.

Do not commit credentials, tokens, OAuth callback data, browser storage, HA
histories, camera images, source plans, source photos, registry exports, or
household HA IDs. Actual local configuration and browser-local binding
profiles stay outside generated code. Remind the user that attachments may be
processed by their chosen agent provider.

## Evidence and handoff

Run applicable schema/types, import-boundary, visual-asset/scene-ownership, geometry,
collision, fixture, responsive UI, production-build, and visual checks. Verify
through the normal UI: layout work needs overview and walk-mode evidence; room
work needs overview, room-focus, walk, and grazing-angle evidence for changed
contacts. Handoffs state files changed, verification performed, assumptions,
remaining uncertainty, and the precise review requested from the user.

Pause after an unfurnished floor and after each equipped room. Revisions of the
accepted home also change and review one room at a time unless the user explicitly
requests broader product work. Structural corrections return to layout review.
