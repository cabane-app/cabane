import { useSyncExternalStore } from "react";

// Include phones rotated to landscape without turning ordinary laptops into mobile editors.
const query = "(max-width: 760px), (max-width: 1024px) and (max-height: 500px)";
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia?.(query);
  if (!media) return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const snapshot = () => window.matchMedia?.(query).matches ?? false;
export function useMobileEditorViewport() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
