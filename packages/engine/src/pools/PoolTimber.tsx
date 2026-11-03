import { useMemo } from "react";
import { ToonMaterial } from "../rendering";
import { polygonSignedArea } from "../geometry";
import type { FloorCoordinates, PoolSpec } from "../types";
import {
  POOL_GROUND_Y,
  poolRimFootprint,
  poolVerticalLayout,
  poolWorldRing,
} from "./pool-footprint";
import { poolShapes } from "./pool-shapes";

/** Horizontal timber courses and upright braces follow the user's pool outline. */
export function PoolTimber({
  pool,
  coordinates,
}: {
  pool: PoolSpec;
  coordinates: FloorCoordinates;
}) {
  const shapes = useMemo(
    () => poolShapes(poolRimFootprint(pool.polygon, coordinates)),
    [pool.polygon, coordinates],
  );
  const ring = poolWorldRing(pool.polygon, coordinates);
  const { height, rim } = poolVerticalLayout(pool);
  const courses = Math.ceil(height / 0.16);
  const courseHeight = (rim - POOL_GROUND_Y) / courses;
  const winding = polygonSignedArea(ring) > 0 ? 1 : -1;
  return (
    <group name={`pool-timber-${pool.id}`}>
      {Array.from({ length: courses }, (_, i) => (
        <mesh
          key={`board-${i}`}
          position={[0, POOL_GROUND_Y + i * courseHeight, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        >
          <extrudeGeometry args={[shapes, { depth: courseHeight - 0.006, bevelEnabled: false }]} />
          <ToonMaterial color={["#ad793c", "#b98443", "#bd8a49", "#b17d3f"][i % 4]} />
        </mesh>
      ))}
      {ring.flatMap(([x, z], index) => {
        const [tx, tz] = ring[(index + 1) % ring.length];
        const length = Math.hypot(tx - x, tz - z);
        const count = Math.ceil(length / 1.15);
        const nx = (winding * (tz - z)) / length;
        const nz = (-winding * (tx - x)) / length;
        return Array.from({ length: count }, (_, i) => {
          const t = (i + 0.5) / count;
          return (
            <mesh
              key={`brace-${index}-${i}`}
              position={[
                x + (tx - x) * t + nx * 0.23,
                POOL_GROUND_Y + (height - 0.02) / 2,
                z + (tz - z) * t + nz * 0.23,
              ]}
              rotation={[0, -Math.atan2(tz - z, tx - x), 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.1, height - 0.02, 0.04]} />
              <ToonMaterial color="#cc9a51" />
            </mesh>
          );
        });
      })}
    </group>
  );
}
