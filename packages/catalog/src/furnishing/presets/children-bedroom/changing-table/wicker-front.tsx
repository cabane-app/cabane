import { RoundedFurniturePanel } from "../../construction";
import { BasketFront } from "../basket-front";
import { WICKER_LIGHT } from "./changing-table-finish";

export function WickerFront() {
  return (
    <group position={[0, 0.43, 0.226]}>
      <RoundedFurniturePanel
        size={[0.6, 0.31, 0.044]}
        color="#927153"
        radius={0.014}
        outlineColor="#877258"
      />
      <BasketFront width={0.566} height={0.277} color={WICKER_LIGHT} position={[0, 0, 0.023]} />
    </group>
  );
}
