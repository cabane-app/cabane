import { indoorRoomsForFloor } from "../outdoor-platforms/platform-rooms";
import {
  cutSurfaceShapes,
  useSlopedCeilingApertures,
  useStairSurfaceApertures,
} from "../stairs/surface-apertures";
import { DoubleSide, ShapeGeometry } from "three";
import type { MultiPolygon } from "polygon-clipping";

import { useEffect, useMemo } from "react";

import { intersectClippingGeometry } from "../architecture-geometry/architecture-clipping";
import { slopedCeilingHeightSampler } from "../architecture-geometry/sloped-ceiling-plane";
import { planPointToWorld, worldPointToPlan } from "../geometry";

import { ToonMaterial } from "../rendering";
import { CEILING_SURFACE_COLOR } from "./surface-colors";
import { WALK_EYE_HEIGHT } from "../navigation/walk-navigation-contract";
import { WALK_HEAD_MARGIN } from "../opening-pose";

import type { FloorSpec, PlanPoint, Polygon, SlopedCeilingSpec } from "../types";

type CeilingPlane = SlopedCeilingSpec["planes"][number];
const ceilingExtrusion = { depth: 0.16, bevelEnabled: false };

const worldRing = (polygon: Polygon, coordinates: FloorSpec["coordinates"]) =>
  polygon.map((point): [number, number] => [...planPointToWorld(point, coordinates)]);

function FlatCeilingSlab({
  polygon,
  floor,
  height,
}: {
  polygon: Polygon;
  floor: FloorSpec;
  height: number;
}) {
  const apertures = useStairSurfaceApertures("ceiling");
  const shape = useMemo(
    () => cutSurfaceShapes(polygon, floor.coordinates, apertures),
    [floor, polygon, apertures],
  );
  return (
    <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <extrudeGeometry args={[shape, ceilingExtrusion]} />
      <ToonMaterial color={CEILING_SURFACE_COLOR} side={DoubleSide} />
    </mesh>
  );
}

function crossesCutaway(
  plane: CeilingPlane,
  coordinates: FloorSpec["coordinates"],
  height: number,
  footprint: MultiPolygon,
) {
  const heightAt = slopedCeilingHeightSampler(plane);
  const risesAbove = (point: PlanPoint) => heightAt(point) > height + 1e-6;
  if (!plane.boundary.some(risesAbove)) return false;
  const ring = worldRing(plane.boundary, coordinates);
  const overlap = intersectClippingGeometry([ring], footprint);
  return overlap.some(([ring]) =>
    ring.some(([x, z]) => risesAbove(worldPointToPlan({ x, z }, coordinates))),
  );
}

export function CeilingSurfaces({
  floor,
  cutawayHeightMeters,
  cutawayFootprint,
}: {
  floor: FloorSpec;
  cutawayHeightMeters?: number | undefined;
  cutawayFootprint?: MultiPolygon | undefined;
}) {
  const rooms = indoorRoomsForFloor(floor);
  const hiddenPlanes = useMemo(() => {
    const hidden = new Set<CeilingPlane>();
    if (cutawayHeightMeters === undefined || !cutawayFootprint) return hidden;
    for (const ceiling of floor.ceilings ?? []) {
      if (ceiling.kind !== "sloped") continue;
      for (const plane of ceiling.planes) {
        if (crossesCutaway(plane, floor.coordinates, cutawayHeightMeters, cutawayFootprint))
          hidden.add(plane);
      }
    }
    return hidden;
  }, [floor.ceilings, floor.coordinates, cutawayHeightMeters, cutawayFootprint]);
  if (!rooms.length && floor.outdoorPlatforms?.length) return null;
  const ceilings = floor.ceilings ?? [
    {
      id: "default-ceiling",
      kind: "flat" as const,
      roomIds: rooms.map((room) => room.id),
      heightMeters: floor.defaultCeilingHeightMeters,
    },
  ];
  const allRoomIds = new Set(rooms.map((room) => room.id));
  return (
    <group name="floor-ceilings">
      {ceilings.flatMap((ceiling) => {
        if (ceiling.kind === "sloped") {
          return ceiling.planes.flatMap((plane) => {
            // A lower ceiling can block the view into the selected upper floor.
            if (hiddenPlanes.has(plane)) return [];
            return [
              <SlopedCeilingSurface
                key={`${ceiling.id}-${plane.id}`}
                floor={floor}
                plane={plane}
              />,
            ];
          });
        }
        const coversEntireFloor =
          ceiling.roomIds.length === allRoomIds.size &&
          ceiling.roomIds.every((roomId) => allRoomIds.has(roomId));
        if (coversEntireFloor) {
          return (floor.footprintRegions ?? [floor.footprint]).map((polygon, index) => (
            <FlatCeilingSlab
              key={`${ceiling.id}-building-${index}`}
              polygon={polygon as Polygon}
              floor={floor}
              height={ceiling.heightMeters}
            />
          ));
        }
        return ceiling.roomIds.flatMap((roomId) => {
          const room = rooms.find((candidate) => candidate.id === roomId);
          if (!room) return [];
          return [
            <FlatCeilingSlab
              key={`${ceiling.id}-${room.id}`}
              polygon={room.polygon}
              floor={floor}
              height={ceiling.heightMeters}
            />,
          ];
        });
      })}
    </group>
  );
}

function SlopedCeilingSurface({ floor, plane }: { floor: FloorSpec; plane: CeilingPlane }) {
  const apertures = useSlopedCeilingApertures();
  const geometry = useMemo(() => {
    const heightAt = slopedCeilingHeightSampler(plane);
    const coordinates = floor.coordinates;
    const boundary = worldRing(plane.boundary, coordinates);
    const minHeight = Math.min(...plane.boundary.map(heightAt));
    const cuts = apertures.flatMap(({ polygon, riseMeters }) => {
      const clearance = riseMeters + WALK_EYE_HEIGHT + WALK_HEAD_MARGIN;
      if (minHeight > clearance) return [];
      const overlap = intersectClippingGeometry([boundary], [worldRing(polygon, coordinates)]);
      return overlap.some(([ring]) =>
        ring.some(([x, z]) => heightAt(worldPointToPlan({ x, z }, coordinates)) <= clearance),
      )
        ? [polygon]
        : [];
    });
    const result = new ShapeGeometry(cutSurfaceShapes(plane.boundary, coordinates, cuts));
    const positions = result.getAttribute("position");
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = -positions.getY(index);
      const point = worldPointToPlan({ x, z }, coordinates);
      positions.setXYZ(index, x, heightAt(point), z);
    }
    result.computeVertexNormals();
    return result;
  }, [apertures, floor.coordinates, plane]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <ToonMaterial color={CEILING_SURFACE_COLOR} side={DoubleSide} />
    </mesh>
  );
}
