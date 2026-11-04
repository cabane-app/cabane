# Casa Solstice · Atelier

A luxury Mediterranean revision of Casa Solstice, saved in
[`../atelier.project.json`](../atelier.project.json). Import that file through
**Workspaces → Import workspace → From file**, then review and Save.
The two generated wallpapers are embedded in the JSON; no separate asset upload
is needed. The original furnished Solstice remains available alongside it.

## Design

Three floors contain twenty rooms and 363 scene items. The existing two floors
retain their architectural identities, openings and original device slots.

- The new 252 m² basement is a private retreat: two-row cinema, listening bar
  with piano and conversation seating, bathing suite, wellness lounge and stair
  gallery. A 1.25 m wide stair connects it to the ground floor. The basement
  floor is 3.2 m below the ground floor.
- Limestone unifies the kitchen, entrance, salon, upper gallery and bathrooms.
  Walnut tones, wood cabinetry, pale stone dining, oatmeal bedding, woven rugs,
  sculptural seating and plants keep the rooms cohesive.
- The formerly sparse salon becomes an intimate seating room. The studio gains
  a library wall and reading chaise; the primary suite gains a reading corner.
- The front garden falls gently by up to 24 cm. The rear pool terrace stays
  level. Ground-mounted landscape items follow the new grade.
- Ninety-six modeled devices include lighting, media, air quality, climate,
  humidity, leak sensing and existing security, appliance and garden devices.
  New devices have local binding slots, ready for Connect. No live HA mappings
  or household identifiers are included. Basement accent lights use always-on
  preview states; selected additions elsewhere use night-only lighting.
- The primary bedroom has an olive-grove fresco wall. The listening bar has a
  dark green and bronze botanical mural. Both use the editor's custom wall-image
  finish, with a physical width matched to their feature walls.

## Assets

Both artworks were generated with the built-in Image Gen tool, then reduced to
1024 × 682 JPEGs within Cabane's 192 KiB per-image limit. The portable project is
under 1 MiB. Copies of the embedded images are in `assets/`.

Olive Grove prompt:

> Create a luxury bespoke wallpaper mural texture for a sophisticated Mediterranean villa's master bedroom. Flat orthographic artwork only, edge-to-edge rectangular landscape 3:2 image, no room mockup, no furniture, no frame, no lettering. Hand-painted atmospheric Mediterranean olive grove with delicate slender olive branches and distant softly layered limestone hills, restrained warm ivory linen background, desaturated sage and olive green, subtle warm antique gold ink details. Quiet expensive artisanal fresco aesthetic, elegant generous negative space, soft matte pigment and delicate natural linen texture. Broad calm composition designed to cover a whole bedroom feature wall. No photographic lighting, shadows, perspective or objects in front of the artwork.

Bronze Palms prompt:

> Use case: stylized-concept. Asset: bespoke luxury wallpaper texture for a private Mediterranean villa cocktail lounge. Create a flat edge-to-edge landscape 3:2 artwork, NOT a room mockup. Abstract Art Deco botanical composition of overlapping elegant fan-shaped palm leaves, fine hand-drawn antique brass outlines, very dark desaturated petrol green and charcoal olive background, subtle patinated bronze accents, large graceful geometric arcs and quiet generous areas. Sophisticated boutique hotel, restrained and expensive, matte silk texture. No words, logos, borders, furniture, shadows, perspective, photographic reflections or room. The whole artwork will be applied to one feature wall.

## Authoring and verification

Architecture, furnishing, floor finishes and terrain were authored through local
editor agent batches. Custom wall-image metadata was embedded in the portable
project because the current command adapter does not expose wall-face finishes.
The finished JSON was imported into a fresh editor workspace for review.

Run the public validator:

```sh
node dev/home-assistant/showcase/validate.mjs home/showcase/atelier.project.json
```

The project validates without errors or warnings. Command-driven camera captures
cover all three floors and close views of the cinema, listening bar, bathing
suite, kitchen, living room and primary bedroom. Private captures and authoring
checkpoints are in ignored `test-results/solstice-atelier/`.

These checks cover disconnected editor rendering and portable schema validity.
Live HA device operation and a complete interactive walk/collision traversal
were not exercised. Treat the dimensions and furnishings as an authored showcase,
not construction drawings.

## Furnishing completion

The second revision adds eight reusable native catalog presets. Six individual
cinema recliners and eight acoustic panels replace the cinema's two sofas; its
side tables sit between the seats. The Palm Club gains an eighteen-bottle wine
cabinet, a barware tray and a low travertine table. The living room gains the same
stone-table family, a magazine rack and an accent cushion.

Towel towers equip the basement bathing suite, wellness lounge and family
bathroom. A full-width upholstered bench replaces the primary suite's small
ottoman. Bronze loop sculptures finish the sideboards and gallery console, while
barware trays complete the kitchen island and upstairs cart. Added static
furnishings introduce no new device slots.

The new presets are available in this checkout's Arrange catalog. Importing this
revision elsewhere requires a Cabane build containing those catalog entries.
The original twenty-room layout and generated wallpapers are retained.

## Public demo

This portable project is also the fresh-browser demo seed. The in-browser
adapter supplies synthetic device bindings and camera feeds; public visitors
need no HA server, account or credentials. Existing browser workspaces are not
automatically replaced. See `packages/engine/src/onboarding/demo/README.md` for
the simulated controls and their limits.
