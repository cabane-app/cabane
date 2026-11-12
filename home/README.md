# Bundled homes

New `/welcome` and `/demo` workspaces use **Larch Observatory** from
`dev-workspaces/larch-observatory.project.json`. `src/showcase.ts` parses the same
portable design with a separate demo identity, leaving the development workspace
independent. The welcome tour walks through its Cathedral hall; demo controls
simulate its existing device slots.

Existing browser workspaces keep their saved contents. The original seed below
remains available for legacy connection migration and compatibility fixtures.

The original home is an ordinary `HomeProject`, using the same schema as portable workspace
import/export. Its checked-in source is split for easier editing:

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
```

Import that file through the workspace library. Custom model implementations are
compiled into this Cabane installation; JSON contains only their IDs. An
installation without those extensions reports missing-model validation errors.
A private workspace backup additionally carries draft/published versions and
browser connection records; those are not bundled seed data.

Browser editing does not rewrite these files. Existing browser workspaces keep
their saved contents. Models removed with the old home are no longer registered.
Imports referencing unavailable models use the normal missing-model validation/recovery flow.
