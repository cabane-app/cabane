import { removeElevationCutWalls } from "../elevation/cut-wall-geometry";
import { elevationCutouts } from "../elevation/surfaces";
import { cutStairGroundOpenings } from "../stairs/ground-apertures";
import { useStairSurfaceApertures } from "../stairs/surface-apertures";
import { ExtrudeGeometry, type Texture } from "three";
import { setWallContactUVs } from "../floor-finishes/wall-contact-map";
import { ArchitecturalMaterial } from "./ArchitecturalMaterial";
import { useScannedFinish } from "../scanned-finishes";
import { roundedDioramaShape, plinthContactShadow } from "./diorama-profile";
import { SceneStyleContext } from "../scene-style";
import { useGraphicsFeature } from "../graphics-features";

import { createContext, memo, useContext, useEffect, useMemo } from "react";
import { useTerrainSurface } from "../terrain/TerrainSurface";
import { conformToTerrain } from "../terrain/terrain-geometry";

import { cutPoolOpenings, poolVerticalLayout } from "../pools";

import { GROUND_ELEVATION_METERS } from "../ground-elevation";

import type { FloorSpec } from "../types";

/** Optional presentation bounds for a stand-alone diorama. Terrain keeps its authored extent. */
export const DioramaFrameContext = createContext<{
  width: number;
  depth: number;
  centerX?: number;
  centerZ?: number;
} | null>(null);

export const DioramaGround = memo(function DioramaGround({
  centerX: requestedCenterX,
  centerZ: requestedCenterZ,
  size: requestedSize,
  color,
  floor,
  wallContact = null,
}: {
  centerX: number;
  centerZ: number;
  size: number;
  color: string;
  floor: FloorSpec;
  wallContact?: Texture | null;
}) {
  const terrain = useTerrainSurface();
  const frame = useContext(DioramaFrameContext);
  const centerX = terrain?.centerX ?? frame?.centerX ?? requestedCenterX;
  const centerZ = terrain?.centerZ ?? frame?.centerZ ?? requestedCenterZ;
  const width = terrain?.size ?? frame?.width ?? requestedSize;
  const depth = terrain?.size ?? frame?.depth ?? requestedSize;
  const grounds = useGraphicsFeature("grounds");
  const natural = useContext(SceneStyleContext) === "default" && grounds;
  const turf = useScannedFinish("ground-cover", "grounds");
  const plinth = useScannedFinish("painted-plaster", "grounds");
  const shadow = useMemo(
    () => (natural ? plinthContactShadow(width, depth) : null),
    [natural, width, depth],
  );
  useEffect(() => () => shadow?.dispose(), [shadow]);
  const apertures = useStairSurfaceApertures("floor");
  const terrainApertures = useStairSurfaceApertures("terrain");
  const baseShape = useMemo(
    () =>
      cutStairGroundOpenings(
        cutPoolOpenings(roundedDioramaShape(centerX, centerZ, width, depth, 0.42), floor),
        floor.coordinates,
        [
          ...apertures,
          ...terrainApertures,
          ...(terrain?.cutouts ?? []),
          ...elevationCutouts(floor),
        ],
      ),
    [centerX, centerZ, width, depth, floor, apertures, terrainApertures, terrain],
  );
  const grassShape = useMemo(
    () =>
      cutStairGroundOpenings(
        cutPoolOpenings(
          roundedDioramaShape(centerX, centerZ, width - 0.1, depth - 0.1, 0.36),
          floor,
        ),
        floor.coordinates,
        [
          ...apertures,
          ...terrainApertures,
          ...(terrain?.cutouts ?? []),
          ...elevationCutouts(floor),
        ],
      ),
    [centerX, centerZ, width, depth, floor, apertures, terrainApertures, terrain],
  );
  const topY = GROUND_ELEVATION_METERS;
  const grassThickness = 0.1;
  const baseThickness = Math.max(
    terrain?.soilDepth ?? 0.28,
    ...floor.rooms.flatMap((room) =>
      (room.floorZones ?? []).map((zone) => -(zone.elevation?.offsetMeters ?? 0) + 0.28),
    ),
    ...(floor.outdoorPlatforms ?? []).map(
      (platform) => -(platform.elevation?.offsetMeters ?? 0) + 0.28,
    ),
    ...(floor.pools ?? [])
      .filter((pool) => pool.type !== "above-ground-wood")
      .map((pool) => poolVerticalLayout(pool).height + 0.06),
  );
  const baseGeometry = useMemo(
    () =>
      conformToTerrain(
        removeElevationCutWalls(
          new ExtrudeGeometry(baseShape, { depth: baseThickness, bevelEnabled: false }),
          floor.coordinates,
          elevationCutouts(floor),
        ),
        terrain,
        baseThickness,
      ),
    [baseShape, baseThickness, terrain, floor],
  );
  const groundContact = terrain ? null : wallContact;
  const grassGeometry = useMemo(() => {
    const geometry = conformToTerrain(
      removeElevationCutWalls(
        new ExtrudeGeometry(grassShape, { depth: grassThickness, bevelEnabled: false }),
        floor.coordinates,
        elevationCutouts(floor),
      ),
      terrain,
    );
    if (groundContact) setWallContactUVs(geometry);
    return geometry;
  }, [grassShape, terrain, floor, groundContact]);
  useEffect(
    () => () => {
      baseGeometry.dispose();
      grassGeometry.dispose();
    },
    [baseGeometry, grassGeometry],
  );
  return (
    <group>
      {shadow && (
        <mesh
          name="diorama-contact-shadow"
          geometry={shadow}
          position={[centerX, topY - grassThickness - baseThickness - 0.002, centerZ]}
          raycast={() => {}}
          renderOrder={-1}
        >
          <meshBasicMaterial color="#342c22" vertexColors transparent depthWrite={false} />
        </mesh>
      )}
      <mesh
        name="diorama-base"
        geometry={baseGeometry}
        position={[0, topY - grassThickness - baseThickness, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <ArchitecturalMaterial
          key={plinth ? "mineral" : "plain"}
          feature="grounds"
          color={natural ? "#c2beb2" : "#6f7d57"}
          map={plinth ?? null}
        />
      </mesh>
      <mesh
        name="diorama-ground"
        geometry={grassGeometry}
        position={[0, topY - grassThickness, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <ArchitecturalMaterial
          key={`${turf ? "turf" : "plain"}-${groundContact ? "contact" : "flat"}`}
          feature="grounds"
          color={color}
          map={turf ?? null}
          roughness={1}
          aoMap={groundContact}
        />
      </mesh>
    </group>
  );
});
