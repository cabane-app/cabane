import { lazy, Suspense, useMemo } from "react";
import { useGraphicsFeature } from "../graphics-features";
import { useSceneStyle } from "../scene-style";
import type { DeviceModelRegistry, HomeManifest } from "../types";
import { worldBoundsForFloorScene } from "../pools/pool-footprint";
import { deriveFloorLevels } from "../building/floor-levels";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";

import { homeGroundFrame } from "../architecture-scene/diorama-frame";
import { createTerrainSurface } from "../terrain/terrain-surface";

const Countryside = lazy(() =>
  import("./RuralLandscape").then((module) => ({ default: module.Countryside })),
);
export function HomeLandscape({
  manifest,
  devices,
  walkMode,
  reducedMotion,
  daylight,
  overcast,
}: {
  daylight: number;
  overcast: number;
  manifest: HomeManifest;
  devices: DeviceModelRegistry;
  walkMode: boolean;
  reducedMotion: boolean;
}) {
  const grounds = useGraphicsFeature("grounds");
  const style = useSceneStyle();
  const frame = useMemo(() => {
    const bounds = manifest.floors.map(worldBoundsForFloorScene);
    const minX = Math.min(...bounds.map((b) => b.minX)),
      maxX = Math.max(...bounds.map((b) => b.maxX));
    const minZ = Math.min(...bounds.map((b) => b.minZ)),
      maxZ = Math.max(...bounds.map((b) => b.maxZ));
    const levels = deriveFloorLevels(manifest.floors);
    const base = manifest.home.apartmentFloor
      ? levels[0].elevationMeters
      : levels[
          Math.max(
            0,
            manifest.floors.findIndex((f) => !f.belowGround),
          )
        ].elevationMeters;
    const apartment =
      (manifest.home.apartmentFloor ?? 0) * manifest.floors[0].floorToFloorHeightMeters;
    const walkGround = walkMode || !grounds || style !== "default";
    const lot = homeGroundFrame(manifest, devices, walkGround ? "walk" : "orbit");
    const plantingLot =
      !walkGround && !manifest.home.groundMargins
        ? homeGroundFrame(manifest, devices, "walk")
        : lot;
    const span = lot ? Math.max(lot.width, lot.depth) : Math.max(maxX - minX, maxZ - minZ) + 7;
    // Anchor the treeline to the home so resizing the lawn keeps the scenery in place.
    const surveyScale = Math.max(0.48, (Math.max(maxX - minX, maxZ - minZ) + 5) / 49);
    return {
      plantingLot: plantingLot ?? {
        centerX: (minX + maxX) / 2,
        centerZ: (minZ + maxZ) / 2,
        width: span,
        depth: span,
      },
      surveyX: (minX + maxX) / 2,
      surveyZ: (minZ + maxZ) / 2 + 58 * surveyScale,
      surveyScale,
      groundColor: manifest.home.palette.ground,
      width: lot?.width ?? span,
      depth: lot?.depth ?? span,
      terrain: !apartment ? createTerrainSurface(manifest.home.terrain, manifest.floors) : null,
      x: lot?.centerX ?? (minX + maxX) / 2,
      z: lot?.centerZ ?? (minZ + maxZ) / 2,
      y: base - apartment + GROUND_ELEVATION_METERS,
    };
  }, [manifest, devices, walkMode, grounds, style]);
  return (
    <Suspense fallback={null}>
      <Countryside
        frame={frame}
        walkMode={walkMode}
        reducedMotion={reducedMotion}
        daylight={daylight}
        overcast={overcast}
      />
    </Suspense>
  );
}
