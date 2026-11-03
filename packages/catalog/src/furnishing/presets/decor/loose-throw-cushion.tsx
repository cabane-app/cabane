import { type SceneItemSize } from "@cabane/engine";
import { TailoredCushion } from "../living-room/sofa-upholstery/tailored-cushion";

export const LOOSE_THROW_CUSHION_SIZE = [0.45, 0.16, 0.45] as const;

/** Supporting surface is Y=0; elevate onto an existing seat or bed. */
export function LooseThrowCushion({
  size = LOOSE_THROW_CUSHION_SIZE,
  variant = "sage",
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
  variant?: string;
}) {
  const fabric =
    color ?? (variant === "clay" ? "#bf8064" : variant === "ivory" ? "#e9ddc6" : "#8e9e7d");
  return (
    <group scale={[size[0] / 0.45, size[1] / 0.16, size[2] / 0.45]}>
      <TailoredCushion
        name="loose-throw-cushion"
        size={[0.45, 0.16, 0.45]}
        position={[0, 0.08, 0]}
        color={fabric}
      />
    </group>
  );
}
