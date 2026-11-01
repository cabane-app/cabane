import {
  pointInsidePolygon,
  resolveItemTransform,
  type FloorSpec,
  type ItemPlacement,
  type SceneItemSpec,
} from "@cabane/engine";

import { createSceneItemId } from "./scene-item-identity";

const nearbyPlacement = (source: SceneItemSpec, floor?: FloorSpec): ItemPlacement => {
  const placement = source.placement;
  const offset = 0.25 / (floor?.coordinates.metersPerPlanUnit ?? 1);
  if (placement.kind === "wall") {
    const wall = floor?.walls.find((candidate) => candidate.id === placement.wallId);
    if (!wall) return { ...placement };
    const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
    for (const delta of [offset, -offset]) {
      const at = placement.offsetFromWallStartPlanUnits + delta;
      if (at >= 0 && at <= length) return { ...placement, offsetFromWallStartPlanUnits: at };
    }
    return { ...placement };
  }
  for (const [dx, dz] of [
    [offset, offset],
    [-offset, offset],
    [offset, -offset],
    [-offset, -offset],
  ]) {
    const at = [placement.at[0] + dx, placement.at[1] + dz] as const;
    if (floor) {
      const rooms = floor.rooms.filter((room) => pointInsidePolygon(at, room.polygon));
      if (rooms.length !== 1 || (placement.kind === "ceiling" && rooms[0].id !== placement.roomId))
        continue;
    }
    return { ...placement, at };
  }
  return { ...placement, at: [...placement.at] };
};

/** Copies declaration identity, never household mappings. Reserve all project slot IDs. */
export const duplicateSceneItem = (
  source: SceneItemSpec,
  items: readonly SceneItemSpec[],
  floor?: FloorSpec,
  reservedSlotIds: readonly string[] = [],
): SceneItemSpec => {
  const occupied = new Set([
    ...items.map((item) => item.id),
    ...items.flatMap((item) => (item.group ? [item.group.id] : [])),
    ...reservedSlotIds,
    ...items.flatMap((item) =>
      item.lightSlotId ? [item.lightSlotId, `${item.lightSlotId}-entity`] : [],
    ),
    ...items.flatMap((item) => (item.entitySlots ?? []).map((slot) => slot.id)),
  ]);
  const id = createSceneItemId(occupied);
  occupied.add(id);
  let placement = nearbyPlacement(source, floor);
  if (floor && placement.kind === "wall") {
    const { position } = resolveItemTransform(placement, floor);
    const point = [
      position[0] / floor.coordinates.metersPerPlanUnit + floor.coordinates.origin[0],
      position[2] / floor.coordinates.metersPerPlanUnit + floor.coordinates.origin[1],
    ] as const;
    if (floor.rooms.filter((room) => pointInsidePolygon(point, room.polygon)).length !== 1)
      placement = { ...source.placement };
  }
  const lightSlotId = source.lightSlotId ? createSceneItemId(occupied) : undefined;
  if (lightSlotId) {
    occupied.add(lightSlotId);
    occupied.add(`${lightSlotId}-entity`);
  }
  const { group: _group, ...ungrouped } = source;
  const common = {
    ...ungrouped,
    ...(lightSlotId ? { lightSlotId } : {}),
    id,
    size: [...source.size] as [number, number, number],
    placement,
  };
  return source.kind === "device"
    ? {
        ...common,
        kind: "device",
        entitySlots: source.entitySlots.map((slot) => {
          const slotId = createSceneItemId(occupied);
          occupied.add(slotId);
          return { ...structuredClone(slot), id: slotId };
        }),
      }
    : {
        ...common,
        kind: "furnishing",
        ...(source.entitySlots
          ? {
              entitySlots: source.entitySlots.map((slot) => {
                const slotId = createSceneItemId(occupied);
                occupied.add(slotId);
                return { ...structuredClone(slot), id: slotId };
              }),
            }
          : {}),
      };
};
