import { collectBindingSlots } from "../../binding-slot-descriptors";
import type {
  EntityId,
  HomeAssistantRuntimeSnapshot,
  HomeManifest,
  RuntimeBindingProfile,
} from "../../types";
import { createDemoDeviceState, demoDomain } from "./demo-device-state";

export interface DemoSessionDefinition {
  runtime: HomeAssistantRuntimeSnapshot;
  profile: RuntimeBindingProfile;
  sampleEntityId: EntityId | null;
  sampleRoomId: string | null;
  sampleSlotId: string | null;
  sampleLabel: string | null;
}
// Injective encoding keeps IDs stable across reordering and punctuation.
const encode = (id: string) =>
  Array.from(id, (character) => character.codePointAt(0)!.toString(16)).join("_");

export function deriveDemoSessionDefinition(
  manifest: HomeManifest,
  night = false,
): DemoSessionDefinition {
  const rooms = manifest.floors.flatMap((floor) => floor.rooms);
  const doorIds = new Set(
    manifest.floors.flatMap((floor) =>
      floor.openings.filter((opening) => opening.kind === "door").map((opening) => opening.id),
    ),
  );
  const slots = collectBindingSlots(manifest).flatMap((descriptor) => {
    // Demo doors use local proximity without simulated contact/cover controls.
    if (
      (descriptor.kind === "opening-contact" || descriptor.kind === "opening-cover") &&
      descriptor.openingId &&
      doorIds.has(descriptor.openingId)
    )
      return [];
    const domain = demoDomain(descriptor.spec);
    const room = rooms.find((candidate) => candidate.id === descriptor.roomIds[0]);
    if (!domain) return [];
    const entityId: EntityId = `${domain}.cabane_demo_${encode(descriptor.slotId)}`;
    return [
      {
        descriptor,
        domain,
        room,
        entityId,
        areaId: room ? `cabane_demo_${encode(room.id)}` : null,
      },
    ];
  });
  const sample =
    slots.find((slot) => slot.domain === "light") ?? slots.find((slot) => slot.domain === "switch");
  const activeRooms = new Map(
    slots.flatMap((slot) =>
      slot.room && slot.areaId
        ? [[slot.room.id, { room: slot.room, areaId: slot.areaId }] as const]
        : [],
    ),
  );
  return {
    runtime: {
      status: "connected",
      configured: false,
      canMutate: slots.some((slot) => !["sensor", "binary_sensor", "event"].includes(slot.domain)),
      origin: null,
      error: null,
      areas: [...activeRooms.values()].map(({ room, areaId }) => ({
        area_id: areaId,
        name: room.name,
        icon: "mdi:home-outline",
        picture: null,
        temperature_entity_id:
          slots.find(
            (slot) =>
              slot.room?.id === room.id &&
              slot.domain === "sensor" &&
              slot.descriptor.spec.compatibleDeviceClasses?.[0] === "temperature",
          )?.entityId ?? null,
        humidity_entity_id:
          slots.find(
            (slot) =>
              slot.room?.id === room.id &&
              slot.domain === "sensor" &&
              slot.descriptor.spec.compatibleDeviceClasses?.[0] === "humidity",
          )?.entityId ?? null,
      })),
      devices: [],
      entityRegistry: slots.map(({ entityId, areaId, descriptor }) => ({
        entity_id: entityId,
        area_id: areaId,
        device_id: null,
        platform: "cabane_demo",
        disabled_by: null,
        hidden_by: null,
        name: descriptor.spec.presentation.label,
        original_name: descriptor.spec.presentation.label,
      })),
      entityStates: Object.fromEntries(
        slots.map(({ entityId, domain, descriptor }) => [
          entityId,
          createDemoDeviceState(entityId, domain, descriptor.spec, night),
        ]),
      ),
    },
    profile: {
      schemaVersion: 1,
      homeId: manifest.home.id,
      roomAreaIds: Object.fromEntries(
        [...activeRooms.values()].map(({ room, areaId }) => [room.id, areaId]),
      ),
      entityIdsBySlotId: Object.fromEntries(
        slots.map(({ descriptor, entityId }) => [descriptor.slotId, entityId]),
      ),
    },
    sampleEntityId: sample?.entityId ?? null,
    sampleRoomId: sample?.room?.id ?? null,
    sampleSlotId: sample?.descriptor.slotId ?? null,
    sampleLabel: sample?.descriptor.spec.presentation.label ?? null,
  };
}
