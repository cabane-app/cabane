import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const GARDEN_BENCH_SIZE = [1.5, 0.9, 0.6] as const;

export function GardenBench({
  size = GARDEN_BENCH_SIZE,
  variant = "default",
}: {
  size?: SceneItemSize;
  variant?: string;
}) {
  return (
    <group
      name="garden-bench"
      scale={[size[0] / 1.5, size[1] / 0.9, size[2] / 0.6]}
      userData={{ walkCollider: true }}
    >
      {variant !== "default" && (
        <RoundedFurniturePanel
          name="bench-seat-pad"
          glowKey="bench.seat-pad"
          size={[1.32, 0.07, 0.48]}
          position={[0, 0.515, 0]}
          color={variant === "sage" ? "#95a184" : "#ddccb0"}
          radius={0.03}
        />
      )}
      <RoundedFurniturePanel
        name="leg"
        glowKey="bench.leg.back-left"
        size={[0.06, 0.44, 0.06]}
        position={[-0.6399999999999999, 0.22, -0.21500000000000002]}
        color="#414e49"
      />
      <RoundedFurniturePanel
        name="leg"
        glowKey="bench.leg.front-left"
        size={[0.06, 0.44, 0.06]}
        position={[-0.6399999999999999, 0.22, 0.21500000000000002]}
        color="#414e49"
      />
      <RoundedFurniturePanel
        name="leg"
        glowKey="bench.leg.back-right"
        size={[0.06, 0.44, 0.06]}
        position={[0.6399999999999999, 0.22, -0.21500000000000002]}
        color="#414e49"
      />
      <RoundedFurniturePanel
        name="leg"
        glowKey="bench.leg.front-right"
        size={[0.06, 0.44, 0.06]}
        position={[0.6399999999999999, 0.22, 0.21500000000000002]}
        color="#414e49"
      />
      <RoundedFurniturePanel
        name="seat-slat"
        glowKey="bench.seat-slat.back"
        size={[1.5, 0.05, 0.1]}
        position={[0, 0.455, -0.24]}
        color="#b58a58"
      />
      <RoundedFurniturePanel
        name="seat-slat"
        glowKey="bench.seat-slat.back-middle"
        size={[1.5, 0.05, 0.1]}
        position={[0, 0.455, -0.12]}
        color="#b58a58"
      />
      <RoundedFurniturePanel
        name="seat-slat"
        glowKey="bench.seat-slat.middle"
        size={[1.5, 0.05, 0.1]}
        position={[0, 0.455, 0]}
        color="#b58a58"
      />
      <RoundedFurniturePanel
        name="seat-slat"
        glowKey="bench.seat-slat.front-middle"
        size={[1.5, 0.05, 0.1]}
        position={[0, 0.455, 0.12]}
        color="#b58a58"
      />
      <RoundedFurniturePanel
        name="seat-slat"
        glowKey="bench.seat-slat.front"
        size={[1.5, 0.05, 0.1]}
        position={[0, 0.455, 0.24]}
        color="#b58a58"
      />
      <RoundedFurniturePanel
        name="back-post"
        glowKey="bench.back-post.left"
        size={[0.05, 0.88, 0.05]}
        position={[-0.65, 0.44, -0.275]}
        color="#414e49"
      />
      <RoundedFurniturePanel
        name="back-post"
        glowKey="bench.back-post.right"
        size={[0.05, 0.88, 0.05]}
        position={[0.65, 0.44, -0.275]}
        color="#414e49"
      />
      <RoundedFurniturePanel
        name="back-slat"
        glowKey="bench.back-slat.lower"
        size={[1.5, 0.09, 0.04]}
        position={[0, 0.6, -0.275]}
        color="#b58a58"
      />
      <RoundedFurniturePanel
        name="back-slat"
        glowKey="bench.back-slat.middle"
        size={[1.5, 0.09, 0.04]}
        position={[0, 0.71, -0.275]}
        color="#b58a58"
      />
      <RoundedFurniturePanel
        name="back-slat"
        glowKey="bench.back-slat.upper"
        size={[1.5, 0.09, 0.04]}
        position={[0, 0.855, -0.275]}
        color="#b58a58"
      />
      <RoundedFurniturePanel
        name="armrest"
        glowKey="bench.armrest.left"
        size={[0.06, 0.05, 0.6]}
        position={[-0.7, 0.66, 0]}
        color="#b58a58"
      />
      <RoundedFurniturePanel
        name="armrest"
        glowKey="bench.armrest.right"
        size={[0.06, 0.05, 0.6]}
        position={[0.7, 0.66, 0]}
        color="#b58a58"
      />
      <RoundedFurniturePanel
        name="arm-post"
        glowKey="bench.arm-post.left"
        size={[0.05, 0.23, 0.05]}
        position={[-0.7, 0.55, 0.24]}
        color="#414e49"
      />
      <RoundedFurniturePanel
        name="arm-post"
        glowKey="bench.arm-post.right"
        size={[0.05, 0.23, 0.05]}
        position={[0.7, 0.55, 0.24]}
        color="#414e49"
      />
    </group>
  );
}
