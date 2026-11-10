import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { DecorativeBottle } from "../construction/decorative-bottle";
export const BARWARE_TRAY_SIZE = [0.48, 0.3, 0.3] as const;
export function BarwareTray({ size = BARWARE_TRAY_SIZE }: { size?: SceneItemSize }) {
  return (
    <group name="barware-tray" scale={[size[0] / 0.48, size[1] / 0.3, size[2] / 0.3]}>
      <RoundedFurniturePanel
        size={[0.48, 0.025, 0.3]}
        position={[0, 0.0125, 0]}
        color="#78583b"
        radius={0.01}
      />
      {[-0.14, 0.14].map((z) => (
        <RoundedFurniturePanel
          key={z}
          size={[0.48, 0.03, 0.02]}
          position={[0, 0.04, z]}
          color="#a48657"
          radius={0.004}
          outline={false}
        />
      ))}
      {[-0.23, 0.23].map((x) => (
        <RoundedFurniturePanel
          key={x}
          size={[0.02, 0.03, 0.26]}
          position={[x, 0.04, 0]}
          color="#a48657"
          radius={0.004}
          outline={false}
        />
      ))}
      <group position={[-0.12, 0.04, 0]}>
        <DecorativeBottle color="#6c5135" />
      </group>
      <mesh position={[-0.12, 0.0325, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 0.015, 16]} />
        <ToonMaterial color="#b69a68" />
      </mesh>
      {[
        [-0.01, 0.04],
        [0.12, -0.04],
      ].map(([x, z]) => (
        <group key={x} position={[x, 0.025, z]}>
          <mesh position={[0, 0.004, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.008, 16]} />
            <ToonMaterial color="#c4ceca" />
          </mesh>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.075, 8]} />
            <ToonMaterial color="#c4ceca" />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <cylinderGeometry args={[0.033, 0.012, 0.06, 16, 1, true]} />
            <ToonMaterial color="#ccd6cf" side={2} />
          </mesh>
          <mesh position={[0, 0.087, 0]}>
            <cylinderGeometry args={[0.018, 0.012, 0.014, 16]} />
            <ToonMaterial color="#79503c" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
