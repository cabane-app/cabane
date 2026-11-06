import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const ACOUSTIC_SLAT_PANEL_SIZE = [0.6, 2.4, 0.055] as const;
export function AcousticSlatPanel({
  size = ACOUSTIC_SLAT_PANEL_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group name="acoustic-slat-panel" scale={[size[0] / 0.6, size[1] / 2.4, size[2] / 0.055]}>
      <RoundedFurniturePanel
        size={[0.6, 2.4, 0.015]}
        position={[0, 1.2, 0.0075]}
        color="#302f2b"
        radius={0.003}
        outline={false}
      />
      {Array.from({ length: 10 }, (_, i) => (
        <RoundedFurniturePanel
          key={i}
          size={[0.036, 2.4, 0.04]}
          position={[-0.27 + i * 0.06, 1.2, 0.035]}
          color={color ?? "#71543e"}
          radius={0.003}
          outline={false}
        />
      ))}
    </group>
  );
}
