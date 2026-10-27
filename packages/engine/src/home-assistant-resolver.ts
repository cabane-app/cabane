import { omitUndefinedProperties } from "./defined-properties";
import { coverPosition } from "./cover-state";
import { bindingDomainMatchRank } from "./binding-slot-compatibility";
import { deviceMappingRooms } from "./outside-room-devices";
import { isOpeningContactEntity } from "./binding-slot-compatibility";
import {
  allowsCrossAreaEntityBinding,
  collectBindingSlots,
  entityAreaId,
} from "./runtime-binding-profile";
import { runtimeRoomDisplayName } from "./home-assistant-mapping/room-display-name";
import type {
  BindingSlotDescriptor,
  DeviceModelRegistry,
  EntityId,
  HomeAssistantBindingIssue,
  HomeAssistantRuntimeSnapshot,
  HomeManifest,
  OpeningSpec,
  ResolvedDeviceBinding,
  ResolvedEntityBinding,
  ResolvedHomeBindings,
  ResolvedOpeningBinding,
  ResolvedOpeningState,
  ResolvedRoomBindings,
  RoomSpec,
  RuntimeBindingProfile,
} from "./types";

export const entityDomain = (entityId: string) => entityId.split(".", 1)[0];

export const resolveHomeAssistantPictureUrl = (
  picture: string | null | undefined,
  homeAssistantUrl: string | null | undefined,
) => {
  if (!picture || !homeAssistantUrl) return null;

  try {
    return new URL(picture, `${homeAssistantUrl.replace(/\/$/, "")}/`).toString();
  } catch {
    return null;
  }
};

const issue = (
  values: Omit<HomeAssistantBindingIssue, "severity"> & {
    severity?: HomeAssistantBindingIssue["severity"];
  },
): HomeAssistantBindingIssue => ({ severity: "error", ...values });

const runtimeHasRegistryContext = (runtime: HomeAssistantRuntimeSnapshot) =>
  runtime.status === "connected" || runtime.status === "reconnecting";

const areaClaimCounts = (profile: RuntimeBindingProfile) => {
  const counts = new Map<string, number>();
  for (const areaId of Object.values(profile.roomAreaIds)) {
    counts.set(areaId, (counts.get(areaId) ?? 0) + 1);
  }
  return counts;
};

