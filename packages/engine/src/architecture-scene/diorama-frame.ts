import { mergeDeviceModelRegistriesStableFirst } from "../devices";
import { createTerrainSurface } from "../terrain/terrain-surface";
import { hasCustomTerrain } from "../terrain/terrain-settings";
import type { GroundMargins } from "../terrain/ground-margins";
import { planPointToWorld } from "../geometry";
import { worldBoundsForFloorScene } from "../pools/pool-footprint";
import { deriveStairFlight } from "../stairs/flight-geometry";
import { stairItemObstacle } from "../stairs/stair-obstacles";
import type { DeviceModelRegistry, HomeManifest } from "../types";

/** Keep the whole above-ground site on the display board, including detached garden objects. */
function measureSite(
  manifest: HomeManifest,
  devices: DeviceModelRegistry,
  includeBasements: boolean,
) {
  const floors = manifest.floors.filter((floor) => includeBasements || !floor.belowGround);
  if (!floors.length) return null;
  const registries = {
    furnishingModels: manifest.extensions.furnishingModels,
    deviceModels: mergeDeviceModelRegistriesStableFirst(devices, manifest.extensions.deviceModels),
  };
  let automaticFit = true;
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
      automaticFit = false;
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
      const placement = item.placement;
      if (
        placement.kind === "wall" &&
        !floor.walls.some(
          (wall) =>
            wall.id === placement.wallId &&
            (wall.from[0] !== wall.to[0] || wall.from[1] !== wall.to[1]),
        )
      ) {
        automaticFit = false;
        continue;
      }
      const bounds = stairItemObstacle(item, floor, 0, registries);
      if (!bounds) {
        automaticFit = false;
        if (placement.kind !== "wall")
          include(
            ...planPointToWorld(placement.at, floor.coordinates),
            Math.hypot(item.size[0], item.size[2]) / 2,
          );
        continue;
      }
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
  return { minX, maxX, minZ, maxZ, automaticFit };
}

function withMargins(site: NonNullable<ReturnType<typeof measureSite>>, margins: GroundMargins) {
  return {
    centerX: (site.minX + site.maxX + margins.right - margins.left) / 2,
    centerZ: (site.minZ + site.maxZ + margins.bottom - margins.top) / 2,
    width: site.maxX - site.minX + margins.left + margins.right,
    depth: site.maxZ - site.minZ + margins.top + margins.bottom,
  };
}

const orbitMargins = { left: 0.9, right: 0.9, top: 0.9, bottom: 0.9 };

/** Automatic Orbit framing is possible only for sites with declared model bounds. */
export function orbitDioramaFrame(manifest: HomeManifest, devices: DeviceModelRegistry) {
  const site = measureSite(manifest, devices, false);
  return site?.automaticFit ? withMargins(site, orbitMargins) : null;
}

/** Construct edits the Walk parcel. Unedited Orbit can fit a compact board to the site. */
export function homeGroundFrame(
  manifest: HomeManifest,
  devices: DeviceModelRegistry,
  view: "walk" | "orbit" = "walk",
) {
  const sloped = !manifest.home.apartmentFloor && hasCustomTerrain(manifest.home.terrain);
  const site = measureSite(manifest, devices, sloped);
  if (!site) return null;
  let margins = manifest.home.groundMargins;
  if (!margins && (view === "walk" || sloped || !site.automaticFit)) {
    const ground = manifest.home.apartmentFloor
      ? manifest.floors[0]
      : manifest.floors.find((floor) => !floor.belowGround);
    if (!ground) return null;
    const bounds = worldBoundsForFloorScene(ground);
    const terrain = sloped ? createTerrainSurface(manifest.home.terrain, manifest.floors) : null;
    const { centerX, centerZ } = terrain ?? bounds;
    const half = (terrain?.size ?? Math.max(bounds.width, bounds.depth) + 7) / 2;
    margins = {
      left: Math.max(0, site.minX - (centerX - half)),
      right: Math.max(0, centerX + half - site.maxX),
      top: Math.max(0, site.minZ - (centerZ - half)),
      bottom: Math.max(0, centerZ + half - site.maxZ),
    };
  }
  margins ??= orbitMargins;
  return { ...withMargins(site, margins), margins };
}
