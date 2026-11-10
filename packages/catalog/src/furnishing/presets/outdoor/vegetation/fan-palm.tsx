import type { SceneItemSize } from "@cabane/engine";
import { TreeModel } from "./TreeModel";
import { palm } from "./palm";
export const FAN_PALM_SIZE = [3.5, 3.8, 3.5] as const;
const create = () => palm(FAN_PALM_SIZE, true);
export function FanPalm({ size = FAN_PALM_SIZE }: { size?: SceneItemSize }) {
  return (
    <TreeModel
      name="fan-palm"
      size={size}
      nominal={FAN_PALM_SIZE}
      create={create}
      bark="#907354"
      leaf="#668249"
    />
  );
}
