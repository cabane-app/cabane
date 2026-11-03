import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const ENTRYWAY_SHOE_BENCH_SIZE = [1, 0.5, 0.38] as const;

/** Padded entry bench with slatted shoe storage below. */
export function EntrywayShoeBench({
  size = ENTRYWAY_SHOE_BENCH_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="entryway-shoe-bench"
      scale={[size[0], size[1] / 0.5, size[2] / 0.38]}
      userData={{ walkCollider: true }}
    >
      {[-0.44, 0.44].flatMap((x) =>
        [-0.15, 0.15].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.19, z]} castShadow>
            <boxGeometry args={[0.055, 0.38, 0.055]} />
            <ToonMaterial color="#b88f5e" />
          </mesh>
        )),
      )}
      {[-0.13, -0.065, 0, 0.065, 0.13].map((z) => (
        <RoundedFurniturePanel
          key={z}
          name="shoe-bench-slat"
          size={[0.86, 0.028, 0.035]}
          position={[0, 0.12, z]}
          color="#cda775"
          radius={0.005}
        />
      ))}
      <RoundedFurniturePanel
        name="shoe-bench-seat"
        size={[1, 0.12, 0.38]}
        position={[0, 0.44, 0]}
        color={color ?? "#d8cbb5"}
        radius={0.035}
      />
    </group>
  );
}
