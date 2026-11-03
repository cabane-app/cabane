import { coverPosition, Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { StatusBeacon } from "../../visuals/device-visual-state";
import { BlindFabric } from "./blind-fabric";

export const MOTORIZED_BLIND_SIZE = [1.2, 1.6, 0.12] as const;

export function MotorizedBlindModel({
  state,
  visualState,
  reducedMotion,
  color,
}: HomeDeviceModelProps) {
  const position =
    visualState === "disconnected" || visualState === "unavailable" ? null : coverPosition(state);
  return (
    <group name="catalog-motorized-blind">
      <mesh name="blind-headbox" position={[0, 1.54, 0.09]} castShadow receiveShadow>
        <boxGeometry args={[1.156, 0.12, 0.06]} />
        <ToonMaterial color="#e7e5dc" />
        <Outlines color="#59605a" thickness={0.0015} screenspace={false} />
      </mesh>
      {[-0.59, 0.59].map((x) => (
        <mesh key={x} position={[x, 1.54, 0.09]} castShadow>
          <boxGeometry args={[0.02, 0.112, 0.058]} />
          <ToonMaterial color="#bac0b7" />
        </mesh>
      ))}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 1.54, 0.035]} castShadow>
          <boxGeometry args={[0.05, 0.07, 0.07]} />
          <ToonMaterial color="#bac0b7" />
        </mesh>
      ))}
      <BlindFabric position={position} reducedMotion={reducedMotion} color={color} />
      <StatusBeacon visualState={visualState} position={[0.52, 1.54, 0.106]} scale={0.4} />
    </group>
  );
}
