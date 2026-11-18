import { groundEdgeProfile, type GroundMargins } from "../terrain/ground-margins";
import { WALK_PLAYER_RADIUS, type WalkPoint } from "./walk-navigation-contract";

/** The player's entire footprint stays inside the lawn, even during a jump. */
export function createWalkParcel(frame: {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  margins?: GroundMargins;
}) {
  const { inset, lawnRadius } = groundEdgeProfile(frame.width, frame.depth, frame.margins);
  const halfX = Math.max(0, frame.width / 2 - inset - WALK_PLAYER_RADIUS);
  const halfZ = Math.max(0, frame.depth / 2 - inset - WALK_PLAYER_RADIUS);
  const corner = Math.min(halfX, halfZ, Math.max(0, lawnRadius - WALK_PLAYER_RADIUS));
  const clamp = (value: number, center: number, half: number) =>
    Math.max(center - half, Math.min(center + half, value));
  function constrain(point: WalkPoint): WalkPoint {
    const cx = clamp(point.x, frame.centerX, halfX - corner);
    const cz = clamp(point.z, frame.centerZ, halfZ - corner);
    const dx = point.x - cx,
      dz = point.z - cz;
    if (dx === 0 && dz === 0) return point;
    const distance = Math.hypot(dx, dz);
    if (distance <= corner + 1e-8) return point;
    const fraction = corner / distance;
    return { x: cx + dx * fraction, z: cz + dz * fraction };
  }
  const fits = Math.min(frame.width, frame.depth) >= 2 * (inset + WALK_PLAYER_RADIUS);
  return { constrain, contains: (point: WalkPoint) => fits && constrain(point) === point };
}

export type WalkParcel = ReturnType<typeof createWalkParcel>;
