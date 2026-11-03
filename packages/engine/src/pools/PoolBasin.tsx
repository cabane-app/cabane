import { useEffect, useMemo } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";
import { ToonMaterial } from "../rendering";
import type { FloorCoordinates, PoolSpec } from "../types";
import { poolVerticalLayout, poolWorldRing } from "./pool-footprint";
import { poolShapes } from "./pool-shapes";

export function PoolBasin({
  pool,
  coordinates,
}: {
  pool: PoolSpec;
  coordinates: FloorCoordinates;
}) {
  const { sides, bottom } = useMemo(() => {
    const ring = poolWorldRing(pool.polygon, coordinates);
    const { bottom: low, rim } = poolVerticalLayout(pool);
    const positions = ring.flatMap(([x, z], index) => {
      const [tx, tz] = ring[(index + 1) % ring.length];
      return [x, low, z, tx, low, tz, tx, rim, tz, x, low, z, tx, rim, tz, x, rim, z];
    });
    const sides = new BufferGeometry();
    sides.setAttribute("position", new Float32BufferAttribute(positions, 3));
    sides.computeVertexNormals();
    return { sides, bottom: poolShapes([[ring]]) };
  }, [pool, coordinates]);
  useEffect(() => () => sides.dispose(), [sides]);
  return (
    <group name={`pool-basin-${pool.id}`}>
      <mesh geometry={sides} receiveShadow>
        <ToonMaterial color="#b0d7d6" side={DoubleSide} />
      </mesh>
      <mesh
        name={`pool-bottom-${pool.id}`}
        position={[0, poolVerticalLayout(pool).bottom, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <shapeGeometry args={[bottom]} />
        <ToonMaterial color="#8ac6c9" side={DoubleSide} />
      </mesh>
    </group>
  );
}
