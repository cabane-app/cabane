import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const ROBOT_LAWN_MOWER_SIZE: SceneItemSize = [0.64, 0.34, 0.86];

/** Generic mower parked on its charging plate; static geometry, front +Z. */
export function RobotLawnMower({ size = ROBOT_LAWN_MOWER_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="robot-lawn-mower"
      userData={{ walkCollider: true }}
      scale={
        size.map((value, axis) => value / ROBOT_LAWN_MOWER_SIZE[axis]) as [number, number, number]
      }
    >
      <RoundedFurniturePanel
        name="charging-plate"
        size={[0.64, 0.025, 0.86]}
        position={[0, 0.0125, 0]}
        color="#454c48"
        radius={0.01}
        outline={false}
      />
      <RoundedFurniturePanel
        name="charging-station"
        size={[0.4, 0.315, 0.1]}
        position={[0, 0.1825, -0.37]}
        color="#4d5550"
        outlineColor="#343d36"
        radius={0.025}
      />
      <RoundedFurniturePanel
        name="cutting-deck"
        size={[0.46, 0.09, 0.58]}
        position={[0, 0.12, 0.045]}
        color="#343c37"
        outlineColor="#242d27"
        radius={0.035}
      />
      <RoundedFurniturePanel
        name="mower-shell"
        size={[0.45, 0.15, 0.55]}
        position={[0, 0.215, 0.045]}
        color="#80965b"
        outlineColor="#50663d"
        radius={0.055}
      />
      <RoundedFurniturePanel
        name="control-panel"
        size={[0.16, 0.018, 0.16]}
        position={[0, 0.291, 0.025]}
        color="#38453d"
        radius={0.008}
        outline={false}
      />
      <RoundedFurniturePanel
        name="stop-button"
        size={[0.07, 0.012, 0.045]}
        position={[0, 0.303, 0.065]}
        color="#bd6653"
        radius={0.005}
        outline={false}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            name="drive-wheel"
            position={[side * 0.246, 0.135, -0.09]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.11, 0.11, 0.065, 16]} />
            <ToonMaterial color="#303831" />
          </mesh>
          <mesh
            name="wheel-hub"
            position={[side * 0.28, 0.135, -0.09]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.052, 0.052, 0.008, 12]} />
            <ToonMaterial color="#7c8679" />
          </mesh>
          <mesh
            name="front-caster"
            position={[side * 0.15, 0.07, 0.235]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.045, 0.045, 0.035, 12]} />
            <ToonMaterial color="#303831" />
          </mesh>
          <RoundedFurniturePanel
            name="charging-contact"
            size={[0.035, 0.025, 0.12]}
            position={[side * 0.11, 0.215, -0.275]}
            color="#b7ac7e"
            radius={0.004}
            outline={false}
          />
        </group>
      ))}
      <RoundedFurniturePanel
        name="front-bumper"
        size={[0.34, 0.055, 0.035]}
        position={[0, 0.148, 0.33]}
        color="#434c43"
        radius={0.015}
        outline={false}
      />
    </group>
  );
}
