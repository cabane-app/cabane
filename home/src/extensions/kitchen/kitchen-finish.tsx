import { RecessedPanel } from "./recessed-panel";
import { Outlines, ToonMaterial } from "@cabane/engine";

export type KitchenVector3 = readonly [number, number, number];

export const KITCHEN_CREAM = "#eee9de";
export const KITCHEN_CREAM_LIGHT = "#f5f2eb";
export const KITCHEN_STONE = "#eee8dc";
export const KITCHEN_OAK = "#b77b43";
export const KITCHEN_BRASS = "#b78332";
export const KITCHEN_DARK = "#292b2a";
const KITCHEN_OUTLINE = "#665c50";

export function KitchenBox({
  size,
  position,
  color,
  outline = KITCHEN_OUTLINE,
  receiveShadow = false,
}: {
  readonly size: KitchenVector3;
  readonly position: KitchenVector3;
  readonly color: string;
  readonly outline?: string;
  readonly receiveShadow?: boolean;
}) {
  return (
    <mesh position={position} castShadow receiveShadow={receiveShadow}>
      <boxGeometry args={[...size]} />
      <ToonMaterial color={color} />
      <Outlines thickness={0.0015} color={outline} screenspace={false} />
    </mesh>
  );
}

export function KitchenPanel({
  width,
  height,
  position,
}: {
  readonly width: number;
  readonly height: number;
  readonly position: KitchenVector3;
}) {
  return (
    <RecessedPanel
      position={position}
      color={KITCHEN_CREAM_LIGHT}
      rings={[
        [width, height, -0.014],
        [width, height, 0.006],
        [width - 0.006, height - 0.006, 0.009],
        [width - 0.058, height - 0.058, 0.009],
        [width - 0.075, height - 0.075, -0.001],
      ]}
    />
  );
}
