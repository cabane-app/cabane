# Bundled home

Fresh browsers start with [Casa Solstice · Atelier](showcase/atelier.project.json).
That file is also an ordinary `HomeProject` you can import from the workspace library.

The fitted kitchen and its cabinet lighting are examples of code-defined models
in `src/extensions/kitchen/`.

Reusable models belong to `packages/catalog`. Use an existing preset ID before
creating geometry. The home contains no per-room React compositions or separate
hand-maintained furnishing inventory. The runtime manifest is derived from the project data.

Run this command to export the bundled demo as an importable JSON file.

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
