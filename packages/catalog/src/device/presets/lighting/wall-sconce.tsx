import { RoundedBox } from "@cabane/engine";
import { Outlines, ToonMaterial, lightBrightnessRatio } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { palette, StatusBeacon } from "../../visuals/device-visual-state";
import { connectedLightFinish } from "./connected-light-finish";

export function WallSconceModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightFinish(visualState);
  return (
    <group name="catalog-wall-sconce">
      <mesh position={[0, 0.16, 0.0125]} castShadow>
        <boxGeometry args={[0.12, 0.32, 0.025]} />
        <ToonMaterial color="#8b928e" />
        <Outlines color={palette.charcoal} thickness={0.003} />
      </mesh>
      <mesh position={[0, 0.16, 0.0475]}>
        <boxGeometry args={[0.035, 0.035, 0.07]} />
        <ToonMaterial color="#737d78" />
      </mesh>
      <RoundedBox
        args={[0.22, 0.22, 0.135]}
        radius={0.035}
        smoothness={2}
        position={[0, 0.17, 0.0925]}
      >
        <ToonMaterial
          color={finish.color}
          emissive="#f2c66d"
          emissiveIntensity={finish.emissiveIntensity * lightBrightnessRatio(state)}
          transparent
          opacity={0.94}
        />
        <Outlines color="#8b7e64" thickness={0.004} />
      </RoundedBox>
      <StatusBeacon visualState={visualState} position={[0.04, 0.035, 0.023]} scale={0.2} />
    </group>
  );
}
