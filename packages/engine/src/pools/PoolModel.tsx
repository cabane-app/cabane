import type { FloorCoordinates, PoolSpec } from "../types";
import { PoolBasin } from "./PoolBasin";
import { PoolRim } from "./PoolRim";
import { PoolTimber } from "./PoolTimber";
import { PoolWater } from "./PoolWater";

/** The same basin assembly serves the scene and Construct's type previews. */
export function PoolModel({
  pool,
  coordinates,
  reducedMotion = false,
}: {
  pool: PoolSpec;
  coordinates: FloorCoordinates;
  reducedMotion?: boolean;
}) {
  return (
    <group name={`pool-${pool.id}`}>
      <PoolBasin pool={pool} coordinates={coordinates} />
      {pool.type === "above-ground-wood" && <PoolTimber pool={pool} coordinates={coordinates} />}
      <PoolRim pool={pool} coordinates={coordinates} />
      <PoolWater pool={pool} coordinates={coordinates} reducedMotion={reducedMotion} />
    </group>
  );
}
