import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { Vector2 } from "three";
export const TABLETOP_CANDLE_SIZE = [0.12, 0.18, 0.12] as const;
// The lip rolls inward onto the lower melt well; the wick rises from its center.
const wax = [
  [0, 0],
  [0.054, 0],
  [0.059, 0.003],
  [0.06, 0.009],
  [0.06, 0.149],
  [0.059, 0.16],
  [0.056, 0.168],
  [0.052, 0.17],
  [0.047, 0.166],
  [0.039, 0.157],
  [0.023, 0.152],
  [0, 0.151],
].map(([r, y]) => new Vector2(r, y));
export function TabletopCandle({
  size = TABLETOP_CANDLE_SIZE,
  variant = "ivory",
}: {
  size?: SceneItemSize;
  variant?: string;
}) {
  const clay = variant === "clay";
  return (
    <group scale={[size[0] / 0.12, size[1] / 0.18, size[2] / 0.12]}>
      <mesh name="melted-wax-pillar" castShadow receiveShadow>
        <latheGeometry args={[wax, 32]} />
        <ToonMaterial color={clay ? "#bc8168" : "#eee1c7"} />
        <Outlines color={clay ? "#92604f" : "#c3b397"} thickness={0.00065} screenspace={false} />
      </mesh>
      <mesh name="wax-pool" position={[0, 0.152, 0]} scale={[1, 0.065, 1]}>
        <sphereGeometry args={[0.027, 24, 8]} />
        <ToonMaterial color={clay ? "#c99780" : "#e2d2af"} />
      </mesh>
      <mesh name="unlit-wick" rotation={[0, 0, -0.14]} position={[0, 0.166, 0]}>
        <cylinderGeometry args={[0.0016, 0.0024, 0.028, 8]} />
        <ToonMaterial color="#514638" />
      </mesh>
    </group>
  );
}
