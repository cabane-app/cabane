import { isWeatherSource } from "./weather/weather-state";
import { omitUndefinedProperties } from "./defined-properties";
import { bindingDomainMatchRank } from "./binding-slot-compatibility";
import { entityAreaId } from "./binding-entity-candidates";
import {
  BindingProfileValidationIssue,
  BindingProfileValidationResult,
  entityDomain,
  LEGACY_RUNTIME_BINDING_PROFILE_STORAGE_PREFIX,
  RUNTIME_BINDING_PROFILE_SCHEMA_VERSION,
  RUNTIME_BINDING_PROFILE_STORAGE_PREFIX,
} from "./binding-profile-contract";
import {
  allowsCrossAreaEntityBinding,
  compatibleDeviceClass,
  isOpeningContactEntity,
} from "./binding-slot-compatibility";
import { collectBindingSlots } from "./binding-slot-descriptors";
import type {
  EntityId,
  HomeAssistantRuntimeSnapshot,
  HomeBindingManifest,
  RuntimeBindingProfile,
} from "./types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isEntityId = (value: unknown): value is EntityId =>
  typeof value === "string" && /^[a-z0-9_]+\.[a-z0-9_]+$/i.test(value);

export const createEmptyRuntimeBindingProfile = (homeId: string): RuntimeBindingProfile => ({
  schemaVersion: RUNTIME_BINDING_PROFILE_SCHEMA_VERSION,
  homeId,
  roomAreaIds: {},
  entityIdsBySlotId: {},
});

export const normalizeBindingOrigin = (origin: string) => {
  const parsed = new URL(origin);
  return parsed.origin.toLowerCase();
};

export const runtimeBindingProfileStorageKey = (origin: string, homeId: string) =>
  `${RUNTIME_BINDING_PROFILE_STORAGE_PREFIX}:${encodeURIComponent(normalizeBindingOrigin(origin))}:${encodeURIComponent(homeId)}`;

export const legacyRuntimeBindingProfileStorageKey = (origin: string, homeId: string) =>
  `${LEGACY_RUNTIME_BINDING_PROFILE_STORAGE_PREFIX}:${encodeURIComponent(normalizeBindingOrigin(origin))}:${encodeURIComponent(homeId)}`;

