import { lightBrightnessRatio, Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { StatusBeacon } from "../../visuals/device-visual-state";

const shadeColor = (visualState: HomeDeviceModelProps["visualState"]) => {
  switch (visualState) {
    case "connected-active":
      return "#f2cf72";
    case "connected-inactive":
      return "#a99666";
    case "unavailable":
      return "#b28b69";
    case "disconnected":
      return "#e2c685";
  }
};

export function FloorLampModel({ state, visualState }: HomeDeviceModelProps) {
  const brightness = lightBrightnessRatio(state);
  return (
    <group name="catalog-floor-lamp">
      <mesh position={[0, 0.035, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.23, 0.07, 16]} />
        <ToonMaterial color="#596660" />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 1.5, 10]} />
        <ToonMaterial color="#596660" />
      </mesh>
      <mesh name="floor-lamp-emitter" position={[0, 1.55, 0]} castShadow>
        <coneGeometry args={[0.32, 0.48, 16, 1, true]} />
        <ToonMaterial
          color={shadeColor(visualState)}
          emissive="#e6a94d"
          emissiveIntensity={brightness * 0.65}
          side={2}
        />
        <Outlines color="#7a6844" thickness={0.006} />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0.16, 0.08, 0]} scale={0.8} />
    </group>
  );
}
