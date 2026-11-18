import type { SceneItemSize } from "@cabane/engine";
import { FourLegOakTable } from "../construction";
import { apronJoinery, easedWorktop } from "../construction/oak-table-joinery";

export const OAK_DESK_SIZE = [1.4, 0.74, 0.7] as const;

const top = easedWorktop(1.4, 0.74, 0.7, 0.029, 0.042);
const frame = apronJoinery(0.605, 0.26, 0.712, 0.029, false);

export function OakDesk({ size = OAK_DESK_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="oak-desk"
      scale={[size[0] / 1.4, size[1] / 0.74, size[2] / 0.7]}
      userData={{ walkCollider: true }}
    >
      <FourLegOakTable worktop={top} frame={frame} />
    </group>
  );
}
