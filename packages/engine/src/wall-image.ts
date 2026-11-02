import { isPlainRecord } from "./home-project/validation-types";

export const WALL_IMAGE_LIMITS = {
  inputBytes: 10 * 1024 * 1024,
  inputPixels: 32_000_000,
  maxEdge: 1024,
  storedBytes: 192 * 1024,
} as const;

/** Read raster dimensions before the browser allocates a decoded image. */
export function wallImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const be16 = (at: number) => (bytes[at] << 8) | bytes[at + 1];
  const le16 = (at: number) => bytes[at] | (bytes[at + 1] << 8);
  const le24 = (at: number) => le16(at) | (bytes[at + 2] << 16);
  const text = (at: number, length: number) =>
    String.fromCharCode(...bytes.subarray(at, at + length));
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) return null;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) return null;
      if (marker === 1 || (marker >= 208 && marker <= 216)) continue;
      const length = be16(offset);
      if (length < 2 || offset + length > bytes.length) return null;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (length < 8) return null;
        return { width: be16(offset + 5), height: be16(offset + 3) };
      }
      offset += length;
    }
  }
  if (bytes.length >= 25 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    const kind = text(12, 4);
    if (kind === "VP8X" && bytes.length >= 30) return { width: le24(24) + 1, height: le24(27) + 1 };
    if (kind === "VP8 " && bytes.length >= 30 && text(23, 3) === "\x9d\x01\x2a")
      return { width: le16(26) & 16383, height: le16(28) & 16383 };
    if (kind === "VP8L" && bytes[20] === 47)
      return {
        width: (le16(21) & 16383) + 1,
        height: (((bytes[22] >> 6) | (bytes[23] << 2) | (bytes[24] << 10)) & 16383) + 1,
      };
  }
  return null;
}

/** Only normalized raster bytes are portable. URLs, SVG and oversized decodes stay rejected. */
export function wallSurfaceImageError(value: unknown): string | null {
  if (
    !isPlainRecord(value) ||
    Object.keys(value).some((k) => !["name", "dataUrl", "width", "height"].includes(k))
  )
    return "The wall image must contain its name, dimensions and embedded image.";
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 120)
    return "The wall image needs a name of at most 120 characters.";
  if (
    !Number.isSafeInteger(value.width) ||
    !Number.isSafeInteger(value.height) ||
    typeof value.width !== "number" ||
    typeof value.height !== "number" ||
    value.width < 1 ||
    value.height < 1 ||
    Math.max(value.width, value.height) > WALL_IMAGE_LIMITS.maxEdge
  )
    return "The wall image dimensions must be between 1 and 1024 pixels.";
  const prefix = "data:image/jpeg;base64,";
  if (
    typeof value.dataUrl !== "string" ||
    !value.dataUrl.startsWith(prefix) ||
    value.dataUrl.length > prefix.length + 4 * Math.ceil(WALL_IMAGE_LIMITS.storedBytes / 3)
  )
    return "Choose an optimized embedded wall image of at most 192 KB.";
  const encoded = value.dataUrl.slice(prefix.length);
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
    return "The embedded wall image is not valid base64.";
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const size = wallImageDimensions(bytes);
  if (
    bytes.byteLength > WALL_IMAGE_LIMITS.storedBytes ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes.at(-2) !== 255 ||
    bytes.at(-1) !== 217 ||
    !size ||
    size.width !== value.width ||
    size.height !== value.height
  )
    return "The wall image is damaged or does not match its saved dimensions.";
  return null;
}
