# Bundled demo and legacy home

The current demo is **Solstice Atelier**, an ordinary `HomeProject` loaded from
`showcase/atelier.project.json` by `src/demo.ts`. The portable showcase is the
single source for the three floors, twenty rooms, furnishings and wallpapers.
Fresh browsers receive this seed; existing saved demos retain their contents.
Its typed device slots are mapped automatically by the in-browser demo adapter.
No real HA instance or private binding file is bundled.

The previous home remains available through `ownerHomeProject` and `homeManifest`
for legacy storage migration, saved custom kitchen models and stable regression
fixtures. Its checked-in source is split for easier editing:

- `src/layout.json`: building coordinates, floors, rooms, walls, openings, ceilings, and stairs.
- `src/items.json`: furniture and device instances, with model IDs, sizes, placements, and typed binding slots.
- `src/project.json`: schema/seed version, home identity, profiles, shortcuts, and assumptions.
- `src/project.ts`: assembles those slices and parses them with the engine's normal project parser.
- `src/extensions/kitchen/`: two custom model definitions, the fitted kitchen and its cabinet lighting. Their small geometry files demonstrate code-defined extensions.

Reusable models belong to `packages/catalog`. Use an existing preset ID before
creating geometry. The home contains no per-room React compositions or separate
hand-maintained furnishing inventory. The runtime manifest is derived from the project data.

Create an importable JSON file with:

```sh
node scripts/export-bundled-home.mjs > /tmp/cabane-home.json
# Optional previous seed:
node scripts/export-bundled-home.mjs --legacy > /tmp/cabane-legacy-home.json
```

Import that file through the workspace library. Custom model implementations are
compiled into this Cabane installation; JSON contains only their IDs. An
installation without those extensions reports missing-model validation errors.
A private workspace backup additionally carries draft/published versions and
browser connection records; those are not bundled seed data.

Browser editing does not rewrite these files. Existing browser workspaces keep
their saved contents. Models removed with the old home are no longer registered.
Imports referencing unavailable models use the normal missing-model validation/recovery flow.
