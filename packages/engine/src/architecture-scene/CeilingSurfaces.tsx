import { indoorRoomsForFloor } from "../outdoor-platforms/platform-rooms";
import { cutSurfaceShapes, useStairSurfaceApertures } from "../stairs/surface-apertures";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, ShapeUtils, Vector2 } from "three";

import { useMemo } from "react";

import { planPointToWorld, slopedCeilingHeightAtPoint } from "../geometry";

import { ToonMaterial } from "../rendering";
import { CEILING_SURFACE_COLOR } from "./surface-colors";

import type { FloorSpec, Polygon, SlopedCeilingSpec } from "../types";

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
    <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
      <extrudeGeometry args={[shape, { depth: 0.16, bevelEnabled: false }]} />
      <ToonMaterial color={CEILING_SURFACE_COLOR} side={DoubleSide} />
    </mesh>
  );
}

export function CeilingSurfaces({ floor }: { floor: FloorSpec }) {
  const rooms = indoorRoomsForFloor(floor);
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
    <group>
      {ceilings.flatMap((ceiling) => {
        if (ceiling.kind === "sloped") {
          return ceiling.planes.map((plane) => (
            <SlopedCeilingSurface key={`${ceiling.id}-${plane.id}`} floor={floor} plane={plane} />
          ));
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

function SlopedCeilingSurface({
  floor,
  plane,
}: {
  floor: FloorSpec;
  plane: SlopedCeilingSpec["planes"][number];
}) {
  const geometry = useMemo(() => {
    const contour = plane.boundary.map(([x, y]) => new Vector2(x, y));
    const triangles = ShapeUtils.triangulateShape(contour, []);
    const positions = triangles.flatMap((triangle) =>
      triangle.flatMap((index) => {
        const vertex = contour[index];
        const point = [vertex.x, vertex.y] as const;
        const [x, z] = planPointToWorld(point, floor.coordinates);
        return [x, slopedCeilingHeightAtPoint(point, plane), z];
      }),
    );
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.computeVertexNormals();
    return result;
  }, [floor.coordinates, plane]);

  return (
    <mesh geometry={geometry} receiveShadow={false}>
      <ToonMaterial color={CEILING_SURFACE_COLOR} side={DoubleSide} />
    </mesh>
  );
}
