import { lightBrightnessRatio, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { connectedLightFinish } from "./connected-light-finish";

import { lampProfile, ShadeFrame } from "./shade-frame";
import { ScallopedRushHem } from "./scalloped-rush-hem";
import { splitCane } from "./shade-finishes";

// Three rush hems step over one another like overlapping petals.
const tiers = [
  lampProfile([
    [0.228, -0.263],
    [0.234, -0.259],
    [0.235, -0.253],
    [0.216, -0.228],
    [0.166, -0.19],
    [0.1, -0.164],
    [0.052, -0.157],
  ]),
  lampProfile([
    [0.284, -0.367],
    [0.29, -0.361],
    [0.288, -0.348],
    [0.273, -0.316],
    [0.248, -0.284],
    [0.222, -0.263],
    [0.214, -0.257],
  ]),
];
const spine = lampProfile([
  [0.03, -0.153],
  [0.119, -0.178],
  [0.213, -0.253],
  [0.274, -0.36],
  [0.262, -0.405],
]);
const socket = lampProfile([
  [0.023, -0.332],
  [0.032, -0.328],
  [0.032, -0.308],
  [0.021, -0.302],
  [0.017, -0.17],
  [0.052, -0.165],
  [0.055, -0.156],
  [0.035, -0.144],
  [0.014, -0.132],
  [0.004, -0.123],
]);

export function ChildrenPendantGeometry({
  color = "#b88958",
  brightness = 0.35,
}: {
  readonly color?: string;
  readonly brightness?: number;
}) {
  return (
    <group name="suspension-rotin-etagee-chambre-enfant">
      <mesh position={[0, -0.009, 0]} castShadow>
        <cylinderGeometry args={[0.043, 0.035, 0.018, 24]} />
        <ToonMaterial color="#d6c4a4" />
      </mesh>
      <mesh position={[0, -0.072, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.13, 10]} />
        <ToonMaterial color="#796955" />
      </mesh>
      <mesh castShadow>
        <latheGeometry args={[socket, 20]} />
        <ToonMaterial color="#926f48" />
      </mesh>
      <ShadeFrame path={spine} gauge={0.0035} color="#806142" />
      {tiers.map((profile, i) => (
        <mesh name={`woven-tier-${i + 1}`} key={i} castShadow>
          <latheGeometry args={[profile, 32]} />
          <ToonMaterial color={color} map={splitCane} side={2} />
        </mesh>
      ))}
      <ScallopedRushHem color={color} />
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
