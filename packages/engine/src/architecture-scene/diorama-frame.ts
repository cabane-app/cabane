import { mergeDeviceModelRegistriesStableFirst } from "../devices";
import { planPointToWorld } from "../geometry";
import { worldBoundsForFloorScene } from "../pools/pool-footprint";
import { deriveStairFlight } from "../stairs/flight-geometry";
import { stairItemObstacle } from "../stairs/stair-obstacles";
import type { DeviceModelRegistry, HomeManifest } from "../types";

/** Keep the whole above-ground site on the display board, including detached garden objects. */
export function orbitDioramaFrame(manifest: HomeManifest, devices: DeviceModelRegistry) {
  const floors = manifest.floors.filter((floor) => !floor.belowGround);
  if (!floors.length) return null;
  const registries = {
    furnishingModels: manifest.extensions.furnishingModels,
    deviceModels: mergeDeviceModelRegistriesStableFirst(devices, manifest.extensions.deviceModels),
  };
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  const include = (x: number, z: number, reach = 0) => {
    minX = Math.min(minX, x - reach);
    maxX = Math.max(maxX, x + reach);
    minZ = Math.min(minZ, z - reach);
    maxZ = Math.max(maxZ, z + reach);
  };
  for (const floor of floors) {
    const items = manifest.sceneItems.filter((item) => item.floorId === floor.id);
    // Free-form legacy components have no declared extent. Keep their original plot.
    if (
      (!items.length && floor.rooms.some((room) => room.furnishings || room.devices.length)) ||
      floor.openings.some((opening) => opening.visualModel) ||
      floor.walls.some((wall) => wall.leanMeters)
    )
      return null;
    const bounds = worldBoundsForFloorScene(floor);
    include(bounds.minX, bounds.minZ);
    include(bounds.maxX, bounds.maxZ);
    for (const region of floor.footprintRegions ?? [])
      for (const point of region) include(...planPointToWorld(point, floor.coordinates));
    for (const wall of floor.walls) {
      if (wall.virtual) continue;
      for (const point of [wall.from, wall.to])
        include(...planPointToWorld(point, floor.coordinates), wall.thicknessMeters);
    }
    for (const item of items) {
      // Uses the declared, resized local bounds and the actual wall/surface transform.
      const bounds = stairItemObstacle(item, floor, 0, registries);
      if (!bounds) return null;
      include(bounds.minX, bounds.minZ);
      include(bounds.maxX, bounds.maxZ);
    }
  }
  for (const stair of manifest.stairs) {
    const flight = deriveStairFlight(manifest, stair);
    if (!flight) continue;
    for (const point of flight.footprintWorld) include(...point);
    for (const point of [...flight.upperLanding, ...flight.lowerLanding])
      include(...planPointToWorld(point, manifest.coordinates));
  }
  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX + 1.8,
    depth: maxZ - minZ + 1.8,
  };
}
