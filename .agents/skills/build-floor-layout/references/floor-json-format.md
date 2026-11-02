# FloorSpec JSON Format

Use this reference whenever creating or correcting `home/src/floors/*.json`.
This reference plus the public `home:validate-floor` command is the routine
authoring contract. Do not inspect engine source during ordinary generation.
If the command contradicts this reference, report the contract mismatch rather
than reverse-engineering or bypassing validation.

## File and loader contract

- Author one pure JSON object per floor. JSON has no comments, trailing commas,
  `undefined`, functions, imports, or household Home Assistant IDs.
- Use stable semantic IDs and preserve them across corrections.
- Format with two-space indentation and a final newline. Keep top-level fields
  in the order shown below; keep arrays in stable architectural order.
- Import the JSON only from `home/src/floors/index.ts` and validate it at module
  load through the public engine helper:

```ts
import { assertValidLayoutFloorSpec } from "@cabane/engine";
import floorJson from "./ground-floor.json";

export const groundFloor = assertValidLayoutFloorSpec(floorJson);
```

Do not cast imported JSON to `FloorSpec`, duplicate it as a TypeScript object,
or import engine validation internals. `assertValidLayoutFloorSpec` is the
shared browser/import/bundled-floor contract.

V2 floors use a positive `floorToFloorHeightMeters` and the same coordinates
as their building. The legacy loader derives a height when older JSON omits it.

## Complete shape

```json
{
  "id": "ground-floor",
  "name": "Ground floor",
  "floorToFloorHeightMeters": 2.5,
  "coordinates": {
    "origin": [0, 0],
    "metersPerPlanUnit": 1,
    "scaleBasis": "measured"
  },
  "defaultWallHeightMeters": 2.5,
  "defaultCeilingHeightMeters": 2.5,
  "footprint": [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3]
  ],
  "rooms": [
    {
      "id": "living-room",
      "name": "Living room",
      "polygon": [
        [0.2, 0.2],
        [3.8, 0.2],
        [3.8, 2.8],
        [0.2, 2.8]
      ],
      "accent": "#c9a477",
      "floorColor": "#b58a62",
      "dashboardSlots": [],
      "devices": []
    }
  ],
  "walls": [
    {
      "id": "north-wall",
      "from": [0, 0],
      "to": [4, 0],
      "classification": "exterior",
      "thicknessMeters": 0.2,
      "faceColors": { "left": "#eee6df" }
    },
    {
      "id": "east-wall",
      "from": [4, 0],
      "to": [4, 3],
      "classification": "exterior",
      "thicknessMeters": 0.2
    },
    {
      "id": "south-wall",
      "from": [4, 3],
      "to": [0, 3],
      "classification": "exterior",
      "thicknessMeters": 0.2
    },
    {
      "id": "west-wall",
      "from": [0, 3],
      "to": [0, 0],
      "classification": "exterior",
      "thicknessMeters": 0.2
    }
  ],
  "wallJunctions": [
    { "id": "north-east-junction", "at": [4, 0], "wallIds": ["north-wall", "east-wall"] },
    { "id": "south-east-junction", "at": [4, 3], "wallIds": ["east-wall", "south-wall"] },
    { "id": "south-west-junction", "at": [0, 3], "wallIds": ["south-wall", "west-wall"] },
    { "id": "north-west-junction", "at": [0, 0], "wallIds": ["west-wall", "north-wall"] }
  ],
  "openings": [],
  "ceilings": [
    {
      "id": "ground-ceiling",
      "kind": "flat",
      "roomIds": ["living-room"],
      "heightMeters": 2.5
    }
  ]
}
```

This is a minimal complete floor, not a template for a fixed rectangle. Add
every real room, wall, junction, and supported opening represented by the
source plan.

## Coordinate and polygon rules

- New browser layouts start in metres with `origin: [0, 0]` and
  `metersPerPlanUnit: 1`. Imported, measured, or calibrated plans may use any
  finite origin and positive `metersPerPlanUnit`; the floor still owns the
  only plan-to-world transform.
- `scaleBasis` is `"measured"` when dimensions establish the scale and
  `"inferred"` when scale comes from plan proportions or familiar anchors.
- A plan point is `[x, y]`; engine world mapping uses plan `y` as world `z`.
- `footprint` and every room `polygon` contain at least three finite points,
  omit a repeated closing point, and must be simple and non-self-intersecting.
- The footprint follows the complete floor boundary in the same coordinate
  system as wall centerlines. Room polygons describe clear interior floor
  areas, stay inside the footprint, and must not create accidental slivers.
- Record inferred scale, dimensions, and topology in
  `HomeManifest.assumptions`; do not add assumption fields to FloorSpec JSON.

## Rooms

Every closed architectural region is represented exactly once in `rooms`.
Each room requires:

