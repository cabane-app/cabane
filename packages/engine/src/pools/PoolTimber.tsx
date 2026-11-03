import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { ToonMaterial } from "../rendering";
import type { FloorCoordinates, PoolSpec } from "../types";
import { POOL_GROUND_Y, poolVerticalLayout } from "./pool-footprint";
import { poolTimberBraces, poolTimberGeometry } from "./pool-timber-geometry";

/** Structural shell, horizontal timber courses and projecting corner/intermediate braces. */
export function PoolTimber({
  pool,
  coordinates,
}: {
  pool: PoolSpec;
  coordinates: FloorCoordinates;
}) {
  const geometry = useMemo(() => poolTimberGeometry(pool, coordinates), [pool, coordinates]);
  const braces = useMemo(() => poolTimberBraces(pool, coordinates), [pool, coordinates]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const bottom = POOL_GROUND_Y + 0.012;
  const top = poolVerticalLayout(pool).rim - 0.012;
  return (
    <group name={`pool-timber-${pool.id}`}>
      <mesh name={`pool-timber-shell-${pool.id}`} geometry={geometry} castShadow receiveShadow>
        <ToonMaterial color="white" vertexColors side={DoubleSide} />
      </mesh>
      {braces.map((brace, index) => (
        <mesh
          key={index}
          name={`pool-timber-brace-${pool.id}-${index}`}
          position={[brace.x, (bottom + top) / 2, brace.z]}
          rotation={[0, brace.angle, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.105, top - bottom, 0.07]} />
          <ToonMaterial color="#c79550" />
        </mesh>
      ))}
    </group>
  );
}
