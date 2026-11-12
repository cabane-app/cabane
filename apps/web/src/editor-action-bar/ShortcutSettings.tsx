import type { ComponentProps } from "react";
import { ActionBarEditor } from "./ActionBarEditor";
import { ShortcutThumbnailSurface } from "./ShortcutDeviceIcon";

/** Settings owns one thumbnail surface for all shortcut previews. */
export function ShortcutSettings(props: ComponentProps<typeof ActionBarEditor>) {
  return (
    <ShortcutThumbnailSurface>
      <ActionBarEditor {...props} />
    </ShortcutThumbnailSurface>
  );
}
