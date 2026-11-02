# Cabane model catalog

## Demo lounge media

The existing `speaker` preset is a 26 × 39 × 26 cm media-player device. Its
colored bands pulse while playing, and remain still with reduced motion. The
new `wall-television` preset is an inferred generic 110-inch class display,
240 × 136 × 7 cm [width, height, depth], without legs or a stand. Its back is
at Z=0 and its bottom is at Y=0 for wall placement; its screen faces +Z.
Both are available in Arrange → Living room → Media. Each has its own manual
media-player slot in the bundled demo lounge. The demo session simulates
play/pause and volume without producing audio.

Import furniture from `@cabane/catalog/furnishing`. Every registered furnishing
is available in Arrange, with the same geometry in its thumbnail and placed
instance. Models use procedural geometry and the engine's toon materials.
Framed wall art also offers four bundled French landscape illustrations; see the
[image assets and prompts](assets/wall-art/README.md) for variants and custom image usage.
Home-generation agents can use the same exports.

Every furnishing and device declares `preferredPlacement` (`absolute`, `wall`,
or `ceiling`) to choose its starting support in Arrange. Instances can use any
placement kind. All items snap to nearby walls by default; Alt/Option bypasses
snapping and detaches wall items. Physical bounds and support references are
still validated. Existing saved placements need no migration.

## Motorized window cover

`motorized-blind` exports `MotorizedBlindModel` and `MOTORIZED_BLIND_SIZE` from
`@cabane/catalog/device`. Find **Motorized blind** in Arrange → Living room,
or search All items. It is a generic neutral roller blind with a pale headbox,
wall brackets, retracting fabric, and a weighted bottom rail. Its inferred
default envelope is **120 × 160 × 12 cm [width, height, depth]**; width and height
resize independently, while depth stays fixed. No manufacturer dimensions are
claimed.

Adding fits an available window near the camera target. Details → Fit to window
fits another window and its room-facing wall support in one Undo step. Dragging
near a window centers the blind and aligns the top of its fabric, retaining the
custom size; Alt/raw dragging bypasses window snapping. Dimensions include the
headbox: the fabric covers 112/120 of the width and 148/160 of the height.
The origin is centered horizontally at the bottom of the fully closed cover,
with the back of its brackets at Z=0 and front facing +Z. The geometry clears the
standard closed window frame; it is not a collision simulation for an open
casement leaf. Window fitting stores a normal wall placement, so later window
layout edits require fitting again.

