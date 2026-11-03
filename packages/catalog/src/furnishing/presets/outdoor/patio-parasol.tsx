import { ToonMaterial, type SceneItemSize } from "@cabane/engine";

export const PATIO_PARASOL_SIZE = [2.4, 2.5, 2.4] as const;

export function PatioParasol({
  size = PATIO_PARASOL_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group name="patio-parasol" scale={[size[0] / 2.4, size[1] / 2.5, size[2] / 2.4]}>
      <mesh
        userData={{ walkCollider: true }}
        name="base"
        position={[0, 0.05, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.29, 0.32, 0.1, 24]} />
        <ToonMaterial color="#414e49" />
      </mesh>
      <mesh
        userData={{ walkCollider: true }}
        name="pole"
        position={[0, 1.28, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.023, 0.023, 2.36, 24]} />
        <ToonMaterial color="#b58a58" />
      </mesh>
      <mesh name="canopy" position={[0, 2.27, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 1.2, 0.34, 24]} />
        <ToonMaterial color={color ?? "#e4d8ba"} />
      </mesh>
      <mesh name="finial" position={[0, 2.47, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.06, 24]} />
        <ToonMaterial color="#b58a58" />
      </mesh>
    </group>
  );
}
