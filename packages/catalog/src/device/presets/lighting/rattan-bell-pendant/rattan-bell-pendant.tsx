import { useEffect, useMemo } from "react";
import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { lampProfile, ShadeFrame } from "../shade-frame";
import { RATTAN_BELL_BULB_POSITION } from "./bulb-position";
import { createWovenBellGeometry } from "./woven-bell-geometry";

const rose = lampProfile([
  [0.0025, 1.157],
  [0.014, 1.158],
  [0.016, 1.164],
  [0.015, 1.17],
  [0.04, 1.175],
  [0.051, 1.182],
  [0.055, 1.19],
  [0.055, 1.198],
  [0.052, 1.2],
  [0, 1.2],
]);
const ferrule = lampProfile([
  [0.005, 0.445],
  [0.013, 0.446],
  [0.014, 0.452],
  [0.011, 0.463],
  [0.009, 0.476],
  [0.006, 0.483],
]);
const support = lampProfile([
  [0.005, 0.455],
  [0.017, 0.457],
  [0.026, 0.466],
  [0.037, 0.473],
]);

export const RATTAN_BELL_PENDANT_SIZE = [0.5, 1.2, 0.5] as const;
const CANE_COLORS = ["#b28a58", "#d4ae79", "#c79a64", "#92704e"] as const;

export function RattanBellPendant({
  size = RATTAN_BELL_PENDANT_SIZE,
  brightness = 0,
}: {
  size?: SceneItemSize;
  brightness?: number;
}) {
  const weave = useMemo(createWovenBellGeometry, []);
  useEffect(() => () => weave.forEach((geometry) => geometry.dispose()), [weave]);
  return (
    <group name="rattan-bell-pendant" scale={[size[0] / 0.5, size[1] / 1.2, size[2] / 0.5]}>
      {weave.map((geometry, index) => (
        <mesh key={index} name="open-rattan-weave" geometry={geometry} castShadow receiveShadow>
          <ToonMaterial color={CANE_COLORS[index]} />
        </mesh>
      ))}
      <mesh name="white-ceiling-rose" castShadow>
        <latheGeometry args={[rose, 28]} />
        <ToonMaterial color="#eeeae2" />
      </mesh>
      <mesh name="white-pendant-cord" position={[0, 0.7375, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.875, 8]} />
        <ToonMaterial color="#e5e0d6" />
      </mesh>
      <mesh name="bulb-socket" position={[0, 0.285, 0]}>
        <cylinderGeometry args={[0.018, 0.021, 0.07, 16]} />
        <ToonMaterial color="#e5e0d6" />
      </mesh>
      <mesh name="opal-bulb" position={RATTAN_BELL_BULB_POSITION} scale={[1, 1.25, 1]}>
        <sphereGeometry args={[0.034, 20, 12]} />
        <ToonMaterial color="#f4ead4" emissive="#ffe1a3" emissiveIntensity={brightness} />
      </mesh>
      <mesh name="cane-neck-ferrule" castShadow>
        <latheGeometry args={[ferrule, 20]} />
        <ToonMaterial color="#ad9067" />
      </mesh>
      <ShadeFrame name="shade-support-spoke" path={support} gauge={0.0023} color="#c7b899" />
    </group>
  );
}