export const validateRuntimeBindingProfile = (
  input: unknown,
  manifest: HomeBindingManifest,
  runtime?: HomeAssistantRuntimeSnapshot,
): BindingProfileValidationResult => {
  const issues: BindingProfileValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (!isObject(input)) {
    add("profile.type", "$", "The binding profile must be a JSON object.");
    return { issues, valid: false };
  }
  if (input.schemaVersion !== RUNTIME_BINDING_PROFILE_SCHEMA_VERSION) {
    add("profile.schema", "schemaVersion", "This binding profile schema is not supported.");
  }
  if (input.homeId !== manifest.home.id) {
    add(
      "profile.home",
      "homeId",
      `This profile belongs to a different home, not "${manifest.home.id}".`,
    );
  }
  if (!isObject(input.roomAreaIds))
    add("profile.rooms", "roomAreaIds", "Room mappings must be an object.");
  if (!isObject(input.entityIdsBySlotId))
    add("profile.slots", "entityIdsBySlotId", "Entity mappings must be an object.");
  const roomIds = new Set(manifest.floors.flatMap((floor) => floor.rooms).map((room) => room.id));
  const descriptors = collectBindingSlots(manifest);
  const descriptorsById = new Map(descriptors.map((descriptor) => [descriptor.slotId, descriptor]));
  const claimedAreas = new Map<string, string>();
  if (isObject(input.roomAreaIds))
    for (const [roomId, areaId] of Object.entries(input.roomAreaIds)) {
      const path = `roomAreaIds.${roomId}`;
      if (!roomIds.has(roomId)) add("profile.room-id", path, `Unknown room ID "${roomId}".`);
      if (typeof areaId !== "string" || !areaId)
        add("profile.area-id", path, "Area IDs must be non-empty strings.");
      else {
        const owner = claimedAreas.get(areaId);
        if (owner && owner !== roomId)
          add(
            "profile.area-duplicate",
            path,
            `Area "${areaId}" is already mapped to room "${owner}".`,
          );
        claimedAreas.set(areaId, roomId);
        if (runtime && !runtime.areas.some((area) => area.area_id === areaId)) {
          add(
            "profile.area-missing",
            path,
            `Area "${areaId}" is not present in the current Home Assistant registry.`,
          );
        }
      }
    }
  if (isObject(input.entityIdsBySlotId))
    for (const [slotId, entityId] of Object.entries(input.entityIdsBySlotId)) {
      const path = `entityIdsBySlotId.${slotId}`;
      const descriptor = descriptorsById.get(slotId);
      if (!descriptor) add("profile.slot-id", path, `Unknown binding slot ID "${slotId}".`);
      if (!isEntityId(entityId)) {
        add("profile.entity-id", path, "Entity IDs must use exact domain.object syntax.");
        continue;
      }
      if (!descriptor) continue;
      const mappedRoomIds = descriptor.roomIds.filter(
        (roomId) => isObject(input.roomAreaIds) && typeof input.roomAreaIds[roomId] === "string",
      );
      if (
        mappedRoomIds.length === 0 &&
        descriptor.roomIds.length > 0 &&
        !allowsCrossAreaEntityBinding(manifest, descriptor)
      ) {
        add(
          "profile.room-unmapped",
          path,
          `Slot "${slotId}" cannot be mapped until one of its rooms has an area mapping.`,
        );
      }
      if (
        bindingDomainMatchRank(descriptor.spec, entityDomain(entityId), descriptor.deviceModel) < 0
      ) {
        add(
          "profile.domain",
          path,
          `Entity "${entityId}" has an incompatible domain for slot "${slotId}".`,
        );
      }
      if (runtime) {
        const entry = runtime.entityRegistry.find((candidate) => candidate.entity_id === entityId);
        if (!entry)
          add(
            "profile.entity-missing",
            path,
            `Entity "${entityId}" is not present in the current Home Assistant registry.`,
          );
        if (
          !(descriptor.kind === "opening-contact"
            ? isOpeningContactEntity(entityId, runtime)
            : compatibleDeviceClass(descriptor.spec, entityId, runtime))
        ) {
          add(
            "profile.device-class",
            path,
            `Entity "${entityId}" has an incompatible or missing device class for slot "${slotId}".`,
          );
        }
        if (
          mappedRoomIds.length > 0 &&
          entry &&
          !allowsCrossAreaEntityBinding(manifest, descriptor)
        ) {
          const actualArea = entityAreaId(entry, runtime);
          const expectedAreas = mappedRoomIds.map(
            (roomId) => (input.roomAreaIds as Record<string, unknown>)[roomId],
          );
          if (!expectedAreas.includes(actualArea)) {
            add(
              "profile.area",
              path,
              `Entity "${entityId}" does not belong to the slot's mapped room area.`,
            );
          }
        }
      }
    }
  if (input.actionEntityIdsByShortcutId !== undefined) {
    if (!isObject(input.actionEntityIdsByShortcutId))
      add("profile.actions", "actionEntityIdsByShortcutId", "Shortcut mappings must be an object.");
    else
      for (const [id, entityId] of Object.entries(input.actionEntityIdsByShortcutId)) {
        const path = `actionEntityIdsByShortcutId.${id}`;
        const target = manifest.actionBar?.items.find((item) => item.id === id)?.target;
        if (!target || (target.kind !== "scene" && target.kind !== "script"))
          add("profile.action-id", path, "Unknown scene or script shortcut.");
        else if (!isEntityId(entityId) || entityDomain(entityId) !== target.kind)
          add(
            "profile.action-domain",
            path,
            "The shortcut requires an entity of its configured action kind.",
          );
      }
  }
  if (input.weatherSource !== undefined && !isWeatherSource(input.weatherSource))
    add("profile.weather", "weatherSource", "Choose Automatic, Off, or a weather entity.");
  const valid = issues.length === 0;
  return omitUndefinedProperties({
    profile: valid
      ? {
          ...(isWeatherSource(input.weatherSource) ? { weatherSource: input.weatherSource } : {}),
          schemaVersion: 1 as const,
          homeId: input.homeId as string,
          roomAreaIds: { ...(input.roomAreaIds as Record<string, string>) },
          entityIdsBySlotId: { ...(input.entityIdsBySlotId as Record<string, EntityId>) },
          ...(input.actionEntityIdsByShortcutId !== undefined
            ? {
                actionEntityIdsByShortcutId: {
                  ...(input.actionEntityIdsByShortcutId as Record<string, EntityId>),
                },
              }
            : {}),
        }
      : undefined,
    issues,
    valid,
  });
};

