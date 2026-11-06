import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const ABSTRACT_LOOP_SCULPTURE_SIZE = [0.36, 0.5, 0.18] as const;
export function AbstractLoopSculpture({
  size = ABSTRACT_LOOP_SCULPTURE_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group name="abstract-loop-sculpture" scale={[size[0] / 0.36, size[1] / 0.5, size[2] / 0.18]}>
      <RoundedFurniturePanel
        size={[0.28, 0.065, 0.18]}
        position={[0, 0.0325, 0]}
        color="#c1b69d"
        radius={0.008}
        outline={false}
      />
      <mesh position={[0, 0.28, 0]} scale={[1, 1.2222222222, 0.8]} castShadow receiveShadow>
        <torusGeometry args={[0.125, 0.055, 12, 32]} />
        <ToonMaterial color={color ?? "#b29361"} />
      </mesh>
    </group>
  );
}
