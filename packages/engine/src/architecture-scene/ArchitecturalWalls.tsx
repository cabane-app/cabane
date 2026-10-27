import { splitWallSurfaceGeometry } from "../architecture-geometry/wall-surface-geometry";
import { useWallSurfaceTextures } from "./wall-surface-textures";
import { wallFrame } from "../architecture-geometry/wall-coordinate-frame";
import { wallFaceFinish, wallEdgeFinish } from "../architecture-geometry/wall-face-finish";
import { BufferGeometry, Color, Float32BufferAttribute } from "three";

import { useEffect, useMemo } from "react";
import { useWallRoomSelection } from "./useWallRoomSelection";
import { RoomWallEmphasis } from "../room-navigation/RoomWallEmphasis";

import {
  buildArchitecturalWallGeometries,
  buildContinuousWallGeometry,
  wallExteriorNormal,
} from "../architecture-geometry";

import { CameraFacingFade, ToonMaterial } from "../rendering";

import type { FloorSpec, OpeningSpec, WallSpec } from "../types";

const splitArchitectureGeometry = (source: BufferGeometry) => {
  const sourcePositions = source.getAttribute("position");
  const extract = (materialIndex: number) => {
    const positions: number[] = [];
    source.groups
      .filter((group) => group.materialIndex === materialIndex)
      .forEach((group) => {
        for (let index = group.start; index < group.start + group.count; index += 1) {
          positions.push(
            sourcePositions.getX(index),
            sourcePositions.getY(index),
            sourcePositions.getZ(index),
          );
        }
      });
    if (!positions.length) return null;
    const geometry = new BufferGeometry();
    geometry.userData.preservePlanarFaces = true;
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  };
  const result = { interior: extract(0), exterior: extract(1) };
  source.dispose();
  return result;
};

export function ArchitecturalWall({
  wall,
  floor,
  openings,
  interiorColor,
  exteriorColor,
  fade,
  reducedMotion,
}: {
  wall: WallSpec;
  floor: FloorSpec;
  openings: readonly OpeningSpec[];
  interiorColor: string;
  exteriorColor: string;
  fade: boolean;
  reducedMotion: boolean;
}) {
  const textures = useWallSurfaceTextures();
  const geometry = useMemo(() => {
    const result = splitArchitectureGeometry(buildContinuousWallGeometry(wall, floor, openings));
    const frame = wallFrame(wall, floor);
    for (const [outside, geometry] of [
      [false, result.interior],
      [true, result.exterior],
    ] as const) {
      if (!geometry) continue;
      const normals = geometry.getAttribute("normal");
      const colors: number[] = [];
      for (let index = 0; index < normals.count; index++) {
        const alignment =
          normals.getX(index) * frame.normal[0] + normals.getZ(index) * frame.normal[1];
        const fallback = outside ? exteriorColor : interiorColor;
        // Longitudinal faces and edge/reveal surfaces have separate finish rules.
        const color = new Color(
          Math.abs(alignment) > 0.999
            ? wallFaceFinish(wall, alignment >= 0 ? "left" : "right", outside, fallback)
            : wallEdgeFinish(wall, interiorColor),
        );
        colors.push(color.r, color.g, color.b);
      }
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    }
    return [
      ...[result.interior, result.exterior].flatMap((geometry, index) =>
        geometry
          ? splitWallSurfaceGeometry(geometry, wall, floor).map((surface, part) => ({
              ...surface,
              name: `wall-${wall.id}${index ? "-exterior-face" : ""}${part ? `-${part}` : ""}`,
            }))
          : [],
      ),
    ];
  }, [floor, openings, wall, interiorColor, exteriorColor]);
  useEffect(() => () => geometry.forEach((surface) => surface.geometry.dispose()), [geometry]);
  const normal = wallExteriorNormal(wall, floor) ?? ([0, 0] as const);
  return (
    <CameraFacingFade
      retainShadows
      enabled={fade && wall.classification === "exterior"}
      normal={normal}
      reducedMotion={reducedMotion}
    >
      {geometry.map(({ geometry, name, finish }) => {
        const texture = finish ? textures.get(finish) : null;
        return (
          <mesh key={name} name={name} geometry={geometry} castShadow>
            <ToonMaterial
              key={texture ? "pattern" : "solid"}
              color={texture ? "white" : (finish?.color ?? "white")}
              map={texture}
              vertexColors
            />
          </mesh>
        );
      })}
    </CameraFacingFade>
  );
}

export function ArchitecturalWalls({
  floor,
  interiorColor,
  exteriorColor,
  fade,
  reducedMotion,
  baseElevationMeters,
  below,
  above,
  onSelectRoom,
}: {
  floor: FloorSpec;
  onSelectRoom?: ((roomId: string) => void) | undefined;
  baseElevationMeters?: number | undefined;
  below?: FloorSpec | undefined;
  above?: FloorSpec | undefined;
  interiorColor: string;
  exteriorColor: string;
  fade: boolean;
  reducedMotion: boolean;
}) {
  const selectionHandlers = useWallRoomSelection(floor, onSelectRoom);
  const textures = useWallSurfaceTextures();
  const groups = useMemo(
    () =>
      buildArchitecturalWallGeometries(floor, interiorColor, exteriorColor, baseElevationMeters, {
        ...(below === undefined ? {} : { below: below }),
        ...(above === undefined ? {} : { above: above }),
      }),
    [exteriorColor, floor, interiorColor, baseElevationMeters, below, above],
  );
  useEffect(() => () => groups.forEach(({ geometry }) => geometry.dispose()), [groups]);
  return (
    <>
      {groups.map(({ geometry, outwardNormal, fadeNormals, finish }, index) => {
        const texture = finish ? textures.get(finish) : null;
        const wall = (
          <mesh key={`mesh-${index}`} geometry={geometry} castShadow {...selectionHandlers}>
            <ToonMaterial
              key={texture ? "pattern" : "solid"}
              color={texture ? "white" : (finish?.color ?? "white")}
              map={texture}
              vertexColors
            />
            <RoomWallEmphasis
              geometry={geometry}
              floor={floor}
              enabled={Boolean(onSelectRoom)}
              reducedMotion={reducedMotion}
            />
          </mesh>
        );
        const normals = fadeNormals.length ? fadeNormals : outwardNormal ? [outwardNormal] : [];
        return normals.length ? (
          <CameraFacingFade
            key={`wall-group-${index}`}
            retainShadows
            enabled={fade}
            normals={normals}
            reducedMotion={reducedMotion}
          >
            {wall}
          </CameraFacingFade>
        ) : (
          <group key={`wall-group-${index}`}>{wall}</group>
        );
      })}
    </>
  );
}
