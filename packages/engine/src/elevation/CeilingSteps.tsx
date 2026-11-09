import { useEffect, useMemo } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";
import { planPointToWorld } from "../geometry";
import { ToonMaterial } from "../rendering";
import type { FloorSpec } from "../types";
import { ceilingHeightAt, ceilingOverrides } from "./ceilings";

export function CeilingSteps({ floor }: { floor: FloorSpec }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const area of ceilingOverrides(floor)) {
      const inherited = {
        ...floor,
        rooms: floor.rooms.map((room) => ({
          ...room,
          floorZones: room.floorZones?.filter((zone) => zone.id !== area.id) ?? [],
        })),
      };
      const height = area.elevation.offsetMeters + area.elevation.ceilingHeightMeters!;
      area.polygon.forEach((a, i) => {
        const b = area.polygon[(i + 1) % area.polygon.length];
        const pa = planPointToWorld(a, floor.coordinates),
          pb = planPointToWorld(b, floor.coordinates);
        const points = [
          [pa[0], height, pa[1]],
          [pb[0], height, pb[1]],
          [pb[0], ceilingHeightAt(inherited, area.roomId!, b), pb[1]],
          [pa[0], ceilingHeightAt(inherited, area.roomId!, a), pa[1]],
        ];
        for (const index of [0, 1, 2, 0, 2, 3]) positions.push(...points[index]);
      });
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [floor]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="local-ceiling-steps" geometry={geometry}>
      <ToonMaterial color="#eee7dc" side={DoubleSide} />
    </mesh>
  );
}
