---
name: create-cabane-model
license: MIT
description: Create a self-contained GLB furniture or device model for import into hosted Cabane. Use for a personal chair, table, appliance, lamp, sensor, camera, or other visible object, with Blender or Three.js. Works independently of the Cabane repository.
---

# Create a Cabane model

Produce a standard GLB 2.0 file that the user can import through Arrange → My models → Import model (.glb file).
Use the user's description and reference images to establish shape and real dimensions.
Resolve scripts, examples and references relative to this skill's installed directory.
Ask only for missing information that materially changes the model. State inferred dimensions.

Recommend Cabane's simplified proportions, warm restrained palette and matte finishes by
default. Follow an explicitly requested alternative style, including realistic PBR and textures.
Style is optional. Preserve useful detail at the scale the object occupies in a room.

## Deliver

- One self-contained `.glb`, with embedded buffers and images, in metres.
- A short handoff with dimensions, the suggested Floor / Wall / Ceiling support and an
  existing device profile, or Furniture. These are chosen in Cabane; no extra manifest is needed.
- Run `python3 scripts/validate_glb.py model.glb` and report its result.
- Ask the user to inspect the file in Cabane's import preview, correct size/orientation if
  needed, then add it to My models. For a Light, configure its light point in the preview.

The file must fit 10 MiB, 100,000 triangles and 128 mesh primitives/scene occurrences.
Cabane allows 100 MiB of distinct assets per house. Use modest embedded PNG/JPEG textures.
Use triangle meshes, standard glTF PBR or unlit materials and a default scene.
Avoid Draco, KTX2 and required extensions outside the list in [export.md](references/export.md).
Use static initial geometry: Cabane ignores embedded animations, cameras and lights.
For a lamp, model its shade/bulb; Cabane adds the controlled light independently.

Use local modelling tools available to the user. [export.md](references/export.md) describes
units, contact conventions and all profiles. Adapt the independent examples:

- `examples/blender.py`: run with Blender's background Python interface.
- `examples/three.mjs`: run with Node and Three.js installed in a local modelling folder.

Reference photos remain inputs. Do not include photos, HA entity IDs, connection data or
credentials in the GLB or handoff. Remind the user that their agent provider may process
the supplied references. Deliver only the model and necessary modelling source.
