import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction/rounded-furniture-panel";

export const LOOP_SCULPTURE_SIZE = [0.55, 1.65, 0.45] as const;

export function LoopSculpture({ size = LOOP_SCULPTURE_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="loop-sculpture"
      scale={[size[0] / 0.55, size[1] / 1.65, size[2] / 0.45]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        name="limestone-plinth"
        size={[0.55, 0.83, 0.45]}
        position={[0, 0.415, 0]}
        radius={0.012}
        color="#c5b8a2"
        outline={false}
      />
      <mesh name="bronze-mount" position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.06, 16]} />
        <ToonMaterial color="#755a40" />
      </mesh>
      <mesh
        name="elongated-bronze-loop"
        position={[0, 1.25, 0]}
        scale={[0.65, 1, 0.65]}
        castShadow
        receiveShadow
      >
        <torusGeometry args={[0.33, 0.07, 12, 48]} />
        <ToonMaterial color="#927150" />
      </mesh>
    </group>
  );
}
