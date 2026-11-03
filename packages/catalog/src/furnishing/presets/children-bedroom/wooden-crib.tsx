import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const WOODEN_CRIB_SIZE = [0.76, 0.95, 1.46] as const;

/** Generic 70 × 140 cm cot with slatted oak sides and neutral bedding. */
export function WoodenCrib({
  size = WOODEN_CRIB_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  const sideSlats = [-0.56, -0.37, -0.18, 0.01, 0.2, 0.39, 0.58];
  return (
    <group
      name="wooden-crib"
      scale={[size[0] / 0.76, size[1] / 0.95, size[2] / 1.46]}
      userData={{ walkCollider: true }}
    >
      {[-0.34, 0.34].flatMap((x) =>
        [-0.7, 0.7].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.475, z]} castShadow>
            <boxGeometry args={[0.08, 0.95, 0.06]} />
            <ToonMaterial color="#c89f6d" />
          </mesh>
        )),
      )}
      {[-0.7, 0.7].map((z) => (
        <RoundedFurniturePanel
          key={z}
          name="crib-end"
          size={[0.6, 0.3, 0.06]}
          position={[0, 0.8, z]}
          color="#d4b17e"
          radius={0.015}
        />
      ))}
      {[-0.365, 0.365].flatMap((x) =>
        sideSlats.map((z) => (
          <mesh key={`${x}-${z}`} name="crib-side-slat" position={[x, 0.64, z]} castShadow>
            <boxGeometry args={[0.025, 0.48, 0.035]} />
            <ToonMaterial color="#c8a06e" />
          </mesh>
        )),
      )}
      {[-0.37, 0.37].map((x) => (
        <RoundedFurniturePanel
          key={x}
          name="crib-top-rail"
          size={[0.02, 0.07, 1.34]}
          position={[x, 0.91, 0]}
          color="#d0aa77"
          radius={0.009}
        />
      ))}
      <RoundedFurniturePanel
        name="crib-mattress-70x140"
        size={[0.7, 0.14, 1.4]}
        position={[0, 0.38, 0]}
        color="#f1ece0"
        radius={0.035}
        outlineColor="#aaa08c"
      />
      <RoundedFurniturePanel
        name="crib-blanket"
        size={[0.66, 0.035, 0.62]}
        position={[0, 0.468, 0.26]}
        color={color ?? "#d8d3bd"}
        radius={0.012}
        outlineColor="#a39d86"
      />
    </group>
  );
}
