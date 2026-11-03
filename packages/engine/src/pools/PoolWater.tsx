import { useMemo } from "react";
import { PoolWaterMaterial } from "./PoolWaterMaterial";
import type { FloorCoordinates, PoolSpec } from "../types";
import { poolVerticalLayout, poolWorldRing } from "./pool-footprint";
import { poolShapes } from "./pool-shapes";

export function PoolWater({
  pool,
  coordinates,
  reducedMotion = false,
}: {
  pool: PoolSpec;
  coordinates: FloorCoordinates;
  reducedMotion?: boolean;
}) {
  const shapes = useMemo(
    () => poolShapes([[poolWorldRing(pool.polygon, coordinates)]]),
    [pool.polygon, coordinates],
  );
  return (
    <mesh
      name={`pool-water-${pool.id}`}
      position={[0, poolVerticalLayout(pool).water, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <shapeGeometry args={[shapes]} />
      <PoolWaterMaterial reducedMotion={reducedMotion} />
    </mesh>
  );
}
