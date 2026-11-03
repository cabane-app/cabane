import { type SceneItemSize } from "@cabane/engine";
import { PanBody } from "./pan-body";
import { PanHandle } from "./pan-handle";

export const SAUCEPAN_SIZE = [0.36, 0.115, 0.2] as const;

/** Generic 20 cm open saucepan; the full footprint includes its long handle. */
export function Saucepan({ size = SAUCEPAN_SIZE }: { size?: SceneItemSize }) {
  return (
    <group name="saucepan" scale={[size[0] / 0.36, size[1] / 0.115, size[2] / 0.2]}>
      <group position={[-0.08, 0, 0]}>
        <PanBody radius={0.1} height={0.115} baseRadius={0.09} color="#a8b0a9" />
      </group>
      <PanHandle start={0.015} end={0.18} height={0.086} />
    </group>
  );
}
