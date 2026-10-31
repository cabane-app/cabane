import { cutStairGroundOpenings } from "../stairs/ground-apertures";
import { useStairSurfaceApertures } from "../stairs/surface-apertures";
import { ExtrudeGeometry, Shape } from "three";

import { memo, useEffect, useMemo } from "react";
import { useTerrainSurface } from "../terrain/TerrainSurface";
import { conformToTerrain } from "../terrain/terrain-geometry";

import { cutPoolOpenings, POOL_DEPTH_METERS } from "../pools";

import { GROUND_ELEVATION_METERS } from "../ground-elevation";

import { ToonMaterial } from "../rendering";

import type { FloorSpec } from "../types";

const roundedDioramaShape = (centerX: number, centerZ: number, size: number, radius: number) => {
  const left = centerX - size / 2;
  const right = centerX + size / 2;
  const near = centerZ - size / 2;
  const far = centerZ + size / 2;
  const shape = new Shape();
  shape.moveTo(left + radius, -near);
  shape.lineTo(right - radius, -near);
  shape.quadraticCurveTo(right, -near, right, -near - radius);
  shape.lineTo(right, -far + radius);
  shape.quadraticCurveTo(right, -far, right - radius, -far);
  shape.lineTo(left + radius, -far);
  shape.quadraticCurveTo(left, -far, left, -far + radius);
  shape.lineTo(left, -near - radius);
  shape.quadraticCurveTo(left, -near, left + radius, -near);
  shape.closePath();
  return shape;
};

export const DioramaGround = memo(function DioramaGround({
  centerX: requestedCenterX,
  centerZ: requestedCenterZ,
  size: requestedSize,
  color,
  floor,
}: {
  centerX: number;
  centerZ: number;
  size: number;
  color: string;
  floor: FloorSpec;
}) {
  const terrain = useTerrainSurface();
  const centerX = terrain?.centerX ?? requestedCenterX;
  const centerZ = terrain?.centerZ ?? requestedCenterZ;
  const size = terrain?.size ?? requestedSize;
  const apertures = useStairSurfaceApertures("floor");
  const baseShape = useMemo(
    () =>
      cutStairGroundOpenings(
        cutPoolOpenings(roundedDioramaShape(centerX, centerZ, size, 0.42), floor),
        floor.coordinates,
        [...apertures, ...(terrain?.cutouts ?? [])],
      ),
    [centerX, centerZ, size, floor, apertures, terrain],
  );
  const grassShape = useMemo(
    () =>
      cutStairGroundOpenings(
        cutPoolOpenings(roundedDioramaShape(centerX, centerZ, size - 0.1, 0.36), floor),
        floor.coordinates,
        [...apertures, ...(terrain?.cutouts ?? [])],
      ),
    [centerX, centerZ, size, floor, apertures, terrain],
  );
  const topY = GROUND_ELEVATION_METERS;
  const grassThickness = 0.1;
  const baseThickness = Math.max(
    terrain?.soilDepth ?? 0.28,
    floor.pools?.length ? POOL_DEPTH_METERS + 0.06 : 0.28,
  );
  const baseGeometry = useMemo(
    () =>
      conformToTerrain(
        new ExtrudeGeometry(baseShape, { depth: baseThickness, bevelEnabled: false }),
        terrain,
        baseThickness,
      ),
    [baseShape, baseThickness, terrain],
  );
  const grassGeometry = useMemo(
    () =>
      conformToTerrain(
        new ExtrudeGeometry(grassShape, { depth: grassThickness, bevelEnabled: false }),
        terrain,
      ),
    [grassShape, terrain],
  );
  useEffect(
    () => () => {
      baseGeometry.dispose();
      grassGeometry.dispose();
    },
    [baseGeometry, grassGeometry],
  );
  return (
    <group>
      <mesh
        name="diorama-base"
        geometry={baseGeometry}
        position={[0, topY - grassThickness - baseThickness, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <ToonMaterial color="#6f7d57" />
      </mesh>
      <mesh
        name="diorama-ground"
        geometry={grassGeometry}
        position={[0, topY - grassThickness, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <ToonMaterial color={color} />
      </mesh>
    </group>
  );
});
