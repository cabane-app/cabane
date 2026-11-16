import { ToonMaterial, Outlines, type SceneItemSize } from "@cabane/engine";
import { Vector2 } from "three";
export const RING_CERAMIC_VASE_SIZE = [0.18, 0.3, 0.06] as const;
const neck = [
  [0.018, 0.169],
  [0.022, 0.179],
  [0.016, 0.197],
  [0.015, 0.209],
  [0.017, 0.211],
  [0.017, 0.214],
  [0.012, 0.215],
  [0.011, 0.21],
  [0.011, 0.192],
].map(([r, y]) => new Vector2(r, y));
const foot = [
  [0, 0],
  [0.043, 0],
  [0.047, 0.004],
  [0.048, 0.011],
  [0.041, 0.019],
  [0.036, 0.027],
  [0, 0.029],
].map(([r, y]) => new Vector2(r, y));
export function RingCeramicVase({ size = RING_CERAMIC_VASE_SIZE }: { size?: SceneItemSize }) {
  return (
    <group name="ring-ceramic-vase" scale={[size[0] / 0.18, size[1] / 0.3, size[2] / 0.06]}>
      <mesh scale={[1, 1, 0.62]} castShadow>
        <latheGeometry args={[foot, 32]} />
        <ToonMaterial color="#e3e1d3" />
      </mesh>
      <mesh position={[0, 0.102, 0]} scale={[1, 1.02, 1]} castShadow>
        <torusGeometry args={[0.06, 0.03, 16, 40]} />
        <ToonMaterial color="#eeeee3" />
        <Outlines color="#c4c3b6" thickness={0.0007} screenspace={false} />
      </mesh>
      <mesh castShadow>
        <latheGeometry args={[neck, 28]} />
        <ToonMaterial color="#eeeee3" />
      </mesh>
      {[-1, 0, 1].map((s) => (
        <group key={s} position={[s * 0.004, 0.205, 0]} rotation={[s * 0.07, 0, -s * 0.32]}>
          <mesh position={[0, 0.043, 0]}>
            <cylinderGeometry args={[0.001, 0.00135, 0.086, 6]} />
            <ToonMaterial color="#a99773" />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh
              key={k}
              position={[k % 2 ? 0.003 : -0.0025, 0.069 + k * 0.009, 0]}
              rotation={[0, 0, k % 2 ? -0.42 : 0.37]}
              scale={[0.003, 0.0075, 0.0025]}
            >
              <sphereGeometry args={[1, 8, 6]} />
              <ToonMaterial color={s ? "#bdad8d" : "#c6b89c"} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
