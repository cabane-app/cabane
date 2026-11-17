import { collectBindingSlots } from "../runtime-binding-profile";
import { retainRoomDashboards } from "../room-dashboards/room-dashboard";
import type {
  FloorSpec,
  RenderableFloorSpec,
  HomeManifest,
  HomeBindingManifest,
  RuntimeBindingProfile,
} from "../types";

export const composeManifestWithBrowserFloor = (
  manifest: HomeManifest,
  floor: FloorSpec,
): HomeManifest => {
  if (floor.footprint.length < 3)
    throw new Error("The imported floor requires a complete footprint.");
  const replacement: RenderableFloorSpec = {
    ...floor,
    footprint: floor.footprint as RenderableFloorSpec["footprint"],
  };
  const target = manifest.floors.find((candidate) => candidate.id === floor.id);
  if (!target) throw new Error("The imported floor does not belong to this home.");
  if (
    manifest.floors.length > 1 &&
    JSON.stringify(floor.coordinates) !== JSON.stringify(manifest.coordinates)
  )
    throw new Error("The imported floor must use the building coordinates.");
  return {
    ...manifest,
    coordinates: manifest.floors.length === 1 ? floor.coordinates : manifest.coordinates,
    floors: manifest.floors.map((candidate) =>
      candidate.id === floor.id ? replacement : candidate,
    ),
  };
};

export const reconcileRuntimeBindingProfile = (
  profile: RuntimeBindingProfile,
  manifest: HomeBindingManifest,
): RuntimeBindingProfile => {
  const roomIds = new Set(manifest.floors.flatMap((floor) => floor.rooms).map((room) => room.id));
  const slotIds = new Set(collectBindingSlots(manifest).map((slot) => slot.slotId));
  return {
    ...profile,
    schemaVersion: 1,
    homeId: manifest.home.id,
    ...retainRoomDashboards(profile.roomDashboards, roomIds),
    roomAreaIds: Object.fromEntries(
      Object.entries(profile.roomAreaIds).filter(([roomId]) => roomIds.has(roomId)),
    ),
    entityIdsBySlotId: Object.fromEntries(
      Object.entries(profile.entityIdsBySlotId).filter(([slotId]) => slotIds.has(slotId)),
    ),
  };
};
