# Export conventions

GLB 2.0 is the only model format required by Cabane. The name, support and profile are
entered in the app. Each import creates a separate model; multiple models may share the
same immutable file. Furniture and device instances can be placed, uniformly resized,
rotated, duplicated and saved like native items.

Use metres. glTF uses right-handed coordinates: +Y up, +X right, front toward +Z.
Blender's glTF exporter converts its +Z-up coordinates automatically.

The preview computes an envelope after your orientation correction and normalizes contact:

| Support | Contact origin                                       |
| ------- | ---------------------------------------------------- |
| Floor   | Bottom at Y=0, centred on X/Z                        |
| Wall    | Back at Z=0, centred on X/Y; model extends toward +Z |
| Ceiling | Top at Y=0, centred on X/Z; model extends toward −Y  |

Origins in the source file need not match these conventions. Check the preview after
normalization. Width, height and depth corrections all apply a uniform scale. Floor objects
have a simple envelope collision, rather than a detailed walkable interior.

## Materials and files

Keep the object's original glTF PBR or unlit materials. Embedded textures are allowed.
Export meshes and embedded PNG/JPEG/WebP images into a single GLB. External image,
buffer, URL and data-URI references are rejected. Cabane does not play animations or
import scene cameras/lights. Export the desired rest pose and apply modifiers first.

Cabane accepts these required extensions: KHR_materials_unlit, KHR_materials_clearcoat,
KHR_materials_transmission, KHR_materials_ior, KHR_materials_specular, KHR_materials_sheen,
KHR_materials_volume, KHR_materials_emissive_strength, KHR_materials_iridescence,
KHR_materials_anisotropy, KHR_materials_dispersion, KHR_texture_transform,
KHR_mesh_quantization, KHR_lights_punctual, EXT_texture_webp,
EXT_mesh_gpu_instancing. Required Meshopt, Draco and KTX2 compression are unsupported;
export without them. Prefer the plain format for portability.

Limits: 10 MiB/file, 100 MiB distinct assets/house, 100,000 rendered triangles/model and
128 mesh primitives/model. Instanced triangles count for every visible occurrence.
The local validator checks the container and declared geometry; Cabane also checks decoded
geometry, materials, bounds and successful loading in the preview.

## Profiles

Choose Furniture for an object without a connected function. Existing HA profiles are
Light, Sensor, Binary sensor, Camera, Cover, Switch, Toggle (input_boolean), Climate, Fan,
Media player, Humidifier, Water heater, Vacuum, Lock, Alarm, Valve, Siren, Select, Number,
and Button. Cabane creates one fresh primary connection slot per device instance.

Light adds an independently configured point light, controlled by availability, brightness,
colour and the app's light-state rules. Camera opens the existing viewer. Other profiles use
existing controls and retain static geometry, including Cover. Choosing a profile does not
connect to HA; mapping happens privately in Cabane after authentication.

## Run the examples

Blender (installed locally):

```sh
blender --background --python examples/blender.py -- desk.glb
python3 scripts/validate_glb.py desk.glb
```

Three.js (Node 20 or newer, in a local modelling folder):

```sh
npm install --no-save three@0.182.0
node examples/three.mjs desk.glb
python3 scripts/validate_glb.py desk.glb
```

In Cabane, open Arrange → My models → Import model (.glb file), choose the file, review it from multiple angles,
enter its name/support/profile, and add it. Save the home and export a `.cabane` archive
to transfer the design and its deduplicated GLB files together.
