import { type SceneItemSize } from "@cabane/engine";
import { CountertopSlab } from "./countertop-slab";

export const COUNTERTOP_SIZE = [1.8, 0.04, 0.63] as const;
export const CORNER_COUNTERTOP_SIZE = [1.26, 0.04, 1.26] as const;

type CountertopProps = { size?: SceneItemSize; variant?: string };

/** Standalone worktop: Y=0 is the underside, with clear space below it. */
export function Countertop({ size = COUNTERTOP_SIZE, variant = "default" }: CountertopProps) {
  return <CountertopSlab size={size} nominalSize={COUNTERTOP_SIZE} variant={variant} />;
}

/** Continuous L-shaped worktop with two half-span arms and an open inner corner. */
export function CornerCountertop({
  size = CORNER_COUNTERTOP_SIZE,
  variant = "default",
}: CountertopProps) {
  return (
    <CountertopSlab size={size} nominalSize={CORNER_COUNTERTOP_SIZE} variant={variant} corner />
  );
}
