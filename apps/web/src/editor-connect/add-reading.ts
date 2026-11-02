import {
  createBrowserUuid,
  createEmptyRuntimeBindingProfile,
  isAuxiliaryEntitySlot,
  normalizeWorkspaceBindingOrigin,
  type EditorWorkspaceSnapshot,
  type EntityBindingSlotSpec,
  type EntityId,
  type HomeAssistantRuntimeSnapshot,
  type ReadingPresentation,
} from "@cabane/engine";

/** Add the local slot and private draft mapping in one undoable workspace edit. */
export function addReadingToSnapshot(
  snapshot: EditorWorkspaceSnapshot,
  itemId: string,
  entityId: EntityId,
  runtime: HomeAssistantRuntimeSnapshot,
  presentation?: ReadingPresentation,
): EditorWorkspaceSnapshot | null {
  const domain = entityId.split(".")[0];
  const item = snapshot.project.sceneItems.find((candidate) => candidate.id === itemId);
  const entry = runtime.entityRegistry.find((candidate) => candidate.entity_id === entityId);
  if (
    !item ||
    !entry ||
    !runtime.origin ||
    runtime.status !== "connected" ||
    (domain !== "sensor" && domain !== "binary_sensor" && domain !== "event")
  )
    return null;
  const origin = normalizeWorkspaceBindingOrigin(runtime.origin);
  const empty = createEmptyRuntimeBindingProfile(snapshot.project.home.id);
  const previous = snapshot.bindings[origin] ?? {
    draft: empty,
    published: empty,
    manualRoomIds: [],
    manualSlotIds: [],
  };
  if (
    item.entitySlots?.some(
      (slot) =>
        isAuxiliaryEntitySlot(slot) && previous.draft.entityIdsBySlotId[slot.id] === entityId,
    )
  )
    return null;
  const friendlyName = runtime.entityStates[entityId]?.attributes.friendly_name;
  const label =
    entry.name ??
    (typeof friendlyName === "string" ? friendlyName : null) ??
    entry.original_name ??
    entityId;
  const slot: EntityBindingSlotSpec = {
    id: `reading-${createBrowserUuid()}`,
    compatibleDomains: [domain],
    required: false,
    autoMap: "manual",
    deviceRole: "secondary",
    presentation: {
      label: presentation?.label.trim() || label,
      dashboardRole: "secondary",
      showInScene: presentation?.showInScene ?? true,
    },
  };
  return {
    ...snapshot,
    project: {
      ...snapshot.project,
      sceneItems: snapshot.project.sceneItems.map((candidate) =>
        candidate.id === itemId
          ? { ...item, entitySlots: [...(item.entitySlots ?? []), slot] }
          : candidate,
      ),
    },
    bindings: {
      ...snapshot.bindings,
      [origin]: {
        ...previous,
        draft: {
          ...previous.draft,
          entityIdsBySlotId: { ...previous.draft.entityIdsBySlotId, [slot.id]: entityId },
        },
        manualSlotIds: [...previous.manualSlotIds, slot.id],
      },
    },
  };
}
