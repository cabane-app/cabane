import { type SceneItemSize } from "@cabane/engine";
import { PanBody } from "./pan-body";
import { PanHandle } from "./pan-handle";

export const FRYING_PAN_SIZE = [0.46, 0.055, 0.28] as const;

/** Broad, shallow 28 cm skillet with sloped sides and an unobstructed interior. */
export function FryingPan({ size = FRYING_PAN_SIZE }: { size?: SceneItemSize }) {
  return (
    <group name="frying-pan" scale={[size[0] / 0.46, size[1] / 0.055, size[2] / 0.28]}>
      <group position={[-0.09, 0, 0]}>
        <PanBody radius={0.14} height={0.055} baseRadius={0.112} color="#505b56" />
      </group>
      <PanHandle start={0.035} end={0.23} height={0.04} />
    </group>
  );
}
