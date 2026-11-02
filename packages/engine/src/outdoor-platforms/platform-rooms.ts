import type { FloorSpec, RoomSpec } from "../types";

export const outdoorPlatformRoomId = (platformId: string): string => `${platformId}:room`;

type RoomFloor = Pick<FloorSpec, "rooms" | "outdoorPlatforms">;

export const isOutdoorPlatformRoom = (
  floor: Pick<FloorSpec, "outdoorPlatforms">,
  roomId: string,
): boolean =>
  Boolean(
    floor.outdoorPlatforms?.some(
      (platform) => platform.useAsRoom && outdoorPlatformRoomId(platform.id) === roomId,
    ),
  );

/** Structural rooms only. Outdoor room geometry stays owned by its platform. */
export const indoorRoomsForFloor = (floor: RoomFloor): readonly RoomSpec[] =>
  floor.rooms.filter((room) => !isOutdoorPlatformRoom(floor, room.id));

/** Runtime room identities; source projects keep only the opt-in platform fields. */
export const roomsForFloor = (floor: RoomFloor): readonly RoomSpec[] => [
  ...indoorRoomsForFloor(floor),
  ...(floor.outdoorPlatforms ?? [])
    .filter((platform) => platform.useAsRoom)
    .map((platform) => ({
      id: outdoorPlatformRoomId(platform.id),
      name: platform.roomName?.trim() ?? "",
      polygon: platform.polygon,
      accent: "#c9a477",
      floorFinish: platform.finish,
      dashboardSlots: [],
      devices: [],
    })),
];
