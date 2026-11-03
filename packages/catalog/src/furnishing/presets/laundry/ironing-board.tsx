import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const IRONING_BOARD_SIZE = [1.2, 0.9, 0.4] as const;

/** Rounded padded sage board, steel trestles and connecting brace. */
export function IroningBoard({
  size = IRONING_BOARD_SIZE,
  color,
}: { size?: SceneItemSize; color?: string | undefined } = {}) {
  return (
    <group
      name="ironing-board"
      scale={[size[0] / 1.2, size[1] / 0.9, size[2] / 0.4]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        name="padded-board"
        size={[1.2, 0.045, 0.4]}
        position={[0, 0.8775, 0]}
        color={color ?? "#81958a"}
        radius={0.09}
      />
      <RoundedFurniturePanel
        name="leg"
        size={[0.035, 0.855, 0.035]}
        position={[-0.4, 0.4275, -0.15]}
        color="#606b70"
        radius={0.006}
        outline={false}
      />
      <RoundedFurniturePanel
        name="leg"
        size={[0.035, 0.855, 0.035]}
        position={[-0.4, 0.4275, 0.15]}
        color="#606b70"
        radius={0.006}
        outline={false}
      />
      <RoundedFurniturePanel
        name="leg"
        size={[0.035, 0.855, 0.035]}
        position={[0.4, 0.4275, -0.15]}
        color="#606b70"
        radius={0.006}
        outline={false}
      />
      <RoundedFurniturePanel
        name="leg"
        size={[0.035, 0.855, 0.035]}
        position={[0.4, 0.4275, 0.15]}
        color="#606b70"
        radius={0.006}
        outline={false}
      />
      <RoundedFurniturePanel
        name="brace"
        size={[0.835, 0.035, 0.035]}
        position={[0, 0.35, 0]}
        color="#606b70"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="trestle-crossbar"
        size={[0.035, 0.035, 0.335]}
        position={[-0.4, 0.35, 0]}
        color="#606b70"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="trestle-crossbar"
        size={[0.035, 0.035, 0.335]}
        position={[0.4, 0.35, 0]}
        color="#606b70"
        radius={0.006}
      />
    </group>
  );
}
