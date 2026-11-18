import { lightBrightnessRatio, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { StatusBeacon } from "../../visuals/device-visual-state";

import { lampProfile } from "./shade-frame";
import { spunSlip } from "./shade-finishes";

const shell = lampProfile([
  [0.311, 0.102],
  [0.304, 0.111],
  [0.296, 0.12],
  [0.259, 0.157],
  [0.21, 0.198],
  [0.155, 0.245],
  [0.111, 0.289],
  [0.081, 0.325],
  [0.067, 0.35],
  [0.06, 0.371],
  [0.046, 0.38],
  [0.032, 0.381],
]);
const oxideSkirt = lampProfile([
  [0.326, 0.056],
  [0.33, 0.062],
  [0.328, 0.075],
  [0.322, 0.087],
  [0.319, 0.092],
]);
const ochreBand = lampProfile([
  [0.319, 0.092],
  [0.316, 0.096],
  [0.311, 0.102],
]);
const lining = lampProfile([
  [0.032, 0.369],
  [0.052, 0.362],
  [0.06, 0.345],
  [0.073, 0.321],
  [0.101, 0.282],
  [0.146, 0.235],
  [0.201, 0.187],
  [0.251, 0.146],
  [0.288, 0.11],
  [0.309, 0.085],
  [0.317, 0.065],
  [0.317, 0.056],
]);
const lip = lampProfile([
  [0.317, 0.056],
  [0.317, 0.051],
  [0.32, 0.047],
  [0.324, 0.047],
  [0.327, 0.051],
  [0.326, 0.056],
]);
const canopy = lampProfile([
  [0.005, 0.568],
  [0.016, 0.571],
  [0.018, 0.584],
  [0.05, 0.594],
  [0.067, 0.606],
  [0.075, 0.625],
  [0.075, 0.637],
  [0.071, 0.64],
  [0, 0.64],
]);
const holder = lampProfile([
  [0.025, 0.111],
  [0.034, 0.12],
  [0.034, 0.145],
  [0.022, 0.157],
  [0.013, 0.165],
  [0.013, 0.364],
  [0.042, 0.37],
  [0.043, 0.381],
  [0.025, 0.393],
  [0.016, 0.41],
  [0.016, 0.417],
  [0.005, 0.418],
]);

const TERRACOTTA = "#ad5436";
const TERRACOTTA_LIGHT = "#c86a46";
const TERRACOTTA_DARK = "#6f321f";

const bulbColor = (visualState: HomeDeviceModelProps["visualState"]) => {
  switch (visualState) {
    case "connected-active":
      return { color: "#ffe8b9", emissive: "#e5a54d", intensity: 0.9 };
    case "unavailable":
      return { color: "#b28b69", emissive: "#4f3526", intensity: 0.18 };
    case "connected-inactive":
      return { color: "#b8ab92", emissive: "#000000", intensity: 0 };
    case "disconnected":
      return { color: "#c7b99e", emissive: "#000000", intensity: 0 };
  }
};

export function TerracottaPendantModel({ state, visualState }: HomeDeviceModelProps) {
  const bulb = bulbColor(visualState);
  const brightness = lightBrightnessRatio(state);

  return (
    <group name="catalog-terracotta-pendant">
      <mesh castShadow>
        <latheGeometry args={[canopy, 28]} />
        <ToonMaterial color={TERRACOTTA_DARK} />
      </mesh>
      <mesh position={[0, 0.494, 0]} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.17, 10]} />
        <ToonMaterial color="#574b44" />
      </mesh>
      <mesh castShadow>
        <latheGeometry args={[holder, 24]} />
        <ToonMaterial color="#766151" />
      </mesh>
      <mesh name="thrown-ceramic-shade" castShadow>
        <latheGeometry args={[shell, 40]} />
        <ToonMaterial color={TERRACOTTA} map={spunSlip} />
      </mesh>
      <mesh name="iron-oxide-skirt" castShadow>
        <latheGeometry args={[oxideSkirt, 40]} />
        <ToonMaterial color="#93442f" map={spunSlip} />
      </mesh>
      <mesh name="ochre-slip-band" castShadow>
        <latheGeometry args={[ochreBand, 40]} />
        <ToonMaterial color="#dcaa73" />
      </mesh>
      <mesh name="slip-glazed-interior">
        <latheGeometry args={[lining, 40]} />
        <ToonMaterial color="#efd4ad" />
      </mesh>
      <mesh name="painted-ceramic-hem" castShadow>
        <latheGeometry args={[lip, 40]} />
        <ToonMaterial color={TERRACOTTA_LIGHT} />
      </mesh>
      <mesh name="terracotta-pendant-emitter" position={[0, 0.065, 0]}>
        <sphereGeometry args={[0.065, 20, 14]} />
        <ToonMaterial
          color={bulb.color}
          emissive={bulb.emissive}
          emissiveIntensity={bulb.intensity * brightness}
        />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0.062, 0.616, 0]} scale={0.6} />
    </group>
  );
}
