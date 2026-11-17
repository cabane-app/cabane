import type { SceneItemSize } from "@cabane/engine";
import { TreeModel } from "./TreeModel";
import { broadleaf } from "./broadleaf";
export const SUGAR_MAPLE_SIZE = [4.2, 5, 4] as const;
const create = () => broadleaf(SUGAR_MAPLE_SIZE, "maple");
export function SugarMaple({ size = SUGAR_MAPLE_SIZE }: { size?: SceneItemSize }) {
  return (
    <TreeModel
      name="sugar-maple"
      size={size}
      nominal={SUGAR_MAPLE_SIZE}
      create={create}
      bark="#76604d"
      leaf="#ba7339"
    />
  );
}
