import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

import { BoxedCushion } from "./sofa-upholstery/boxed-cushion";
import { TurnedSeatFoot } from "./sofa-upholstery/turned-seat-foot";

export const UPHOLSTERED_OTTOMAN_SIZE = [0.7, 0.42, 0.55] as const;

/** Compact upholstered footstool and occasional seat. */
export function UpholsteredOttoman({
  size = UPHOLSTERED_OTTOMAN_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="upholstered-ottoman"
      scale={[size[0] / 0.7, size[1] / 0.42, size[2] / 0.55]}
      userData={{ walkCollider: true }}
    >
      {[-0.27, 0.27].flatMap((x) =>
        [-0.195, 0.195].map((z) => (
          <TurnedSeatFoot
            key={`${x}-${z}`}
            x={x}
            z={z}
            height={0.106}
            radius={0.041}
            name="ottoman-foot"
            color="#a67d51"
          />
        )),
      )}
      <RoundedFurniturePanel
        name="oak-bottom-rail"
        size={[0.6, 0.035, 0.45]}
        position={[0, 0.1075, 0]}
        color="#a67d51"
        radius={0.014}
        outline={false}
      />
      <BoxedCushion
        name="upholstered-boxing"
        size={[0.66, 0.216, 0.51]}
        position={[0, 0.216, 0]}
        color={color ?? "#c9b9a1"}
      />
      <BoxedCushion
        name="ottoman-cushion"
        size={[0.7, 0.15, 0.55]}
        position={[0, 0.345, 0]}
        color={color ?? "#ded1ba"}
        outlineColor="#ac9980"
      />
    </group>
  );
}
