import { lightingModelId, lightingSlotForItem } from "../model-lighting/settings";
import { roomsForFloor } from "../outdoor-platforms/platform-rooms";
import { resolveProjectModels } from "../imported-models/resolve-models";
import { deriveFloorLevels } from "../building/floor-levels";
import { worldPointToPlan } from "../geometry";
import type {
  DeviceSlotSpec,
  RenderableFloorSpec,
  HomeExtensionRegistry,
  HomeManifest,
  HomeBindingManifest,
  OpeningSpec,
  SceneModelEditorDescriptor,
} from "../types";
import { resolveItemTransform } from "./placements";
import type { DeviceItemSpec, HomeProject, SceneItemSpec } from "./types";

export { roomIdForItem, indoorRoomIdsOnWallFace } from "./item-rooms";
import { roomIdForItem } from "./item-rooms";

const resolvedPlanPoint = (item: SceneItemSpec, floor: HomeBindingManifest["floors"][number]) => {
  const transform = resolveItemTransform(item.placement, floor);
  return {
    at: worldPointToPlan({ x: transform.position[0], z: transform.position[2] }, floor.coordinates),
    transform,
  };
};

const itemBelongsToRoom = (
  item: SceneItemSpec,
  floor: HomeBindingManifest["floors"][number],
  roomId: string,
  definition?: SceneModelEditorDescriptor,
) => {
  try {
    return roomIdForItem(item, floor, definition) === roomId;
  } catch {
    return false;
  }
};

export const deviceSlotForItem = (
  item: DeviceItemSpec,
  floor: HomeBindingManifest["floors"][number],
): DeviceSlotSpec => {
  const { at, transform } = resolvedPlanPoint(item, floor);
  return {
    id: item.id,
    model: item.modelId,
    entitySlots: item.entitySlots,
    placement:
      item.placement.kind === "wall"
        ? {
            at,
            elevationMeters: transform.position[1],
            rotationYRadians: transform.rotationYRadians,
            support: { kind: "wall", wallId: item.placement.wallId },
          }
        : {
            at,
            elevationMeters: transform.position[1],
            rotationYRadians: transform.rotationYRadians,
            support: { kind: "surface" },
          },
  };
};

/** Optional independent light remains a separate normal Connect relationship. */
export const lightingDeviceForItem = (
  item: SceneItemSpec,
  floor: HomeBindingManifest["floors"][number],
  label = item.modelId,
): DeviceSlotSpec | null => {
  if (!item.lightSlotId) return null;
  const { at, transform } = resolvedPlanPoint(item, floor);
  const slot = lightingSlotForItem(item);
  if (!slot) return null;
  return {
    id: item.lightSlotId,
    model: lightingModelId(item.modelId),
    entitySlots: [{ ...slot, presentation: { ...slot.presentation, label: `${label} lighting` } }],
    placement: {
      at,
      elevationMeters: transform.position[1],
      rotationYRadians: transform.rotationYRadians,
      support: { kind: "surface" },
    },
  };
};
export const bindingDevicesForItem = (
  item: SceneItemSpec,
  floor: HomeBindingManifest["floors"][number],
  label = item.modelId,
): readonly DeviceSlotSpec[] => {
  const lighting = lightingDeviceForItem(item, floor, label);
  return [
    ...(item.kind === "device" ? [deviceSlotForItem(item, floor)] : []),
    ...(lighting ? [lighting] : []),
  ];
};

