import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const INDOOR_CHAISE_LONGUE_SIZE = [0.8, 0.8, 1.65] as const;

/** Terracotta day chaise with a full-length cushion and raised headrest. */
export function IndoorChaiseLongue({
  size = INDOOR_CHAISE_LONGUE_SIZE,
  color,
}: { size?: SceneItemSize; color?: string | undefined } = {}) {
  return (
    <group
      name="indoor-chaise-longue"
      scale={[size[0] / 0.8, size[1] / 0.8, size[2] / 1.65]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        name="foot"
        size={[0.06, 0.15, 0.06]}
        position={[-0.3, 0.075, -0.68]}
        color="#bd9367"
        radius={0.003}
        outline={false}
      />
      <RoundedFurniturePanel
        name="foot"
        size={[0.06, 0.15, 0.06]}
        position={[-0.3, 0.075, 0.68]}
        color="#bd9367"
        radius={0.003}
        outline={false}
      />
      <RoundedFurniturePanel
        name="foot"
        size={[0.06, 0.15, 0.06]}
        position={[0.3, 0.075, -0.68]}
        color="#bd9367"
        radius={0.003}
        outline={false}
      />
      <RoundedFurniturePanel
        name="foot"
        size={[0.06, 0.15, 0.06]}
        position={[0.3, 0.075, 0.68]}
        color="#bd9367"
        radius={0.003}
        outline={false}
      />
      <RoundedFurniturePanel
        name="frame"
        size={[0.8, 0.15, 1.65]}
        position={[0, 0.225, 0]}
        color="#996b4b"
        radius={0.025}
      />
      <RoundedFurniturePanel
        name="chaise-cushion"
        size={[0.8, 0.17, 1.65]}
        position={[0, 0.385, 0]}
        color={color ?? "#ba7960"}
        radius={0.06}
      />
      <RoundedFurniturePanel
        name="headrest"
        size={[0.8, 0.33, 0.3]}
        position={[0, 0.635, -0.675]}
        color={color ?? "#c68b70"}
        radius={0.07}
      />
    </group>
  );
}
