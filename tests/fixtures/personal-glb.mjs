import { BoxGeometry } from "three";
import { zlibSync } from "fflate";

function pngChunk(type, bytes) {
  const name = Buffer.from(type);
  const body = Buffer.concat([name, bytes]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const header = Buffer.alloc(4),
    tail = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length);
  tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, body, tail]);
}

function testTexture() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.from([
    0, 240, 40, 80, 255, 240, 40, 80, 255, 0, 40, 170, 230, 255, 40, 170, 230, 255,
  ]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", Buffer.from(zlibSync(pixels))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function packGlb(json, binary) {
  const source = Buffer.from(JSON.stringify(json));
  const document = Buffer.alloc(Math.ceil(source.length / 4) * 4, 0x20);
  source.copy(document);
  const data = Buffer.alloc(Math.ceil(binary.length / 4) * 4);
  Buffer.from(binary).copy(data);
  const result = Buffer.alloc(12 + 8 + document.length + 8 + data.length);
  result.writeUInt32LE(0x46546c67, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(document.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  document.copy(result, 20);
  const offset = 20 + document.length;
  result.writeUInt32LE(data.length, offset);
  result.writeUInt32LE(0x004e4942, offset + 4);
  data.copy(result, offset + 8);
  return new Uint8Array(result);
}

export function testGlb({
  poses = false,
  textured = false,
  unlit = false,
  embedded = false,
  padding = 0,
  mutate,
} = {}) {
  const geometry = new BoxGeometry(1, 0.5, 0.4).toNonIndexed();
  const views = [],
    accessors = [],
    pieces = [];
  let offset = 0;
  for (const [name, type] of [
    ["position", "VEC3"],
    ["normal", "VEC3"],
    ["uv", "VEC2"],
  ]) {
    const attr = geometry.getAttribute(name);
    const bytes = Buffer.from(attr.array.buffer);
    pieces.push(bytes);
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    accessors.push({
      bufferView: views.length - 1,
      componentType: 5126,
      count: attr.count,
      type,
      ...(name === "position" ? { min: [-0.5, -0.25, -0.2], max: [0.5, 0.25, 0.2] } : {}),
    });
    offset += bytes.length;
  }
  const material = {
    pbrMetallicRoughness: {
      baseColorFactor: textured ? [1, 1, 1, 1] : [0.2, 0.6, 0.3, 1],
      roughnessFactor: 0.27,
      metallicFactor: 0.65,
    },
    ...(unlit ? { extensions: { KHR_materials_unlit: {} } } : {}),
  };
  const json = {
    asset: { version: "2.0", generator: "Synthetic Cabane verification fixture" },
    buffers: [{ byteLength: offset }],
    bufferViews: views,
    accessors,
    meshes: [
      { primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, material: 0 }] },
    ],
    materials: [material],
    nodes: [{ mesh: 0, extras: { walkCollider: true, deviceBindingId: "untrusted-extra" } }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  if (poses) {
    const accessor = (values, type, count) => {
      const data = Buffer.from(new Float32Array(values).buffer);
      pieces.push(data);
      views.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
      offset += data.length;
      accessors.push({ bufferView: views.length - 1, componentType: 5126, count, type });
      return accessors.length - 1;
    };
    const time = accessor([0], "SCALAR", 1);
    json.animations = [0, 1].map((y) => ({
      name: y ? "Raised" : "Resting",
      samplers: [{ input: time, output: accessor([0, y, 0], "VEC3", 1) }],
      channels: [{ sampler: 0, target: { node: 0, path: "translation" } }],
    }));
  }
  if (unlit) json.extensionsRequired = ["KHR_materials_unlit"];
  if (textured) {
    const image = testTexture();
    pieces.push(image);
    json.images = [{ bufferView: views.length, mimeType: "image/png" }];
    views.push({ buffer: 0, byteOffset: offset, byteLength: image.length });
    json.textures = [{ source: 0 }];
    material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
    offset += image.length;
  }
  if (padding) {
    pieces.push(Buffer.alloc(padding));
    offset += padding;
  }
  if (embedded) {
    json.animations = [{ channels: [], samplers: [] }];
    json.cameras = [{ type: "perspective", perspective: { yfov: 0.7, znear: 0.01 } }];
    json.extensions = { KHR_lights_punctual: { lights: [{ type: "point", intensity: 10 }] } };
    json.nodes.push({ camera: 0 }, { extensions: { KHR_lights_punctual: { light: 0 } } });
    json.scenes[0].nodes.push(1, 2);
  }
  json.extensionsUsed = [
    ...(unlit ? ["KHR_materials_unlit"] : []),
    ...(embedded ? ["KHR_lights_punctual"] : []),
  ];
  json.buffers[0].byteLength = offset;
  mutate?.(json);
  geometry.dispose();
  return packGlb(json, Buffer.concat(pieces));
}
