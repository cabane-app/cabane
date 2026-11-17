import { Outlines, ToonMaterial } from "@cabane/engine";
import { Vector2 } from "three";

const profile = [
  [0, 0],
  [0.62, 0],
  [0.66, 0.026],
  [0.66, 0.074],
  [0.71, 0.09],
  [0.75, 0.16],
  [0.91, 0.73],
  [0.91, 0.78],
  [0.97, 0.8],
  [1, 0.87],
  [1, 0.94],
  [0.99, 0.975],
  [0.97, 1],
  [0.88, 1],
  [0.862, 0.965],
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
