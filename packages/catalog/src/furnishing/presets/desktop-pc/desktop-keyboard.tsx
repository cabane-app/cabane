import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { KeyboardKeys } from "./keyboard-keys";

export const DESKTOP_KEYBOARD_SIZE = [0.44, 0.03, 0.15] as const;

export function DesktopKeyboard({ size = DESKTOP_KEYBOARD_SIZE }: { size?: SceneItemSize }) {
  return (
    <group name="desktop-keyboard" scale={[size[0] / 0.44, size[1] / 0.03, size[2] / 0.15]}>
      <RoundedFurniturePanel
        size={[0.44, 0.023, 0.15]}
        position={[0, 0.0115, 0]}
        color="#41494d"
        outlineColor="#30373b"
        radius={0.008}
      />
      <KeyboardKeys />
    </group>
  );
}
