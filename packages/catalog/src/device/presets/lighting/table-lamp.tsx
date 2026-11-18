import { lightBrightnessRatio, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { connectedLightFinish } from "./connected-light-finish";

import { lampProfile, ShadeFrame } from "./shade-frame";
import { linenWeaveTexture } from "../../../furnishing/presets/construction/linen-weave-texture";

const shadeLinen = linenWeaveTexture.clone();
shadeLinen.repeat.set(4, 1);
shadeLinen.needsUpdate = true;

const foot = lampProfile([
  [0, 0],
  [0.079, 0],
  [0.086, 0.003],
  [0.09, 0.012],
  [0.094, 0.015],
]);
const base = lampProfile([
  [0.094, 0.015],
  [0.098, 0.018],
  [0.112, 0.033],
  [0.12, 0.055],
  [0.119, 0.081],
  [0.109, 0.105],
  [0.089, 0.129],
  [0.059, 0.148],
  [0.047, 0.16],
  [0.046, 0.18],
  [0.041, 0.185],
  [0.024, 0.185],
]);
const stem = lampProfile([
  [0.021, 0.172],
  [0.027, 0.18],
  [0.028, 0.187],
  [0.023, 0.192],
  [0.011, 0.196],
  [0.011, 0.315],
  [0.017, 0.323],
  [0.025, 0.328],
  [0.027, 0.336],
  [0.027, 0.354],
  [0.021, 0.361],
  [0.015, 0.361],
]);
const shade = lampProfile([
  [0.151, 0.263],
  [0.155, 0.26],
  [0.159, 0.261],
  [0.16, 0.266],
  [0.159, 0.277],
  [0.156, 0.293],
  [0.131, 0.461],
  [0.122, 0.507],
  [0.12, 0.516],
]);
const binding = lampProfile([
  [0.12, 0.512],
  [0.122, 0.515],
  [0.122, 0.517],
  [0.12, 0.52],
  [0.116, 0.52],
  [0.114, 0.517],
  [0.115, 0.514],
  [0.12, 0.512],
]);
const harp = lampProfile([
  [0.017, 0.332],
  [0.068, 0.354],
  [0.097, 0.427],
  [0.116, 0.517],
]);

export const TABLE_LAMP_SIZE = [0.32, 0.52, 0.32] as const;

export function TableLampModel({
  state,
  visualState,
}: Pick<HomeDeviceModelProps, "state" | "visualState">) {
  const finish = connectedLightFinish(visualState);
  return (
    <group name={`device-state-${visualState}`}>
      <mesh name="stoneware-foot" castShadow>
        <latheGeometry args={[foot, 32]} />
        <ToonMaterial color="#b18b66" />
      </mesh>
      <mesh name="table-lamp-base" castShadow>
        <latheGeometry args={[base, 32]} />
        <ToonMaterial color="#ded7c8" />
      </mesh>
      <mesh name="table-lamp-neck" castShadow>
        <latheGeometry args={[stem, 24]} />
        <ToonMaterial color="#978365" />
      </mesh>
      <ShadeFrame name="table-lamp-harp" path={harp} gauge={0.0025} color="#9c8971" />
      <mesh name="table-lamp-shade" castShadow>
        <latheGeometry args={[shade, 32]} />
        <ToonMaterial
          color={finish.color}
          map={shadeLinen}
          emissive="#f2c66d"
          emissiveIntensity={finish.emissiveIntensity * 0.45 * lightBrightnessRatio(state)}
          side={2}
        />
      </mesh>
      <mesh name="table-lamp-shade-top" castShadow>
        <latheGeometry args={[binding, 32]} />
        <ToonMaterial color={finish.color} />
      </mesh>
      <mesh name="table-lamp-bulb" position={[0, 0.393, 0]} scale={[1, 1.35, 1]}>
        <sphereGeometry args={[0.032, 16, 12]} />
        <ToonMaterial
          color="#eaddc8"
          emissive="#f2c66d"
          emissiveIntensity={finish.emissiveIntensity * lightBrightnessRatio(state)}
        />
      </mesh>
    </group>
  );
}
