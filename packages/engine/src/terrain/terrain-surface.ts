import { worldBoundsForFloorScene } from "../pools/pool-footprint";
import { worldBoundsForPolygon } from "../geometry";
import type { FloorSpec, Polygon } from "../types";
import { hasCustomTerrain, type TerrainSettings } from "./terrain-settings";
import { deriveFloorLevels } from "../building/floor-levels";
import { isOutdoorPlatformRoom } from "../outdoor-platforms/platform-rooms";

/** Heights meet the building bounds and continue level beyond each edge. */
export function createTerrainSurface(
  settings: TerrainSettings | undefined,
  floors: readonly FloorSpec[],
) {
  if (!hasCustomTerrain(settings) || !settings || !floors.length) return null;
  const ground = floors.find((floor) => !floor.belowGround);
  if (!ground) return null;
  const groundFloors = floors.filter((floor) => floor.belowGround || floor === ground);
  const bounds = groundFloors.map((floor) =>
    worldBoundsForPolygon(floor.footprint, floor.coordinates),
  );
  const sceneBounds = groundFloors.map(worldBoundsForFloorScene);
  const sceneMinX = Math.min(...sceneBounds.map((bounds) => bounds.minX));
  const sceneMaxX = Math.max(...sceneBounds.map((bounds) => bounds.maxX));
  const sceneMinZ = Math.min(...sceneBounds.map((bounds) => bounds.minZ));
  const sceneMaxZ = Math.max(...sceneBounds.map((bounds) => bounds.maxZ));
  const minX = Math.min(...bounds.map((bounds) => bounds.minX));
  const maxX = Math.max(...bounds.map((bounds) => bounds.maxX));
  const minZ = Math.min(...bounds.map((bounds) => bounds.minZ));
  const maxZ = Math.max(...bounds.map((bounds) => bounds.maxZ));
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const heights = [
    settings.topLeftMeters,
    settings.topRightMeters,
    settings.bottomLeftMeters,
    settings.bottomRightMeters,
  ];
  return {
    floorId: ground.id,
    centerX: (sceneMinX + sceneMaxX) / 2,
    centerZ: (sceneMinZ + sceneMaxZ) / 2,
    size: Math.max(sceneMaxX - sceneMinX, sceneMaxZ - sceneMinZ) + 7,
    // Include both grade boundaries exactly; decoration bounds never move them.
    gridX: Array.from({ length: 17 }, (_, i) => minX + ((maxX - minX) * i) / 16),
    gridZ: Array.from({ length: 17 }, (_, i) => minZ + ((maxZ - minZ) * i) / 16),
    soilDepth: Math.max(
      0.28,
      -Math.min(0, ...deriveFloorLevels(floors).map((level) => level.elevationMeters), ...heights) +
        0.28,
    ),
    cutouts: groundFloors
      .flatMap((floor) =>
        [
          ...floor.rooms.filter((room) => !isOutdoorPlatformRoom(floor, room.id)),
          ...(floor.solidRooms ?? []),
        ].map((room) => room.polygon),
      )
      .filter((polygon): polygon is Polygon => polygon.length >= 3),
    offsetAt(x: number, z: number) {
      const ease = (value: number) => {
        const t = clamp(value);
        return t * t * (3 - 2 * t);
      };
      const u = ease((x - minX) / Math.max(maxX - minX, 0.001));
      const v = ease((z - minZ) / Math.max(maxZ - minZ, 0.001));
      const top = settings.topLeftMeters * (1 - u) + settings.topRightMeters * u;
      const bottom = settings.bottomLeftMeters * (1 - u) + settings.bottomRightMeters * u;
      return top * (1 - v) + bottom * v;
    },
  };
}

export type TerrainSurface = ReturnType<typeof createTerrainSurface>;
