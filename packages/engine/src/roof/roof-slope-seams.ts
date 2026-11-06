import type { RoofRegion } from "./roof-coverage";

type Point = [number, number];

const SEAM_TOLERANCE_METERS = 1e-6;

/** Find the parts of an authored slope edge shared by another slope at the same elevation. */
export function sharedSlopeEdgeSpans(
  region: RoofRegion,
  slopes: readonly RoofRegion[],
  from: Point,
  to: Point,
): [start: number, end: number][] {
  const heightAt = region.heightAt;
  if (!heightAt) return [];
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  if (length < SEAM_TOLERANCE_METERS) return [];
  const along = ([x, z]: Point) => ((x - from[0]) * dx + (z - from[1]) * dz) / length ** 2;
  const across = ([x, z]: Point) => ((x - from[0]) * dz - (z - from[1]) * dx) / length;
  const at = (t: number): Point => [from[0] + dx * t, from[1] + dz * t];
  const spans: [number, number][] = [];
  for (const other of slopes) {
    if (other === region || !other.heightAt) continue;
    for (const ring of other.polygon) {
      for (const [index, a] of ring.entries()) {
        const b = ring[(index + 1) % ring.length];
        if (
          Math.abs(across(a)) > SEAM_TOLERANCE_METERS ||
          Math.abs(across(b)) > SEAM_TOLERANCE_METERS
        )
          continue;
        // Adjacent regions run in opposite directions along a common boundary.
        const start = Math.max(0, along(b));
        const end = Math.min(1, along(a));
        if ((end - start) * length < SEAM_TOLERANCE_METERS) continue;
        const p = at(start);
        const q = at(end);
        if (
          Math.abs(heightAt(p) - other.heightAt(p)) <= SEAM_TOLERANCE_METERS &&
          Math.abs(heightAt(q) - other.heightAt(q)) <= SEAM_TOLERANCE_METERS
        ) {
          spans.push([start, end]);
        }
      }
    }
  }
  return spans;
}
