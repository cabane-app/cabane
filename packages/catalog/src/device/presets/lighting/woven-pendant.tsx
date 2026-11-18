import { lightBrightnessRatio, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { connectedLightFinish } from "./connected-light-finish";

import { lampProfile } from "./shade-frame";
import { PlaitedShade } from "./plaited-shade";

const crown = lampProfile([
  [0.025, -0.439],
  [0.031, -0.436],
  [0.029, -0.413],
  [0.049, -0.404],
  [0.066, -0.393],
  [0.069, -0.385],
  [0.065, -0.379],
  [0.043, -0.375],
  [0.022, -0.365],
  [0.015, -0.349],
  [0.004, -0.348],
]);
const hem = lampProfile([
  [0.415, -0.573],
  [0.419, -0.579],
  [0.423, -0.58],
  [0.429, -0.576],
  [0.43, -0.57],
  [0.425, -0.564],
  [0.415, -0.562],
  [0.411, -0.567],
  [0.415, -0.573],
]);

export function WovenPendantGeometry({ brightness = 0 }: { readonly brightness?: number }) {
  return (
    <group name="woven-pendant">
      <mesh castShadow position={[0, -0.013, 0]}>
        <cylinderGeometry args={[0.051, 0.039, 0.026, 24]} />
        <ToonMaterial color="#705a48" />
      </mesh>
      <mesh position={[0, -0.185, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.35, 10]} />
        <ToonMaterial color="#5b5147" />
      </mesh>
      <group scale={[0.847 / 0.86, 1, 1]}>
        <PlaitedShade hand={1} color="#c79868" />
        <PlaitedShade hand={-1} color="#b38659" />
        <mesh castShadow>
          <latheGeometry args={[hem, 36]} />
          <ToonMaterial color="#97734b" />
        </mesh>
      </group>
      <mesh castShadow>
        <latheGeometry args={[crown, 28]} />
        <ToonMaterial color="#9b7952" />
      </mesh>
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
