import { lightBrightnessRatio, Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { connectedLightFinish } from "./connected-light-finish";

export function WovenPendantGeometry({ brightness = 0 }: { readonly brightness?: number }) {
  return (
    <group name="woven-pendant">
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.4, 8]} />
        <ToonMaterial color="#5b5147" />
      </mesh>
      <mesh position={[0, -0.48, 0]}>
        <cylinderGeometry args={[0.1, 0.43, 0.2, 18, 1, true]} />
        <ToonMaterial color="#b4895d" transparent opacity={0.82} />
        <Outlines color="#6e5139" thickness={0.005} />
      </mesh>
      {[-0.39, -0.45, -0.51, -0.57].map((y, index) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13 + index * 0.075, 0.009, 6, 18]} />
          <ToonMaterial color="#7d5b3e" />
        </mesh>
      ))}
      <mesh position={[0, -0.47, 0]}>
        <sphereGeometry args={[0.055, 12, 8]} />
        <ToonMaterial color="#f2d69a" emissive="#d49b48" emissiveIntensity={brightness} />
      </mesh>
    </group>
  );
}

export function WovenPendantModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightFinish(visualState);
  return (
    <group name={`device-state-${visualState}`}>
      <WovenPendantGeometry brightness={finish.emissiveIntensity * lightBrightnessRatio(state)} />
    </group>
  );
}
