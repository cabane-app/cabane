import { DEFAULT_TERRAIN_GRASS_COLOR } from "../terrain/terrain-settings";
import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { ToonMaterial } from "../rendering";
import { useTerrainSurface } from "../terrain/TerrainSurface";
import { useStairSurfaceApertures } from "../stairs/surface-apertures";
import type { FloorSpec } from "../types";
import { terrainLocalHeight } from "./surfaces";
import { elevationEdgeGeometry } from "./edge-geometry";

export function ElevationEdges({ floor }: { floor: FloorSpec }) {
  const terrain = useTerrainSurface();
  const apertures = useStairSurfaceApertures("floor");
  const geometry = useMemo(
    () =>
      elevationEdgeGeometry(
        floor,
        terrainLocalHeight(floor, terrain ? (x, z) => terrain.offsetAt(x, z) : undefined),
        apertures,
      ),
    [floor, terrain, apertures],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (geometry.getAttribute("position").count === 0) return null;
  return (
    <mesh name="elevation-transitions" geometry={geometry} receiveShadow castShadow>
      <ToonMaterial attach="material-0" color="#d4c6ae" side={DoubleSide} />
      <ToonMaterial attach="material-1" color={DEFAULT_TERRAIN_GRASS_COLOR} side={DoubleSide} />
    </mesh>
  );
}
