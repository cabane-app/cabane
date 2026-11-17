import { type SceneItemSize } from "@cabane/engine";
import { TubChairShell } from "./tub-chair-shell";
import { BoxedCushion } from "./sofa-upholstery/boxed-cushion";
import { TurnedSeatFoot } from "./sofa-upholstery/turned-seat-foot";
export const SAGE_TUB_ARMCHAIR_SIZE = [0.78, 0.86, 0.8] as const;
/** Generic proportions inferred from reference appearance, not manufacturer measurements. */
export function SageTubArmchair({
  size = SAGE_TUB_ARMCHAIR_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
  variant?: string;
}) {
  return (
    <group
      name="sage-tub-armchair"
      scale={[size[0] / 0.78, size[1] / 0.86, size[2] / 0.8]}
      userData={{ walkCollider: true }}
    >
      {[-0.27, 0.27].flatMap((x) =>
        [-0.28, 0.28].map((z) => (
          <TurnedSeatFoot
            key={`${x}-${z}`}
            x={x}
            z={z}
            height={0.18}
            radius={0.04}
            name="tub-chair-foot"
            color="#bb976d"
          />
        )),
      )}
      <BoxedCushion
        name="upholstered-base"
        size={[0.67, 0.25, 0.71]}
        position={[0, 0.257, 0.022]}
        color={color ?? "#748e81"}
      />
      <TubChairShell color={color ?? "#789486"} />
      <BoxedCushion
        name="tub-seat"
        size={[0.549, 0.168, 0.659]}
        position={[0, 0.434, 0.0705]}
        color={color ?? "#819b8d"}
        outlineColor="#687f72"
      />
    </group>
  );
}
