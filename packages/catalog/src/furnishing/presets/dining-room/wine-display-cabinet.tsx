import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { DecorativeBottle } from "../construction/decorative-bottle";
export const WINE_DISPLAY_CABINET_SIZE = [1.6, 2.1, 0.45] as const;
export function WineDisplayCabinet({ size = WINE_DISPLAY_CABINET_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="wine-display-cabinet"
      scale={[size[0] / 1.6, size[1] / 2.1, size[2] / 0.45]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        size={[1.48, 0.1, 0.38]}
        position={[0, 0.05, 0]}
        color="#44372d"
        radius={0.01}
        outline={false}
      />
      <RoundedFurniturePanel
        size={[1.6, 0.62, 0.43]}
        position={[0, 0.41, -0.01]}
        color="#6e5038"
        radius={0.012}
      />
      {[-0.39, 0.39].map((x) => (
        <group key={x}>
          <RoundedFurniturePanel
            size={[0.765, 0.57, 0.025]}
            position={[x, 0.415, 0.1965]}
            color="#806044"
            radius={0.006}
          />
          <mesh position={[x + (x < 0 ? 0.27 : -0.27), 0.46, 0.213]}>
            <boxGeometry args={[0.015, 0.16, 0.008]} />
            <ToonMaterial color="#b79b65" />
          </mesh>
        </group>
      ))}
      <RoundedFurniturePanel
        size={[1.52, 1.34, 0.025]}
        position={[0, 1.39, -0.195]}
        color="#3a3930"
        radius={0.003}
        outline={false}
      />
      {[-0.775, 0.775].map((x) => (
        <RoundedFurniturePanel
          key={x}
          size={[0.05, 1.38, 0.45]}
          position={[x, 1.41, 0]}
          color="#71533b"
          radius={0.006}
        />
      ))}
      {[0.74, 1.16, 1.58, 2.075].map((y) => (
        <RoundedFurniturePanel
          key={y}
          size={[1.5, 0.05, 0.45]}
          position={[0, y, 0]}
          color="#806044"
          radius={0.006}
        />
      ))}
      {[0.765, 1.185, 1.605].flatMap((y, row) =>
        [-0.56, -0.34, -0.12, 0.12, 0.34, 0.56].map((x, i) => (
          <group key={`${x}:${y}`} position={[x, y, 0]}>
            <DecorativeBottle color={(i + row) % 3 === 0 ? "#6b3f32" : "#384b37"} />
          </group>
        )),
      )}
    </group>
  );
}
