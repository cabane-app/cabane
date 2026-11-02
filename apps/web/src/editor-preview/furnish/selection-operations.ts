import type { FloorSpec, ItemPlacement, SceneItemSpec } from "@cabane/engine";
import { duplicateSceneItem } from "./duplicate-item";
import { createSceneItemId } from "./scene-item-identity";
import { expandItemSelection } from "./item-groups";
import { groupPlacement, transformItemGroup } from "./group-transforms";

export type FurnishingSelectionAction =
  | { type: "group-items"; ids: readonly string[]; reservedIds: readonly string[] }
  | { type: "ungroup-items"; ids: readonly string[] }
  | { type: "rename-group"; id: string; name: string }
  | {
      type: "transform-group";
      id: string;
      floor: FloorSpec;
      placement: Extract<ItemPlacement, { kind: "absolute" }>;
    }
  | {
      type: "duplicate-items";
      ids: readonly string[];
      floor: FloorSpec;
      reservedIds: readonly string[];
    };

const occupiedIds = (items: readonly SceneItemSpec[], reservedIds: readonly string[]) =>
  new Set([
    ...reservedIds,
    ...items.flatMap((item) => [
      item.id,
      ...(item.group ? [item.group.id] : []),
      ...(item.entitySlots ?? []).map((slot) => slot.id),
      ...(item.lightSlotId ? [item.lightSlotId, `${item.lightSlotId}-entity`] : []),
    ]),
  ]);

export function editFurnishingSelection(
  items: readonly SceneItemSpec[],
  action: FurnishingSelectionAction,
) {
  const selected =
    "ids" in action
      ? new Set(expandItemSelection(items, action.ids))
      : new Set(items.filter((item) => item.group?.id === action.id).map((item) => item.id));
  const members = items.filter((item) => selected.has(item.id));
  if (!members.length) return null;
  let next = items;
  let selection = members.map((item) => item.id);
  switch (action.type) {
    case "group-items": {
      if (members.length < 2 || members.some((item) => item.floorId !== members[0].floorId))
        return null;
      const existing = members.find((item) => item.group)?.group;
      if (members.every((item) => item.group?.id === existing?.id) && existing) return null;
      const names = new Set(items.flatMap((item) => (item.group ? [item.group.name] : [])));
      let suffix = 1;
      while (names.has(`Group ${suffix}`)) suffix++;
      const group = existing ?? {
        id: createSceneItemId(occupiedIds(items, action.reservedIds)),
        name: `Group ${suffix}`,
      };
      next = items.map((item) => (selected.has(item.id) ? { ...item, group } : item));
      break;
    }
    case "ungroup-items":
      next = items.map((item) => {
        if (!selected.has(item.id) || !item.group) return item;
        const { group: _group, ...ungrouped } = item;
        return ungrouped;
      });
      break;
    case "rename-group": {
      const name = action.name.trim();
      if (!name || members.every((item) => item.group?.name === name)) return null;
      next = items.map((item) =>
        selected.has(item.id) && item.group ? { ...item, group: { ...item.group, name } } : item,
      );
      break;
    }
    case "transform-group": {
      const placements = transformItemGroup(members, action.floor, action.placement);
      next = items.map((item) =>
        placements[item.id] &&
        JSON.stringify(item.placement) !== JSON.stringify(placements[item.id])
          ? { ...item, placement: placements[item.id] }
          : item,
      );
      break;
    }
    case "duplicate-items": {
      const occupied = occupiedIds(items, action.reservedIds);
      const groupIds = new Map<string, string>();
      const sourcePlacement = groupPlacement(members, action.floor);
      const offset = 0.25 / action.floor.coordinates.metersPerPlanUnit;
      const placements = transformItemGroup(members, action.floor, {
        ...sourcePlacement,
        at: [sourcePlacement.at[0] + offset, sourcePlacement.at[1] + offset],
      });
      const copies = members.map((source) => {
        const copy = duplicateSceneItem(source, items, undefined, [...occupied]);
        occupied.add(copy.id);
        for (const slot of copy.entitySlots ?? []) occupied.add(slot.id);
        if (copy.lightSlotId) {
          occupied.add(copy.lightSlotId);
          occupied.add(`${copy.lightSlotId}-entity`);
        }
        if (source.group) {
          let id = groupIds.get(source.group.id);
          if (!id) {
            id = createSceneItemId(occupied);
            occupied.add(id);
            groupIds.set(source.group.id, id);
          }
          copy.group = { id, name: `${source.group.name} copy` };
        }
        return { ...copy, placement: placements[source.id] };
      });
      next = [...items, ...copies];
      selection = copies.map((item) => item.id);
      break;
    }
  }
  if (!next.some((item, index) => item !== items[index]) && next.length === items.length)
    return null;
  return { items: next, selectedId: null, multipleIds: selection };
}
