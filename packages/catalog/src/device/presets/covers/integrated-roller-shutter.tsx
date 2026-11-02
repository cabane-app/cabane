import { coverPosition, Outlines, RoundedBox, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { RollerShutterSlats } from "./roller-shutter-slats";

export const INTEGRATED_ROLLER_SHUTTER_SIZE = [1.2, 1.6, 0.04] as const;

/** The roll is concealed in the wall; only its exit strip is visible. */
export function IntegratedRollerShutterModel({
  state,
  visualState,
  reducedMotion,
}: HomeDeviceModelProps) {
  const position =
    visualState === "disconnected" || visualState === "unavailable" ? null : coverPosition(state);
  return (
    <group name="catalog-integrated-roller-shutter">
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          name={`shutter-guide-${side}`}
          args={[0.025, 1.6, 0.04]}
          position={[side * 0.5875, 0.8, 0.02]}
          radius={0.002}
          smoothness={1}
          bevelSegments={1}
          castShadow
          receiveShadow
        >
          <ToonMaterial color="#deded7" />
          <Outlines color="#92958c" thickness={0.0015} screenspace={false} />
        </RoundedBox>
      ))}
      <RollerShutterSlats position={position} reducedMotion={reducedMotion} />
      <RoundedBox
        name="shutter-exit-strip"
        args={[1.15, 0.06, 0.04]}
        position={[0, 1.57, 0.02]}
        radius={0.002}
        smoothness={1}
        bevelSegments={1}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#e7e7e0" />
        <Outlines color="#92958c" thickness={0.0015} screenspace={false} />
      </RoundedBox>
    </group>
  );
}
