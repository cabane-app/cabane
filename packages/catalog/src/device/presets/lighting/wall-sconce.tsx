import { ToonMaterial, lightBrightnessRatio } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { StatusBeacon } from "../../visuals/device-visual-state";
import { connectedLightFinish } from "./connected-light-finish";
import { turnedProfile } from "../../visuals/turned-profile";

const plate = new RoundedBoxGeometry(0.115, 0.32, 0.022, 1, 0.009).translate(0, 0.16, 0.011);
const arm = new RoundedBoxGeometry(0.039, 0.034, 0.076, 1, 0.005).translate(0, 0.083, 0.055);
const cup = turnedProfile(
  [
    [0, 0.074],
    [0.03, 0.074],
    [0.047, 0.081],
    [0.05, 0.094],
    [0.045, 0.099],
    [0, 0.099],
  ],
  24,
)
  .scale(1, 1, 0.64)
  .translate(0, 0, 0.09);
// Outside, rolled lip and inner wall are a single open-topped opal shade.
const shade = turnedProfile(
  [
    [0.041, 0.087],
    [0.059, 0.103],
    [0.085, 0.145],
    [0.106, 0.217],
    [0.11, 0.259],
    [0.109, 0.266],
    [0.105, 0.268],
    [0.101, 0.264],
    [0.101, 0.25],
    [0.097, 0.219],
    [0.076, 0.15],
    [0.051, 0.108],
    [0, 0.098],
  ],
  96,
);
// Shallow scallops catch the light vertically, fading out into the smooth rolled lip.
const opal = shade.getAttribute("position");
for (let i = 0; i < opal.count; i++) {
  const x = opal.getX(i),
    y = opal.getY(i),
    z = opal.getZ(i);
  const envelope = Math.max(0, Math.min(1, (y - 0.095) / 0.035, (0.259 - y) / 0.024));
  const factor = 1 - 0.032 * envelope * (1 + Math.cos(16 * Math.atan2(x, z)));
  opal.setXYZ(i, x * factor, y, z * factor);
}
shade.computeVertexNormals();
shade.scale(1, 1, 0.62).translate(0, 0, 0.0918);

export function WallSconceModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightFinish(visualState);
  return (
    <group name="catalog-wall-sconce">
      <mesh name="sconce-backplate" geometry={plate} castShadow>
        <ToonMaterial color="#8a928b" />
      </mesh>
      <mesh geometry={arm} castShadow>
        <ToonMaterial color="#6c7972" />
      </mesh>
      <mesh name="sconce-lamp-cup" geometry={cup} castShadow>
        <ToonMaterial color="#ae9472" />
      </mesh>
      <mesh name="sconce-opal-shade" geometry={shade} castShadow>
        <ToonMaterial
          color={finish.color}
          emissive="#f2c66d"
          emissiveIntensity={finish.emissiveIntensity * lightBrightnessRatio(state)}
        />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0.038, 0.035, 0.022]} scale={0.2} />
    </group>
  );
}
