import {
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  RedFormat,
  type BufferGeometry,
} from "three";
import type { StairTread } from "../types";

type Joint = {
  x: number;
  z: number;
  dx: number;
  dz: number;
  length: number;
  height: number;
  reach: number;
};
const tolerance = 1e-5;
export type TreadContact = { map: DataTexture; below: Joint | undefined; above: Joint | undefined };

/** The overlap can cover only half a switchback landing, or a radial edge of a spiral. */
export function treadJoint(lower: StairTread, upper: StairTread): Joint | undefined {
  const rise = upper.elevation - lower.elevation;
  if (rise <= tolerance) return;
  for (let i = 0; i < lower.polygon.length; i++) {
    const a = lower.polygon[i],
      b = lower.polygon[(i + 1) % lower.polygon.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length <= tolerance) continue;
    const dx = (b[0] - a[0]) / length,
      dz = (b[1] - a[1]) / length;
    for (let j = 0; j < upper.polygon.length; j++) {
      const p = upper.polygon[j],
        q = upper.polygon[(j + 1) % upper.polygon.length];
      const across = (v: typeof p) => (v[0] - a[0]) * dz - (v[1] - a[1]) * dx;
      if (Math.abs(across(p)) > tolerance || Math.abs(across(q)) > tolerance) continue;
      const along = (v: typeof p) => (v[0] - a[0]) * dx + (v[1] - a[1]) * dz;
      const start = Math.max(0, Math.min(along(p), along(q)));
      const end = Math.min(length, Math.max(along(p), along(q)));
      if (end - start > tolerance)
        return {
          x: a[0] + start * dx,
          z: a[1] + start * dz,
          dx,
          dz,
          length: end - start,
          height: lower.elevation,
          reach: Math.min(0.06, rise * 0.5),
        };
    }
  }
  return undefined;
}

/** One small indirect-light lookup shared by every solid tread on the flight. */
export function createTreadContactMap() {
  const size = 32;
  const data = new Uint8Array(size * size).fill(255);
  for (let y = 0; y < size; y++)
    for (let x = size / 4; x < (3 * size) / 4; x++)
      data[y * size + x] = Math.round(255 * (1 - 0.38 * (1 - y / (size - 1)) ** 2));
  const texture = new DataTexture(data, size, size, RedFormat);
  texture.channel = 1;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function setTreadContactUVs(
  geometry: BufferGeometry,
  baseY: number,
  { below, above }: TreadContact,
) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  // The extrude's positive local Z is world up after the slab's quarter turn.
  const uvs = new Float32Array(positions.count * 2).fill(1);
  for (let i = 0; i < positions.count; i += 3) {
    const up = normals.getZ(i);
    const top = up > 0.99;
    const joint = top ? above : Math.abs(up) < tolerance ? below : undefined;
    if (!joint) continue;
    if (top && Math.abs(positions.getZ(i) + baseY - joint.height) > tolerance) continue;
    const along = (j: number) =>
      (positions.getX(j) - joint.x) * joint.dx + (-positions.getY(j) - joint.z) * joint.dz;
    const across = (j: number) =>
      (positions.getX(j) - joint.x) * joint.dz - (-positions.getY(j) - joint.z) * joint.dx;
    // Only the riser in the plane of the shared edge meets the lower tread.
    if (!top && [i, i + 1, i + 2].some((j) => Math.abs(across(j)) > tolerance)) continue;
    for (let j = i; j < i + 3; j++) {
      const distance = top ? Math.abs(across(j)) : positions.getZ(j) + baseY - joint.height;
      uvs[j * 2] = 0.25 + (0.5 * along(j)) / joint.length;
      uvs[j * 2 + 1] = (0.5 + (31 * distance) / joint.reach) / 32;
    }
  }
  geometry.setAttribute("uv1", new Float32BufferAttribute(uvs, 2));
}
