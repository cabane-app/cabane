import type { SceneItemSize } from "@cabane/engine";
import { TreeModel } from "./TreeModel";
import { broadleaf } from "./broadleaf";
export const WEEPING_WILLOW_SIZE = [5, 5, 4.8] as const;
const create = () => broadleaf(WEEPING_WILLOW_SIZE, "willow");
export function WeepingWillow({ size = WEEPING_WILLOW_SIZE }: { size?: SceneItemSize }) {
  return (
    <TreeModel
      name="weeping-willow"
      size={size}
      nominal={WEEPING_WILLOW_SIZE}
      create={create}
      bark="#827158"
      leaf="#8b9c50"
    />
  );
}
