import type { SceneItemSize } from "@cabane/engine";
import { FourLegOakTable } from "../construction";
import { apronJoinery, easedWorktop } from "../construction/oak-table-joinery";

export const RECTANGULAR_DINING_TABLE_SIZE = [1.8, 0.75, 0.9] as const;

const top = easedWorktop(1.8, 0.75, 0.9, 0.037, 0.065);
const frame = apronJoinery(0.78, 0.345, 0.714, 0.038, true);

export function RectangularDiningTable({
  size = RECTANGULAR_DINING_TABLE_SIZE,
  variant = "default",
}: {
  size?: SceneItemSize;
  variant?: string;
}) {
  return (
    <group
      name="rectangular-dining-table"
      scale={[size[0] / 1.8, size[1] / 0.75, size[2] / 0.9]}
      userData={{ walkCollider: true }}
    >
      <FourLegOakTable worktop={top} frame={frame} stone={variant === "pale-stone"} />
    </group>
  );
}