Each instance receives a fresh manual primary `cover` slot. Connect it at runtime
to the desired HA cover. Numeric `current_position` drives the model; 0 is closed
and 100 fully raised, following the [HA cover contract](https://developers.home-assistant.io/docs/core/entity/cover/).
Without a numeric position, `open`/`closed` select the endpoints; movement states
alone do not invent progress. Updates animate briefly unless reduced motion is
enabled. Unavailable/stale states freeze the displayed position; an unbound
preview starts half open. The room/device module displays position and movement,
offers Open/Stop/Close and a position slider according to advertised features,
and disables commands when offline. It uses the existing command scheduler and
exact runtime binding. No household bindings are included in the preset.

## Standalone kitchen countertops

**Arrange → Kitchen → Worktops** offers **Countertop** (`countertop`) and
**Corner countertop** (`corner-countertop`). Search for countertop or worktop.
Both are independent slabs, with no cabinet, legs, plinth, or appliance baked in.
They share six Details → Variant finishes: **Light oak**, **Dark oak**,
**White marble**, **Black granite**, **White quartz**, and **Concrete**.
Beveled edges, fine directional oak grain, marble veins, and mineral flecks
are procedural, with no external textures.

Width, depth, and height resize independently; height is the slab's thickness.
The inferred default straight slab is **180 × 63 × 4 cm (width × depth × thickness)**.
The continuous L-shaped slab is **126 × 126 × 4 cm**, with two **63 cm** deep arms
and a clear inner corner. Resizing the corner scales each arm with its corresponding
overall dimension: its arm depths stay half the overall width and depth.
Rotate it to suit any kitchen corner, and use the same finish on adjacent straight runs.
These are generic dimensions, not manufacturer measurements.

The origin is centered on X/Z at the slab's underside (Y=0). Set **Elevation**
to the desired underside height in Arrange Details. For a 91 cm finished worktop
with a 4 cm slab, use **87 cm elevation**, leaving clear space above an 86.5 cm
washing machine. Elevation and thickness are independent, so changing thickness
does not move the underside. The L's opening is toward +X/−Z before rotation.
Both components and size constants are exported from `@cabane/catalog/furnishing`:
`Countertop` / `COUNTERTOP_SIZE`, `CornerCountertop` / `CORNER_COUNTERTOP_SIZE`.

## Integrated roller shutter

`integrated-roller-shutter` exports `IntegratedRollerShutterModel` and
`INTEGRATED_ROLLER_SHUTTER_SIZE` from `@cabane/catalog/device`. Find **Integrated
roller shutter** in **Arrange → Living room → Covers**, or search All items.
The generic off-white assembly has side guides, 31 translating horizontal slats,
a bottom rail and a narrow exit strip. The roll is concealed above the aperture
and is not separately modeled. The inferred nominal envelope is **120 × 160 × 4 cm
[width, height, depth]**. Width and height resize independently; depth stays fixed.
No manufacturer dimensions are claimed. The origin is centered horizontally at
the closed assembly's bottom/back plane, Y=0 and Z=0, facing exterior +Z.

Adding, Fit to window and normal drag snapping use exterior windows and full-glass
sliding doors with one unambiguous adjoining indoor room. The whole assembly fits
the aperture, leaving 15 mm above a conventional window's projecting sill.
`windowFit.mounting: "exterior-recessed"` recesses it behind the exterior finish
where possible; shallow walls or outward-facing closed handles move it forward
enough to retain 3 mm solid clearance plus 4 mm outline allowance. Catalog-owned
`closedOpeningCoverClearance` describes the supported closed opening envelopes.
It does not simulate collisions with moving casement leaves.

The physical exterior placement keeps its controls in the indoor room across
the support wall, even beside an outdoor platform. Bounded wall-face probes omit
solid rooms and never guess a nearest room. Arrange, Connect, dashboard state and
device shortcuts share this assignment; there is no saved room override.
Ambiguous or missing rooms remain unassigned. Alt/free placement uses its actual
position like other devices. Fit stores an ordinary wall placement with a signed
depth offset; architecture edits require fitting again.

Each copy has a fresh manual primary `cover` slot with the existing cover controls
and position semantics. Full-size slats slide behind the exit strip without
stretching; geometry is reused throughout animation. Mid-travel targets continue
from the current pose, unusable readings freeze it, and reduced motion settles
immediately. No household mappings or new project fields are included.

## Warm contemporary furniture

Dimensions below are **width × depth × height in centimetres**. In code,
`defaultSize` and `size` use **[width, height, depth] in metres**. All these
models have a floor-contact origin at Y=0, centered footprints, and face +Z
(the back/headboard is toward −Z).

| Model ID                   | Public component         | Default dimensions     | Finish and construction                                                             | Arrange room |
| -------------------------- | ------------------------ | ---------------------- | ----------------------------------------------------------------------------------- | ------------ |
| `three-seat-sofa`          | `ThreeSeatSofa`          | 220 × 94 × 84          | Beige fabric, three seat/back cushions, rounded arms, oak feet                      | Living room  |
| `rectangular-dining-table` | `RectangularDiningTable` | 180 × 90 × 75          | Light oak, thin top, four square legs                                               | Dining room  |
| `oak-dining-chair`         | `OakDiningChair`         | 49 × 50 × 82           | Oak frame, curved wood back, lightly padded beige seat                              | Dining room  |
| `oak-nightstand`           | `OakNightstand`          | 45 × 40 × 50           | Compact, simple oak nightstand with one drawer, recessed pull, and open lower shelf | Bedroom      |
| `flat-door-wardrobe`       | `FlatDoorWardrobe`       | 200 × 60 × 220         | Four off-white flat doors, oak case and pulls                                       | Bedroom      |
| `oak-desk`                 | `OakDesk`                | 140 × 70 × 74          | Oak, 2.5 cm top, four square legs                                                   | Office       |
| `ergonomic-office-chair`   | `ErgonomicOfficeChair`   | 68 × 68 × 104          | Cream padding, grey shell, dark five-spoke caster base, lumbar pad and arms         | Office       |
| `oak-bookshelf`            | `OakBookshelf`           | 80 × 30 × 190          | Oak, five usable shelf levels including the bottom, separate top panel              | Office       |
| `single-bed`               | `SingleBed`              | 100 × 210 × 95 overall | 90 × 200 mattress, oak frame, beige padded headboard and neutral bedding            | Bedroom      |

Unspecified heights and sofa/chair dimensions are inferred standard proportions,
not measurements of a particular product. The bed's requested 90 × 200 cm is
the mattress size; placement bounds include the frame and headboard. The
wardrobe's 60 cm depth includes its pulls. The office chair uses all three
requested neutral colors in one preset. Room filters provide a default browsing
location; any model can be placed in another suitable room.

## Mediterranean outdoor furniture and rug finishes

`pool-chaise-longue` (`PoolChaiseLongue`) is a separately placeable teak lounger
with sage cushions, a reclined back and connected supports. Its inferred overall
dimensions are 80 × 210 × 85 cm (width × depth × height), including the tilted
back. The floor origin is centered in X/Z, the feet face +Z, and resizing is uniform.
Arrange: Outdoor → Pool chaise longue. Numeric inspection: 13 toon meshes,
4,816 triangles; bounds [-0.4, 0, -1.05] to [0.4, 0.85, 1.05] m.

`garden-hedge` (`GardenHedge`) is an independently placeable 200 × 60 × 140 cm
clipped hedge segment with timber stems and softly shaped green foliage.
Arrange: Outdoor → Garden hedge. Width/depth resize with fixed height;
the floor origin is centered and the model requires outdoor placement.
Numeric inspection: 13 toon meshes, 3,692 triangles. Dimensions are generic
design assumptions, not manufacturer measurements.

Rug (`neutral-area-rug`, implemented in `rug.tsx`) keeps its stable ID and 200 × 300 × 1.5 cm envelope.
Its Details variants are Natural woven (`default`), Terracotta (`terracotta`),
Sage (`sage`), Ocean blue (`ocean`), and Playful colors (`playful`), plus Jute rug (`jute`), Sisal (`sisal`),
Persian (`persian`), Kilim (`kilim`), Moroccan (`moroccan`), Shag (`shag`),
Braided (`braided`), Striped (`striped`), Checkered (`checkered`), and
Scandinavian (`scandinavian`), and Fluffy white (`fluffy`).
Fluffy white has a plain white field with fine procedural raised pile and no
contrasting border or motif, within the same envelope. The original
neutral appearance remains the default. Colored variants use a 13 mm field
and 2 mm thick non-overlapping motifs: field top = 13 mm, motif tops = 15 mm.
Their visible faces are separated by 2 mm at every supported planar size.
All styles use procedural toon geometry with no texture assets.

## Garden olive tree

`olive-tree` exports `OliveTree` and `OLIVE_TREE_SIZE` from
`@cabane/catalog/furnishing`. Find **Olive tree · Olivier** in
**Arrange → Outdoor → Vegetation**, or search **olive** / **olivier** in All items.
It uses outdoor ground placement and proportional resizing.

The inferred envelope is **380 × 320 × 360 cm (width × depth × height)**;
code uses `[3.8, 3.6, 3.2]` metres. This is an artistic mature Mediterranean
olive, with no manufacturer reference or user-provided measurements. The full
canopy is centered on X/Z, the exposed root flare meets Y=0, and the trunk
leans slightly off-center. There is no pot, planter, terrain patch, or soil disk.

Twisting fluted wood, seven spreading roots, twelve asymmetric crown lobes,
folded narrow silver/sage-green leaves, and scattered purple and green olives
are entirely procedural. Connected shoots and individually shaped leaves leave
openings through the canopy. All surfaces use the engine's cel-shaded material;
the wood has restrained 1.5 mm outlines. Geometry is deterministic and batched
into five solid meshes (29,592 triangles). Only the trunk and roots declare a
walk collider, leaving the crown's overhang passable. The complete canopy is
still included in placement bounds. The component also accepts no props to
render at its default size. Registering it does not add a household placement.

## Connected appliance presets

Import these device components and `stableDeviceRegistry` from
`@cabane/catalog/device`. Arrange exposes each appliance independently under
**Appliances**, in its default room filter or **All items**.

Dimensions here are **width × depth × height in centimetres**, including handles.
These are generic standard proportions inferred for this catalog, with no
manufacturer or specific connected product claimed. They have fixed sizes,
face +Z, and use Y=0 at the floor or supporting shelf. New presets have centered
X/Z footprints; the reused washing machine preserves its existing origin and
conservative outline-inclusive bounds.

| Model ID                   | Public component      | Placement dimensions | Finish and defining features                                                                                                 | Arrange room |
| -------------------------- | --------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `washing-machine` (reused) | `WashingMachineModel` | 63.2 × 63 × 86.5     | Off-white front loader, dark round door, detergent drawer, dial and display; existing 62 × 58 × 86 cm cabinet                | Laundry      |
| `tumble-dryer`             | `TumbleDryerModel`    | 60 × 65 × 85         | Off-white condenser dryer, round glass door and grip, condensate drawer, lower vents                                         | Laundry      |
| `dishwasher`               | `DishwasherModel`     | 60 × 65 × 85         | White freestanding dishwasher, full-height front door, top controls, projecting pull and recessed plinth                     | Kitchen      |
| `oven`                     | `OvenModel`           | 60 × 62 × 60         | Independently placeable built-in oven, charcoal glass, stainless-style trim, two dials and bracketed pull; no cabinet or hob | Kitchen      |

The oven's origin is its supporting shelf: use absolute placement with the
appropriate elevation when placing it in a cabinet. The dryer and dishwasher
use a 60 cm body depth plus their projecting front details; the oven's full
envelope includes its handle. Door-opening clearance is not part of these
closed-appliance envelopes. Existing household placements are unaffected.

All four are devices with a `device-dashboard` interaction and normalized
connected, disconnected and unavailable indicators. Adding one in Arrange
creates a fresh required **manual primary slot**, compatible with either
`switch` or `sensor`. Use **Connect device** to select one exact entity exposed
by the appliance's Home Assistant integration: a switch uses the existing
on/off controls; a sensor presents state, power, energy, temperature or other
measurements read-only. This does not add vendor-specific program selection,
cycle-start commands, or new HA domains. Additional measurements or controls
can be declared as secondary typed slots through the existing device contract.

Primary-slot alternatives share identical device-class constraints; a domain
with different constraints is not silently merged into the same slot. Existing
placed items retain their saved slots. No household identifiers, credentials,
registry access or live HA service calls are needed to author these presets.

## Countertop, pet, and weather devices

These six generic presets are independently available in Arrange. Dimensions
are **width × depth × height in centimetres** and include every visible handle,
base, door, or bowl. They use inferred standard proportions and do not claim to
match a manufacturer. All have fixed sizes, face +Z, and use Y=0 at the floor or
supporting surface.

| Model ID          | Public component      | Dimensions    | Finish and defining features                                                       | Arrange room |
| ----------------- | --------------------- | ------------- | ---------------------------------------------------------------------------------- | ------------ |
| `microwave`       | `MicrowaveModel`      | 52 × 40 × 31  | Pale grey countertop housing, dark window, vertical pull, display, and controls    | Kitchen      |
| `coffee-maker`    | `CoffeeMakerModel`    | 24 × 34 × 36  | Warm-white filter machine with brew head, glass carafe, handle, and display        | Kitchen      |
| `electric-kettle` | `ElectricKettleModel` | 22 × 20 × 26  | Pale grey cordless kettle with charging base, spout, lid, and dark handle          | Kitchen      |
| `freezer`         | `FreezerModel`        | 65 × 68 × 175 | Upright pale-grey freezer with one tall door, long pull, display, and drawer lines | Kitchen      |
| `pet-feeder`      | `PetFeederModel`      | 24 × 36 × 35  | Automatic dry-food feeder with hopper, lid, chute, forward bowl, and display       | Kitchen      |
| `weather-station` | `WeatherStationModel` | 18 × 4 × 12   | Indoor tabletop console with weather display, sun indicator, and trend bars        | Living room  |

The microwave and coffee maker accept generic `switch`, `sensor`, `select`,
`number`, or `button` entities. The kettle accepts `switch`, `sensor`, or
`button`; the pet feeder accepts `button`, `switch`, `sensor`, `number`, or
`select`. These domains reuse the existing generic dashboard and do not add
vendor-specific cooking programs, recipes, schedules, or dispensing amounts.
The freezer is a read-only temperature sensor. The weather-station console is a
read-only sensor compatible with temperature, humidity, or atmospheric-pressure
entities. One primary entity is created by Arrange; additional measurements can
be added as secondary typed slots when a home is equipped.

## Using presets from equip-room

Prefer a declarative furnishing item so Arrange can select and edit it:

```ts
import { stableFurnishingRegistry } from "@cabane/catalog/furnishing";
import type { FurnishingItemSpec } from "@cabane/engine";

const sofa: FurnishingItemSpec = {
  id: "living-room-sofa",
  kind: "furnishing",
  modelId: "three-seat-sofa",
  placement: {
    kind: "absolute",
    at: [3, 2], // Use the accepted floor's plan coordinates.
    elevationMeters: 0,
    rotationYRadians: 0,
  },
  size: stableFurnishingRegistry["three-seat-sofa"].defaultSize,
};
```

Include the stable furnishing registry in the home's extension registry (the
bundled home already does). Use stable registry entries first when combining
them with home-local models. Registering a model does not place it in a home.

