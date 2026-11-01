import { isAuxiliaryEntitySlot } from "../entity-slot-roles";
import { omitUndefinedProperties } from "../defined-properties";
import { collectBindingSlots } from "../runtime-binding-profile";
import type {
  EntityId,
  EntityStateSnapshot,
  HomeAssistantRuntimeSnapshot,
  HomeManifest,
  ResolvedEntityBinding,
  ResolvedHomeBindings,
  ResolvedRoomBindings,
  RuntimeBindingProfile,
} from "../types";

export interface RoomStatusReading {
  readonly value: string;
  readonly unit: string | null;
}

export interface RoomStatusSummary {
  readonly roomId: string;
  readonly connected?: boolean;
  readonly temperature?: RoomStatusReading;
  readonly humidity?: RoomStatusReading;
  readonly heating: boolean;
  readonly cooling: boolean;
  readonly lighting?: "on" | "off";
  readonly presence?: "present" | "absent";
  readonly doorOpen: boolean;
}

export type RoomStatusMap = Readonly<Record<string, RoomStatusSummary>>;

const reliableState = (state: EntityStateSnapshot | undefined) =>
  state?.available === true &&
  state.stale === false &&
  state.state !== "unknown" &&
  state.state !== "unavailable";

const roomEntities = (
  resolved: ResolvedRoomBindings | undefined,
): readonly ResolvedEntityBinding[] =>
  resolved
    ? [
        ...resolved.sections.primary,
        ...resolved.sections.secondary,
        ...resolved.sections.diagnostic,
        ...resolved.devices.flatMap((device) => device.entities),
      ]
    : [];

const areaReading = (
  entityId: EntityId | null | undefined,
  runtime: HomeAssistantRuntimeSnapshot,
): RoomStatusReading | undefined => {
  if (!entityId?.startsWith("sensor.")) return undefined;
  const state = runtime.entityStates[entityId];
  if (!reliableState(state)) return undefined;
  const unit = state.attributes.unit_of_measurement;
  return {
    value: state.state,
    unit: typeof unit === "string" ? unit : null,
  };
};

const roomReading = (
  entityId: EntityId | null | undefined,
  deviceClass: "temperature" | "humidity",
  entities: readonly ResolvedEntityBinding[],
  runtime: HomeAssistantRuntimeSnapshot,
): RoomStatusReading | undefined => {
  const preferred = areaReading(entityId, runtime);
  if (preferred) return preferred;
  for (const binding of entities) {
    if (binding.domain !== "sensor" || binding.state?.attributes.device_class !== deviceClass)
      continue;
    const reading = areaReading(binding.entityId, runtime);
    if (reading) return reading;
  }
  return undefined;
};

const climateMode = (state: EntityStateSnapshot): "heating" | "cooling" | null => {
  const action = state.attributes.hvac_action;
  if (action === "heating" || action === "cooling") return action;
  if (state.state === "heat") return "heating";
  if (state.state === "cool") return "cooling";
  return null;
};

export const deriveRoomStatusMap = (
  manifest: HomeManifest,
  profile: RuntimeBindingProfile,
  resolved: ResolvedHomeBindings,
  runtime: HomeAssistantRuntimeSnapshot,
): RoomStatusMap => {
  const auxiliarySlotIds = new Set(
    manifest.sceneItems.flatMap((item) =>
      (item.entitySlots ?? []).filter(isAuxiliaryEntitySlot).map((slot) => slot.id),
    ),
  );
  const doorIds = new Set(
    manifest.floors
      .flatMap((floor) => floor.openings)
      .filter((opening) => opening.kind === "door")
      .map((opening) => opening.id),
  );
  const doorRoomIds = new Map(
    collectBindingSlots(manifest)
      .filter(
        (descriptor) =>
          descriptor.kind === "opening-contact" &&
          descriptor.openingId &&
          doorIds.has(descriptor.openingId),
      )
      .map((descriptor) => [descriptor.openingId!, descriptor.roomIds] as const),
  );

  return Object.fromEntries(
    manifest.floors
      .flatMap((floor) => floor.rooms)
      .map((room) => {
        const area = runtime.areas.find(
          (candidate) => candidate.area_id === profile.roomAreaIds[room.id],
        );
        const entities = roomEntities(resolved.rooms[room.id]);
        const reliableEntities = entities.filter(
          (binding) => !auxiliarySlotIds.has(binding.slotId) && reliableState(binding.state),
        );
        const climateModes = reliableEntities
          .filter((binding) => binding.domain === "climate")
          .map((binding) => climateMode(binding.state!));
        const lightStates = reliableEntities
          .filter((binding) => binding.domain === "light")
          .map((binding) => binding.state!.state)
          .filter((state): state is "on" | "off" => state === "on" || state === "off");
        const presenceStates = reliableEntities
          .filter(
            (binding) =>
              binding.domain === "binary_sensor" &&
              ["motion", "occupancy", "presence"].includes(
                String(binding.state!.attributes.device_class),
              ),
          )
          .map((binding) => binding.state!.state)
          .filter((state): state is "on" | "off" => state === "on" || state === "off");
        const doorOpen = Object.values(resolved.openings).some(
          (opening) =>
            opening.state === "open" &&
            Boolean(opening.entityId && reliableState(runtime.entityStates[opening.entityId])) &&
            Boolean(doorRoomIds.get(opening.openingId)?.includes(room.id)),
        );

        const summary: RoomStatusSummary = omitUndefinedProperties({
          roomId: room.id,
          connected: Boolean(area),
          temperature: roomReading(
            area?.temperature_entity_id,
            "temperature",
            reliableEntities,
            runtime,
          ),
          humidity: roomReading(area?.humidity_entity_id, "humidity", reliableEntities, runtime),
          heating: climateModes.includes("heating"),
          cooling: climateModes.includes("cooling"),
          lighting:
            lightStates.length === 0 ? undefined : lightStates.includes("on") ? "on" : "off",
          presence:
            presenceStates.length === 0
              ? undefined
              : presenceStates.includes("on")
                ? "present"
                : "absent",
          doorOpen,
        });
        return [room.id, summary] as const;
      }),
  );
};
