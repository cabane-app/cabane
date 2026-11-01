import { isAuxiliaryEntitySlot } from "./entity-slot-roles";
import {
  bindingEntityCandidates,
  collectBindingSlots,
  replaceEntitySlotMapping,
  replaceRoomAreaMapping,
} from "./runtime-binding-profile";
import type {
  DeviceSlotSpec,
  EntityId,
  FloorSpec,
  HomeAssistantRuntimeSnapshot,
  HomeBindingManifest,
  RuntimeBindingProfile,
} from "./types";

export interface DeviceMappingCandidate {
  deviceId: string;
  label: string;
  entityIdsBySlotId: Readonly<Record<string, EntityId>>;
  unresolvedSlotIds: readonly string[];
  selectable: boolean;
}

export const replaceRoomAreaAndClearSlots = (
  manifest: HomeBindingManifest,
  profile: RuntimeBindingProfile,
  roomId: string,
  areaId: string | null,
) => {
  const affected = new Set(
    collectBindingSlots(manifest)
      .filter((descriptor) => descriptor.roomIds.includes(roomId))
      .map((descriptor) => descriptor.slotId),
  );
  const next = replaceRoomAreaMapping(profile, roomId, areaId);
  return {
    ...next,
    entityIdsBySlotId: Object.fromEntries(
      Object.entries(next.entityIdsBySlotId).filter(([slotId]) => !affected.has(slotId)),
    ) as Record<string, EntityId>,
  };
};

export const planBounds = (floor: FloorSpec) => {
  const xs = floor.footprint.map(([x]) => x);
  const ys = floor.footprint.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    minX,
    minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
};

export const deviceMappingCandidates = ({
  manifest,
  roomId,
  device,
  profile,
  runtime,
}: {
  manifest: HomeBindingManifest;
  roomId: string;
  device: DeviceSlotSpec;
  profile: RuntimeBindingProfile;
  runtime: HomeAssistantRuntimeSnapshot;
}): readonly DeviceMappingCandidate[] =>
  runtime.devices
    .map((haDevice) => {
      const entityIdsBySlotId: Record<string, EntityId> = {};
      const unresolvedSlotIds: string[] = [];
      let compatibleMatchCount = 0;
      let matchRank = 0;
      for (const slot of device.entitySlots.filter((slot) => !isAuxiliaryEntitySlot(slot))) {
        const descriptor = collectBindingSlots(manifest).find(
          (candidate) => candidate.slotId === slot.id,
        );
        if (!descriptor) continue;
        const compatible = bindingEntityCandidates({ descriptor, roomId, profile, runtime }).filter(
          (candidate) =>
            runtime.entityRegistry.find((entry) => entry.entity_id === candidate.entityId)
              ?.device_id === haDevice.id,
        );
        const bestRank = Math.min(...compatible.map((candidate) => candidate.matchRank));
        const matches = compatible.filter((candidate) => candidate.matchRank === bestRank);
        if (matches.length) matchRank = Math.max(matchRank, bestRank);
        compatibleMatchCount += matches.length;
        if (matches.length === 1) entityIdsBySlotId[slot.id] = matches[0].entityId;
        else if (slot.required || matches.length > 1) unresolvedSlotIds.push(slot.id);
      }
      return {
        deviceId: haDevice.id,
        label: haDevice.name_by_user ?? haDevice.name ?? haDevice.model ?? haDevice.id,
        entityIdsBySlotId,
        unresolvedSlotIds,
        selectable: unresolvedSlotIds.length === 0 && Object.keys(entityIdsBySlotId).length > 0,
        compatibleMatchCount,
        matchRank,
      };
    })
    .filter((candidate) => candidate.compatibleMatchCount > 0)
    .sort(
      (left, right) => left.matchRank - right.matchRank || left.label.localeCompare(right.label),
    )
    .map(
      ({ compatibleMatchCount: _compatibleMatchCount, matchRank: _matchRank, ...candidate }) =>
        candidate,
    );

export const applyDeviceMapping = (
  profile: RuntimeBindingProfile,
  device: DeviceSlotSpec,
  candidate: DeviceMappingCandidate | null,
) => {
  let next = profile;
  for (const slot of device.entitySlots.filter((slot) => !isAuxiliaryEntitySlot(slot)))
    next = replaceEntitySlotMapping(next, slot.id, null);
  if (!candidate) return next;
  for (const [slotId, entityId] of Object.entries(candidate.entityIdsBySlotId)) {
    next = replaceEntitySlotMapping(next, slotId, entityId);
  }
  return next;
};

export const mappedHomeAssistantDeviceId = (
  profile: RuntimeBindingProfile,
  device: DeviceSlotSpec,
  runtime: HomeAssistantRuntimeSnapshot,
) => {
  const deviceIds = new Set(
    device.entitySlots
      .filter((slot) => !isAuxiliaryEntitySlot(slot))
      .map((slot) => profile.entityIdsBySlotId[slot.id])
      .map(
        (entityId) =>
          runtime.entityRegistry.find((entry) => entry.entity_id === entityId)?.device_id,
      )
      .filter((deviceId): deviceId is string => Boolean(deviceId)),
  );
  return deviceIds.size === 1 ? [...deviceIds][0] : null;
};
