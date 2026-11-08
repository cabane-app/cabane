import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { Vector2 } from "three";

export const CARVED_STONE_PLANTER_SIZE = [0.64, 0.72, 0.64] as const;
const profile = [
  [0, 0],
  [0.245, 0],
  [0.26, 0.035],
  [0.285, 0.08],
  [0.32, 0.65],
  [0.32, 0.7],
  [0.31, 0.72],
  [0.275, 0.72],
  [0.265, 0.695],
  [0.24, 0.12],
  [0, 0.12],
].map(([x, y]) => new Vector2(x, y));

/** Hollow limestone vessel; the broad rim remains clean at room distance. */
export function CarvedStonePlanter({ size = CARVED_STONE_PLANTER_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="carved-stone-planter"
      scale={[size[0] / 0.64, size[1] / 0.72, size[2] / 0.64]}
      userData={{ walkCollider: true }}
    >
      <mesh name="carved-limestone-vessel" castShadow receiveShadow>
        <latheGeometry args={[profile, 32]} />
        <ToonMaterial color="#c8bca6" />
      </mesh>
      <mesh name="recessed-earth" position={[0, 0.57, 0]} receiveShadow>
        <cylinderGeometry args={[0.258, 0.258, 0.02, 32]} />
        <ToonMaterial color="#4b4438" />
      </mesh>
    </group>
  );
}