For code-native compositions, public components also render at their default
size without props, for example `<ThreeSeatSofa />` or `<OakDesk />`. Each accepts
an optional `size` tuple. Declarative items must respect the registry's resize
policy; the fixed single-bed preset retains its 90 × 200 cm mattress. Furniture
does not need Home Assistant slots or IDs.

Bounds describe solid geometry; `outlineContact: true` tells placement to account
for the restrained 1.5 mm outline. For direct composition, inspect transformed
bounds and keep the documented floor/wall contact tolerances.

## Essential non-connected home presets

The following generic presets fill the most common gaps across living rooms,
adult and children's bedrooms, kitchens, bathrooms, entryways, and hallways.
Their dimensions and warm-neutral finishes are inferred standard proportions;
they do not claim to reproduce a particular manufacturer. Dimensions are
**width × depth × height in centimetres**.

| Model ID                   | Default dimensions      | Finish and defining construction                                                                                  | Arrange room |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| `double-bed`               | 170 × 215 × 110         | Light oak frame, beige padded headboard, 160 × 200 mattress, duvet and two pillows                                | Bedroom      |
| `rectangular-coffee-table` | 110 × 60 × 40           | Light oak rounded top, lower rail and four legs                                                                   | Living room  |
| `upholstered-armchair`     | 85 × 88 × 90            | Greige upholstery, separate seat/back cushions, two arms and four oak feet                                        | Living room  |
| `chest-of-drawers`         | 100 × 45 × 90           | Light oak case, four off-white drawers, recessed pulls and low plinth                                             | Bedroom      |
| `neutral-area-rug`         | 200 × 300 × 1.5         | Ivory and taupe code-native field, border and raised geometric bands                                              | Living room  |
| `low-media-console`        | 160 × 42 × 55           | Light oak, two cream doors, central open niche, cable port and short feet                                         | Living room  |
| `three-door-sideboard`     | 160 × 45 × 82           | Light oak three-door dining storage with projecting top and four feet                                             | Dining room  |
| `kitchen-base-cabinet`     | 60 × 63 × 90            | Off-white modular case, oak worktop, drawer, two doors and plinth                                                 | Kitchen      |
| `kitchen-sink-cabinet`     | 60 × 63 × 112           | Off-white two-door base, pale worktop, inset basin, drain and 112 cm-high faucet envelope                         | Kitchen      |
| `kitchen-wall-cabinet`     | 60 × 35 × 80            | Off-white wall case with two doors and low pulls                                                                  | Kitchen      |
| `freestanding-bathtub`     | 170 × 78 × 60           | Warm-white rounded shell, visible inner basin, drain and overflow                                                 | Bathroom     |
| `dark-oak-vessel-vanity`   | 80 × 52 × 123 overall   | Dark oak two-door vanity, white vessel basin and tall matte-black faucet                                          | Bathroom     |
| `shower-assembly`          | 202 × 91 × 230 overall  | Walk-in tray, partial frameless glass screen with stabilizer and clamps, wall-mounted rain shower and hand shower | Bathroom     |
| `white-corner-wardrobe`    | 180 × 120 × 235 overall | White L-shaped floor-to-ceiling storage, three long-run doors and one return door                                 | Bedroom      |
| `entryway-shoe-bench`      | 100 × 38 × 50           | Light oak frame and slatted shelf with a beige padded seat                                                        | Entryway     |
| `wall-coat-rack`           | 80 × 22 × 32            | Light oak back and shelf with five supported grey hooks                                                           | Entryway     |
| `hallway-console-table`    | 110 × 35 × 80           | Narrow light oak table with two drawers and four legs                                                             | Hallway      |
| `floating-wall-shelf`      | 80 × 25 × 22            | Light oak shelf and back lip with two visible grey brackets                                                       | Hallway      |
| `framed-wall-art`          | 80 × 4 × 60             | Oak frame with abstract relief or four bundled French landscape prints                                            | Living room  |
| `wooden-crib`              | 76 × 146 × 95           | Light oak slatted cot with a 70 × 140 mattress and ivory bedding                                                  | Bedroom      |
| `counter-stool`            | 48 × 50 × 92            | Light oak four-leg frame, 65 cm beige seat, low back and foot rail                                                | Kitchen      |
| `upholstered-ottoman`      | 70 × 55 × 42            | Beige upholstered cushion, perimeter seam and four short oak feet                                                 | Living room  |

Freestanding models use a floor-contact origin at Y=0, centered X/Z footprints,
and face +Z. Wall models use X-centered, bottom-edge Y=0 geometry with their
back at Z=0. The media console never embeds a
television, and each kitchen module remains independently placeable.

The dark-oak vanity and white corner wardrobe follow the supplied reference
photos. Their 80 cm vanity width and 180 cm wardrobe long side are user-provided;
the vanity depth, basin/faucet envelope, wardrobe return depth, and both heights
are inferred from the photos and standard built-in proportions. They are generic
photo-matched presets, not verified manufacturer products.

## Connected fans

Import these device components and `stableDeviceRegistry` from
`@cabane/catalog/device`. All three are available in Arrange under All items
(search **fan**) and the room filters below. Each new instance receives its own
manual primary slot compatible with the Home Assistant `fan` domain. Connect
maps that slot at runtime; no household entity IDs are stored in the catalog.
The existing fan dashboard provides power, percentage, and available presets
according to the bound entity's capabilities.

Dimensions are **width × depth × height in centimetres**, including the base,
guard, and motor; animation waves are outside the physical placement envelope.

| Model ID       | Public component   | Default dimensions | Finish and construction                                                        | Arrange room |
| -------------- | ------------------ | ------------------ | ------------------------------------------------------------------------------ | ------------ |
| `ceiling-fan`  | `CeilingFanModel`  | 120 × 120 × 40     | Four rounded wood blades, off-white motor/canopy, grey downrod                 | Living room  |
| `table-fan`    | `TableFanModel`    | 36 × 24 × 48       | Three blades, front/back wire guards, off-white base and short neck            | Office       |
| `pedestal-fan` | `PedestalFanModel` | 45 × 40 × 135      | Three blades, front/back wire guards, off-white round base and telescopic post | Bedroom      |

These are generic presets; all dimensions, proportions, and finishes are
inferred, with no manufacturer reference. Each supports uniform resizing.
Table and pedestal fans have their base at Y=0 and face +Z. Set an absolute
placement's elevation to the tabletop height for the table fan. The ceiling
fan uses ceiling placement: its canopy top is at local Y=0.40 and the motor
bottom at Y=0, following the pendant convention. Ceiling placement deducts the
model height from the room's ceiling height.

