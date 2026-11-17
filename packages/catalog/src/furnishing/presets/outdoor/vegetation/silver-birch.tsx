import type { SceneItemSize } from "@cabane/engine";
import { TreeModel } from "./TreeModel";
import { broadleaf } from "./broadleaf";
export const SILVER_BIRCH_SIZE = [2.8, 6, 2.6] as const;
const create = () => broadleaf(SILVER_BIRCH_SIZE, "birch");
export function SilverBirch({ size = SILVER_BIRCH_SIZE }: { size?: SceneItemSize }) {
  return (
    <TreeModel
      name="silver-birch"
      size={size}
      nominal={SILVER_BIRCH_SIZE}
      create={create}
      bark="#ddd6c7"
      leaf="#7c9b51"
    />
  );
}
