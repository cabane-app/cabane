import type { WalkPoint } from "./walk-navigation-contract";

/** Signed distance and outward normal to a counterclockwise convex footprint. */
export const polygonContact = (point: WalkPoint, polygon: readonly WalkPoint[]) => {
  let inside = true;
  let distance = Infinity;
  let normal = { x: 0, z: 0 };
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared < 1e-16) continue;
    if (dx * (point.z - a.z) - dz * (point.x - a.x) < -1e-9) inside = false;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared),
    );
    const offset = { x: point.x - a.x - t * dx, z: point.z - a.z - t * dz };
    const candidate = Math.hypot(offset.x, offset.z);
    if (candidate >= distance) continue;
    distance = candidate;
    normal =
      candidate > 1e-9
        ? { x: offset.x / candidate, z: offset.z / candidate }
        : { x: dz / Math.sqrt(lengthSquared), z: -dx / Math.sqrt(lengthSquared) };
  }
  if (inside && distance > 1e-9) normal = { x: -normal.x, z: -normal.z };
  return { distance: inside && Number.isFinite(distance) ? -distance : distance, normal };
};
