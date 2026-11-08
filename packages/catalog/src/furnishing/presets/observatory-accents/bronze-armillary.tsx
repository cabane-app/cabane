import { ToonMaterial, type SceneItemSize } from "@cabane/engine";

export const BRONZE_ARMILLARY_SIZE = [0.52, 0.68, 0.52] as const;

/** Decorative celestial rings, with a stone foot and connected meridian support. */
export function BronzeArmillary({ size = BRONZE_ARMILLARY_SIZE }: { size?: SceneItemSize }) {
  return (
    <group name="bronze-armillary" scale={[size[0] / 0.52, size[1] / 0.68, size[2] / 0.52]}>
      <mesh name="stone-foot" position={[0, 0.025, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.115, 0.13, 0.05, 24]} />
        <ToonMaterial color="#c3b5a0" />
      </mesh>
      <mesh name="stem" position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.035, 0.14, 16]} />
        <ToonMaterial color="#80633e" />
      </mesh>
      <group position={[0, 0.42, 0]}>
        <mesh name="meridian" castShadow>
          <torusGeometry args={[0.25, 0.01, 8, 48]} />
          <ToonMaterial color="#92764c" />
        </mesh>
        <mesh name="horizon" rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.25, 0.01, 8, 48]} />
          <ToonMaterial color="#92764c" />
        </mesh>
        <group rotation={[0, 0, -0.41]}>
          <mesh name="ecliptic" rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.21, 0.008, 8, 48]} />
            <ToonMaterial color="#b19665" />
          </mesh>
          <mesh name="polar-axis" castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.48, 12]} />
            <ToonMaterial color="#80633e" />
          </mesh>
          <mesh name="celestial-sphere" castShadow>
            <sphereGeometry args={[0.065, 20, 12]} />
            <ToonMaterial color="#a58a56" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
