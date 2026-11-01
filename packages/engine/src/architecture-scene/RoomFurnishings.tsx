import type {
  DeviceLiveMedia,
  EntityId,
  EntityStateSnapshot,
  ExtensionInteractionTarget,
  FloorSpec,
  HomeExtensionRegistry,
  ResolvedHomeBindings,
  RoomSpec,
} from "../types";

export function Furnishings({
  floor,
  room,
  extensions,
  resolvedBindings,
  walkMode,
  reducedMotion,
  onInteract,
}: {
  floor: FloorSpec;
  room: RoomSpec;
  extensions: HomeExtensionRegistry;
  resolvedBindings: ResolvedHomeBindings;
  walkMode: boolean;
  reducedMotion: boolean;
  onInteract: (target: ExtensionInteractionTarget) => void;
}) {
  if (!room.furnishings) return null;
  const roomRegistry = extensions.roomFurnishings;
  const Component =
    roomRegistry && Object.hasOwn(roomRegistry, room.furnishings)
      ? roomRegistry[room.furnishings]
      : undefined;
  if (!Component) return null;
  const resolvedRoom = resolvedBindings.rooms[room.id];
  const relevantEntities = [
    ...Object.values(resolvedRoom?.sections ?? {}).flat(),
    ...(resolvedRoom?.devices.flatMap((device) => device.entities) ?? []),
  ];
  const relevantStates = Object.fromEntries(
    relevantEntities
      .filter((entity) => entity.state)
      .map((entity) => [entity.entityId, entity.state!]),
  ) as Readonly<Record<EntityId, EntityStateSnapshot>>;
  const statesBySlotId = Object.fromEntries(
    relevantEntities
      .filter((entity) => entity.state)
      .map((entity) => [entity.slotId, entity.state!]),
  ) as Readonly<Record<string, EntityStateSnapshot>>;
  return (
    <Component
      coordinates={floor.coordinates}
      room={room}
      entityStates={relevantStates}
      entityStatesBySlotId={statesBySlotId}
      walkMode={walkMode}
      reducedMotion={reducedMotion}
      onInteract={onInteract}
    />
  );
}

export const statesBySlotIdForRoom = (
  roomId: string | null,
  resolvedBindings: ResolvedHomeBindings,
): Readonly<Record<string, EntityStateSnapshot>> => {
  if (!roomId) return EMPTY_STATES;
  const resolvedRoom = resolvedBindings.rooms[roomId];
  if (!resolvedRoom) return EMPTY_STATES;
  const entities = [
    ...(resolvedRoom.sceneEntities ?? []),
    ...Object.values(resolvedRoom.sections).flat(),
    ...resolvedRoom.devices.flatMap((device) => device.entities),
  ];
  const withState = entities.filter((entity) => entity.state);
  return withState.length
    ? Object.fromEntries(withState.map((entity) => [entity.slotId, entity.state!]))
    : EMPTY_STATES;
};

export const EMPTY_STATES: Readonly<Record<string, EntityStateSnapshot>> = {};

export const EMPTY_MEDIA: Readonly<Partial<Record<EntityId, DeviceLiveMedia>>> = {};
