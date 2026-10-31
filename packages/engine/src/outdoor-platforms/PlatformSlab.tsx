import { useEffect, useMemo } from "react";
import { DoubleSide, ExtrudeGeometry, Path, Shape, ShapeGeometry } from "three";
import { ToonMaterial } from "../rendering";
import { useStairSurfaceApertures } from "../stairs/surface-apertures";
import { differenceClippingGeometry } from "../architecture-geometry/architecture-clipping";
import { planPointToWorld } from "../geometry";
import type { FloorSpec, OutdoorPlatformSpec } from "../types";
import { derivePlatformSlabPieces } from "./platform-slab-coverage";
import { CEILING_SURFACE_COLOR } from "../architecture-scene/surface-colors";

const PLATFORM_SLAB_EDGE_COLOR = "#d4c6ae";
const CEILING_LINER_OFFSET_METERS = 0.002;

/** One slab, with its underside matching any authored room ceiling below. */
export function PlatformSlab({
  platform,
  floor,
  below,
}: {
  platform: OutdoorPlatformSpec;
  floor: FloorSpec;
  below?: FloorSpec | undefined;
}) {
  const apertures = useStairSurfaceApertures("floor");
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
        return {
          ...piece,
          slabGeometry: new ExtrudeGeometry(shapes, {
            depth: piece.depth,
            bevelEnabled: false,
          }),
          ceilingGeometry: new ShapeGeometry(shapes),
        };
      }),
    // Slab geometry uses polygon, coordinate transform, lower ceiling and apertures; rail and style edits do not change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platform.polygon, floor.coordinates, below, apertures],
  );
  useEffect(
    () => () =>
      pieces.forEach((piece) => {
        piece.slabGeometry.dispose();
        piece.ceilingGeometry.dispose();
      }),
    [pieces],
  );
  return (
    <group name={`platform-slab-${platform.id}`}>
      {pieces.map((piece, index) => (
        <group key={index}>
          <mesh
            name={`platform-slab-${platform.id}-structure-${index}`}
            geometry={piece.slabGeometry}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, piece.bottom, 0]}
            castShadow
            receiveShadow
          >
            <ToonMaterial attach="material-0" color={CEILING_SURFACE_COLOR} />
            <ToonMaterial attach="material-1" color={PLATFORM_SLAB_EDGE_COLOR} />
          </mesh>
          <mesh
            name={`platform-slab-${platform.id}-ceiling-${index}`}
            geometry={piece.ceilingGeometry}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, piece.bottom - CEILING_LINER_OFFSET_METERS, 0]}
            receiveShadow={false}
          >
            <ToonMaterial color={CEILING_SURFACE_COLOR} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
