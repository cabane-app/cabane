import { Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../../furnishing/presets/construction/rounded-furniture-panel";
import { ApplianceSteam } from "./appliance-steam";
import { hasOperatingPower } from "./appliance-power";
import { StatusBeacon } from "../../visuals/device-visual-state";

/** Generic cordless electric kettle on its charging base; front faces +Z. */
export function ElectricKettleModel({
  visualState,
  reducedMotion,
  readings,
}: HomeDeviceModelProps) {
  return (
    <group name="catalog-electric-kettle" userData={{ walkCollider: true }}>
      <RoundedFurniturePanel
        size={[0.22, 0.02, 0.2]}
        position={[0, 0.01, 0]}
        color="#505b57"
        radius={0.01}
        outlineColor="#34403d"
      />
      <mesh name="kettle-body" position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.067, 0.088, 0.2, 18]} />
        <ToonMaterial color="#d8ddda" />
        <Outlines color="#596560" thickness={0.003} />
      </mesh>
      <mesh name="kettle-lid" position={[0, 0.218, 0]}>
        <cylinderGeometry args={[0.069, 0.069, 0.016, 18]} />
        <ToonMaterial color="#8d9893" />
      </mesh>
      <mesh name="kettle-lid-knob" position={[0, 0.242, 0]}>
        <sphereGeometry args={[0.018, 12, 8]} />
        <ToonMaterial color="#52605b" />
      </mesh>
      <mesh name="kettle-spout" position={[-0.05, 0.18, 0]} rotation={[0, 0, Math.PI / 3]}>
        <coneGeometry args={[0.03, 0.1, 12]} />
        <ToonMaterial color="#c7cecb" />
      </mesh>
      <mesh name="kettle-handle" position={[0.058, 0.145, 0]}>
        <torusGeometry args={[0.04, 0.009, 6, 16, Math.PI * 1.55]} />
        <ToonMaterial color="#46514e" />
      </mesh>
      {visualState === "connected-active" && hasOperatingPower(readings) && (
        <ApplianceSteam position={[-0.09, 0.23, 0]} reducedMotion={reducedMotion} />
      )}
      <StatusBeacon visualState={visualState} position={[0.073, 0.045, 0.087]} scale={0.22} />
    </group>
  );
}
