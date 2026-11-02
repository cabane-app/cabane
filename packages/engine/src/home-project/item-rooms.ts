import { pointInsidePolygon, worldPointToPlan } from "../geometry";
import { indoorRoomsForFloor, roomsForFloor } from "../outdoor-platforms/platform-rooms";
import type { FloorSpec, SceneModelEditorDescriptor } from "../types";
import { resolveItemTransform } from "./placements";
import type { ItemPlacement, SceneItemSpec } from "./types";

type WallPlacement = Extract<ItemPlacement, { kind: "wall" }>;

/** Probe only the wall finish, never a nearest room elsewhere on the floor. */
export function indoorRoomIdsOnWallFace(
  placement: Pick<WallPlacement, "wallId" | "face" | "offsetFromWallStartPlanUnits">,
  floor: FloorSpec,
): readonly string[] {
  const wall = floor.walls.find((candidate) => candidate.id === placement.wallId);
  if (!wall || wall.virtual) return [];
  const rooms = indoorRoomsForFloor(floor).filter((room) => !room.isSolid);
  const ids = new Set<string>();
  for (let step = 0; step <= 10; step++) {
    const { position } = resolveItemTransform(
      {
        ...placement,
        kind: "wall",
        elevationMeters: 0,
        depthOffsetMeters: 0.003 + step * 0.005,
        rotationOffsetRadians: 0,
      },
      floor,
    );
    const at = worldPointToPlan({ x: position[0], z: position[2] }, floor.coordinates);
    for (const room of rooms) if (pointInsidePolygon(at, room.polygon)) ids.add(room.id);
  }
  return [...ids];
}

export function roomIdForItem(
  item: SceneItemSpec,
  floor: FloorSpec,
  definition?: SceneModelEditorDescriptor,
): string | null {
  if (item.placement.kind === "wall" && definition?.windowFit?.mounting === "exterior-recessed") {
    const ids = indoorRoomIdsOnWallFace(
      { ...item.placement, face: item.placement.face === "left" ? "right" : "left" },
      floor,
    );
    return ids.length === 1 ? ids[0] : null;
  }
  const { position } = resolveItemTransform(item.placement, floor);
  const at = worldPointToPlan({ x: position[0], z: position[2] }, floor.coordinates);
  const rooms = roomsForFloor(floor).filter(
    (room) => !room.isSolid && pointInsidePolygon(at, room.polygon),
  );
  if (rooms.length !== 1) return null;
  return item.placement.kind !== "ceiling" || rooms[0].id === item.placement.roomId
    ? rooms[0].id
    : null;
}
