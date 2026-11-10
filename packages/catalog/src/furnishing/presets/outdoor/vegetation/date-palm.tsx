import type { SceneItemSize } from "@cabane/engine";
import { TreeModel } from "./TreeModel";
import { palm } from "./palm";
export const DATE_PALM_SIZE = [4.5, 5, 4.5] as const;
const create = () => palm(DATE_PALM_SIZE, false);
export function DatePalm({ size = DATE_PALM_SIZE }: { size?: SceneItemSize }) {
  return (
    <TreeModel
      name="date-palm"
      size={size}
      nominal={DATE_PALM_SIZE}
      create={create}
      bark="#9b805c"
      leaf="#6e8547"
    />
  );
}