Blades rotate only while the bound fan is on, with rotation speed following HA
percentage (a moderate default when the entity has no percentage). At zero
percentage, off, unavailable, or disconnected, both rotation and airflow stop.
Table and pedestal fans project five blue waves straight ahead, reusing the
AC's cold palette and animation. The ceiling fan has no airflow effect.
Reduced motion keeps the blades still and uses the AC's static wave treatment.
Waves do not extend walk collision. These models contain no scene lights,
external assets, or additional HA capabilities.

## Whole-home connected presets

The stable device catalog also includes the following generic whole-home
presets. Dimensions are **width × depth × height in centimetres**; code uses
`[width, height, depth]` in metres. All dimensions and finishes are inferred
standard proportions rather than verified manufacturer specifications.

| Model ID                    | Public component               | Dimensions     | Domain / device class                      | Default room and placement   |
| --------------------------- | ------------------------------ | -------------- | ------------------------------------------ | ---------------------------- |
| `heated-towel-rail`         | `HeatedTowelRailModel`         | 60 × 12 × 120  | `climate` or `switch`                      | Bathroom, wall               |
| `smart-panel-radiator`      | `SmartPanelRadiatorModel`      | 100 × 12 × 60  | `climate` or `switch`                      | Living room, wall            |
| `smart-thermostat`          | `SmartThermostatModel`         | 12 × 3.5 × 12  | `climate`                                  | Hallway, wall                |
| `smart-plug`                | `SmartPlugModel`               | 7 × 5.5 × 7    | `switch` / `outlet`                        | Living room, wall            |
| `table-lamp`                | `TableLampModel`               | 32 × 32 × 52   | `light`                                    | Bedroom, surface             |
| `woven-pendant`             | `WovenPendantModel`            | 84.7 × 86 × 58 | `light`                                    | Dining room, ceiling         |
| `children-pendant`          | `ChildrenPendantModel`         | 58 × 58 × 47.9 | `light`                                    | Bedroom, ceiling             |
| `ceiling-light`             | `CeilingLightModel`            | 40 × 40 × 12   | `light`                                    | Living room, ceiling         |
| `recessed-downlight`        | `RecessedDownlightModel`       | 10 × 10 × 4    | `light`                                    | Hallway, ceiling             |
| `wall-sconce`               | `WallSconceModel`              | 22 × 16 × 32   | `light`                                    | Bedroom, wall                |
| `illuminated-round-mirror`  | `IlluminatedRoundMirrorModel`  | 80 × 4.5 × 80  | `light`                                    | Bathroom, wall               |
| `integrated-roller-shutter` | `IntegratedRollerShutterModel` | 120 × 4 × 160  | `cover`                                    | Living room, exterior window |
| `motorized-curtain`         | `MotorizedCurtainModel`        | 200 × 16 × 240 | `cover` / `curtain`                        | Living room, wall            |
| `connected-frame-oak`       | `ConnectedFrameOakModel`       | 72 × 4.5 × 52  | `camera`                                   | Living room, wall            |
| `connected-frame-black`     | `ConnectedFrameBlackModel`     | 72 × 4.5 × 52  | `camera`                                   | Living room, wall            |
| `video-doorbell`            | `VideoDoorbellModel`           | 5 × 3.5 × 13.5 | `camera`                                   | Entryway, wall               |
| `indoor-security-camera`    | `IndoorSecurityCameraModel`    | 10 × 10 × 16   | `camera`                                   | Living room, surface         |
| `smoke-alarm`               | `SmokeAlarmModel`              | 12 × 12 × 4.5  | `binary_sensor` / `smoke`                  | Hallway, ceiling             |
| `carbon-monoxide-alarm`     | `CarbonMonoxideAlarmModel`     | 11 × 3.5 × 11  | `binary_sensor` / `carbon_monoxide`        | Hallway, wall                |
| `humidity-sensor`           | `HumiditySensorModel`          | 8.5 × 3 × 8.5  | `sensor` / `humidity`                      | Bathroom, wall               |
| `air-quality-monitor`       | `AirQualityMonitorModel`       | 10 × 6 × 16    | `sensor` / AQI, CO₂, PM2.5, VOC            | Bedroom, surface             |
| `energy-monitor`            | `EnergyMonitorModel`           | 20 × 9 × 30    | `sensor` / power, energy, current, voltage | Laundry, wall                |
| `air-purifier`              | `AirPurifierModel`             | 27 × 27 × 52   | `fan` or `switch`                          | Bedroom, surface             |
| `bathroom-extractor-fan`    | `BathroomExtractorFanModel`    | 18 × 9 × 18    | `fan` or `switch`                          | Bathroom, wall               |
| `refrigerator`              | `RefrigeratorModel`            | 70 × 72 × 185  | `sensor` / `temperature`                   | Kitchen, surface             |
| `smart-power-strip`         | `SmartPowerStripModel`         | 34 × 6.5 × 5.5 | `switch` / `outlet`                        | Office, surface              |

All instances receive a fresh manual primary slot. Lights, including the
illuminated mirror's perimeter ring, contribute an engine-owned scene light,
while the connected frames, doorbell, and indoor
camera open the stable camera viewer. The two connected-frame IDs are the oak
and black finish choices for one shared 72 × 52 cm procedural frame family.
The curtain uses numeric cover position when available. Garage doors belong to
Construct as wall-owned roll-up doors with optional cover slots, rather than to
the device catalog. `sensor` and `binary_sensor` presets are read-only.

The illuminated round mirror is photo-matched to the halo-lit mirror visible in
the bathroom reference. Its 80 cm diameter and 4.5 cm depth are inferred to pair
with the requested 80 cm vanity; no manufacturer dimensions are claimed. It
connects to a Home Assistant `light` entity for on/off and brightness behavior.

The `smart-panel-radiator` preset appears in Arrange as **Electric heater**. It
reuses the existing stable ID for saved-placement compatibility and represents
a generic warm-white wall-mounted electric panel heater; no manufacturer model
or verified product dimensions are claimed.

