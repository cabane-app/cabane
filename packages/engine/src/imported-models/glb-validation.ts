import { CUSTOM_MODEL_LIMITS } from "./contracts";

export type GlbDocument = {
  asset?: { version?: string; minVersion?: string };
  extensionsRequired?: string[];
  extensionsUsed?: string[];
  buffers?: { uri?: string; byteLength: number }[];
  images?: { uri?: string; bufferView?: number; mimeType?: string }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[];
  accessors?: { count: number }[];
  meshes?: {
    primitives: { mode?: number; indices?: number; attributes: Record<string, number> }[];
  }[];
  nodes?: {
    mesh?: number;
    children?: number[];
    camera?: number;
    extensions?: Record<string, unknown>;
  }[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
  animations?: unknown[];
  cameras?: unknown[];
  extensions?: Record<string, unknown>;
};

// The bundled import decoder supports these without external resource requests.
export const SUPPORTED_GLB_EXTENSIONS = new Set([
  "KHR_materials_unlit",
  "KHR_materials_clearcoat",
  "KHR_materials_transmission",
  "KHR_materials_ior",
  "KHR_materials_specular",
  "KHR_materials_sheen",
  "KHR_materials_volume",
  "KHR_materials_emissive_strength",
  "KHR_materials_iridescence",
  "KHR_materials_anisotropy",
  "KHR_materials_dispersion",
  "KHR_texture_transform",
  "KHR_mesh_quantization",
  "KHR_lights_punctual",
  "EXT_texture_webp",
  "EXT_mesh_gpu_instancing",
]);

export function inspectGlb(bytes: Uint8Array) {
  function fail(message: string): never {
    throw new Error(message);
  }
  if (bytes.byteLength > CUSTOM_MODEL_LIMITS.fileBytes) fail("GLB files must be at most 10 MiB.");
  if (bytes.byteLength < 20) fail("This is not a complete GLB 2.0 file.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    fail("Choose a valid GLB 2.0 file.");
  let document: GlbDocument | undefined;
  let binaryLength = 0;
  for (let offset = 12; offset < bytes.byteLength;) {
    if (offset + 8 > bytes.byteLength) fail("The GLB chunk header is truncated.");
    const length = view.getUint32(offset, true),
      type = view.getUint32(offset + 4, true);
    if (length % 4 || offset + 8 + length > bytes.byteLength)
      fail("The GLB chunk length is invalid.");
    if (offset === 12 && type !== 0x4e4f534a) fail("The GLB must start with its JSON chunk.");
    if (type === 0x4e4f534a) {
      if (document) fail("The GLB has more than one JSON chunk.");
      try {
        document = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(
            bytes.subarray(offset + 8, offset + 8 + length),
          ),
        ) as GlbDocument;
      } catch {
        fail("The GLB JSON is invalid.");
      }
    } else if (type === 0x004e4942) {
      if (binaryLength) fail("The GLB has more than one binary chunk.");
      binaryLength = length;
    }
    offset += 8 + length;
  }
  if (
    !document ||
    document.asset?.version !== "2.0" ||
    (document.asset.minVersion && document.asset.minVersion !== "2.0")
  )
    fail("Only GLB 2.0 is supported.");
  const json = document;
  // Scan recursively, including extension-owned URIs, before the loader sees it.
  const inspect = (value: unknown, depth = 0) => {
    if (depth > 64) fail("The GLB nesting is too deep.");
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if ((key === "uri" || key === "url") && typeof child === "string")
        fail("External references are not allowed. Embed buffers and images in the GLB.");
      inspect(child, depth + 1);
    }
  };
  inspect(json);
  for (const extension of json.extensionsRequired ?? [])
    if (!SUPPORTED_GLB_EXTENSIONS.has(extension))
      fail(`Required GLB extension “${extension}” is not supported. Export without it.`);
    else if (!json.extensionsUsed?.includes(extension))
      fail(`Required GLB extension “${extension}” must also be declared in extensionsUsed.`);
  if (
    json.buffers?.length !== 1 ||
    !Number.isSafeInteger(json.buffers[0].byteLength) ||
    json.buffers[0].byteLength <= 0 ||
    json.buffers[0].byteLength > binaryLength ||
    json.buffers[0].byteLength < binaryLength - 3
  )
    fail("The GLB must contain one embedded binary buffer.");
  for (const image of json.images ?? [])
    if (
      !Number.isInteger(image.bufferView) ||
      !json.bufferViews?.[image.bufferView!] ||
      !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType ?? "")
    )
      fail("Images must be embedded PNG, JPEG or WebP data.");
  for (const buffer of json.bufferViews ?? [])
    if (
      buffer.buffer !== 0 ||
      !Number.isSafeInteger(buffer.byteLength) ||
      buffer.byteLength < 0 ||
      !Number.isSafeInteger(buffer.byteOffset ?? 0) ||
      (buffer.byteOffset ?? 0) < 0 ||
      (buffer.byteOffset ?? 0) + buffer.byteLength > binaryLength
    )
      fail("A GLB buffer view is outside the embedded file.");
  // Count scene occurrences (not just mesh definitions), including instancing.
  let meshes = 0,
    triangles = 0;
  const active = new Set<number>();
  const visited = new Set<number>();
  const visit = (index: number, depth: number) => {
    if (depth > 64 || active.has(index))
      fail("The GLB scene contains a cycle or excessive nesting.");
    if (visited.has(index)) fail("The GLB scene reuses a node under multiple parents.");
    visited.add(index);
    const node = json.nodes?.[index];
    if (!node) fail("The GLB references a missing node.");
    active.add(index);
    if (node.mesh !== undefined) {
      const mesh = json.meshes?.[node.mesh];
      if (!mesh) fail("The GLB references a missing mesh.");
      const instancing = node.extensions?.EXT_mesh_gpu_instancing as
        { attributes?: Record<string, number> } | undefined;
      const instances = instancing
        ? (json.accessors?.[Object.values(instancing.attributes ?? {})[0]]?.count ?? 0)
        : 1;
      if (!Number.isSafeInteger(instances) || instances <= 0)
        fail("The GLB instance count is invalid.");
      for (const primitive of mesh.primitives) {
        if (primitive.mode !== undefined && primitive.mode !== 4)
          fail("Export triangle meshes (GLB TRIANGLES mode).");
        const count = json.accessors?.[primitive.indices ?? primitive.attributes.POSITION]?.count;
        if (!Number.isSafeInteger(count) || !count || count % 3)
          fail("The GLB triangle count is invalid.");
        meshes++;
        triangles += (count / 3) * instances;
        if (meshes > CUSTOM_MODEL_LIMITS.meshes || triangles > CUSTOM_MODEL_LIMITS.triangles)
          fail("A model may contain at most 100,000 triangles and 128 meshes.");
      }
    }
    for (const child of node.children ?? []) visit(child, depth + 1);
    active.delete(index);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  if (!scene?.nodes?.length) fail("The GLB has no default scene.");
  for (const node of scene.nodes) visit(node, 0);
  if (!meshes) fail("The GLB has no triangle meshes.");
  const notices: string[] = [];
  if (json.animations?.length)
    notices.push(
      "Single-keyframe animations can be mapped as named poses. Moving animations are ignored.",
    );
  if (json.nodes?.some((node) => node.camera !== undefined))
    notices.push("Embedded cameras are ignored.");
  if (json.extensions?.KHR_lights_punctual)
    notices.push(
      "Embedded lights are ignored. Use the Light profile to add a controlled light source.",
    );
  return { complexity: { visibleMeshes: meshes, triangles }, notices };
}
