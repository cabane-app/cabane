"""Standalone Blender example; no Cabane repository or HA data required."""

import sys
import bpy

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 0.85
    return result


wood = material("Warm oak", (0.50, 0.30, 0.14))
frame = material("Sage frame", (0.11, 0.16, 0.11))


def box(name, size, at, finish):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(finish)


# Blender is Z-up. The exporter emits glTF Y-up in metres.
box("Desktop", (1.2, 0.65, 0.05), (0, 0, 0.725), wood)
for x in (-0.52, 0.52):
    for y in (-0.25, 0.25):
        box("Leg", (0.055, 0.055, 0.7), (x, y, 0.35), frame)

bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.unit_settings.scale_length = 1
args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
output = args[0] if args else "desk.glb"
bpy.ops.export_scene.gltf(
    filepath=output,
    export_format="GLB",
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
)
print(f"Saved {output}: 1.20 × 0.75 × 0.65 m, Floor, Furniture.")
