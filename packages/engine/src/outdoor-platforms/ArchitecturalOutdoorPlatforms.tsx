import { useMemo } from "react";
import type { FloorSpec } from "../types";
import { isOutdoorPlatformOutline } from "./platform-geometry";
import { deriveOutdoorPlatformBarriers } from "./platform-barriers";
import { PlatformBarrierModel } from "./PlatformBarrierModel";
import { PlatformLowWallRuns } from "./PlatformLowWallRuns";
import { PlatformSlab } from "./PlatformSlab";

export function ArchitecturalOutdoorPlatforms({
  floor,
  below,
}: {
  floor: FloorSpec;
  below?: FloorSpec | undefined;
}) {
  const barriers = useMemo(() => deriveOutdoorPlatformBarriers(floor), [floor]);
  return (
    <group name="outdoor-platforms">
      {(floor.outdoorPlatforms ?? [])
        .filter((platform) => isOutdoorPlatformOutline(platform.polygon))
        .map((platform) => (
          <PlatformSlab key={platform.id} platform={platform} floor={floor} below={below} />
        ))}
      <PlatformLowWallRuns barriers={barriers} />
      {barriers
        .filter((barrier) => barrier.configuration.kind !== "low-wall")
        .map((barrier, index) => (
          <PlatformBarrierModel
            key={`${barrier.edgeId}-${index}`}
            name={`platform-barrier-${barrier.edgeId}-${index}`}
            {...barrier}
          />
        ))}
    </group>
  );
}