const resolveEntity = ({
  entityId,
  descriptor,
  room,
  manifest,
  profile,
  runtime,
}: {
  entityId: EntityId;
  descriptor: BindingSlotDescriptor;
  room: RoomSpec;
  manifest: HomeManifest;
  profile: RuntimeBindingProfile;
  runtime: HomeAssistantRuntimeSnapshot;
}): ResolvedEntityBinding => {
  const path = `runtimeProfile.entityIdsBySlotId.${descriptor.slotId}`;
  const registry = runtime.entityRegistry.find((entry) => entry.entity_id === entityId);
  const state = runtime.entityStates[entityId];
  const areaId = entityAreaId(registry, runtime);
  const expectedAreaId = profile.roomAreaIds[room.id] ?? null;
  const domain = entityDomain(entityId);
  const issues: HomeAssistantBindingIssue[] = [];
  const hasContext = runtimeHasRegistryContext(runtime);

  if (hasContext && !registry && !state) {
    issues.push(
      issue({
        code: "binding.entity-missing",
        path,
        entityId,
        roomId: room.id,
        slotId: descriptor.slotId,
        message: `Mapped entity "${entityId}" no longer exists. Clear or replace this binding.`,
      }),
    );
  } else if (hasContext && !registry) {
    issues.push(
      issue({
        code: "binding.registry-missing",
        path,
        entityId,
        roomId: room.id,
        slotId: descriptor.slotId,
        message: `Mapped entity "${entityId}" has live state but no registry entry, so its area cannot be verified.`,
      }),
    );
  } else if (hasContext && !state) {
    issues.push(
      issue({
        code: "binding.state-missing",
        path,
        entityId,
        roomId: room.id,
        slotId: descriptor.slotId,
        message: `Mapped entity "${entityId}" has no live state. It may be renamed or disabled.`,
      }),
    );
  }
  if (hasContext && registry?.disabled_by) {
    issues.push(
      issue({
        code: "binding.disabled",
        path,
        entityId,
        roomId: room.id,
        slotId: descriptor.slotId,
        message: `Mapped entity "${entityId}" is disabled in Home Assistant.`,
      }),
    );
  }
  if (hasContext && registry?.hidden_by) {
    issues.push(
      issue({
        code: "binding.hidden",
        severity: "warning",
        path,
        entityId,
        roomId: room.id,
        slotId: descriptor.slotId,
        message: `Mapped entity "${entityId}" is hidden in Home Assistant.`,
      }),
    );
  }
  if (
    hasContext &&
    registry &&
    expectedAreaId &&
    areaId !== expectedAreaId &&
    !allowsCrossAreaEntityBinding(manifest, descriptor)
  ) {
    issues.push(
      issue({
        code: "binding.area-mismatch",
        path,
        entityId,
        roomId: room.id,
        slotId: descriptor.slotId,
        message: areaId
          ? `Mapped entity "${entityId}" belongs to area "${areaId}", not "${expectedAreaId}".`
          : `Mapped entity "${entityId}" is not assigned to mapped area "${expectedAreaId}".`,
      }),
    );
  }
  if (bindingDomainMatchRank(descriptor.spec, domain) < 0) {
    issues.push(
      issue({
        code: "binding.domain-incompatible",
        path,
        entityId,
        roomId: room.id,
        slotId: descriptor.slotId,
        message: `Mapped entity "${entityId}" uses incompatible domain "${domain}".`,
      }),
    );
  }
  if (descriptor.spec.compatibleDeviceClasses?.length) {
    const deviceClass = state?.attributes.device_class;
    if (
      descriptor.kind === "opening-contact"
        ? !isOpeningContactEntity(entityId, runtime)
        : !descriptor.spec.compatibleDeviceClasses.includes(String(deviceClass))
    ) {
      issues.push(
        issue({
          code: "binding.device-class-incompatible",
          path,
          entityId,
          roomId: room.id,
          slotId: descriptor.slotId,
          message:
            typeof deviceClass === "string"
              ? `Mapped entity "${entityId}" uses device class "${deviceClass}", not ${descriptor.spec.compatibleDeviceClasses.join(", ")}.`
              : `Mapped entity "${entityId}" is missing a compatible device class (${descriptor.spec.compatibleDeviceClasses.join(", ")}).`,
        }),
      );
    }
  }
  if (hasContext && state && !state.available) {
    issues.push(
      issue({
        code: "binding.unavailable",
        severity: "warning",
        path,
        entityId,
        roomId: room.id,
        slotId: descriptor.slotId,
        message: `Mapped entity "${entityId}" is currently ${state.state}.`,
      }),
    );
  }

  return omitUndefinedProperties({
    entityId,
    domain,
    path,
    label: descriptor.spec.presentation.label,
    roomId: room.id,
    slotId: descriptor.slotId,
    deviceSlotId: descriptor.deviceSlotId,
    registry,
    state,
    areaId,
    deviceId: registry?.device_id ?? null,
    issues,
  });
};

const unmappedSlotIssue = (
  descriptor: BindingSlotDescriptor,
  room: RoomSpec,
): HomeAssistantBindingIssue =>
  issue({
    code: "binding.slot-unmapped",
    severity: descriptor.spec.required ? "error" : "warning",
    path: `runtimeProfile.entityIdsBySlotId.${descriptor.slotId}`,
    roomId: room.id,
    slotId: descriptor.slotId,
    message: `${descriptor.spec.presentation.label} is not mapped to a Home Assistant entity.`,
  });

export const deriveOpeningState = (
  opening: OpeningSpec,
  entityId: EntityId | undefined,
  runtime: HomeAssistantRuntimeSnapshot,
): ResolvedOpeningState => {
  if (!opening.contactSlot || !entityId) return "unavailable";
  const state = runtime.entityStates[entityId];
  if (!state?.available || state.stale) return "unavailable";
  if (state.state === opening.contactSlot.openState) return "open";
  if (state.state === (opening.contactSlot.openState === "on" ? "off" : "on")) return "closed";
  return "unavailable";
};

