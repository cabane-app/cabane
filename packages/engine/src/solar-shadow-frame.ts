import { deriveFloorLevels, legacyFloorHeight } from "./building/floor-levels";
import { physicalFloor } from "./architecture-geometry/physical-floor";
import { planPointToWorld } from "./geometry";
import { worldBoundsForFloorScene } from "./pools/pool-footprint";
import type { RenderableFloorSpec } from "./types";

/** A conservative sphere keeps the building inside the shadow camera at every solar angle. */
export const solarShadowFrame = (floors: readonly RenderableFloorSpec[]) => {
  if (!floors.length) return { center: [0, 0, 0] as const, radius: 18, distance: 18, far: 40 };
  const levels = deriveFloorLevels(floors);
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  floors.forEach((floor, index) => {
    const bounds = worldBoundsForFloorScene(floor);
    // Match the rendered outdoor ground and include free-standing walls.
    const halfGround = (Math.max(bounds.width, bounds.depth) + 7) / 2;
    minX = Math.min(minX, bounds.centerX - halfGround);
    maxX = Math.max(maxX, bounds.centerX + halfGround);
    minZ = Math.min(minZ, bounds.centerZ - halfGround);
    maxZ = Math.max(maxZ, bounds.centerZ + halfGround);
    for (const wall of physicalFloor(floor).walls)
      for (const point of [wall.from, wall.to]) {
        const [x, z] = planPointToWorld(point, floor.coordinates);
        minX = Math.min(minX, x - wall.thicknessMeters);
        maxX = Math.max(maxX, x + wall.thicknessMeters);
        minZ = Math.min(minZ, z - wall.thicknessMeters);
        maxZ = Math.max(maxZ, z + wall.thicknessMeters);
      }
    const elevation = levels[index].elevationMeters;
    minY = Math.min(minY, elevation - 0.1);
    maxY = Math.max(maxY, elevation + legacyFloorHeight(floor) + 2.2);
  });
  const radius = Math.max(1, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 0.5);
  return {
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2] as const,
    radius,
    distance: radius * 2 + 1,
    far: radius * 3 + 2,
  };
};
