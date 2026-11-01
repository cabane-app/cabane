import { outdoorPlatformRoomId } from "../outdoor-platforms/platform-rooms";
import { isObject, type RawObject } from "./core";

export const isPlatformRoomRecord = (floor: RawObject, room: RawObject): boolean =>
  Array.isArray(floor.outdoorPlatforms) &&
  floor.outdoorPlatforms.some(
    (platform) =>
      isObject(platform) &&
      platform.useAsRoom === true &&
      typeof platform.id === "string" &&
      room.id === outdoorPlatformRoomId(platform.id) &&
      JSON.stringify(room.polygon) === JSON.stringify(platform.polygon),
  );
