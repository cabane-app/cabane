import type { SceneItemSize } from "@cabane/engine";
import { TreeModel } from "./TreeModel";
import { conifer } from "./conifer";
export const ITALIAN_CYPRESS_SIZE = [1.2, 5, 1.2] as const;
const create = () => conifer(ITALIAN_CYPRESS_SIZE, true);
export function ItalianCypress({ size = ITALIAN_CYPRESS_SIZE }: { size?: SceneItemSize }) {
  return (
    <TreeModel
      name="italian-cypress"
      size={size}
      nominal={ITALIAN_CYPRESS_SIZE}
      create={create}
      bark="#85715c"
      leaf="#3f6046"
    />
  );
}