/** Full-home composition. Empty draft floors use composeHomeProjectPreview instead. */
export const composeHomeBindingManifest = (
  project: HomeProject,
  extensions: HomeExtensionRegistry,
): HomeBindingManifest => ({
  schemaVersion: 2,
  home: project.home,
  coordinates: project.coordinates,
  stairs: project.stairs,
  floors: project.floors.map((layout) => {
    const floor = layout;
    const openings: readonly OpeningSpec[] = floor.openings.map((opening) => {
      const profile = project.openingProfiles[opening.id];
      if (opening.kind === "passage") return opening;
      const contactSlot = profile?.contactSlot ?? {
        id: `${opening.id}-contact`,
        compatibleDeviceClasses: ["door", "window", "opening"] as const,
        openState: "on" as const,
        autoMap: "manual" as const,
      };
      if (opening.kind === "door" && opening.operation === "roll-up")
        return {
          ...opening,
          contactSlot,
          coverSlot: profile?.coverSlot ?? {
            id: `${opening.id}-cover`,
            autoMap: "manual" as const,
          },
        };
      return { ...opening, contactSlot };
    });
    const items = project.sceneItems.filter(
      (item) => (item.kind === "device" || !!item.lightSlotId) && item.floorId === floor.id,
    );
    const rooms = roomsForFloor(floor)
      .filter((room) => !room.isSolid)
      .map((room) => ({
        ...room,
        dashboardSlots: [
          ...(project.roomProfiles[room.id]?.dashboardSlots ?? []),
          ...project.sceneItems
            .filter(
              (item) =>
                item.kind === "furnishing" &&
                item.floorId === floor.id &&
                Boolean(item.entitySlots?.length) &&
                itemBelongsToRoom(item, floor, room.id, extensions.furnishingModels[item.modelId]),
            )
            .flatMap((item) => item.entitySlots ?? []),
        ],
        devices: items
          .filter((item) =>
            itemBelongsToRoom(
              item,
              floor,
              room.id,
              (item.kind === "device" ? extensions.deviceModels : extensions.furnishingModels)[
                item.modelId
              ],
            ),
          )
          .flatMap((item) =>
            bindingDevicesForItem(
              item,
              floor,
              project.customModels?.find((model) => model.id === item.modelId)?.name ??
                extensions.deviceModels[item.modelId]?.label ??
                extensions.furnishingModels[item.modelId]?.label ??
                item.modelId,
            ),
          ),
      }));
    const solidRooms = floor.rooms.filter((room) => room.isSolid);
    const roomIds = new Set(rooms.map((room) => room.id));
    return {
      ...floor,
      rooms,
      openings,
      ...(solidRooms.length ? { solidRooms } : {}),
      ...(floor.ceilings
        ? {
            ceilings: floor.ceilings
              .map((ceiling) => ({
                ...ceiling,
                roomIds: ceiling.roomIds.filter((id) => roomIds.has(id)),
              }))
              .filter((ceiling) => ceiling.roomIds.length),
          }
        : {}),
    };
  }),
  sceneItems: project.sceneItems,
  shortcuts: project.shortcuts,
  ...(project.actionBar === undefined ? {} : { actionBar: project.actionBar }),
  extensions: { ...extensions, ...resolveProjectModels(project, extensions) },
  assumptions: project.assumptions,
});

export const composeHomeManifest = (
  project: HomeProject,
  extensions: HomeExtensionRegistry,
): HomeManifest => {
  const binding = composeHomeBindingManifest(project, extensions);
  const floors = binding.floors.map((floor): RenderableFloorSpec => {
    if (floor.footprint.length < 3)
      throw new Error(`Floor “${floor.name}” has no complete footprint.`);
    return { ...floor, footprint: floor.footprint as RenderableFloorSpec["footprint"] };
  });
  return { ...binding, floors };
};

export const composeHomeProjectPreview = (
  project: HomeProject,
  extensions: HomeExtensionRegistry,
): { manifest: HomeManifest; issues: readonly import("./validation-types").HomeProjectIssue[] } => {
  const emptyFloors = project.floors.filter((floor) => floor.footprint.length < 3);
  const omittedIds = new Set(emptyFloors.map((floor) => floor.id));
  const levels = deriveFloorLevels(project.floors);
  const manifest = composeHomeManifest(
    {
      ...project,
      floors: project.floors.filter((floor) => !omittedIds.has(floor.id)),
      sceneItems: project.sceneItems.filter((item) => !omittedIds.has(item.floorId)),
    },
    extensions,
  );
  return {
    manifest: {
      ...manifest,
      floors: manifest.floors.map((floor) => ({
        ...floor,
        elevationMeters: levels.find((level) => level.floorId === floor.id)!.elevationMeters,
      })),
    },
    issues: emptyFloors.map((floor) => ({
      code: "project.floor-empty",
      path: `floors[${project.floors.indexOf(floor)}].footprint`,
      message: `Draw a closed room on “${floor.name}” before applying this floor.`,
      severity: "error",
    })),
  };
};
