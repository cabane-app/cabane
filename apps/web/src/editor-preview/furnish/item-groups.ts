import type { SceneItemSpec } from "@cabane/engine";

/** Selecting any member always includes the entire saved group. */
export function expandItemSelection(
  items: readonly SceneItemSpec[],
  ids: readonly string[],
): string[] {
  const selected = new Set(ids);
  const groups = new Set(
    items.filter((item) => selected.has(item.id) && item.group).map((item) => item.group!.id),
  );
  return items
    .filter((item) => selected.has(item.id) || (item.group && groups.has(item.group.id)))
    .map((item) => item.id);
}

export function selectedItemGroup(items: readonly SceneItemSpec[], ids: readonly string[]) {
  const selected = new Set(ids);
  const members = items.filter((item) => selected.has(item.id));
  const group = members[0]?.group;
  return group && members.every((item) => item.group?.id === group.id) ? group : null;
}

export function toggleItemSelection(
  items: readonly SceneItemSpec[],
  ids: readonly string[],
  id: string,
) {
  const unit = expandItemSelection(items, [id]);
  return ids.includes(id)
    ? ids.filter((value) => !unit.includes(value))
    : expandItemSelection(items, [...ids, ...unit]);
}

/** A saved group is one row; children are descriptive and cannot be selected independently. */
export function itemSelectionUnits(items: readonly SceneItemSpec[]) {
  const units: { id: string; name: string | null; items: SceneItemSpec[] }[] = [];
  for (const item of items) {
    const existing = item.group && units.find((unit) => unit.id === item.group!.id);
    if (existing) existing.items.push(item);
    else
      units.push({ id: item.group?.id ?? item.id, name: item.group?.name ?? null, items: [item] });
  }
  return units;
}
