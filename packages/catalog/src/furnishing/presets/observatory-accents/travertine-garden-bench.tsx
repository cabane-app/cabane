import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction/rounded-furniture-panel";

export const TRAVERTINE_GARDEN_BENCH_SIZE = [1.8, 0.45, 0.5] as const;

export function TravertineGardenBench({
  size = TRAVERTINE_GARDEN_BENCH_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="travertine-garden-bench"
      scale={[size[0] / 1.8, size[1] / 0.45, size[2] / 0.5]}
      userData={{ walkCollider: true }}
    >
      {[-0.62, 0.62].map((x) => (
        <RoundedFurniturePanel
          key={x}
          name="stone-pier"
          size={[0.18, 0.35, 0.4]}
          position={[x, 0.175, 0]}
          radius={0.008}
          color="#b9ad96"
          outline={false}
        />
      ))}
      <RoundedFurniturePanel
        name="honed-seat"
        size={[1.8, 0.1, 0.5]}
        position={[0, 0.4, 0]}
        radius={0.018}
        color="#d0c4ae"
        outlineColor="#a69b86"
      />
    </group>
  );
}
