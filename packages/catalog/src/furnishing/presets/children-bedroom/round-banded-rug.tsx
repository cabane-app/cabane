import type { SceneModelProps } from "@cabane/engine";
import { ToonMaterial } from "@cabane/engine";
export function RoundBandedRug({ size, color }: SceneModelProps) {
  return (
    <group
      name="round-banded-rug"

      scale={[size[0] / 1.2, size[1] / 0.008, size[2] / 1.2]}
    >
      <mesh position={[0, 0.002, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.004, 64]} />
        <ToonMaterial color={color ?? "#dec9bb"} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry args={[0.49, 0.54, 64]} />
        <ToonMaterial color="#bb9c6c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <ringGeometry args={[0.35, 0.41, 64]} />
        <ToonMaterial color="#bb9c6c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <circleGeometry args={[0.29, 64]} />
        <ToonMaterial color="#bb9c6c" />
      </mesh>
    </group>
  );
}
