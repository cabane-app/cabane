import { Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { Vector2 } from "three";
import { connectedLightBulbFinish } from "./connected-light-finish";

export const HEARTH_TABLE_LAMP_SIZE = [0.15, 0.25, 0.15] as const;

const baseProfile = [
  [0, 0.003],
  [0.063, 0.003],
  [0.071, 0.008],
  [0.075, 0.014],
  [0.075, 0.036],
  [0.073, 0.041],
  [0.044, 0.06],
  [0.039, 0.065],
  [0.039, 0.083],
  [0.042, 0.085],
  [0.042, 0.089],
  [0, 0.089],
].map(([radius, height]) => new Vector2(radius, height));
const chimneyProfile = [
  [0.033, 0.092],
  [0.04, 0.096],
  [0.047, 0.107],
  [0.05, 0.12],
  [0.05, 0.192],
  [0.049, 0.204],
  [0.044, 0.216],
  [0.035, 0.227],
  [0.029, 0.237],
  [0.028, 0.248],
].map(([radius, height]) => new Vector2(radius, height));
const bulbProfile = [
  [0.009, 0.1],
  [0.014, 0.108],
  [0.017, 0.12],
  [0.016, 0.132],
  [0.012, 0.147],
  [0.006, 0.16],
  [0, 0.166],
].map(([radius, height]) => new Vector2(radius, height));

/** Surface-contact lantern with an open glass chimney and candle bulb. */
export function HearthTableLampModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightBulbFinish(visualState, state);
  return (
    <group name={`device-state-${visualState}`}>
      <mesh position={[0, 0.002, 0]}>
        <cylinderGeometry args={[0.064, 0.064, 0.004, 32]} />
        <ToonMaterial color="#37362f" />
      </mesh>
      <mesh name="hearth-base" castShadow>
        <latheGeometry args={[baseProfile, 32]} />
        <ToonMaterial color="#d6d0b9" />
        <Outlines color="#8c8878" thickness={0.0005} screenspace={false} />
      </mesh>
      <mesh position={[0, 0.091, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.004, 24]} />
        <ToonMaterial color="#aa9153" />
      </mesh>
      <mesh position={[0, 0.097, 0]}>
        <cylinderGeometry args={[0.011, 0.013, 0.009, 16]} />
        <ToonMaterial color="#b59a59" />
      </mesh>
      <group position={[0.044, 0.074, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.003, 0.003, 0.016, 12]} />
          <ToonMaterial color="#9f8145" />
        </mesh>
        <mesh position={[0, 0.009, 0]}>
          <cylinderGeometry args={[0.008, 0.009, 0.004, 20]} />
          <ToonMaterial color="#c0a361" />
        </mesh>
      </group>
      <mesh name="hearth-bulb">
        <latheGeometry args={[bulbProfile, 20]} />
        <ToonMaterial color="#edc180" transparent opacity={0.42} depthWrite={false} side={2} />
      </mesh>
      {[-0.004, 0.004].map((x) => (
        <mesh key={x} name="hearth-filament" position={[x, 0.126, 0]}>
          <cylinderGeometry args={[0.001, 0.001, 0.037, 6]} />
          <ToonMaterial
            color={finish.color}
            emissive="#ffc16b"
            emissiveIntensity={finish.emissiveIntensity}
          />
        </mesh>
      ))}
      <mesh name="hearth-chimney">
        <latheGeometry args={[chimneyProfile, 32]} />
        <ToonMaterial color="#e2e9df" transparent opacity={0.16} depthWrite={false} side={2} />
      </mesh>
      <mesh position={[0, 0.2485, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.028, 0.0015, 6, 32]} />
        <ToonMaterial color="#bbc4b6" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  );
}
