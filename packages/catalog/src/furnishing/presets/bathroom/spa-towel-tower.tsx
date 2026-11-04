import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const SPA_TOWEL_TOWER_SIZE = [0.6, 1.6, 0.4] as const;
export function SpaTowelTower({
  size = SPA_TOWEL_TOWER_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="spa-towel-tower"
      scale={[size[0] / 0.6, size[1] / 1.6, size[2] / 0.4]}
      userData={{ walkCollider: true }}
    >
      {[-0.275, 0.275].flatMap((x) =>
        [-0.175, 0.175].map((z) => (
          <RoundedFurniturePanel
            key={`${x}:${z}`}
            size={[0.05, 1.6, 0.05]}
            position={[x, 0.8, z]}
            color="#806347"
            radius={0.006}
            outline={false}
          />
        )),
      )}
      {[0.1, 0.56, 1.02, 1.56].map((y) => (
        <RoundedFurniturePanel
          key={y}
          size={[0.56, 0.04, 0.36]}
          position={[0, y, 0]}
          color="#8a6b4b"
          radius={0.006}
        />
      ))}
      <RoundedFurniturePanel
        size={[0.44, 0.3, 0.3]}
        position={[0, 0.27, 0]}
        color="#bca986"
        radius={0.025}
        outlineColor="#99866a"
      />
      {[0.64, 1.1].flatMap((y) =>
        [-0.16, 0, 0.16].map((x) => (
          <group key={`${x}:${y}`} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.28, 16]} />
              <ToonMaterial color={color ?? "#e4ded0"} />
            </mesh>
            <mesh position={[0, 0.141, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.032, 0.035, 16]} />
              <ToonMaterial color="#c6bda9" />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}
