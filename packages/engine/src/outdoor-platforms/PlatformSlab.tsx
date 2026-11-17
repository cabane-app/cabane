import { removeElevationCutWalls } from "../elevation/cut-wall-geometry";
import { useEffect, useMemo } from "react";
import { BackSide, DoubleSide, ExtrudeGeometry, Path, Shape, ShapeGeometry } from "three";
import { ToonMaterial } from "../rendering";
import { useStairSurfaceApertures } from "../stairs/surface-apertures";
import { differenceClippingGeometry } from "../architecture-geometry/architecture-clipping";
import { planPointToWorld } from "../geometry";
import type { FloorSpec, OutdoorPlatformSpec } from "../types";
import { derivePlatformSlabPieces } from "./platform-slab-coverage";
import { CEILING_SURFACE_COLOR } from "../architecture-scene/surface-colors";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";

const PLATFORM_SLAB_EDGE_COLOR = "#d4c6ae";
const CEILING_LINER_OFFSET_METERS = 0.002;
const TERRAIN_CLEARANCE_METERS = 0.002;

/** One slab, with its underside matching any authored room ceiling below. */
export function PlatformSlab({
  platform,
  floor,
  below,
  buryInTerrain = false,
}: {
  platform: OutdoorPlatformSpec;
  floor: FloorSpec;
  below?: FloorSpec | undefined;
  buryInTerrain?: boolean;
}) {
  const apertures = useStairSurfaceApertures("floor");
  const slabTop =
    platform.elevation?.offsetMeters ??
    (buryInTerrain ? GROUND_ELEVATION_METERS - TERRAIN_CLEARANCE_METERS : 0);
  const pieces = useMemo(
    () =>
      derivePlatformSlabPieces(platform, floor, below).map((piece) => {
        const clipped = apertures.length
          ? differenceClippingGeometry(
              piece.polygon,
              ...apertures.map((p) => [
                p.map(
                  (point) => [...planPointToWorld(point, floor.coordinates)] as [number, number],
                ),
              ]),
            )
          : [piece.polygon];
        const shapes = clipped.map((rings) => {
          const shape = new Shape();
          rings.forEach((ring, index) => {
            const path = index === 0 ? shape : new Path();
            ring.forEach(([x, z], i) => (i === 0 ? path.moveTo(x, -z) : path.lineTo(x, -z)));
            path.closePath();
            if (index) shape.holes.push(path);
          });
          return shape;
        });
        const bottom = Math.min(piece.bottom, slabTop - 0.16);
        const depth = slabTop - bottom;
        return {
          ...piece,
          bottom,
          slabGeometry:
            depth > 0
              ? removeElevationCutWalls(
                  new ExtrudeGeometry(shapes, { depth, bevelEnabled: false }),
                  floor.coordinates,
                  platform.elevation ? [platform.polygon] : [],
                )
              : null,
          ceilingGeometry: new ShapeGeometry(shapes),
        };
      }),
    // Slab geometry uses the outline, transform, lower ceiling, apertures and visual top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platform.polygon, platform.elevation, floor.coordinates, below, apertures, slabTop],
  );
  useEffect(
    () => () =>
      pieces.forEach((piece) => {
        piece.slabGeometry?.dispose();
        piece.ceilingGeometry.dispose();
      }),
    [pieces],
  );
  return (
    <group name={`platform-slab-${platform.id}`}>
      {pieces.map((piece, index) => (
        <group key={index}>
          {piece.slabGeometry && (
            <mesh
              name={`platform-slab-${platform.id}-structure-${index}`}
              geometry={piece.slabGeometry}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, piece.bottom, 0]}
              castShadow={!buryInTerrain}
              receiveShadow
            >
              <ToonMaterial attach="material-0" color={CEILING_SURFACE_COLOR} />
              <ToonMaterial attach="material-1" color={PLATFORM_SLAB_EDGE_COLOR} />
            </mesh>
          )}
          <mesh
            name={`platform-slab-${platform.id}-ceiling-${index}`}
            geometry={piece.ceilingGeometry}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, piece.bottom - CEILING_LINER_OFFSET_METERS, 0]}
            receiveShadow={false}
          >
            <ToonMaterial
              color={CEILING_SURFACE_COLOR}
              side={buryInTerrain ? BackSide : DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
