import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const UPHOLSTERED_BED_BENCH_SIZE = [1.5, 0.46, 0.45] as const;
export function UpholsteredBedBench({
  size = UPHOLSTERED_BED_BENCH_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="upholstered-bed-bench"
      scale={[size[0] / 1.5, size[1] / 0.46, size[2] / 0.45]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        size={[1.5, 0.16, 0.45]}
        position={[0, 0.38, 0]}
        color={color ?? "#d6ccb8"}
        radius={0.065}
      />
      <RoundedFurniturePanel
        size={[1.36, 0.06, 0.36]}
        position={[0, 0.27, 0]}
        color="#71543b"
        radius={0.012}
      />
      {[-0.59, 0.59].flatMap((x) =>
        [-0.15, 0.15].map((z) => (
          <mesh key={`${x}:${z}`} position={[x, 0.12, z]} castShadow>
            <cylinderGeometry args={[0.032, 0.025, 0.24, 12]} />
            <ToonMaterial color="#71543b" />
          </mesh>
        )),
      )}
      {[-0.48, 0, 0.48].map((x) => (
        <RoundedFurniturePanel
          key={x}
          size={[0.004, 0.015, 0.31]}
          position={[x, 0.451, 0]}
          color="#b9ad98"
          radius={0.001}
          outline={false}
        />
      ))}
    </group>
  );
}
