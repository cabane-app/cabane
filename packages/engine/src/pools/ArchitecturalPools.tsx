import { memo } from "react";
import type { FloorSpec } from "../types";
import { isPoolOutline } from "./pool-footprint";
import { PoolTimber } from "./PoolTimber";
import { PoolBasin } from "./PoolBasin";
import { PoolRim } from "./PoolRim";
import { PoolWater } from "./PoolWater";

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
          <group key={pool.id} name={`pool-${pool.id}`}>
            <PoolBasin pool={pool} coordinates={floor.coordinates} />
            {pool.type === "above-ground-wood" && (
              <PoolTimber pool={pool} coordinates={floor.coordinates} />
            )}
            <PoolRim pool={pool} coordinates={floor.coordinates} />
            <PoolWater pool={pool} coordinates={floor.coordinates} reducedMotion={reducedMotion} />
          </group>
        ) : null,
      )}
    </group>
  );
});
