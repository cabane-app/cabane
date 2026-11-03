import { Outlines, ToonMaterial } from "@cabane/engine";

export function TowelRail({ color }: { color?: string | undefined } = {}) {
  return (
    <group name="towel-rail">
      {[-0.29, 0.29].map((z) => (
        <mesh key={z} position={[0.026, 0, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.052, 10]} />
          <ToonMaterial color="#909794" />
        </mesh>
      ))}
      <mesh position={[0.055, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.62, 12]} />
        <ToonMaterial color="#aeb5b2" />
      </mesh>
      <mesh position={[0.08, -0.25, 0]} castShadow>
        <boxGeometry args={[0.035, 0.48, 0.52]} />
        <ToonMaterial color={color ?? "#e6dfd2"} />
        <Outlines color="#938d82" thickness={0.003} />
      </mesh>
    </group>
  );
}
