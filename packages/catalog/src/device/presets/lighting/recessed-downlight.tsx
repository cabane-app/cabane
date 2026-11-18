import { ToonMaterial, lightBrightnessRatio } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { Float32BufferAttribute } from "three";
import { StatusBeacon } from "../../visuals/device-visual-state";
import { connectedLightFinish } from "./connected-light-finish";
import { turnedProfile } from "../../visuals/turned-profile";

const trim = turnedProfile(
  [
    [0.0365, 0.003],
    [0.039, 0],
    [0.048, 0],
    [0.05, 0.002],
    [0.05, 0.006],
    [0.044, 0.008],
    [0.042, 0.04],
    [0.033, 0.04],
    [0.0365, 0.003],
  ],
  24,
);
const reflector = turnedProfile(
  [
    [0.02, 0.029],
    [0.024, 0.025],
    [0.025, 0.022],
    [0.029, 0.019],
    [0.03, 0.016],
    [0.037, 0.005],
    [0.038, 0.002],
  ],
  24,
);
// The stepped reflector has spun silver lands and darker concentric grooves.
const ribs = reflector.getAttribute("position");
const silver: number[] = [];
for (let i = 0; i < ribs.count; i++) {
  const y = ribs.getY(i);
  const tone = (y > 0.021 && y < 0.024) || (y > 0.015 && y < 0.018) ? 0.53 : 0.9;
  silver.push(tone, tone * 0.98, tone * 0.91);
}
reflector.setAttribute("color", new Float32BufferAttribute(silver, 3));
const lens = turnedProfile(
  [
    [0, 0.023],
    [0.014, 0.0235],
    [0.022, 0.026],
    [0.022, 0.029],
  ],
  24,
);

export function RecessedDownlightModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightFinish(visualState);
  return (
    <group name="catalog-recessed-downlight">
      <mesh name="downlight-trim" geometry={trim} castShadow>
        <ToonMaterial color="#dfdfd7" />
      </mesh>
      <mesh name="downlight-baffle" geometry={reflector}>
        <ToonMaterial color="#9daba8" vertexColors />
      </mesh>
      <mesh name="downlight-optic" geometry={lens}>
        <ToonMaterial
          color={finish.color}
          emissive="#f2c66d"
          emissiveIntensity={finish.emissiveIntensity * lightBrightnessRatio(state)}
        />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0.043, 0.0016, 0]} scale={0.1} />
    </group>
  );
}
