import type { ActionBarItem } from "@cabane/engine";

const sameTarget = (a: ActionBarItem["target"], b: ActionBarItem["target"]): boolean =>
  a.kind === b.kind &&
  (a.kind === "built-in" && b.kind === "built-in"
    ? a.action === b.action
    : a.kind === "walk-tool" && b.kind === "walk-tool"
      ? a.toolId === b.toolId
      : a.kind === "scene-feature" && b.kind === "scene-feature"
        ? a.featureId === b.featureId
        : a.kind === "room" && b.kind === "room"
          ? a.roomId === b.roomId
          : a.kind === "device" && b.kind === "device" && a.deviceId === b.deviceId);

export function replaceActionBarItem(
  items: readonly ActionBarItem[],
  id: string | null,
  target: ActionBarItem["target"],
  newId: () => string,
): readonly ActionBarItem[] {
  if (items.some((item) => item.id !== id && sameTarget(item.target, target))) return items;
  if (id === null) return [...items, { id: newId(), target }];
  return items.map((item) => (item.id === id ? { ...item, target } : item));
}

export function moveActionBarItem(
  items: readonly ActionBarItem[],
  id: string,
  direction: -1 | 1,
): readonly ActionBarItem[] {
  const index = items.findIndex((item) => item.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= items.length) return items;
  const result = [...items];
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}

export function removeActionBarItem(
  items: readonly ActionBarItem[],
  id: string,
): readonly ActionBarItem[] {
  return items.filter((item) => item.id !== id);
}
