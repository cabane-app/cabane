import { lightBrightnessRatio, Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { connectedLightFinish } from "./connected-light-finish";

function WovenTier({
  y,
  top,
  bottom,
  color,
}: {
  readonly y: number;
  readonly top: number;
  readonly bottom: number;
  readonly color: string;
}) {
  return (
    <mesh position={[0, y, 0]}>
      <cylinderGeometry args={[top, bottom, 0.12, 24, 1, true]} />
      <ToonMaterial color={color} transparent opacity={0.58} depthWrite={false} side={2} />
      <Outlines color="#6d4f34" thickness={0.005} screenspace={false} />
    </mesh>
  );
}

export function ChildrenPendantGeometry({
  color = "#b88958",
  brightness = 0.35,
}: {
  readonly color?: string;
  readonly brightness?: number;
}) {
  return (
    <group name="suspension-rotin-etagee-chambre-enfant">
      <mesh position={[0, -0.075, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.15, 10]} />
        <ToonMaterial color="#796955" />
      </mesh>
      <mesh position={[0, -0.145, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 0.055, 20]} />
        <ToonMaterial color="#76533a" />
      </mesh>
      <WovenTier y={-0.2} top={0.14} bottom={0.23} color={color} />
      <WovenTier y={-0.305} top={0.22} bottom={0.29} color={color} />
      <WovenTier y={-0.41} top={0.27} bottom={0.21} color={color} />
      <mesh position={[0, -0.47, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.21, 0.01, 6, 24]} />
        <ToonMaterial color="#795638" />
      </mesh>
      <mesh position={[0, -0.37, 0]}>
        <sphereGeometry args={[0.052, 18, 12]} />
        <ToonMaterial color="#f1d59b" emissive="#d49b48" emissiveIntensity={brightness} />
      </mesh>
    </group>
  );
}

export function ChildrenPendantModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightFinish(visualState);
  return (
    <group name={`device-state-${visualState}`}>
      <ChildrenPendantGeometry
        brightness={finish.emissiveIntensity * lightBrightnessRatio(state)}
      />
    </group>
  );
}
