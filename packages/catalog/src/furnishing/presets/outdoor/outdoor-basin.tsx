import { ToonMaterial } from "@cabane/engine";
import { useMemo } from "react";
import { Vector2 } from "three";

/** Closed wall section: tapered exterior, rounded lip, inner wall and basin floor. */
export function OutdoorBasin({
  name,
  radius,
  height,
  position,
  color,
}: {
  name: string;
  radius: number;
  height: number;
  position: [number, number, number];
  color: string;
}) {
  const points = useMemo(
    () =>
      [
        [0, 0],
        [radius * 0.66, 0],
        [radius, height * 0.92],
        [radius, height],
        [radius - 0.025, height],
        [radius * 0.66 - 0.025, 0.035],
        [0, 0.035],
      ].map(([x, y]) => new Vector2(x, y)),
    [radius, height],
  );
  return (
    <mesh name={name} position={position} castShadow receiveShadow>
      <latheGeometry args={[points, 24]} />
      <ToonMaterial color={color} />
    </mesh>
  );
}
