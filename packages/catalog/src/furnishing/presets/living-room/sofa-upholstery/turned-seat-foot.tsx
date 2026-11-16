import { ToonMaterial } from "@cabane/engine";
import { Vector2 } from "three";

const profile = [
  [0, 0],
  [0.54, 0],
  [0.63, 0.05],
  [0.78, 0.46],
  [1, 0.78],
  [1, 0.94],
  [0.85, 1],
  [0, 1],
].map(([r, y]) => new Vector2(r, y));

export function TurnedSeatFoot({
  x,
  z,
  height,
  radius,
  name,
  color,
}: {
  x: number;
  z: number;
  height: number;
  radius: number;
  name: string;
  color: string;
}) {
  return (
    <mesh
      name={name}
      position={[x, 0, z]}
      scale={[radius, height, radius]}
      castShadow
      receiveShadow
    >
      <latheGeometry args={[profile, 12]} />
      <ToonMaterial color={color} />
    </mesh>
  );
}
