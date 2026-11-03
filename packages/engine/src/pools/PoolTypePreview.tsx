import polygonClipping from "polygon-clipping";
import { useMemo } from "react";
import { ToonMaterial } from "../rendering";
import type { FloorCoordinates, PoolSpec, Polygon } from "../types";
import { POOL_GROUND_Y, poolExcavationFootprint } from "./pool-footprint";
import { poolShapes } from "./pool-shapes";
import { PoolModel } from "./PoolModel";

const coordinates: FloorCoordinates = {
  origin: [0, 0],
  metersPerPlanUnit: 1,
  scaleBasis: "measured",
};
const polygon: Polygon = [
  [-1.1, -1.1],
  [1.1, -1.1],
  [1.65, -0.55],
  [1.65, 0.55],
  [1.1, 1.1],
  [-1.1, 1.1],
  [-1.65, 0.55],
  [-1.65, -0.55],
];

/** A short section of terrain makes the buried basin legible in the type picker. */
export function PoolTypePreview({ type }: { type: NonNullable<PoolSpec["type"]> }) {
  const ground = useMemo(
    () =>
      poolShapes(
        polygonClipping.difference(
          [
            [
              [-2.15, -1.6],
              [2.15, -1.6],
              [2.15, 1.6],
              [-2.15, 1.6],
            ],
          ],
          poolExcavationFootprint(polygon, coordinates),
        ),
      ),
    [],
  );
  const buried = type === "in-ground";
  return (
    <>
      {buried && (
        <mesh position={[0, POOL_GROUND_Y - 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <extrudeGeometry args={[ground, { depth: 0.42, bevelEnabled: false }]} />
          <ToonMaterial color="#969e70" />
        </mesh>
      )}
      <PoolModel
        pool={{ id: `preview-${type}`, polygon, type, heightMeters: buried ? 0.3 : 1.2 }}
        coordinates={coordinates}
        reducedMotion
      />
    </>
  );
}
