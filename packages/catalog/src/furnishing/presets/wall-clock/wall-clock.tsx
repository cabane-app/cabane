import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { Vector2 } from "three";
import { ClockDial } from "./clock-dial";

export const WALL_CLOCK_SIZE: SceneItemSize = [0.3, 0.3, 0.045];

const caseProfile = [
  [0, 0],
  [0.144, 0],
  [0.15, 0.006],
  [0.15, 0.027],
  [0.145, 0.032],
  [0.135, 0.032],
  [0.131, 0.028],
  [0, 0.028],
].map(([radius, depth]) => new Vector2(radius, depth));

/** Static ten-past-ten clock, bottom at Y=0 and wall contact at Z=0. */
export function WallClock({ size = WALL_CLOCK_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="wall-clock"
      scale={size.map((value, axis) => value / WALL_CLOCK_SIZE[axis]) as [number, number, number]}
    >
      <group position={[0, 0.15, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <latheGeometry args={[caseProfile, 64]} />
          <ToonMaterial color="#66675f" />
          <Outlines color="#494b45" thickness={0.0015} screenspace={false} />
        </mesh>
        <ClockDial />
      </group>
    </group>
  );
}
