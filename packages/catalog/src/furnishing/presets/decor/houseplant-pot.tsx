import { Outlines, ToonMaterial } from "@cabane/engine";
import { Vector2 } from "three";

const profile = [
  [0, 0],
  [0.65, 0],
  [0.68, 0.045],
  [0.69, 0.1],
  [0.9, 0.78],
  [0.97, 0.8],
  [1, 0.87],
  [1, 0.96],
  [0.97, 1],
  [0.88, 1],
  [0.86, 0.93],
  [0.84, 0.82],
].map(([r, y]) => new Vector2(r, y));

export function HouseplantPot({
  radius,
  height,
  color,
  outline,
}: {
  radius: number;
  height: number;
  color: string;
  outline: string;
}) {
  return (
    <group scale={[radius, height, radius]}>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[profile, 24]} />
        <ToonMaterial color={color} />
        <Outlines color={outline} thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh position={[0, 0.87, 0]} receiveShadow>
        <cylinderGeometry args={[0.855, 0.84, 0.035, 24]} />
        <ToonMaterial color="#574737" />
      </mesh>
    </group>
  );
}
