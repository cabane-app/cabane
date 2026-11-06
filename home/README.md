# Bundled home

Fresh browsers start with [Casa Solstice · Atelier](showcase/atelier.project.json).
That file is also an ordinary `HomeProject` you can import from the workspace library.

The original bundled home is retained for legacy workspace migration. Its
source is split into the following files.

- `src/layout.json`: building coordinates, floors, rooms, walls, openings, ceilings, and stairs.
- `src/items.json`: furniture and device instances, with model IDs, sizes, placements, and typed binding slots.
- `src/project.json`: schema/seed version, home identity, profiles, shortcuts, and assumptions.
- `src/project.ts`: assembles those slices and parses them with the engine's normal project parser.
- `src/extensions/kitchen/`: two custom model definitions, the fitted kitchen and its cabinet lighting. Their small geometry files demonstrate code-defined extensions.

Reusable models belong to `packages/catalog`. Use an existing preset ID before
creating geometry. The home contains no per-room React compositions or separate
hand-maintained furnishing inventory. The runtime manifest is derived from the project data.

Run this command to export the original home as an importable JSON file.

```sh
node scripts/export-bundled-home.mjs > /tmp/cabane-home.json
```

Import that file through the workspace library. Custom model implementations are
compiled into this Cabane installation; JSON contains only their IDs. An
installation without those extensions reports missing-model validation errors.
A private workspace backup additionally carries draft/published versions and
browser connection records; those are not bundled seed data.

Browser editing does not rewrite these files. Existing browser workspaces keep
their saved contents. Models removed with the old home are no longer registered.
Imports referencing unavailable models use the normal missing-model validation/recovery flow.