export const exportRuntimeBindingProfile = (profile: RuntimeBindingProfile) =>
  JSON.stringify(
    {
      weatherSource: profile.weatherSource,
      schemaVersion: profile.schemaVersion,
      homeId: profile.homeId,
      roomAreaIds: profile.roomAreaIds,
      entityIdsBySlotId: profile.entityIdsBySlotId,
      actionEntityIdsByShortcutId: profile.actionEntityIdsByShortcutId,
    },
    null,
    2,
  );

export const importRuntimeBindingProfile = (
  json: string,
  manifest: HomeBindingManifest,
  runtime: HomeAssistantRuntimeSnapshot,
): BindingProfileValidationResult => {
  try {
    return validateRuntimeBindingProfile(JSON.parse(json), manifest, runtime);
  } catch {
    return {
      issues: [
        { code: "profile.json", path: "$", message: "The selected file is not valid JSON." },
      ],
      valid: false,
    };
  }
};

export const loadRuntimeBindingProfile = (
  storage: Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">>,
  origin: string,
  manifest: HomeBindingManifest,
) => {
  const key = runtimeBindingProfileStorageKey(origin, manifest.home.id);
  const current = storage.getItem(key);
  const raw =
    current ?? storage.getItem(legacyRuntimeBindingProfileStorageKey(origin, manifest.home.id));
  if (raw === null) return null;
  try {
    const profile = validateRuntimeBindingProfile(JSON.parse(raw), manifest).profile ?? null;
    if (profile && current === null) storage.setItem?.(key, exportRuntimeBindingProfile(profile));
    return profile;
  } catch {
    return null;
  }
};

export const saveRuntimeBindingProfile = (
  storage: Pick<Storage, "setItem">,
  origin: string,
  profile: RuntimeBindingProfile,
) =>
  storage.setItem(
    runtimeBindingProfileStorageKey(origin, profile.homeId),
    exportRuntimeBindingProfile(profile),
  );

export const replaceRoomAreaMapping = (
  profile: RuntimeBindingProfile,
  roomId: string,
  areaId: string | null,
): RuntimeBindingProfile => {
  const roomAreaIds = { ...profile.roomAreaIds };
  if (areaId) {
    for (const [otherRoomId, candidate] of Object.entries(roomAreaIds)) {
      if (candidate === areaId && otherRoomId !== roomId) delete roomAreaIds[otherRoomId];
    }
    roomAreaIds[roomId] = areaId;
  } else delete roomAreaIds[roomId];
  return { ...profile, roomAreaIds };
};

export const replaceEntitySlotMapping = (
  profile: RuntimeBindingProfile,
  slotId: string,
  entityId: EntityId | null,
): RuntimeBindingProfile => {
  const entityIdsBySlotId = { ...profile.entityIdsBySlotId };
  if (entityId) {
    entityIdsBySlotId[slotId] = entityId;
  } else delete entityIdsBySlotId[slotId];
  return { ...profile, entityIdsBySlotId };
};

export { automaticallyMapRuntimeBindings } from "./automatic-binding-mapping";
export { bindingEntityCandidates, entityAreaId } from "./binding-entity-candidates";
export {
  LEGACY_RUNTIME_BINDING_PROFILE_STORAGE_PREFIX,
  RUNTIME_BINDING_PROFILE_SCHEMA_VERSION,
  RUNTIME_BINDING_PROFILE_STORAGE_PREFIX,
} from "./binding-profile-contract";
export type {
  BindingEntityCandidate,
  BindingEntityCandidateScope,
  BindingProfileValidationIssue,
  BindingProfileValidationResult,
} from "./binding-profile-contract";
export {
  allowsCrossAreaEntityBinding,
  entityMatchesBindingSlot,
  isShareableCameraDescriptor,
  isShareableCameraSlot,
} from "./binding-slot-compatibility";
export { collectBindingSlots } from "./binding-slot-descriptors";
