import { useMemo } from "react";
import { useTerrainSurface } from "../terrain/TerrainSurface";
import type { FloorSpec } from "../types";
import { isOutdoorPlatformOutline } from "./platform-geometry";
import { deriveOutdoorPlatformBarriers } from "./platform-barriers";
import { PlatformBarrierModel } from "./PlatformBarrierModel";
import { PlatformLowWallRuns } from "./PlatformLowWallRuns";
import { PlatformSlab } from "./PlatformSlab";

export function ArchitecturalOutdoorPlatforms({
  floor,
  below,
  showGround = false,
}: {
  floor: FloorSpec;
  below?: FloorSpec | undefined;
  showGround?: boolean;
}) {
  const terrain = useTerrainSurface();
  const barriers = useMemo(() => deriveOutdoorPlatformBarriers(floor), [floor]);
  return (
    <group name="outdoor-platforms">
      {(floor.outdoorPlatforms ?? [])
        .filter((platform) => isOutdoorPlatformOutline(platform.polygon))
        .map((platform) => (
          <PlatformSlab
            key={platform.id}
            platform={platform}
            floor={floor}
            below={below}
            buryInTerrain={showGround && !terrain && platform.finish.kind === "grass"}
          />
        ))}
      {(floor.outdoorPlatforms ?? []).map((platform) => (
        <group
          key={`barriers-${platform.id}`}
          position={[0, platform.elevation?.offsetMeters ?? 0, 0]}
        >
          <PlatformLowWallRuns
            barriers={barriers.filter((barrier) => barrier.platformId === platform.id)}
          />
          {barriers
            .filter(
              (barrier) =>
                barrier.platformId === platform.id && barrier.configuration.kind !== "low-wall",
            )
            .map((barrier, index) => (
              <PlatformBarrierModel
                key={`${barrier.edgeId}-${index}`}
                name={`platform-barrier-${barrier.edgeId}-${index}`}
                {...barrier}
              />
            ))}
        </group>
      ))}
    </group>
  );
}
