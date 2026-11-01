# Source-authored floor layout

Use this branch for an explicitly requested FloorSpec JSON file or bundled home.
Read [the layout contract](layout-contract.md) and [the JSON format](floor-json-format.md)
before writing geometry. Inspect Git status, existing floor JSON and its loader,
the home manifest, and root package commands. Preserve unrelated changes and IDs.
Source generation runs offline and keeps all edits in `home/`.

## Implement

1. Store the requested floor as pure JSON at `home/src/floors/<floor-id>.json`.
   Keep `home/src/floors/index.ts` as a thin loader that imports the JSON and
   passes it to the public `assertValidLayoutFloorSpec` helper. Do not rebuild
   the architecture as a TypeScript object or import engine internals.
2. Update the home manifest only for home metadata or material assumptions;
   import the validated floor from `home/src/floors`.
3. Define a footprint and simple, non-self-intersecting room polygons in one
   plan coordinate space. All V2 floors share the building transform; do not
   introduce an independent origin or scale for an upper floor. Set a positive
   `floorToFloorHeightMeters`. Do not pre-scale coordinates into world units.
4. Give every `RoomSpec` a stable local ID, name, polygon, accent, empty
   `dashboardSlots`, and empty `devices`. Add an optional solid `floorColor`
   only when supported by evidence or user direction. Do not put HA area/entity
   IDs or runtime profile data in generated code.
5. Define arbitrary straight `WallSpec` segments with stable IDs, dimensions,
   and interior/exterior classification. Optional solid `faceColors.left` and
   `faceColors.right` are observed from `from` toward `to`; preserve endpoint
   direction across corrections. Walls are the source of truth.
6. Define every real corner, T-junction, crossing, and collinear endpoint join
   as one stable `WallJunctionSpec` at the exact plan point with all incident wall IDs. Do
   not declare opening jambs as junctions or leave intersections implicit.
7. Define each door, window, or passage as the matching discriminated
   `OpeningSpec` owned by exactly one wall. Configure door operation separately
   from its visual variant and finish, and keep window structure in its
   window-only fields.
   Derive its world transform, thickness, finishes, fade behavior, and
   collision from that wall rather than duplicating wall facts. Openings are
   optional; a valid layout may contain none.
8. Use flat ceilings in the layout JSON. If explicit evidence requires a
   sloped ceiling, stop and report that the current layout-only JSON validator
   does not accept sloped ceilings instead of bypassing it.
9. Let engine navigation derive walk collision from the same walls, junctions, and opening
   states. Never author an independent collision layout.
10. Preserve existing IDs across corrections and keep architectural components
    free of room-specific furnishings.

Do not edit `apps/web`, `packages/engine`, or `packages/catalog` during
ordinary generation. If a public API is insufficient, report the missing API
instead of importing internals or patching the stable layer.

## Verify

Validate the floor JSON directly after the first complete draft and after every
correction:

```sh
npm run home:validate-floor -- home/src/floors/<floor-id>.json
```

Require the `FLOOR_VALID` marker. Add `--json` when machine-readable diagnostics
are useful; JSON success reports `valid: true` and `status: "FLOOR_VALID"`.
Fix reported paths in the JSON contract; do not read validator source merely
to interpret a diagnostic.

Then run the layout-stage gate:

```sh
npm run home:verify -- --stage layout
```

Use `npm run home:preview` for the normal product UI and capture the required
views with:

```sh
npm run home:evidence -- --stage layout
```

Both successful stage commands end with `LAYOUT_REVIEW_REQUIRED`. Treat that
marker as a mandatory pause, never as permission to start room work. Also run
the repository's remaining real verification commands when applicable. At minimum,
establish evidence for:

- manifest schema and TypeScript validity;
- the requested floors and one building coordinate transform;
- footprint and room polygon validity;
- HA-ID-free rooms and safe built-in shortcuts;
- stable-package import boundaries;
- wall/junction/opening ownership, complete incident-wall sets, dimensions,
  endpoint consistency, and absence of opening/junction overlap;
- flat ceiling coverage and height validity;
- deterministic pure-JSON formatting and successful
  `assertValidLayoutFloorSpec` loading;
- visual asset contract and engine-owned lighting;
- valid solid room-floor and directed wall-face colors, with palette fallback
  and no texture or PBR fields;
- walk collision derived from architecture, including doors in relevant
  states;
- room focus for every room;
- production build and Compose validation when available; and
- responsive normal-UI behavior.

Inspect the rendered result through the ordinary product UI, not a special
debug scene. Capture or show:

- a full-floor orbit overview that makes room topology and openings legible;
- a walk-mode view proving passages and collision; and
- solid and faded normal/grazing views of every corrected junction and opening;
  and
- both directed faces of every recolored wall and every recolored room floor.

Never hide an unsupported opening with a decorative wall patch. Fix the
source relationship and re-check shared exterior finish, camera fade, shadows,
and collision.
