import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const DESKTOP_PC_TOWER_SIZE = [0.21, 0.44, 0.43] as const;

/** Generic compact tower, with its front facing +Z and feet on Y=0. */
export function DesktopPcTower({ size = DESKTOP_PC_TOWER_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="desktop-pc-tower"
      scale={[size[0] / 0.21, size[1] / 0.44, size[2] / 0.43]}
      userData={{ walkCollider: true }}
    >
      {[-0.075, 0.075].flatMap((x) =>
        [-0.15, 0.15].map((z) => (
          <RoundedFurniturePanel
            key={`${x}-${z}`}
            size={[0.035, 0.025, 0.055]}
            position={[x, 0.0125, z]}
            color="#32373b"
            radius={0.004}
            outline={false}
          />
        )),
      )}
      <RoundedFurniturePanel
        size={[0.21, 0.42, 0.42]}
        position={[0, 0.23, -0.005]}
        color="#41494d"
        outlineColor="#30373b"
        radius={0.012}
      />
      <RoundedFurniturePanel
        size={[0.184, 0.382, 0.012]}
        position={[0, 0.23, 0.207]}
        color="#343b40"
        radius={0.007}
        outline={false}
      />
      {[0.11, 0.13, 0.15, 0.17, 0.19].map((y) => (
        <RoundedFurniturePanel
          key={y}
          size={[0.12, 0.005, 0.003]}
          position={[0, y, 0.2135]}
          color="#252e33"
          radius={0.001}
          outline={false}
        />
      ))}
      <RoundedFurniturePanel
        size={[0.018, 0.018, 0.003]}
        position={[0.055, 0.385, 0.2135]}
        color="#a6b8b9"
        radius={0.006}
        outline={false}
      />
      {[-0.035, -0.005].map((x) => (
        <RoundedFurniturePanel
          key={x}
          size={[0.017, 0.007, 0.003]}
          position={[x, 0.385, 0.2135]}
          color="#202a30"
          radius={0.001}
          outline={false}
        />
      ))}
    </group>
  );
}
