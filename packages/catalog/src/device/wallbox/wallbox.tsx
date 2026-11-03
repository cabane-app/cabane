import { Outlines, RoundedBox, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps, SceneItemSize } from "@cabane/engine";
import { StatusBeacon } from "../visuals/device-visual-state";
import { ChargingCable } from "./charging-cable";

export const WALLBOX_SIZE: SceneItemSize = [0.3, 0.8, 0.2225];

export function WallboxModel({ visualState }: HomeDeviceModelProps) {
  const active = visualState === "connected-active";
  return (
    <group name="catalog-wallbox">
      <RoundedBox
        args={[0.24, 0.38, 0.035]}
        radius={0.008}
        smoothness={2}
        position={[0, 0.57, 0.0175]}
      >
        <ToonMaterial color="#526066" />
      </RoundedBox>
      <RoundedBox args={[0.3, 0.44, 0.13]} radius={0.035} smoothness={3} position={[0, 0.58, 0.09]}>
        <ToonMaterial color="#e1e5df" />
        <Outlines color="#8b9795" thickness={0.0015} screenspace={false} />
      </RoundedBox>
      <RoundedBox
        args={[0.2, 0.225, 0.018]}
        radius={0.025}
        smoothness={3}
        position={[0, 0.635, 0.155]}
      >
        <ToonMaterial color="#36474e" />
      </RoundedBox>
      <RoundedBox
        args={[0.105, 0.012, 0.006]}
        radius={0.003}
        smoothness={2}
        position={[0, 0.69, 0.167]}
      >
        <ToonMaterial
          color={active ? "#83c8af" : "#697e80"}
          emissive={active ? "#83c8af" : "#000000"}
          emissiveIntensity={active ? 0.2 : 0}
        />
      </RoundedBox>
      <StatusBeacon visualState={visualState} position={[0, 0.6, 0.168]} scale={0.12} />
      <ChargingCable />
    </group>
  );
}
