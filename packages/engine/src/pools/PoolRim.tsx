import { useMemo } from "react";
import { ToonMaterial } from "../rendering";
import type { FloorCoordinates, PoolSpec } from "../types";
import { poolVerticalLayout, poolRimFootprint } from "./pool-footprint";
import { poolShapes } from "./pool-shapes";

export function PoolRim({ pool, coordinates }: { pool: PoolSpec; coordinates: FloorCoordinates }) {
  const shapes = useMemo(
    () => poolShapes(poolRimFootprint(pool.polygon, coordinates)),
    [pool.polygon, coordinates],
  );
  return (
    <mesh
      name={`pool-rim-${pool.id}`}
      position={[0, poolVerticalLayout(pool).rim, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    >
      <extrudeGeometry
        args={[
          shapes,
          {
            depth: pool.type === "above-ground-wood" ? 0.075 : 0.1,
            bevelEnabled: pool.type === "above-ground-wood",
            bevelSize: 0.008,
            bevelOffset: -0.008,
            bevelThickness: 0.008,
            bevelSegments: 1,
            steps: 1,
          },
        ]}
      />
      <ToonMaterial color={pool.type === "above-ground-wood" ? "#c99a52" : "#e2d9c6"} />
    </mesh>
  );
}
