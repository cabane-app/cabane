import type { SceneItemSize } from "@cabane/engine";
import { TreeModel } from "./TreeModel";
import { grass } from "./grass";
export const ORNAMENTAL_GRASS_SIZE = [1.3, 1.5, 1.3] as const;
const create = () => grass(ORNAMENTAL_GRASS_SIZE);
export function OrnamentalGrass({ size = ORNAMENTAL_GRASS_SIZE }: { size?: SceneItemSize }) {
  return (
    <TreeModel
      name="ornamental-grass"
      size={size}
      nominal={ORNAMENTAL_GRASS_SIZE}
      create={create}
      bark="#c4b38b"
      leaf="#8c995c"
    />
  );
}
