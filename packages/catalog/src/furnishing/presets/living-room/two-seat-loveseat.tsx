import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

import { BoxedCushion } from "./sofa-upholstery/boxed-cushion";
import { TurnedSeatFoot } from "./sofa-upholstery/turned-seat-foot";

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
      {[-0.65, 0.65].flatMap((x) =>
        [-0.32, 0.32].map((z) => (
          <TurnedSeatFoot
            key={`${x}-${z}`}
            x={x}
            z={z}
            height={0.17}
            radius={0.046}
            name="foot"
            color="#bd9367"
          />
        )),
      )}
      <RoundedFurniturePanel
        name="base"
        size={[1.49, 0.18, 0.79]}
        position={[0, 0.23, 0.004]}
        radius={0.062}
        color={color ?? "#64796b"}
        outline={false}
      />
      <BoxedCushion
        name="back"
        size={[1.42, 0.14, 0.55]}
        position={[0, 0.545, -0.355]}
        rotation={[Math.PI / 2, 0, 0]}
        color={color ?? "#64796b"}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <BoxedCushion
            name="arm"
            size={[0.19, 0.43, 0.88]}
            position={[side * 0.705, 0.42, 0]}
            color={color ?? "#718775"}
            outlineColor="#556858"
          />
          <BoxedCushion
            name="seat-cushion"
            size={[0.63, 0.185, 0.67]}
            position={[side * 0.316, 0.399, 0.077]}
            color={color ?? "#91a18b"}
          />
          <BoxedCushion
            name="back-cushion"
            size={[0.632, 0.17, 0.377]}
            position={[side * 0.317, 0.615, -0.235]}
            rotation={[1.37, 0, side * 0.009]}
            color={color ?? "#91a18b"}
          />
        </group>
      ))}
    </group>
  );
}
