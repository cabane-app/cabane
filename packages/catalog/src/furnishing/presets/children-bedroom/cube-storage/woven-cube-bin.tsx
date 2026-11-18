import { RoundedFurniturePanel } from "../../construction";
import { BasketFront } from "../basket-front";
import { WICKER_LIGHT } from "./cube-storage-finish";

export function WovenCubeBin({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <group position={[x, y, 0.038]}>
      <RoundedFurniturePanel
        size={[0.31, 0.28, 0.285]}
        color="#846449"
        radius={0.013}
        outline={false}
      />
      <BasketFront width={0.294} height={0.26} color={WICKER_LIGHT} position={[0, 0, 0.143]} />
    </group>
  );
}