export const resolveHomeAssistantBindings = (
  manifest: HomeManifest,
  profile: RuntimeBindingProfile,
  runtime: HomeAssistantRuntimeSnapshot,
  _deviceModels: DeviceModelRegistry = {},
): ResolvedHomeBindings => {
  const descriptors = collectBindingSlots(manifest);
  const descriptorsById = new Map(descriptors.map((descriptor) => [descriptor.slotId, descriptor]));
  const areaCounts = areaClaimCounts(profile);
  const rooms: Record<string, ResolvedRoomBindings> = {};
  const allIssues: HomeAssistantBindingIssue[] = [];

  const openings: Record<string, ResolvedOpeningBinding> = {};
  for (const floor of manifest.floors) {
    deviceMappingRooms(manifest, floor.id).forEach((room) => {
      const roomIssues: HomeAssistantBindingIssue[] = [];
      const areaId = profile.roomAreaIds[room.id];
      const area = runtime.areas.find((candidate) => candidate.area_id === areaId);
      if (!areaId && floor.rooms.some((candidate) => candidate.id === room.id)) {
        roomIssues.push(
          issue({
            code: "binding.area-unmapped",
            severity: "warning",
            path: `runtimeProfile.roomAreaIds.${room.id}`,
            roomId: room.id,
            message: `${room.name} is not mapped to a Home Assistant area.`,
          }),
        );
      } else if (areaId) {
        if (
          runtimeHasRegistryContext(runtime) &&
          !runtime.areas.some((area) => area.area_id === areaId)
        ) {
          roomIssues.push(
            issue({
              code: "binding.area-missing",
              path: `runtimeProfile.roomAreaIds.${room.id}`,
              roomId: room.id,
              message: `Mapped Home Assistant area "${areaId}" no longer exists.`,
            }),
          );
        }
        if ((areaCounts.get(areaId) ?? 0) > 1) {
          roomIssues.push(
            issue({
              code: "binding.area-duplicate",
              path: `runtimeProfile.roomAreaIds.${room.id}`,
              roomId: room.id,
              message: `Mapped area "${areaId}" is claimed by more than one modeled room.`,
            }),
          );
        }
      }

      const sections: {
        primary: ResolvedEntityBinding[];
        secondary: ResolvedEntityBinding[];
        diagnostic: ResolvedEntityBinding[];
      } = {
        primary: [],
        secondary: [],
        diagnostic: [],
      };
      for (const spec of room.dashboardSlots) {
        const descriptor = descriptorsById.get(spec.id)!;
        const entityId = profile.entityIdsBySlotId[spec.id];
        if (!entityId) {
          roomIssues.push(unmappedSlotIssue(descriptor, room));
          continue;
        }
        const resolved = resolveEntity({ entityId, descriptor, room, manifest, profile, runtime });
        if (spec.presentation.dashboardRole !== "hidden") {
          sections[spec.presentation.dashboardRole].push(resolved);
        }
        roomIssues.push(...resolved.issues);
      }

      for (const descriptor of descriptors.filter(
        (entry) => entry.kind === "opening-cover" && entry.roomIds.includes(room.id),
      )) {
        const entityId = profile.entityIdsBySlotId[descriptor.slotId];
        if (!entityId) continue;
        const binding = resolveEntity({ entityId, descriptor, room, manifest, profile, runtime });
        sections.primary.push(binding);
        roomIssues.push(...binding.issues);
      }

      const devices: ResolvedDeviceBinding[] = room.devices.map((slot) => {
        const entities: ResolvedEntityBinding[] = [];
        const deviceIssues: HomeAssistantBindingIssue[] = [];
        for (const spec of slot.entitySlots) {
          const descriptor = descriptorsById.get(spec.id)!;
          const entityId = profile.entityIdsBySlotId[spec.id];
          if (!entityId) {
            deviceIssues.push(unmappedSlotIssue(descriptor, room));
            continue;
          }
          const resolved = resolveEntity({
            entityId,
            descriptor,
            room,
            manifest,
            profile,
            runtime,
          });
          entities.push(resolved);
          deviceIssues.push(...resolved.issues);
        }
        const primarySlot = slot.entitySlots.find(
          (entitySlot) => entitySlot.deviceRole === "primary",
        );
        const displayEntity =
          entities.find((entity) => entity.slotId === primarySlot?.id) ?? entities[0];
        const haDevice = runtime.devices.find((device) => device.id === displayEntity?.deviceId);
        const friendlyName = displayEntity?.state?.attributes.friendly_name;
        const displayName =
          haDevice?.name_by_user?.trim() ||
          haDevice?.name?.trim() ||
          displayEntity?.registry?.name?.trim() ||
          (typeof friendlyName === "string" ? friendlyName.trim() : undefined) ||
          undefined;
        return omitUndefinedProperties({ slot, displayName, entities, issues: deviceIssues });
      });
      roomIssues.push(...devices.flatMap((device) => device.issues));
      rooms[room.id] = {
        room,
        displayName: !floor.rooms.some((candidate) => candidate.id === room.id)
          ? room.name
          : runtimeRoomDisplayName({
              floor,
              roomId: room.id,
              roomAreaIds: profile.roomAreaIds,
              areas: runtime.areas,
            }),
        pictureUrl: resolveHomeAssistantPictureUrl(area?.picture, runtime.origin),
        sections,
        devices,
        issues: roomIssues,
      };
      allIssues.push(...roomIssues);
    });

    for (const opening of floor.openings) {
      if (!opening.contactSlot && !opening.coverSlot) continue;
      const descriptor = descriptorsById.get((opening.contactSlot ?? opening.coverSlot)!.id)!;
      const entityId = opening.contactSlot
        ? profile.entityIdsBySlotId[opening.contactSlot.id]
        : undefined;
      const room = floor.rooms.find((candidate) => descriptor.roomIds.includes(candidate.id));
      let openingIssue: HomeAssistantBindingIssue | undefined;
      if (entityId && room) {
        const resolved = resolveEntity({ entityId, descriptor, room, manifest, profile, runtime });
        openingIssue = resolved.issues[0];
      }
      const coverSlotId = opening.coverSlot?.id;
      const coverEntityId = coverSlotId ? profile.entityIdsBySlotId[coverSlotId] : undefined;
      const coverDescriptor = coverSlotId ? descriptorsById.get(coverSlotId) : undefined;
      const coverBinding =
        coverEntityId && coverDescriptor && room
          ? resolveEntity({
              entityId: coverEntityId,
              descriptor: coverDescriptor,
              room,
              manifest,
              profile,
              runtime,
            })
          : undefined;
      const coverValid = !coverBinding?.issues.some((issue) => issue.severity === "error");
      const contactState = openingIssue
        ? "unavailable"
        : deriveOpeningState(opening, entityId, runtime);
      const reported =
        coverValid && coverEntityId ? coverPosition(runtime.entityStates[coverEntityId]) : null;
      const position =
        reported !== null
          ? reported / 100
          : contactState === "open"
            ? 1
            : contactState === "closed"
              ? 0
              : null;
      const state = position === null ? "unavailable" : position > 0 ? "open" : "closed";
      if (
        !openingIssue &&
        entityId &&
        state === "unavailable" &&
        runtimeHasRegistryContext(runtime)
      ) {
        const snapshot = runtime.entityStates[entityId];
        openingIssue = issue({
          code: snapshot ? "binding.unavailable" : "binding.entity-missing",
          severity: snapshot ? "warning" : "error",
          path: `runtimeProfile.entityIdsBySlotId.${descriptor.slotId}`,
          entityId,
          slotId: descriptor.slotId,
          message: snapshot
            ? `Opening contact "${entityId}" is currently ${snapshot.state}.`
            : `Opening contact "${entityId}" has no live state.`,
        });
      }
      openings[opening.id] = omitUndefinedProperties({
        openingId: opening.id,
        slotId: descriptor.slotId,
        entityId,
        state,
        position,
        available: position !== null,
        bound: Boolean(entityId || coverEntityId),
        bindingKey: JSON.stringify([
          manifest.home.id,
          opening.id,
          opening.contactSlot?.id ?? null,
          coverSlotId ?? null,
          entityId ?? null,
          coverEntityId ?? null,
        ]),
        coverSlotId,
        coverEntityId,
        issue: coverBinding?.issues[0] ?? openingIssue,
      });
      if (openingIssue) allIssues.push(openingIssue);
    }
  }
  return { rooms, openings, issues: allIssues };
};

export const bindingCanMutate = (binding: ResolvedEntityBinding) =>
  Boolean(
    binding.domain !== "event" &&
    binding.state?.available &&
    !binding.state.stale &&
    !binding.issues.some((candidate) => candidate.severity === "error"),
  );
