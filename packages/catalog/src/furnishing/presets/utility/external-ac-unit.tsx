import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction/rounded-furniture-panel";

export const EXTERNAL_AC_UNIT_SIZE = [0.8, 0.6, 0.32] as const;

/** Generic static condenser, with floor-contact feet and its fan facing +Z. */
export function ExternalAcUnit({ size = EXTERNAL_AC_UNIT_SIZE }: { size?: SceneItemSize } = {}) {
  return (
    <group
      name="external-ac-unit"
      scale={[size[0] / 0.8, size[1] / 0.6, size[2] / 0.32]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        name="condenser-case"
        size={[0.784, 0.54, 0.285]}
        position={[0, 0.33, -0.0175]}
        radius={0.012}
        color="#e5e3da"
        outlineColor="#92948e"
      />
      {[-0.27, 0.27].map((x) => (
        <mesh key={x} name="condenser-floor-foot" position={[x, 0.038, -0.015]} castShadow>
          <boxGeometry args={[0.075, 0.076, 0.27]} />
          <ToonMaterial color="#a3a59f" />
        </mesh>
      ))}
      <group position={[-0.115, 0.33, 0]}>
        <mesh name="fan-recess" position={[0, 0, 0.126]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.225, 0.225, 0.012, 32]} />
          <ToonMaterial color="#414b4b" />
        </mesh>
        {[0, 1, 2, 3, 4].map((blade) => (
          <group key={blade} rotation={[0, 0, (blade * Math.PI * 2) / 5]}>
            <mesh name="fan-blade" position={[0.087, 0.035, 0.138]} rotation={[0, 0, 0.45]}>
              <boxGeometry args={[0.19, 0.065, 0.008]} />
              <ToonMaterial color="#89918b" />
            </mesh>
          </group>
        ))}
        {[0.075, 0.145, 0.223].map((radius) => (
          <mesh key={radius} name="fan-grille-ring" position={[0, 0, 0.153]}>
            <torusGeometry args={[radius, 0.007, 8, 32]} />
            <ToonMaterial color="#bfc3b9" />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((spoke) => (
          <mesh
            key={spoke}
            name="fan-grille-spoke"
            position={[0, 0, 0.153]}
            rotation={[0, 0, (spoke * Math.PI) / 4]}
          >
            <boxGeometry args={[0.446, 0.009, 0.01]} />
            <ToonMaterial color="#bfc3b9" />
          </mesh>
        ))}
        <mesh name="fan-hub" position={[0, 0, 0.146]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.028, 20]} />
          <ToonMaterial color="#c9ccc3" />
        </mesh>
      </group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh name="side-vent-recess" position={[side * 0.392, 0.33, -0.02]}>
            <boxGeometry args={[0.008, 0.4, 0.216]} />
            <ToonMaterial color="#68716d" />
          </mesh>
          {Array.from({ length: 9 }, (_, index) => (
            <mesh
              key={index}
              name="side-vent-louver"
              position={[side * 0.396, 0.15 + index * 0.045, -0.02]}
            >
              <boxGeometry args={[0.008, 0.022, 0.21]} />
              <ToonMaterial color="#d7d9d0" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