The compatibility classes follow the official Home Assistant entity contracts
for [climate](https://developers.home-assistant.io/docs/core/entity/climate/),
[cover](https://developers.home-assistant.io/docs/core/entity/cover/),
[fan](https://developers.home-assistant.io/docs/core/entity/fan/),
[sensor](https://developers.home-assistant.io/docs/core/entity/sensor/),
[binary sensor](https://developers.home-assistant.io/docs/core/entity/binary-sensor/),
[switch](https://developers.home-assistant.io/docs/core/entity/switch/), and
[camera](https://developers.home-assistant.io/docs/core/entity/camera/). No
household IDs, credentials, or vendor-specific capabilities are included.

## Connected utility, security, and control presets

These generic presets use the native Home Assistant domains already supported
by Cabane. Dimensions are **width × depth × height in centimetres** and are
inferred standard proportions, not verified manufacturer specifications.

| Model ID                  | Public component              | Dimensions    | Domain                | Default room and placement |
| ------------------------- | ----------------------------- | ------------- | --------------------- | -------------------------- |
| `humidifier-dehumidifier` | `HumidifierDehumidifierModel` | 32 × 28 × 60  | `humidifier`          | Bedroom, surface           |
| `robot-vacuum`            | `RobotVacuumModel`            | 35 × 35 × 9   | `vacuum`              | Living room, surface       |
| `smart-lock`              | `SmartLockModel`              | 7 × 6 × 18    | `lock`                | Entryway, wall             |
| `alarm-keypad`            | `AlarmKeypadModel`            | 18 × 3.5 × 25 | `alarm_control_panel` | Entryway, wall             |
| `motorized-valve`         | `MotorizedValveModel`         | 24 × 12 × 22  | `valve`               | Laundry, wall              |
| `siren`                   | `SirenModel`                  | 16 × 7 × 16   | `siren`               | Hallway, wall              |
| `smart-button`            | `SmartButtonModel`            | 9 × 3.5 × 9   | `button`              | Living room, wall          |

The humidity appliance intentionally covers both humidifying and dehumidifying
entities without claiming a product-specific mechanism. The valve silhouette
is suitable for water, gas, or irrigation pipework. The robot vacuum models a
parked appliance; portable start, pause, stop, return-to-base, and advertised
fan-speed controls remain available, while maps and vendor-specific navigation
stay outside the catalog model. Every added instance receives a fresh manual
primary slot, and no household identifiers or credentials are stored here.

## Photo-matched oak dining set

`CustomDiningSet` supplies the existing home registry ID `dining-set` (Arrange →
Dining room), preserving `living-dining-set` and its 178.5 × 178.5 × 112 cm
placement envelope. The public catalog geometry replaces the previous custom
home implementation; it does not add a second Arrange entry.

The supplied photo informs the thin, softened round oak top, tapered legs,
continuous bentwood chair backs/arms, open wishbone supports, square envelope-woven
rush seats, and ribbed sage planter on a coiled mat. Four chairs are retained
from the existing composition; the photo only clearly exposes three. A round
top seen in perspective is inferred. Table and seat heights are inferred at
76.1 and 45.4 cm; these are not manufacturer measurements. The home retains its
existing 0.88 horizontal footprint scale (the nominal 120 cm tabletop therefore
renders at 105.6 cm). Dimensions and all model/placement IDs remain compatible
with saved instances. Floor contact is now Y=0.

All detail is procedural and cel-shaded, with 1.5 mm timber outlines. Repeated
rush cords, frame members, mat coils, and foliage are batched into 26 solid
meshes totaling 60,168 triangles. No source photo, textures, or downloaded model
assets are included.

## Garden lantern pole

`garden-lantern-pole` exports `GardenLanternPoleModel` and
`GARDEN_LANTERN_POLE_SIZE`. Find **Garden lantern pole** in
**Arrange → Outdoor → Lighting**. The supplied garden reference informs a
single black post, flared foot, tapered clear lantern panes, four corner bars,
hipped roof and warm bulb. The inferred overall dimensions are **24 × 24 × 80 cm**
(width × depth × height), with centered X/Z and ground contact at Y=0; these
are not manufacturer measurements. Uniform resizing is supported.

Each placement gets a manual `light` slot for the existing on/off and brightness
controls. The bulb follows connection state and brightness; illumination stays
engine-owned. Geometry and translucent toon panes are procedural, with no
external assets or household bindings. No home placement is added.

`low-garden-lantern` exports `LowGardenLanternModel` and
`LOW_GARDEN_LANTERN_SIZE`, appearing as **Low garden lantern** in the same
Outdoor → Lighting category. It keeps the same head on a ground-level foot,
without a pole, at an inferred **24 × 24 × 35 cm**. The pole variant's 80 cm
overall height follows the requested approximate height above ground. Both
are independently placeable and connectable light presets.

## Provençal wrought-iron pergola

**Wrought-iron pergola** (`pergola-string-lights`) appears once in
**Arrange → Outdoor → Garden structures** as a device. Details → Variant offers
**String lights** (the existing device default) and **Plain**. Both use one
procedural frame with charcoal-green iron posts, curled knee braces, an open
trellis, climbing wisteria, sage foliage and hanging lavender flowers. String
lights adds three gently sagging strings with 27 bulbs; Plain removes both the
strings and their illumination. The old `wrought-iron-pergola` furnishing remains
registered for existing saved items but is hidden from new-item browsing.

The inferred default envelope is **400 × 300 × 270 cm (width × length × height)**,
centered on X/Z with ground contact at Y=0. Arrange's Width and Depth fields
resize width and length independently; height stays fixed. Horizontal scaling
also scales ironwork and foliage. Only the four posts/feet block walking, leaving
the center passable. No manufacturer dimensions are claimed.

Both choices share the device's manual `light` slot and preserve its identity and
bindings when switching. String lights exposes Connected, Always on, Night only,
and Always off under State; Plain hides that control and suppresses scene illumination.
No HA commands are sent by Variant or State. Public geometry exports remain
`WroughtIronPergola`, `WROUGHT_IRON_PERGOLA_SIZE` (furnishing) and
`PergolaStringLightsModel` (device). No owner placements or bindings are added.

## Tailored couches

The existing **3-seat sofa** (`three-seat-sofa`) and **Sectional sofa**
(`sectional-sofa`) remain in Arrange → Living room. Both use rounded upholstery,
separate welt-piped seat and back cushions, recessed oak rails, tapered feet,
and restrained 1.5 mm outlines in the warm procedural toon style of Dining set.
The sectional retains its left chaise and padded arms; its implementation is now
exported as `CustomSectionalSofa` from the catalog through the existing home adapter.
No additional catalog card or home placement is created.

Existing inferred dimensions, origins, and resizing policies are preserved:
220 × 94 × 84 cm for the three-seater and 293 × 163 × 122.7 cm for the sectional
(width × depth × height). These are generic designs, not manufacturer replicas.
Numeric inspection measures 21 solid meshes / 7,588 triangles and 31 solid meshes /
10,356 triangles respectively; no textures or external assets are used.

Details → Variant offers **Classic** (the sectional's existing default) and
**Cozy**, adding two square throw cushions and a lumbar cushion in terracotta and
beige. Both fit the same envelope; Cozy uses 37 solid meshes and 13,080 triangles.

All furnishing/device models support the standard saved `variant` attribute.
Declare ordered `variants: [{ id, label }]` on the model definition to offer
choices; the first is the default. Models without metadata implicitly have one
`default` choice and show no selector. Components receive the resolved `variant`
prop. Variants share the model's bounds, dimensions, resizing and entity slots.

## Cozy white and blue bed and oak shelf

The existing `double-bed` (160 × 200 cm mattress) offers **Classic** (`default`)
and **Cozy white a blue** (`cozy-white-blue`) in Arrange → Bedroom → Beds →
Details → Variant. The new variant follows a supplied photo: four horizontal
timber headboard planks, ivory bedding, layered cream and navy cushions, a navy
foot throw and a softly rippled white blanket. Both retain the existing
**170 × 110 × 215 cm [width, height, depth]** placement envelope and independent
axis resizing. The reference supplies appearance, not measured dimensions.

**Oak floating shelf** (`oak-floating-shelf`, public `OakFloatingShelf` and
`OAK_FLOATING_SHELF_SIZE`) appears in Arrange → Bedroom → Storage. It is one
plain oak board with concealed fixings, without a back lip, visible brackets or
decorations. Its inferred default is **110 × 3.5 × 24 cm [width, height, depth]**.
Each wall-supported instance has independent elevation and dimensions, so two
instances can reproduce the reference's two heights. The origin is centered on
X, at the underside Y=0, with its wall-facing back at Z=0 and front toward +Z.
The photo is not bundled as an asset; all geometry and materials are procedural.

## Connected vehicles

Three independently placeable devices appear in **Arrange → Outdoor → Vehicles**.
Search **compact**, **Tesla**, or **pickup** in All items. Public exports are
`CompactCarModel` / `COMPACT_CAR_SIZE`, `ElectricSedanModel` / `ELECTRIC_SEDAN_SIZE`,
and `PickupTruckModel` / `PICKUP_TRUCK_SIZE` from `@cabane/catalog/device`.

| Model ID         | Width × length × height | Construction                                                                            |
| ---------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `compact-car`    | 194 × 400 × 150 cm      | Blue European hatchback, short hood, upright rear, four wheels and divided side glazing |
| `electric-sedan` | 208 × 470 × 145 cm      | White Tesla-inspired sedan, low swept cabin, smooth nose and slim headlights            |
| `pickup-truck`   | 224 × 540 × 186 cm      | Graphite double cab, raised chassis, large tires, open ribbed cargo bed and tailgate    |

Dimensions include mirrors and bumpers and are inferred generic proportions,
not verified manufacturer specifications or exact Tesla replicas. Sizes are fixed;
X/Z footprints are centered, tires touch Y=0, and fronts face +Z. Bodywork, glazing,
wheel hubs, lamps, mirrors, and trim use procedural toon geometry with restrained
body outlines. Each complete vehicle blocks walking.

Adding a vehicle creates a fresh manual primary `sensor` slot for a vehicle
integration's battery, range, fuel, or other reported state. The existing dashboard
shows that sensor read-only and the model indicates connection availability.
No vehicle-specific controls, tracking integration, driving animation, household
bindings, or home placements are added.

The vehicles use the same four-band engine toon material and restrained 1.5 mm
painted-body outlines as the photo-matched dining set. Body panels have crowned
shoulders, softened edges and open wheel arches. Rounded tires include tread,
recessed brake discs, alloy spokes, rim lips and lug nuts. Glazing is separated
into framed side panes, windscreen and rear glass, with procedural reflection
accents and front wipers. Door shut lines, handles, mirrors, layered lamps,
bumpers and license-plate recesses remain readable at catalog scale. The sedan
adds a glass roof; the pickup adds a recessed grille, side steps, lined/ribbed
bed, wheel tubs, bed rails and a separate tailgate.

Geometry is batched by finish: the most detailed connection state measures
14 meshes / 29,032 triangles (compact), 15 / 29,910 (sedan), and 16 / 31,682
(pickup), excluding the engine outline pass. Existing IDs, fixed dimensions,
placement origin and sensor slots are preserved. Front and rear rendered views
were reviewed; numeric checks also verify that glass is exposed and painted
bodywork does not fill the wheel wells in every connection state.

## Modular kitchens and outdoor cooking

The existing `kitchen-base-cabinet`, `kitchen-sink-cabinet`, and
`kitchen-wall-cabinet` now start at **60 cm wide** and allow width resizing.
Saved instance sizes are preserved. Details → Variant offers **White**, **Black**,
and **Wood**, with visible projecting door/drawer pulls. The existing `dishwasher`
device offers the same front finishes while retaining its standard 60 × 65 × 85 cm
size and connection behavior. No duplicate dishwasher or household binding is added.

New independently placeable presets (width × depth × height, cm):

| Model ID                 | Public component       | Dimensions      | Arrange |
| ------------------------ | ---------------------- | --------------- | ------- |
| `kitchen-pantry-cabinet` | `KitchenPantryCabinet` | 60 × 63 × 210   | Kitchen |
| `kitchen-hob-cabinet`    | `KitchenHobCabinet`    | 60 × 63 × 91    | Kitchen |
| `kitchen-island`         | `KitchenIsland`        | 150 × 90 × 90   | Kitchen |
| `outdoor-bbq`            | `OutdoorBbq`           | 120 × 60 × 110  | Outdoor |
| `wooden-garden-swing`    | `WoodenGardenSwing`    | 220 × 140 × 210 | Outdoor |

The pantry has two handled doors; the hob module adds four cooking rings to a
base cabinet; the island has three handled doors and an overhanging oak top.
All three share the cabinet finishes and support width resizing. The BBQ has a
closed lid, thermometer, front controls, timber side shelves and a supported cart.
The wooden swing has an A-frame, four suspension ropes and a slatted bench.
Outdoor models resize proportionally and require outdoor placement; their full
footprints block walking. The swing is static, with no simulated motion.

Dimensions other than the requested 60 cm cabinet width are inferred generic
proportions. Resizing scales construction along the supported axis, including
handles. Floor models are centered on X/Z, face +Z, and meet Y=0; wall cabinets
retain their wall-back Z=0 origin. Existing ovens and counter stools complement
these modules. Models use procedural toon geometry with no external assets.

### Outdoor irrigation

Arrange → Outdoor includes four generic connected irrigation presets:

| ID                     | Component                 | Solid size (W × H × D, metres) | Connection             |
| ---------------------- | ------------------------- | ------------------------------ | ---------------------- |
| `pop-up-sprinkler`     | `PopUpSprinklerModel`     | .14 × .182 × .14 (extended)    | valve or switch        |
| `rotating-sprinkler`   | `RotatingSprinklerModel`  | .28 × .164 × .28               | valve or switch        |
| `smart-hose-timer`     | `SmartHoseTimerModel`     | .09 × .20 × .063               | valve or switch        |
| `soil-moisture-sensor` | `SoilMoistureSensorModel` | .065 × .12 × .044              | sensor, moisture class |

Dimensions are inferred generic proportions, not manufacturer specifications.
Sprinklers and the soil sensor use a ground-contact origin; the hose timer mounts
against a wall near a tap. Buried pipes and sensing probes are omitted. Sprinkler
bounds describe solid hardware at full extension; decorative spray reaches about
1.2 m beyond the center and is excluded from picking. Water droplets animate only
in the connected-active state. The pop-up riser retracts when inactive; the rotary
head spins while watering. Reduced motion shows static water and snaps the riser
to its target. Disconnected/unavailable devices never display running water.
Use existing valve or switch controls; no new HA services or household mappings
are introduced. Add as many independently connected instances as needed.

## Additional living-room furniture

Ten independent generic presets appear in **Arrange → Living room** and All items.
All dimensions and finishes are inferred, with no manufacturer reference. Dimensions
below are width × depth × height in centimetres. Each model uses a centered X/Z
footprint, Y=0 floor contact, +Z front, and proportional resizing. Bar-cart wheels
and the trunk lid are static. The divider is a furniture obstacle, not a wall.

| Model ID                | Public component      | Dimensions     | Construction                                                                     |
| ----------------------- | --------------------- | -------------- | -------------------------------------------------------------------------------- |
| `two-seat-loveseat`     | `TwoSeatLoveseat`     | 160 × 88 × 82  | Sage upholstery, two separate seats and back cushions, rounded arms and oak feet |
| `indoor-chaise-longue`  | `IndoorChaiseLongue`  | 80 × 165 × 80  | Terracotta day chaise with a full-length cushion and raised headrest             |
| `pedestal-side-table`   | `PedestalSideTable`   | 50 × 50 × 55   | Round oak top and circular foot with a thick central pedestal                    |
| `c-shaped-sofa-table`   | `CShapedSofaTable`    | 40 × 45 × 62   | Oak overhanging top and charcoal steel C frame                                   |
| `blanket-storage-trunk` | `BlanketStorageTrunk` | 95 × 48 × 46   | Closed oak blanket chest with lid seam, brass latch and short feet               |
| `floor-magazine-rack`   | `FloorMagazineRack`   | 42 × 30 × 45   | Open oak magazine trough with tall side cheeks and carry crossbar                |
| `vinyl-record-cabinet`  | `VinylRecordCabinet`  | 90 × 40 × 70   | Walnut cabinet with four open record compartments and a turntable-height top     |
| `open-display-bookcase` | `OpenDisplayBookcase` | 100 × 35 × 160 | Open-backed oak display case with staggered dividers and four shelf bays         |
| `two-tier-bar-cart`     | `TwoTierBarCart`      | 70 × 42 × 80   | Two walnut trays on a brass frame with four dark wheels and a push handle        |
| `slatted-room-divider`  | `SlattedRoomDivider`  | 120 × 40 × 180 | Freestanding oak screen with twelve vertical slats and two stabilizing feet      |

## Everyday outdoor essentials

These 15 independently placeable furnishings appear in **Arrange → Outdoor**,
with the categories below. Dimensions are inferred generic proportions, not
manufacturer measurements (width × depth × height, cm). All resize uniformly,
use a centered X/Z footprint and Y=0 floor contact, and face +Z. No home
placements or smart bindings are added. The parasol blocks walking only at its
base and pole; other items use their full footprint. The fire pit is unlit, the
planter is empty, and the raised bed includes recessed soil.

| Model ID               | Dimensions      | Category          | Construction                                                   |
| ---------------------- | --------------- | ----------------- | -------------------------------------------------------------- |
| `outdoor-dining-table` | 160 × 90 × 75   | Tables            | Teak slatted top, charcoal four-leg frame                      |
| `outdoor-dining-chair` | 56 × 58 × 85    | Seating           | Teak slats, charcoal frame and armrests                        |
| `garden-bench`         | 150 × 60 × 90   | Seating           | Three-seat teak slatted bench with charcoal arms               |
| `outdoor-side-table`   | 50 × 50 × 45    | Tables            | Compact round teak top and charcoal pedestal                   |
| `patio-parasol`        | 240 × 240 × 250 | Garden structures | Sand-colored open canopy, central pole and weighted base       |
| `terracotta-planter`   | 50 × 50 × 50    | Vegetation        | Empty tapered terracotta pot with thick lip                    |
| `raised-garden-bed`    | 120 × 80 × 40   | Garden structures | Timber raised bed with recessed soil                           |
| `outdoor-storage-box`  | 120 × 55 × 60   | Storage           | Sage deck box, separate lid, front grip and panel seams        |
| `garden-hose-reel`     | 48 × 42 × 60    | Garden tools      | Freestanding reel with wound green hose and crank              |
| `watering-can`         | 54 × 22 × 36    | Garden tools      | Sage watering can with carry handle and projecting spout       |
| `garden-birdbath`      | 60 × 60 × 80    | Decor             | Stone-colored open basin on flared pedestal                    |
| `outdoor-fire-pit`     | 80 × 80 × 40    | Garden structures | Unlit charcoal fire bowl with three connected feet             |
| `garden-compost-bin`   | 80 × 80 × 100   | Garden tools      | Dark green compost bin, lift lid, ventilation and access hatch |
| `wheelie-bin`          | 58 × 64 × 105   | Garden tools      | Green refuse bin, hinged lid, rear handle and two wheels       |
| `garden-trellis`       | 90 × 12 × 180   | Garden structures | Freestanding timber lattice panel with two floor feet          |

## Practical household objects

These 15 non-connected, independently placeable presets appear in Arrange under
the room below and All items. Dimensions are inferred generic proportions, not
manufacturer measurements, in **width × depth × height cm**. All resize uniformly.
Floor and countertop objects have centered X/Z footprints and Y=0 at their support;
wall objects have their back at Z=0, bottom at Y=0, and face +Z. Set elevation for
countertop objects. No binding slots or household placements are added.

| Model ID                  | Public component        | Dimensions    | Construction                                                          | Arrange room |
| ------------------------- | ----------------------- | ------------- | --------------------------------------------------------------------- | ------------ |
| `drying-rack`             | `DryingRack`            | 120 × 60 × 95 | White steel standing frame with ten drying rails                      | laundry      |
| `ironing-board`           | `IroningBoard`          | 120 × 40 × 90 | Rounded padded sage board, steel trestles and connecting brace        | laundry      |
| `two-step-stool`          | `TwoStepStool`          | 45 × 50 × 45  | Oak two-step platform with open risers and four supports              | kitchen      |
| `utility-shelving`        | `UtilityShelving`       | 90 × 45 × 180 | Four steel uprights and five full-width shelves                       | laundry      |
| `workbench`               | `Workbench`             | 150 × 65 × 90 | Thick oak worktop, steel legs and lower tool shelf                    | laundry      |
| `toolbox`                 | `Toolbox`               | 45 × 24 × 30  | Blue tool case with lid seam, two latches and raised carry handle     | laundry      |
| `shoe-cabinet`            | `ShoeCabinet`           | 80 × 30 × 110 | Slim oak cabinet with three cream tilt fronts and recessed pulls      | entryway     |
| `umbrella-stand`          | `UmbrellaStand`         | 28 × 28 × 55  | Open sage slatted holder with drip tray                               | entryway     |
| `freestanding-coat-stand` | `FreestandingCoatStand` | 50 × 50 × 175 | Oak central post with six supported coat pegs and cross feet          | entryway     |
| `laundry-carry-basket`    | `LaundryCarryBasket`    | 60 × 40 × 35  | Open cream slatted basket with reinforced grip rims                   | laundry      |
| `kitchen-trolley`         | `KitchenTrolley`        | 70 × 45 × 90  | Oak worktop, two lower shelves, steel posts and four casters          | kitchen      |
| `bread-bin`               | `BreadBin`              | 40 × 25 × 25  | Warm-white box with rounded lid and oak front pull                    | kitchen      |
| `dish-drying-rack`        | `DishDryingRack`        | 45 × 32 × 15  | Drain tray with eight plate dividers and open side rails              | kitchen      |
| `toilet-paper-holder`     | `ToiletPaperHolder`     | 18 × 14 × 12  | Wall plate, two brackets, spindle and paper roll                      | bathroom     |
| `medicine-cabinet`        | `MedicineCabinet`       | 50 × 16 × 65  | Wall-mounted cream cabinet with framed pale-blue mirror and side pull | bathroom     |

`@cabane/catalog/architecture` exports `DOOR_PRESETS`: six typed configurations
(Panel wood, Panel white, French, Full glass, Sliding wood, Garage door) with
metre-based default dimensions. `DoorModel` dispatches hinged/sliding leaves or
a roll-up assembly from the canonical door operation. Architecture models receive
normalized `position` (0 closed, 1 open), rather than a boolean `open` prop.

## Compact bedroom and desk modules

Eleven independently placeable generic presets appear in Arrange → Bedroom.
They use inferred proportions, warm white fronts, black round knobs and natural
wood; no manufacturer measurements are claimed. Dimensions are width × height
× depth in metres. Each accepts independent axis resizing and has a centered
footprint with Y=0 at its support and the front facing +Z.

| ID                          | Dimensions        | Construction                                                                |
| --------------------------- | ----------------- | --------------------------------------------------------------------------- |
| `knob-door-wardrobe`        | 1 × 2.4 × .6      | Two plain doors by default; single-door variants with left/right black knob |
| `overbed-bridge-cabinet`    | 2 × .65 × .4      | Three doors and round pulls; elevate above a bed, no floor collider         |
| `shelf-headboard`           | 2 × 1.15 × .22    | Wood backing, top shelf, white inset panel, two small bedside ledges        |
| `headboard-free-double-bed` | 1.64 × .66 × 2.04 | 160 × 200 cm mattress, white frame, neutral duvet and two pillows           |
| `drawer-pedestal-desk`      | 1.8 × .75 × .6    | Wood worktop, two white five-drawer supports, recessed dark grips           |
| `white-folding-chair`       | .46 × .8 × .52    | White seat and three back slats, crossed metal supports and floor pads      |
| `desktop-monitor`           | .54 × .42 × .18   | Dark screen bezel, muted flat display, stem and base; elevate onto a desk   |
| `open-laptop`               | .34 × .24 × .24   | Dark open notebook, flat screen, keyboard and touchpad                      |
| `round-globe-wall-lamp`     | .24 × .24 × .16   | Static white globe on a round backplate; no light slot or floor collider    |

`knob-door-wardrobe` offers Two doors (`default`), One door · left knob
(`single-left`), and One door · right knob (`single-right`). These keep the same
cabinet bounds; door count is explicit rather than inferred from instance width.

Two further static lighting visuals are available in Bedroom: `wall-reading-spot`
(9 × 12 × 13 cm) has a round white plate and a downward tilted cylindrical barrel;
`oak-wall-uplight` (12 × 25 × 9 cm) has a narrow oak backing and two white light
bands. Both support independent axis resizing and use the supporting wall/surface at the back of
the centered depth envelope. They do not create floor colliders or HA slots.

These are static furnishings and carry no invented smart-device capabilities.
The existing `pedestal-fan` device remains available separately. Cabinet fronts
sit 5 mm beyond the supporting cases; desk grips end at the declared front
plane, clear of the drawer faces by 10 mm. Monitor glass sits 2 mm ahead of
the bezel face. Suspended modules and desk accessories use absolute elevation;
their Y=0 is the supporting surface, not an instruction to place them on the floor.

## Curved living-room and media modules

These generic, independently placeable presets use dimensions inferred from
reference appearance, rather than manufacturer measurements. They are procedural
toon geometry and support independent axis resizing. Front is +Z and Y=0 is the
supporting surface; elevate shelf accessories and suspended modules explicitly.

| ID                          | Width × height × depth (metres) | Construction                                                   |
| --------------------------- | ------------------------------- | -------------------------------------------------------------- |
| `curved-three-seat-sofa`    | 2.6 × .88 × 1.1                 | Shallow crescent base, three seat/back cushions, four feet     |
| `sage-tub-armchair`         | .78 × .86 × .8                  | Rounded sage seat and shell, oak feet                          |
| `sage-rounded-footstool`    | .48 × .45 × .46                 | Sage padded stool on four oak feet                             |
| `hexagonal-side-table`      | .6 × .43 × .5196                | White top/oak body; `oak-top` reverses finishes                |
| `six-door-oak-sideboard`    | 3 × .74 × .42                   | Six flat doors, three knob pairs                               |
| `double-arched-bookcase`    | 1 × 1.73 × .36                  | Two real arched openings with recessed backing and oak shelves |
| `media-shelf-surround`      | 2 × 1.73 × .36                  | Open television bay below two oak shelves                      |
| `white-display-column`      | .6 × 2.4 × .3                   | Freestanding open shelving; not an architectural wall niche    |
| `white-tapered-wall-sconce` | .18 × .23 × .12                 | Static white tapered shade with open top and wall plate        |
| `slim-soundbar`             | 1.05 × .065 × .12               | Static dark bar and indicator                                  |
| `six-globe-ceiling-lamp`    | .9 × .42 × .8062                | Brass connected hub/spokes and six globes; static furnishing   |
| `tufted-diamond-rug`        | 2.6 × .016 × 2                  | Cream field, raised diamond rings and fringe                   |
| `book-row`                  | .4 × .28 × .18                  | Ten blank coloured spines                                      |
| `ring-ceramic-vase`         | .18 × .3 × .06                  | White ceramic ring and dried stems                             |
| `decorative-globe`          | .278 × .339 × .24               | White sphere on brass support                                  |
| `trailing-shelf-plant`      | .26 × .57 × .18                 | Pot origin at Y=0; foliage extends down to Y=-.35              |

Suspended assemblies and decor do not create floor colliders. Place the arched
case and media surround on a supporting cabinet, with its top at their Y=0.
The rug is 16 mm high; accessories standing on it need the matching elevation.
The ceiling lamp and soundbar declare no smart capabilities.

`compact-wall-television` is a separate Media device (1.58 × .9 × .07 m), reusing
the existing wall television's media-player behavior. Its back plane is Z=0,
width/height resize independently, and household mapping stays in runtime slots.

The `single-window-curtain` furnishing preset covers one window with its own
track and a single gathered panel. Arrange → Living room → Decor offers Gathered
left and Gathered right variants, as viewed from the room. Each instance has
independent width (track length), height (drop), depth, and elevation controls.
Fit to window aligns one window; adding another prefers an unoccupied window.
The inferred default envelope is 120 × 240 × 12 cm; the panel drops 232 cm
below its track. Existing paired and motorized curtains remain unchanged.

## Rattan bell pendant

`rattan-bell-pendant` is available in Arrange → Dining room → Lighting and All
items. Device exports are `RattanBellPendantModel` and `RATTAN_BELL_PENDANT_SIZE`
from `@cabane/catalog/device`.
Based on the supplied lamp photo, it has an open woven natural-rattan bell,
a narrow bottle neck, white suspension cord, ceiling rose and recessed opal bulb.
The woven shell uses actual curved cane strands and binding hoops, batched into
three closely related warm tones; there is no opaque cone behind the weave.

Dimensions are inferred, not manufacturer specifications: 50 cm diameter,
48 cm shade height and 120 cm overall drop. Proportional resizing is supported.
The centered X/Z origin is at the shade's lower rim, with the ceiling contact at
Y=1.2 m. New instances are light devices with a primary light binding, dimming-aware bulb
glow and engine-managed scene illumination. The bulb and physical emitter share a
position 22 cm above the lower rim, in the wider shade chamber; the socket and
internal cord meet the lowered bulb. Maximum scene intensity is 0.45 with a 3 m
reach, and bulb emission tops out at 0.18. Inactive, unavailable and disconnected
bulbs do not glow. The former furnishing is hidden from Arrange but retained for
saved-project compatibility. No home placement is added, and the source photo is
not stored in Git.

## Reusable catalog additions

Reusable bedroom, dining, balcony, bathroom and kitchen models extend the shared
catalog without importing apartment placements or private assets. Square cube
storage offers two- and four-compartment variants behind one frame and descriptor.
The wood bunk bed (`wood-bunk-bed`, 101.5 × 160 × 208 cm) offers right-side,
left-side, front-end and back-end ladder variants. All four share the same
placement envelope and independent axis resizing.
The existing potted plant gains a white-pot variant without changing its default.

Bathroom definitions are grouped by fixtures, storage and lighting. They retain
substantial fixtures such as baths, shower screens, basins, vanities, mirrors,
cabinets and a wall-hung toilet. Standalone toiletries, tiny fittings, packaging,
fitted laundry platforms and duplicate appliance poses are excluded. Wall-mounted
awnings use ordinary wall support; outdoor ground-placement restrictions apply to
the folding table and chair. The cleaning-tool rack also uses wall support.

Connected additions include the built-in microwave, white dome pendant and
under-cabinet LED strip. Heated towel rails offer dense white and black variants;
all variants retain the shared activity indication. The built-in microwave uses
the same active-only warm window treatment as the countertop model.

Fitted kitchen joinery, exact entryway cabinetry, and apartment-specific rounded
furniture stay in the active home's personal model collection.

Ordinary model geometry is reviewed visually and through shared catalog and
surface checks. This split adds no item-specific test files. The shared outline
regression protects non-indexed source normals from outline smoothing.

## Cozy Mediterranean variants

Eleven additional Details variants reuse existing shared catalog IDs and envelopes:

- Bedroom → Double bed: Sage linen and clay throw, Dusty rose and cocoa,
  and Oatmeal and ivory. Each uses the existing timber headboard, draped layers,
  sleeping pillows, two pairs of accent cushions and lumbar cushion.
- Living room → Sectional sofa: Sage cushions with either left or right chaise.
- Living room → Decor → Framed wall art: Olive branch, Fern study and
  Terracotta botanical, with procedural leaves and a slender stem.
- Living room → Decor → Potted plant: Sage ceramic, Sandstone and Charcoal pots.

Dimensions remain the existing inferred generic dimensions. Botanical ink sits
at Z=40 mm, 3 mm ahead of the canvas face (37 mm); coplanar ink shapes describe
one continuous print. Bedding retains its existing 15 mm layer clearances.
These are reusable variants, not new household placements or manufacturer products.

The outdoor bench adds Sage and Linen seat pads; the pool lounger adds an ivory
lumbar cushion and folded clay towel. Existing bare/default variants remain.

Five new independently placeable models use generic inferred dimensions
(width × height × depth, metres), support independent axis resizing and expose
Y=0 at the supporting surface:

| ID                  | Dimensions      | Arrange              | Variants                               |
| ------------------- | --------------- | -------------------- | -------------------------------------- |
| loose-throw-cushion | .45 × .16 × .45 | Living room / Decor  | Sage, Terracotta, Ivory                |
| tabletop-candle     | .12 × .18 × .12 | Living room / Decor  | Ivory wax, Clay wax                    |
| flower-pot          | .5 × .8 × .5    | Outdoor / Vegetation | Lavender, White flowers, Coral flowers |
| teak-lounge-sofa    | 2 × .84 × .8    | Outdoor              | Ivory and terracotta, Ivory and sage   |
| teak-lounge-chair   | .8 × .84 × .8   | Outdoor              | Ivory and terracotta, Ivory and sage   |

Cushions and candles need explicit elevation onto their supporting furniture.
Candles are static, unlit decor with no light or HA slot. Lounge seats use three
or one seat/back cushion pairs with accent cushions, connected teak rails and
legs. Flower pots include soil, stems, leaves and flower heads. All are procedural;
no reference screenshot or private home data is bundled.

Single bed also offers Sage and clay and Dusty rose and clay, with an accent
cushion and folded throw, preserving its 100 × 95 × 210 cm envelope.

## Reference-led cozy refinements

The terrace lounge now has open spindle arms and staggered, larger accent
cushions; the sofa mixes sage and clay accents. Single-bed Sage and Rose variants
use a curved timber headboard, draped cloth and layered pillows.
Botanical frame variants depict several leafy stems rather than one diagrammatic sprig.

New public presets: RoundJuteRug / round-jute-rug (2 × .018 × 2 m) and
LeafyPlanter / leafy-planter (.8 × 1.25 × .8 m). The rug has coiled rope relief;
the planter uses 540 individually shaped leaves batched into three foliage meshes.
Both support independent axis resizing; dimensions are inferred from the reference,
not manufacturer measurements. The planter offers Terracotta and Ivory stone pots.

Rug also offers Sage woven (sage-woven), a plain sage field with a pale border,
resizable independently along its width and length. Casa Solstice uses a
1.3 × 11 m runner beside the stair opening.

The garden swing offers a Cozy variant with a linen seat pad and three sage/clay
cushions. Its original bare-timber variant remains available.
