import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const TWO_SEAT_LOVESEAT_SIZE = [1.6, 0.82, 0.88] as const;

/** Sage upholstery, two separate seats and back cushions, rounded arms and oak feet. */
export function TwoSeatLoveseat({
  size = TWO_SEAT_LOVESEAT_SIZE,
  color,
}: { size?: SceneItemSize; color?: string } = {}) {
  return (
    <group
      name="two-seat-loveseat"
      scale={[size[0] / 1.6, size[1] / 0.82, size[2] / 0.88]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        name="foot"
        size={[0.06, 0.14, 0.06]}
        position={[-0.65, 0.07, -0.32]}
        color="#bd9367"
        radius={0.003}
        outline={false}
      />
      <RoundedFurniturePanel
        name="foot"
        size={[0.06, 0.14, 0.06]}
        position={[-0.65, 0.07, 0.32]}
        color="#bd9367"
        radius={0.003}
        outline={false}
      />
      <RoundedFurniturePanel
        name="foot"
        size={[0.06, 0.14, 0.06]}
        position={[0.65, 0.07, -0.32]}
        color="#bd9367"
        radius={0.003}
        outline={false}
      />
      <RoundedFurniturePanel
        name="foot"
        size={[0.06, 0.14, 0.06]}
        position={[0.65, 0.07, 0.32]}
        color="#bd9367"
        radius={0.003}
        outline={false}
      />
      <RoundedFurniturePanel
        name="base"
        size={[1.5, 0.2, 0.8]}
        position={[0, 0.24, 0]}
        color={color ?? "#64796b"}
        radius={0.04}
      />
      <RoundedFurniturePanel
        name="back"
        size={[1.36, 0.48, 0.16]}
        position={[0, 0.58, -0.36]}
        color={color ?? "#64796b"}
        radius={0.05}
      />
      <RoundedFurniturePanel
        name="arm"
        size={[0.15, 0.4, 0.88]}
        position={[-0.725, 0.42, 0]}
        color={color ?? "#718775"}
        radius={0.05}
      />
      <RoundedFurniturePanel
        name="arm"
        size={[0.15, 0.4, 0.88]}
        position={[0.725, 0.42, 0]}
        color={color ?? "#718775"}
        radius={0.05}
      />
      <RoundedFurniturePanel
        name="seat-cushion"
        size={[0.64, 0.16, 0.65]}
        position={[-0.33, 0.42, 0.075]}
        color={color ?? "#91a18b"}
        radius={0.045}
      />
      <RoundedFurniturePanel
        name="seat-cushion"
        size={[0.64, 0.16, 0.65]}
        position={[0.33, 0.42, 0.075]}
        color={color ?? "#91a18b"}
        radius={0.045}
      />
      <RoundedFurniturePanel
        name="back-cushion"
        size={[0.64, 0.34, 0.14]}
        position={[-0.33, 0.63, -0.22]}
        color={color ?? "#91a18b"}
        radius={0.04}
      />
      <RoundedFurniturePanel
        name="back-cushion"
        size={[0.64, 0.34, 0.14]}
        position={[0.33, 0.63, -0.22]}
        color={color ?? "#91a18b"}
        radius={0.04}
      />
    </group>
  );
}
