import type { SceneModelProps } from "@cabane/engine";
import { PoolChaiseFrame } from "./chaise-frame";
import { PoolChaiseUpholstery } from "./chaise-upholstery";

export const POOL_CHAISE_LONGUE_SIZE = [0.8, 0.85, 2.1] as const;

export function PoolChaiseLongue({
  size = POOL_CHAISE_LONGUE_SIZE,
  variant = "default",
  color,
}: Partial<Pick<SceneModelProps, "size" | "variant" | "color">>) {
  return (
    <group
      name="pool-chaise-longue"
      userData={{ walkCollider: true }}
      scale={[
        size[0] / POOL_CHAISE_LONGUE_SIZE[0],
        size[1] / POOL_CHAISE_LONGUE_SIZE[1],
        size[2] / POOL_CHAISE_LONGUE_SIZE[2],
      ]}
    >
      <PoolChaiseFrame />
      <PoolChaiseUpholstery cozy={variant === "cozy"} color={color} />
    </group>
  );
}