- stable `id`, owner-facing `name`, valid CSS hex `accent`;
- a simple interior `polygon`; and
- `dashboardSlots: []` plus `devices: []` for layout-stage JSON.

`floorColor` is optional. When supplied, it must be a non-empty CSS color and
replaces the stable neutral room-floor color. It is a solid toon color cue,
not a texture or physical material. Record user-requested or inferred material
color choices in `HomeManifest.assumptions`.

Omit `furnishings`. Do not include devices, binding slots, HA area IDs, or HA
entity IDs during floor-layout generation.

## Walls and junctions

- `from` and `to` are distinct wall-centerline points. Array direction is
  meaningful because opening offsets and directed face colors are measured
  from `from` toward `to`.
- `classification` is `"exterior"` for the outer shell and `"interior"` for
  shared/internal partitions.
- `thicknessMeters` is positive. Use `heightMeters` only to override
  `defaultWallHeightMeters` for that wall.
- `faceColors` is optional and may contain non-empty CSS `left` and/or `right`
  colors. Looking from `from` toward `to` defines the two faces; reversing the
  endpoints swaps them. Omitted faces keep the home interior/exterior palette.
  Caps, opening returns, and non-parallel junction surfaces keep the palette.
- Walls may be angled. Collinear walls may meet at one shared endpoint, but
  overlapping or duplicate spans are invalid.
- Add one `wallJunctions` entry at every endpoint meeting, T-junction, and true
  crossing. `at` is the exact shared point and `wallIds` lists every incident
  wall once, including a wall that passes through a T or crossing.
- Opening jambs are not junctions.
- `virtual: true` marks a wall that only divides rooms, for an open plan whose
  areas still need their own names. It keeps its `thicknessMeters`, junctions
  and `classification`, renders and collides as open floor, and cannot host an
  opening. Omit it for every physical wall.

Keep junction IDs stable and descriptive. A change in wall thickness must not
change wall or junction coordinates.

## Openings

`openings` is always present and may be empty. Each opening requires:

```json
{
  "id": "hall-door",
  "wallId": "hall-wall",
  "kind": "door",
  "offsetFromWallStartPlanUnits": 1.1,
  "widthPlanUnits": 0.9,
  "openingHeightMeters": 2.04,
  "sillHeightMeters": 0,
  "operation": "hinged",
  "variant": "panel",
  "finish": "wood",
  "leafCount": 1
}
```

- Offset and width use plan units, which are metres for layout JSON.
- The complete interval `[offset, offset + width]` must fit inside the owning
  wall and must not overlap another opening. Up to 0.02 m may enter a junction
  trim zone for realistic casing; deeper structural overlap remains invalid.
- Doors require `operation: "hinged" | "sliding"`, a built-in `variant`
  (`panel`, `french`, `full-glass`, or `plank`), `finish: "wood" | "white"`,
  `leafCount: 1 | 2`, and `sillHeightMeters: 0`. Doors are traversable by
  definition; operation, visual variant, and finish are independent.
- Windows require `operation: "fixed" | "casement"`, `variant: "plain" |
"muntined"`, `panelCount: 1 | 2`, and `glazing: "clear" | "privacy"`.
  Muntined windows also require integer `muntins.columns` and `muntins.rows`
  from 1 through 6. Dimensions and sill height remain per-home configuration.
- Passages use `kind: "passage"` with `variant: "rectangular"`, or
  `variant: "arched"` plus a positive `archRiseMeters`. They start at floor
  level and do not declare a moving operation or contact.
- Omit `visualModel` and `contactSlot` at the layout stage.

## Ceilings

Use flat ceilings in layout JSON:

```json
{
  "id": "living-ceiling",
  "kind": "flat",
  "roomIds": ["living-room"],
  "heightMeters": 2.5
}
```

Every `roomIds` value must reference an existing room. The current
`assertValidLayoutFloorSpec` contract rejects sloped ceilings; if the source
requires one, report that validator limitation rather than casting around it.

## Validation checklist

Before visual review:

1. Run
   `npm run home:validate-floor -- home/src/floors/<floor-id>.json` and require
   `FLOOR_VALID`. Use `--json` for structured path/code/message diagnostics;
   success then reports `valid: true` and `status: "FLOOR_VALID"`.
2. Import the JSON through `assertValidLayoutFloorSpec` in the thin floor
   loader.
3. Run `npm run home:verify -- --stage layout` and require
   `LAYOUT_REVIEW_REQUIRED`.
4. Run the repository type, import-boundary, and production build checks
   applicable to the change.
5. Review overview, walk, solid, faded, and grazing-angle evidence through the
   normal UI.

Treat validation paths as source locations to correct. Do not loosen geometry
tolerances, suppress issues, cast invalid JSON into the runtime, or inspect
validator internals unless the documented public contract is demonstrably
inconsistent.
