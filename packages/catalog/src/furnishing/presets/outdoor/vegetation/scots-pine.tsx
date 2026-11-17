import type { SceneItemSize } from "@cabane/engine";
import { TreeModel } from "./TreeModel";
import { conifer } from "./conifer";
export const SCOTS_PINE_SIZE = [4, 6, 3.8] as const;
const create = () => conifer(SCOTS_PINE_SIZE, false);
export function ScotsPine({ size = SCOTS_PINE_SIZE }: { size?: SceneItemSize }) {
  return (
    <TreeModel
      name="scots-pine"
      size={size}
      nominal={SCOTS_PINE_SIZE}
      create={create}
      bark="#a47855"
      leaf="#486951"
    />
  );
}
