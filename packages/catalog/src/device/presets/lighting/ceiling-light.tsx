import { Outlines, ToonMaterial, lightBrightnessRatio } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { palette, StatusBeacon } from "../../visuals/device-visual-state";
import { connectedLightFinish } from "./connected-light-finish";

export function CeilingLightModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightFinish(visualState);
  return (
    <group name="catalog-ceiling-light">
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.08, 24]} />
        <ToonMaterial color="#a8aaa4" />
        <Outlines color={palette.charcoal} thickness={0.004} />
      </mesh>
      <mesh name="ceiling-light-diffuser" position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.18, 0.19, 0.08, 24]} />
        <ToonMaterial
          color={finish.color}
          emissive="#f2c66d"
          emissiveIntensity={finish.emissiveIntensity * lightBrightnessRatio(state)}
        />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0.13, 0.075, 0]} scale={0.3} />
    </group>
  );
}
