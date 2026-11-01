import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deviceMappingRooms,
  automaticallyMapRuntimeBindings,
  collectBindingSlots,
  createEmptyRuntimeBindingProfile,
  entityMatchesBindingSlot,
  groupRoomMappingRelationships,
  normalizeWorkspaceBindingOrigin,
  replaceRoomAreaMapping,
  replaceEntitySlotMapping,
  saveRoomAreaDraft,
  validateRuntimeBindingProfile,
  type HomeAssistantRuntimeValue,
  type EntityId,
  type HomeBindingManifest,
  type HomeProjectIssue,
  type RuntimeBindingProfile,
  type WorkspaceBindings,
  type ReadingPresentation,
} from "@cabane/engine";
import { stageImportedProfile } from "./profile-transfer";
import { deviceRoom, type EditorOpenRequest } from "./connect-navigation";
export type { EditorOpenRequest } from "./connect-navigation";

type AssignmentResult =
  | { status: "applied" | "unchanged" }
  | { status: "confirmation-required"; clearedSlotIds: readonly string[] }
  | { status: "rejected"; message: string };

export function useConnectEditor({
  manifest,
  bindings,
  runtime,
  origin,
  active,
  onChange,
  onAddReading,
  initialRequest,
  routeView,
  onViewChange,
  floorId,
}: {
  manifest: HomeBindingManifest;
  floorId?: string;
  bindings: WorkspaceBindings;
  runtime: HomeAssistantRuntimeValue;
  origin: string | null;
  active: boolean;
  onChange: (bindings: WorkspaceBindings) => void;
  onAddReading?: (itemId: string, entityId: EntityId, presentation?: ReadingPresentation) => void;
  initialRequest?: EditorOpenRequest;
  routeView?: "rooms" | "devices";
  onViewChange?: ((view: "rooms" | "devices") => void) | undefined;
}) {
  const key = origin ? normalizeWorkspaceBindingOrigin(origin) : null;
  const empty = useMemo(
    () => createEmptyRuntimeBindingProfile(manifest.home.id),
    [manifest.home.id],
  );
  const state = key ? bindings[key] : undefined;
  const profile = state?.draft ?? empty;
  const rooms = useMemo(
    () =>
      (manifest.floors.find((floor) => floor.id === floorId) ?? manifest.floors[0])?.rooms ?? [],
    [manifest.floors, floorId],
  );
  const hasUnmappedRooms = rooms.some((room) => !profile.roomAreaIds[room.id]);
  const defaultView: "rooms" | "devices" =
    rooms.length > 0 && !hasUnmappedRooms ? "devices" : "rooms";
  const [localView, setLocalView] = useState<"rooms" | "devices">(
    initialRequest?.relationshipId ? "devices" : (initialRequest?.view ?? defaultView),
  );
  const view = onViewChange ? (routeView ?? defaultView) : localView;
  const setView = (next: "rooms" | "devices") => {
    setLocalView(next);
    onViewChange?.(next);
  };
  const [roomId, setRoomId] = useState<string | null>(
    () =>
      (initialRequest?.relationshipId
        ? deviceRoom(manifest, initialRequest.relationshipId)?.id
        : null) ??
      initialRequest?.roomId ??
      null,
  );
  const [relationshipId, setRelationshipId] = useState<string | null>(
    initialRequest?.relationshipId ?? null,
  );
  const [slotId, setSlotId] = useState<string | null>(null);
  const [pendingAreaChange, setPendingAreaChange] = useState<
    | (ReturnType<typeof saveRoomAreaDraft> & {
        origin: string;
        sourceProfile: RuntimeBindingProfile;
      })
    | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const disconnected = runtime.status !== "connected" || runtime.origin !== key;
  const cache = useRef<{ origin: string; runtime: HomeAssistantRuntimeValue } | null>(null);
  if (!disconnected && key) cache.current = { origin: key, runtime };
  const displayRuntime =
    disconnected && cache.current?.origin === key ? cache.current.runtime : runtime;
  const deviceRooms = useMemo(
    () => deviceMappingRooms(manifest, floorId ?? manifest.floors[0]?.id),
    [manifest, floorId],
  );
  const room = deviceRooms.find((candidate) => candidate.id === roomId) ?? null;
  const groupsByRoom = useMemo(
    () =>
      Object.fromEntries(
        deviceRooms.map((candidate) => [
          candidate.id,
          groupRoomMappingRelationships(manifest, candidate.id),
        ]),
      ),
    [manifest, deviceRooms],
  );
  const groups = room ? groupsByRoom[room.id] : [];
  const roomDeviceSummaries = useMemo(
    () =>
      Object.fromEntries(
        deviceRooms.map((candidate) => {
          // Optional opening contacts should not make the room look unfinished.
          const categories = groupsByRoom[candidate.id]
            .map((group) => ({
              ...group,
              relationships: group.relationships.filter(
                (relationship) =>
                  relationship.kind !== "entity-slot" ||
                  (relationship.slotKind !== "opening-contact" &&
                    relationship.slotKind !== "opening-cover") ||
                  relationship.slotIds.some((id) => Boolean(profile.entityIdsBySlotId[id])),
              ),
            }))
            .filter((group) => group.relationships.length > 0);
          const relationships = categories.flatMap((group) => group.relationships);
          return [
            candidate.id,
            {
              // Count each device/control once, even when it has several mapped functions.
              mapped: relationships.filter((relationship) => {
                const descriptors =
                  relationship.kind === "modeled-device"
                    ? relationship.descriptors
                    : [relationship.descriptor];
                const required = descriptors.filter((descriptor) => descriptor.spec.required);
                const checked = required.length
                  ? required
                  : [
                      descriptors.find((descriptor) => descriptor.spec.deviceRole === "primary") ??
                        descriptors[0],
                    ];
                return checked.every(
                  (descriptor) =>
                    descriptor && Boolean(profile.entityIdsBySlotId[descriptor.slotId]),
                );
              }).length,
              total: relationships.length,
              categories,
            },
          ];
        }),
      ),
    [groupsByRoom, profile.entityIdsBySlotId, deviceRooms],
  );
  const relationship =
    groups
      .flatMap((group) => group.relationships)
      .find((candidate) => candidate.id === relationshipId) ?? null;
  const current = useRef({
    manifest,
    bindings,
    state,
    profile,
    onChange,
    key,
    runtime,
    disconnected,
  });
  current.current = { manifest, bindings, state, profile, onChange, key, runtime, disconnected };
  useEffect(() => {
    if (initialRequest?.relationshipId) {
      setRoomId(
        deviceRoom(current.current.manifest, initialRequest.relationshipId)?.id ??
          initialRequest.roomId ??
          null,
      );
      setRelationshipId(initialRequest.relationshipId);
    } else if (initialRequest?.roomId) setRoomId(initialRequest.roomId);
  }, [initialRequest]);

  const commitProfile = useCallback(
    (
      next: RuntimeBindingProfile,
      manualRoomIds: readonly string[] = [],
      manualSlotIds: readonly string[] = [],
    ) => {
      const latest = current.current;
      if (!latest.key) return;
      latest.onChange({
        ...latest.bindings,
        [latest.key]: {
          draft: next,
          published: latest.state?.published ?? empty,
          manualRoomIds: [...new Set([...(latest.state?.manualRoomIds ?? []), ...manualRoomIds])],
          manualSlotIds: [...new Set([...(latest.state?.manualSlotIds ?? []), ...manualSlotIds])],
        },
      });
      setMessage("Draft changes");
    },
    [empty],
  );
  const assignRoomArea = (
    targetRoomId: string,
    areaId: string | null,
    confirmClearedSlots = false,
  ): AssignmentResult => {
    const latest = current.current;
    if (!latest.key) return { status: "rejected", message: "Set a Home Assistant address first." };
    if (
      !latest.manifest.floors.some((floor) => floor.rooms.some((room) => room.id === targetRoomId))
    )
      return { status: "rejected", message: `Room ${targetRoomId} was not found.` };
    if (areaId && latest.disconnected)
      return { status: "rejected", message: "Home Assistant is not connected for this workspace." };
    if (
      areaId &&
      (!latest.runtime.areas.some((area) => area.area_id === areaId) ||
        Object.entries(latest.profile.roomAreaIds).some(
          ([id, assigned]) => id !== targetRoomId && assigned === areaId,
        ))
    )
      return {
        status: "rejected",
        message: `Home Assistant area ${areaId} is unavailable or already mapped.`,
      };
    const next = replaceRoomAreaMapping(latest.profile, targetRoomId, areaId);
    const proposed = saveRoomAreaDraft({
      manifest: latest.manifest,
      savedProfile: latest.profile,
      roomAreaIds: next.roomAreaIds,
    });
    if (proposed.clearedSlotIds.length && !confirmClearedSlots) {
      setPendingAreaChange({ ...proposed, origin: latest.key, sourceProfile: latest.profile });
      return { status: "confirmation-required", clearedSlotIds: proposed.clearedSlotIds };
    }
    if (!proposed.changedRoomIds.length && latest.state?.manualRoomIds.includes(targetRoomId))
      return { status: "unchanged" };
    commitProfile(proposed.profile, [targetRoomId], proposed.clearedSlotIds);
    setPendingAreaChange(null);
    return { status: "applied" };
  };
  const assignEntities = (
    entityIdsBySlotId: RuntimeBindingProfile["entityIdsBySlotId"],
    manualSlotIds: readonly string[] = relationship?.slotIds ?? [],
  ): AssignmentResult => {
    const latest = current.current;
    if (!latest.key) return { status: "rejected", message: "Set a Home Assistant address first." };
    const changed = [
      ...new Set([
        ...Object.keys(latest.profile.entityIdsBySlotId),
        ...Object.keys(entityIdsBySlotId),
      ]),
    ].filter((id) => latest.profile.entityIdsBySlotId[id] !== entityIdsBySlotId[id]);
    const slots = collectBindingSlots(latest.manifest);
    for (const slotId of changed) {
      const slot = slots.find((candidate) => candidate.slotId === slotId);
      if (!slot) return { status: "rejected", message: `Binding slot ${slotId} was not found.` };
      const entityId = entityIdsBySlotId[slotId];
      if (!entityId) continue;
      const entry = latest.runtime.entityRegistry.find(
        (candidate) => candidate.entity_id === entityId,
      );
      if (
        latest.disconnected ||
        !entry ||
        entry.disabled_by ||
        entry.hidden_by ||
        !entityMatchesBindingSlot(slot, entityId, latest.runtime)
      )
        return {
          status: "rejected",
          message: `Home Assistant entity ${entityId} is unavailable or incompatible with slot ${slotId}.`,
        };
    }
    if (!changed.length && manualSlotIds.every((id) => latest.state?.manualSlotIds.includes(id)))
      return { status: "unchanged" };
    commitProfile({ ...latest.profile, entityIdsBySlotId }, [], [...changed, ...manualSlotIds]);
    return { status: "applied" };
  };
  const assignEntity = (slotId: string, entityId: EntityId | null): AssignmentResult => {
    const latest = current.current;
    if (!collectBindingSlots(latest.manifest).some((slot) => slot.slotId === slotId))
      return { status: "rejected", message: `Binding slot ${slotId} was not found.` };
    return assignEntities(
      replaceEntitySlotMapping(latest.profile, slotId, entityId).entityIdsBySlotId,
      [slotId],
    );
  };
  // History edits are deliberately absent from this trigger. Undo must stay undone.
  const entryKey = JSON.stringify([
    key,
    manifest,
    runtime.areas,
    runtime.devices,
    runtime.entityRegistry,
  ]);
  const lastAutomaticEntry = useRef<string | null>(null);
  useEffect(() => {
    const latest = current.current;
    if (!active || latest.disconnected || !latest.key) return;
    if (lastAutomaticEntry.current === entryKey) return;
    lastAutomaticEntry.current = entryKey;
    const result = automaticallyMapRuntimeBindings(
      latest.manifest,
      latest.profile,
      latest.runtime,
      latest.state,
    );
    if (result.applied.length) commitProfile(result.profile);
  }, [entryKey, active, disconnected, commitProfile]);
  useEffect(() => {
    if (relationshipId && !relationship) {
      const currentRoom = deviceRoom(manifest, relationshipId);
      if (currentRoom) {
        setRoomId(currentRoom.id);
        return;
      }
      setMessage("This device is no longer in the draft. Select another device to connect.");
      setRelationshipId(null);
    }
    if (!room) setRoomId(null);
  }, [manifest, room, relationship, relationshipId]);

  const issues: HomeProjectIssue[] = validateRuntimeBindingProfile(
    profile,
    manifest,
    disconnected ? undefined : runtime,
  ).issues.map((issue) => ({
    ...issue,
    severity: ["profile.area-missing", "profile.entity-missing", "profile.device-class"].includes(
      issue.code,
    )
      ? "warning"
      : "error",
  }));
  if (
    disconnected &&
    (Object.keys(profile.roomAreaIds).length || Object.keys(profile.entityIdsBySlotId).length)
  ) {
    issues.push({
      code: "connect.offline",
      path: "bindings",
      message:
        "Home Assistant is offline. Saved connections will be retained without registry verification.",
      severity: "warning",
    });
  }
  const selectRelationship = useCallback((id: string | null) => {
    setRelationshipId(id);
    setSlotId(null);
  }, []);
  return {
    view,
    defaultView,
    hasUnmappedRooms,
    setView: (next: "rooms" | "devices") => {
      setView(next);
      setRelationshipId(null);
      if (next === "rooms" && !rooms.some((candidate) => candidate.id === roomId)) setRoomId(null);
    },
    rooms,
    deviceRooms,
    roomId: room?.id ?? null,
    room,
    slotId,
    selectSlot: (id: string) => {
      const destination = deviceRooms.find((room) =>
        groupsByRoom[room.id].some((group) =>
          group.relationships.some((relationship) => relationship.slotIds.includes(id)),
        ),
      );
      const target =
        destination &&
        groupsByRoom[destination.id]
          .flatMap((group) => group.relationships)
          .find((relationship) => relationship.slotIds.includes(id));
      if (!destination || !target) return false;
      setView("devices");
      setRoomId(destination.id);
      setRelationshipId(target.id);
      setSlotId(id);
      return true;
    },
    selectSlotId: setSlotId,
    showPlan: () => {
      setRoomId(null);
      setRelationshipId(null);
      setSlotId(null);
      setPendingAreaChange(null);
    },
    selectRoom: (id: string) => {
      setRoomId(id);
      setRelationshipId(null);
      setPendingAreaChange(null);
      setSlotId(null);
    },
    relationshipId,
    relationship,
    selectRelationship,
    groups,
    roomDeviceSummaries,
    profile,
    addItemReading: (itemId: string, entityId: EntityId, presentation?: ReadingPresentation) => {
      if (!disconnected) onAddReading?.(itemId, entityId, presentation);
    },
    selectDevice: (id: string) => {
      const destination = deviceRoom(manifest, id);
      setView("devices");
      setPendingAreaChange(null);
      if (!destination) {
        setRelationshipId(null);
        setMessage("This device is no longer in the draft. Select another device to connect.");
        return false;
      }
      setRoomId(destination.id);
      setRelationshipId(id);
      setMessage(null);
      return true;
    },
    publishedProfile: state?.published ?? empty,
    displayRuntime,
    disconnected,
    issues,
    message,
    pendingAreaChange,
    assignRoomArea,
    assignEntity,
    assignArea: (areaId: string) => room && assignRoomArea(room.id, areaId || null),
    confirmAreaChange: () => {
      if (!pendingAreaChange) return;
      if (pendingAreaChange.origin === key && pendingAreaChange.sourceProfile === profile)
        commitProfile(
          pendingAreaChange.profile,
          pendingAreaChange.changedRoomIds,
          pendingAreaChange.clearedSlotIds,
        );
      setPendingAreaChange(null);
    },
    cancelAreaChange: () => setPendingAreaChange(null),
    addReading:
      onAddReading &&
      relationship?.kind === "modeled-device" &&
      manifest.sceneItems.some((item) => item.kind === "device" && item.id === relationship.id)
        ? (entityId: EntityId, presentation?: ReadingPresentation) => {
            if (!disconnected) onAddReading(relationship.id, entityId, presentation);
          }
        : undefined,
    assignEntities,
    refresh: async () => {
      if (disconnected) return;
      try {
        await runtime.refresh();
      } catch {
        setMessage("Refresh failed. Your draft choices are unchanged.");
      }
    },
    importProfile: (json: string) => {
      if (!key) throw new Error("Set a Home Assistant address before importing a profile.");
      onChange(stageImportedProfile(bindings, key, json, manifest));
      setMessage("Connections imported into the draft. Save to activate them.");
    },
  };
}

export type ConnectEditor = ReturnType<typeof useConnectEditor>;
