import { memo, useContext, useEffect, useMemo } from "react";
import { DoubleSide, type Texture } from "three";
import { ArchitecturalMaterial } from "../architecture-scene/ArchitecturalMaterial";
import { CountryLawnContext, CountryTurf } from "../landscapes/CountryTurf";
import { useGraphicsFeature } from "../graphics-features";
import { useScannedFinish, useTurfFringeMask } from "../scanned-finishes";
import { useStairSurfaceApertures } from "../stairs/surface-apertures";
import { DEFAULT_TERRAIN_GRASS_COLOR } from "../terrain/terrain-settings";
import { useTerrainSurface } from "../terrain/TerrainSurface";
import type { FloorSpec } from "../types";
import { groundLawnEdges } from "./ground-lawn-edges";
import { createTurfFringe } from "./turf-fringe";
import { createVergeBlades } from "./verge-blades";

interface MarginProps {
  floor: FloorSpec;
  groundColor: string;
  wallContact: Texture | null;
}

const LawnMargins = memo(function LawnMargins({ floor, groundColor, wallContact }: MarginProps) {
  const countryside = useContext(CountryLawnContext);
  const terrain = useTerrainSurface();
  const floorHoles = useStairSurfaceApertures("floor");
  const terrainHoles = useStairSurfaceApertures("terrain");
  const turf = useScannedFinish("ground-cover", "grounds");
  const edges = useMemo(
    () => groundLawnEdges(floor, [...floorHoles, ...terrainHoles, ...(terrain?.cutouts ?? [])]),
    [floor, floorHoles, terrainHoles, terrain],
  );
  const fringes = useMemo(() => {
    // A raised slab keeps its stone nosing. Blades at its base can stand proud of it.
    const flush = edges.filter((edge) => !edge.platform && !edge.lawnPlatform);
    return [false, true].map((explicit) =>
      createTurfFringe(
        flush.filter((edge) => edge.explicitGrass === explicit),
        floor.coordinates,
        terrain,
      ),
    );
  }, [edges, floor.coordinates, terrain]);
  const blades = useMemo(
    () => createVergeBlades(edges, floor.coordinates, groundColor, terrain),
    [edges, floor.coordinates, groundColor, terrain],
  );
  const matte = useTurfFringeMask(fringes.some(Boolean));
  useEffect(() => () => fringes.forEach((geometry) => geometry?.dispose()), [fringes]);
  useEffect(() => () => blades?.dispose(), [blades]);
  const offset = -((floor.groundZones?.length ?? 0) + 1);
  const fringeSurface = {
    aoMap: terrain ? null : wallContact,
    vertexColors: true,
    alphaMap: matte ?? null,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: offset,
    polygonOffsetUnits: offset,
  };
  return (
    <group name="ground-lawn-verges">
      {matte &&
        fringes.map(
          (geometry, i) =>
            geometry && (
              <mesh
                key={i}
                name={i === 0 ? "terrain-turf-fringe" : "grass-zone-fringe"}
                geometry={geometry}
                receiveShadow
                raycast={() => {}}
              >
                {countryside && i === 0 ? (
                  <CountryTurf color={groundColor} {...fringeSurface} />
                ) : (
                  <ArchitecturalMaterial
                    key={`${i === 0 && turf ? "turf" : "plain"}-${wallContact && !terrain ? "contact" : "flat"}`}
                    feature="grounds"
                    color={i === 0 ? groundColor : DEFAULT_TERRAIN_GRASS_COLOR}
                    map={i === 0 ? (turf ?? null) : null}
                    roughness={1}
                    {...fringeSurface}
                  />
                )}
              </mesh>
            ),
        )}
      {blades && (
        <mesh name="verge-blades-and-chips" geometry={blades} receiveShadow raycast={() => {}}>
          <ArchitecturalMaterial feature="grounds" vertexColors side={DoubleSide} roughness={1} />
        </mesh>
      )}
    </group>
  );
});

export function GroundLawnMargins(props: MarginProps) {
  const grounds = useGraphicsFeature("grounds");
  return grounds && (props.floor.groundZones?.length || props.floor.outdoorPlatforms?.length) ? (
    <LawnMargins {...props} />
  ) : null;
}
