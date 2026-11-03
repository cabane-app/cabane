import { memo } from "react";
import type { FloorSpec } from "../types";
import { isPoolOutline } from "./pool-footprint";
import { PoolModel } from "./PoolModel";

export const ArchitecturalPools = memo(function ArchitecturalPools({
  floor,
  reducedMotion = false,
}: {
  floor: FloorSpec;
  reducedMotion?: boolean;
}) {
  return (
    <group name="architectural-pools">
      {(floor.pools ?? []).map((pool) =>
        isPoolOutline(pool.polygon) ? (
          <PoolModel
            key={pool.id}
            pool={pool}
            coordinates={floor.coordinates}
            reducedMotion={reducedMotion}
          />
        ) : null,
      )}
    </group>
  );
});
