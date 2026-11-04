import { ToonMaterial } from "@cabane/engine";

/** Upright static bottle, underside at Y=0. No transparent or runtime surfaces. */
export function DecorativeBottle({ color = "#384b37" }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.18, 12]} />
        <ToonMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.195, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.035, 0.03, 12]} />
        <ToonMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.23, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 0.04, 12]} />
        <ToonMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.255, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.01, 12]} />
        <ToonMaterial color="#aa8b55" />
      </mesh>
      <mesh position={[0, 0.1, 0.0355]}>
        <boxGeometry args={[0.04, 0.055, 0.003]} />
        <ToonMaterial color="#e2d9c0" />
      </mesh>
    </group>
  );
}
