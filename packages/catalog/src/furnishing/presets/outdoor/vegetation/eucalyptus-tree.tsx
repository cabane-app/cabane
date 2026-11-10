import type { SceneItemSize } from "@cabane/engine";
import { TreeModel } from "./TreeModel";
import { broadleaf } from "./broadleaf";
export const EUCALYPTUS_TREE_SIZE = [3.8, 6, 3.5] as const;
const create = () => broadleaf(EUCALYPTUS_TREE_SIZE, "eucalyptus");
export function EucalyptusTree({ size = EUCALYPTUS_TREE_SIZE }: { size?: SceneItemSize }) {
  return (
    <TreeModel
      name="eucalyptus-tree"
      size={size}
      nominal={EUCALYPTUS_TREE_SIZE}
      create={create}
      bark="#c7b8a1"
      leaf="#829878"
    />
  );
}
