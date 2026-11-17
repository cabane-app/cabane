import {
  projectPaintedWallUVs,
  splitWallSurfaceGeometry,
} from "../architecture-geometry/wall-surface-geometry";
import { useWallFaceTexture } from "./wall-surface-textures";
import type { PassageHead } from "../architecture-geometry/passage-head";
import { wallFrame } from "../architecture-geometry/wall-coordinate-frame";
import { wallFaceFinish, wallEdgeFinish } from "../architecture-geometry/wall-face-finish";
import { BufferGeometry, Color, Float32BufferAttribute } from "three";

import { useContext, useEffect, useMemo } from "react";
import { useWallRoomSelection } from "./useWallRoomSelection";
import { ArchitecturalGlass } from "./ArchitecturalGlass";
import { useGraphicsFeature } from "../graphics-features";
import { SceneStyleContext } from "../scene-style";
import { bakeWallContacts, type WallContacts } from "../architecture-geometry/wall-contact";
import { RoomWallEmphasis } from "../room-navigation/RoomWallEmphasis";

import {
  buildArchitecturalWallGeometries,
  buildContinuousWallGeometry,
  buildWallGableGlass,
  wallExteriorNormal,
} from "../architecture-geometry";

import { CameraFacingFade } from "../rendering";

import { ArchitecturalMaterial } from "./ArchitecturalMaterial";
import type { FloorSpec, OpeningSpec, WallSpec } from "../types";

function useWallContacts(floor: FloorSpec, allowed: boolean, wall?: WallSpec) {
  const enabled = useGraphicsFeature("contact");
  const style = useContext(SceneStyleContext);
  const contact = useMemo(
    () => (allowed && enabled && style === "default" ? bakeWallContacts(floor, wall) : null),
    [allowed, enabled, style, floor, wall],
  );
  useEffect(() => () => contact?.map.dispose(), [contact]);
  return contact;
}

function projectSingleWallContacts(
  geometry: BufferGeometry,
  wall: WallSpec,
  floor: FloorSpec,
  contact: WallContacts,
) {
  const positions = geometry.getAttribute("position"),
    normals = geometry.getAttribute("normal");
  const normal = wallFrame(wall, floor).normal;
  const uvs = new Float32BufferAttribute(new Float32Array(positions.count * 2), 2);
  for (let i = 0; i < positions.count; i++) {
    const alignment = normals.getX(i) * normal[0] + normals.getZ(i) * normal[1];
    uvs.setXY(
      i,
      ...contact.uv(
        Math.abs(alignment) > 0.999 ? wall.id : undefined,
        alignment > 0 ? "left" : "right",
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i),
      ),
    );
  }
  geometry.setAttribute("uv1", uvs);
}

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
  allowContact = true,
}: {
  wall: WallSpec;
  floor: FloorSpec;
  openings: readonly OpeningSpec[];
  interiorColor: string;
  exteriorColor: string;
  fade: boolean;
  reducedMotion: boolean;
  allowContact?: boolean;
}) {
  const contact = useWallContacts(floor, allowContact, wall);
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
    const surfaces = [
      ...[result.interior, result.exterior].flatMap((geometry, index) =>
        geometry
          ? splitWallSurfaceGeometry(geometry, wall, floor).map((surface, part) => ({
              ...surface,
              name: `wall-${wall.id}${index ? "-exterior-face" : ""}${part ? `-${part}` : ""}`,
            }))
          : [],
      ),
    ];
    for (const surface of surfaces) {
      if (!surface.finish) projectPaintedWallUVs(surface.geometry);
      if (contact) projectSingleWallContacts(surface.geometry, wall, floor, contact);
    }
    return surfaces;
  }, [floor, openings, wall, interiorColor, exteriorColor, contact]);
  const faceTexture = useWallFaceTexture(geometry);
  const receiveSun = useGraphicsFeature("lighting");
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
        const texture = faceTexture(finish);
        return (
          <mesh key={name} name={name} geometry={geometry} castShadow receiveShadow={receiveSun}>
            <ArchitecturalMaterial
              key={`${texture ? "pattern" : "solid"}-${contact ? "contact" : "flat"}`}
              color={texture ? "white" : (finish?.color ?? "white")}
              map={texture}
              aoMap={contact?.map ?? null}
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
  passageHeads,
  sectionEdges = false,
  allowContact = true,
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
  passageHeads?: ReadonlyMap<string, PassageHead>;
  sectionEdges?: boolean;
  allowContact?: boolean;
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
  const joinery = useGraphicsFeature("joinery");
  const contact = useWallContacts(floor, allowContact);
  const groups = useMemo(() => {
    const surfaces = buildArchitecturalWallGeometries(
      floor,
      interiorColor,
      exteriorColor,
      baseElevationMeters,
      {
        sectionEdges: joinery && sectionEdges,
        skirting: joinery,
        passageHeads,
        contact,
        ...(below === undefined ? {} : { below: below }),
        ...(above === undefined ? {} : { above: above }),
      },
    );
    for (const surface of surfaces) {
      if (!surface.finish) projectPaintedWallUVs(surface.geometry);
    }
    return surfaces;
  }, [
    exteriorColor,
    floor,
    interiorColor,
    baseElevationMeters,
    below,
    above,
    sectionEdges,
    passageHeads,
    joinery,
    contact,
  ]);
  const faceTexture = useWallFaceTexture(groups);
  const receiveSun = useGraphicsFeature("lighting");
  useEffect(() => () => groups.forEach(({ geometry }) => geometry.dispose()), [groups]);
  const gableGlass = useMemo(() => buildWallGableGlass(floor), [floor]);
  useEffect(() => () => gableGlass.forEach(({ geometry }) => geometry.dispose()), [gableGlass]);
  return (
    <>
      {gableGlass.map(({ geometry, outwardNormal }, index) => (
        <CameraFacingFade
          key={`gable-glass-${index}`}
          enabled={fade && outwardNormal !== null}
          normals={outwardNormal ? [outwardNormal] : []}
          reducedMotion={reducedMotion}
        >
          <mesh geometry={geometry} receiveShadow>
            <ArchitecturalGlass />
          </mesh>
        </CameraFacingFade>
      ))}
      {groups.map(({ geometry, outwardNormal, fadeNormals, finish }, index) => {
        const texture = faceTexture(finish);
        const wall = (
          <mesh
            key={`mesh-${index}`}
            name="structural-wall-surface"
            geometry={geometry}
            castShadow
            receiveShadow={receiveSun}
            {...selectionHandlers}
          >
            <ArchitecturalMaterial
              key={`${texture ? "pattern" : "solid"}-${contact ? "contact" : "flat"}`}
              color={texture ? "white" : (finish?.color ?? "white")}
              map={texture}
              aoMap={contact?.map ?? null}
              vertexColors
            />
            {onSelectRoom && (
              <RoomWallEmphasis geometry={geometry} floor={floor} reducedMotion={reducedMotion} />
            )}
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
