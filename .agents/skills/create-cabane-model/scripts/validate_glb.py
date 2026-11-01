"""Validate a standalone Cabane GLB using only the Python standard library."""

import hashlib
import json
import struct
import sys
from pathlib import Path

SUPPORTED = set(
    "KHR_materials_unlit KHR_materials_clearcoat KHR_materials_transmission KHR_materials_ior KHR_materials_specular KHR_materials_sheen KHR_materials_volume KHR_materials_emissive_strength KHR_materials_iridescence KHR_materials_anisotropy KHR_materials_dispersion KHR_texture_transform KHR_mesh_quantization KHR_lights_punctual EXT_texture_webp EXT_mesh_gpu_instancing".split()
)


def validate(path):
    if Path(path).stat().st_size > 10 * 1024 * 1024:
        raise ValueError("GLB must fit 10 MiB.")
    data = Path(path).read_bytes()
    if not 20 <= len(data) <= 10 * 1024 * 1024:
        raise ValueError("GLB must fit 10 MiB and contain a complete header.")
    if struct.unpack_from("<III", data) != (0x46546C67, 2, len(data)):
        raise ValueError("Expected a GLB 2.0 container.")
    offset, document, binary_size = 12, None, 0
    while offset < len(data):
        size, kind = struct.unpack_from("<II", data, offset)
        if size % 4 or offset + 8 + size > len(data):
            raise ValueError("Invalid chunk length.")
        if offset == 12 and kind != 0x4E4F534A:
            raise ValueError("The first chunk must be JSON.")
        if kind == 0x4E4F534A:
            if document is not None:
                raise ValueError("Duplicate JSON chunk.")
            document = json.loads(data[offset + 8 : offset + 8 + size])
        elif kind == 0x004E4942:
            if binary_size:
                raise ValueError("Duplicate binary chunk.")
            binary_size = size
        offset += 8 + size
    if not document or document.get("asset", {}).get("version") != "2.0":
        raise ValueError("Expected glTF 2.0 metadata.")

    def inspect(value, depth=0):
        if depth > 64:
            raise ValueError("Excessive nesting.")
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ("uri", "url") and isinstance(child, str):
                    raise ValueError(
                        "Embed every buffer and image; external references are rejected."
                    )
                inspect(child, depth + 1)
        elif isinstance(value, list):
            for child in value:
                inspect(child, depth + 1)

    inspect(document)
    unsupported = set(document.get("extensionsRequired", [])) - SUPPORTED
    if unsupported:
        raise ValueError(
            f"Unsupported required extensions: {', '.join(sorted(unsupported))}"
        )
    if set(document.get("extensionsRequired", [])) - set(
        document.get("extensionsUsed", [])
    ):
        raise ValueError("Required extensions must also be declared in extensionsUsed.")
    buffers = document.get("buffers", [])
    if (
        len(buffers) != 1
        or not binary_size - 3 <= buffers[0]["byteLength"] <= binary_size
    ):
        raise ValueError("Expected one embedded binary buffer.")
    for image in document.get("images", []):
        if "bufferView" not in image or image.get("mimeType") not in (
            "image/png",
            "image/jpeg",
            "image/webp",
        ):
            raise ValueError("Expected embedded PNG/JPEG/WebP images.")
    for view in document.get("bufferViews", []):
        if (
            view.get("buffer") != 0
            or view.get("byteOffset", 0) < 0
            or view["byteLength"] < 0
            or view.get("byteOffset", 0) + view["byteLength"] > binary_size
        ):
            raise ValueError("A buffer view is outside the embedded file.")
    triangles, meshes = 0, 0
    active = set()
    visited = set()

    def visit(index, depth=0):
        nonlocal triangles, meshes
        if index in active or depth > 64:
            raise ValueError("Scene cycle or excessive nesting.")
        if index in visited:
            raise ValueError("Scene nodes cannot have multiple parents.")
        visited.add(index)
        active.add(index)
        node = document["nodes"][index]
        if "mesh" in node:
            instancing = node.get("extensions", {}).get("EXT_mesh_gpu_instancing")
            count = (
                document["accessors"][next(iter(instancing["attributes"].values()))][
                    "count"
                ]
                if instancing
                else 1
            )
            for primitive in document["meshes"][node["mesh"]]["primitives"]:
                if primitive.get("mode", 4) != 4:
                    raise ValueError("Export triangle meshes.")
                accessor = primitive.get("indices", primitive["attributes"]["POSITION"])
                vertices = document["accessors"][accessor]["count"]
                if vertices <= 0 or vertices % 3:
                    raise ValueError("Invalid triangle count.")
                triangles += vertices // 3 * count
                meshes += 1
                if triangles > 100_000 or meshes > 128:
                    raise ValueError(
                        "Limit: 100,000 triangles and 128 mesh primitives."
                    )
        for child in node.get("children", []):
            visit(child, depth + 1)
        active.remove(index)

    for node in document["scenes"][document.get("scene", 0)]["nodes"]:
        visit(node)
    if not meshes:
        raise ValueError("No triangle meshes in the default scene.")
    print(
        f"OK: {len(data)} bytes, {triangles} triangles, {meshes} meshes; SHA-256 {hashlib.sha256(data).hexdigest()}"
    )
    if document.get("animations"):
        print("Cabane shows the initial pose and ignores animations.")
    print(
        "Next: inspect dimensions, support contact and materials in Cabane → Arrange → My models → Import model (.glb file)."
    )


if __name__ == "__main__":
    try:
        validate(sys.argv[1])
    except (
        ValueError,
        KeyError,
        IndexError,
        TypeError,
        OSError,
        struct.error,
    ) as error:
        print(f"Invalid GLB: {error}", file=sys.stderr)
        sys.exit(1)
