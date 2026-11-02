import { outsideRoomDevices } from "../outside-room-devices";
import type { HomeManifest } from "../types";
import type { ActionBarTarget } from "./action-bar-config";

export function resolveActionBarDestination(
  manifest: Pick<HomeManifest, "floors"> & Partial<Pick<HomeManifest, "sceneItems" | "extensions">>,
  target: ActionBarTarget,
): { floorId: string; roomId: string; deviceId?: string } | null {
  for (const floor of manifest.floors) {
    for (const room of floor.rooms) {
      if (target.kind === "room" && room.id === target.roomId) {
        return { floorId: floor.id, roomId: room.id };
      }
      if (
        target.kind === "device" &&
        room.devices.some((device) => device.id === target.deviceId)
      ) {
        return { floorId: floor.id, roomId: room.id, deviceId: target.deviceId };
      }
    }
  }
  if (target.kind === "device" && manifest.sceneItems && manifest.extensions) {
    for (const floor of manifest.floors) {
      const outside = outsideRoomDevices(
        {
          floors: manifest.floors,
          sceneItems: manifest.sceneItems,
          extensions: manifest.extensions,
        },
        floor.id,
      );
      if (outside?.devices.some((device) => device.id === target.deviceId))
        return { floorId: floor.id, roomId: outside.id, deviceId: target.deviceId };
    }
  }
  return null;
}

export function openActionBarDestination(
  destination: { floorId: string; roomId: string; deviceId?: string },
  navigation: {
    walkMode: boolean;
    leaveWalkMode: () => void;
    selectFloor: (floorId: string) => void;
    selectRoom: (roomId: string) => void;
    openDevice: (roomId: string, deviceId: string) => void;
  },
): void {
  if (navigation.walkMode) navigation.leaveWalkMode();
  navigation.selectFloor(destination.floorId);
  navigation.selectRoom(destination.roomId);
  if (destination.deviceId) navigation.openDevice(destination.roomId, destination.deviceId);
}
