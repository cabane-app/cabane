import { bindingDevicesForItem, roomIdForItem } from "./home-project/runtime";
import type { HomeBindingManifest, RoomSpec } from "./types";

/** A device-list group only; never added to architectural floor rooms. */
export function outsideRoomDevices(
  manifest: Pick<HomeBindingManifest, "floors" | "sceneItems" | "extensions">,
  floorId: string,
): RoomSpec | null {
  const floor = manifest.floors.find((candidate) => candidate.id === floorId);
  if (!floor) return null;
  const devices = manifest.sceneItems.flatMap((item) => {
    if ((item.kind !== "device" && !item.lightSlotId) || item.floorId !== floorId) return [];
    try {
      const definition = (
        item.kind === "device"
          ? manifest.extensions.deviceModels
          : manifest.extensions.furnishingModels
      )[item.modelId];
      if (roomIdForItem(item, floor, definition) !== null) return [];
      return bindingDevicesForItem(
        item,
        floor,
        manifest.extensions.deviceModels[item.modelId]?.label ??
          manifest.extensions.furnishingModels[item.modelId]?.label ??
          item.modelId,
      );
    } catch {
      return [];
    }
  });
  const dashboardSlots = manifest.sceneItems.flatMap((item) => {
    if (item.kind !== "furnishing" || item.floorId !== floorId || !item.entitySlots?.length)
      return [];
    try {
      return roomIdForItem(item, floor, manifest.extensions.furnishingModels[item.modelId]) === null
        ? item.entitySlots
        : [];
    } catch {
      return [];
    }
  });
  return devices.length || dashboardSlots.length
    ? {
        id: `outside-rooms:${floorId}`,
        name: "Outside rooms",
        // Non-spatial adapter for the existing room-based mapping components.
        polygon: [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
        accent: "#74856a",
        dashboardSlots,
        devices,
      }
    : null;
}

export function deviceMappingRooms(
  manifest: Pick<HomeBindingManifest, "floors" | "sceneItems" | "extensions">,
  floorId?: string,
): readonly RoomSpec[] {
  return manifest.floors
    .filter((floor) => !floorId || floor.id === floorId)
    .flatMap((floor) => {
      const outside = outsideRoomDevices(manifest, floor.id);
      return [...floor.rooms, ...(outside ? [outside] : [])];
    });
}
