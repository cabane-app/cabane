import type { SceneItemSize } from "@cabane/engine";
import { TreeModel } from "./TreeModel";
import { broadleaf } from "./broadleaf";
export const ENGLISH_OAK_SIZE = [5, 5.5, 4.8] as const;
const create = () => broadleaf(ENGLISH_OAK_SIZE, "oak");
export function EnglishOak({ size = ENGLISH_OAK_SIZE }: { size?: SceneItemSize }) {
  return (
    <TreeModel
      name="english-oak"
      size={size}
      nominal={ENGLISH_OAK_SIZE}
      create={create}
      bark="#77614a"
      leaf="#537446"
    />
  );
}
