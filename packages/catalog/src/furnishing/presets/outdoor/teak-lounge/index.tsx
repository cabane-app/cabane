import { type SceneItemSize } from "@cabane/engine";
import { TeakLoungeFrame } from "./lounge-frame";
export const TEAK_LOUNGE_SOFA_SIZE = [2, 0.84, 0.8] as const;
export const TEAK_LOUNGE_CHAIR_SIZE = [0.8, 0.84, 0.8] as const;
type Props = { size?: SceneItemSize; variant?: string; color?: string | undefined };
export function TeakLoungeSofa({ size = TEAK_LOUNGE_SOFA_SIZE, variant = "clay", color }: Props) {
  return (
    <group scale={[size[0] / 2, size[1] / 0.84, size[2] / 0.8]}>
      <TeakLoungeFrame width={2} seats={3} variant={variant} color={color} />
    </group>
  );
}
export function TeakLoungeChair({ size = TEAK_LOUNGE_CHAIR_SIZE, variant = "clay", color }: Props) {
  return (
    <group scale={[size[0] / 0.8, size[1] / 0.84, size[2] / 0.8]}>
      <TeakLoungeFrame width={0.8} seats={1} variant={variant} color={color} />
    </group>
  );
}
