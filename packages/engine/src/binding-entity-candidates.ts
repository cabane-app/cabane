import { BindingEntityCandidate, BindingEntityCandidateScope } from "./binding-profile-contract";
import {
  bindingDomainMatchRank,
  entityMatchesBindingSlot,
  isShareableCameraDescriptor,
} from "./binding-slot-compatibility";
import type {
  BindingSlotDescriptor,
  EntityId,
  HomeAssistantEntityRegistryEntry,
  HomeAssistantRuntimeSnapshot,
  RuntimeBindingProfile,
} from "./types";

export const canonicalName = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

export const entityAreaId = (
  entry: HomeAssistantEntityRegistryEntry | undefined,
  runtime: HomeAssistantRuntimeSnapshot,
) => {
  if (!entry) return null;
  if (entry.area_id) return entry.area_id;
  if (!entry.device_id) return null;
  return runtime.devices.find((device) => device.id === entry.device_id)?.area_id ?? null;
};

const registryLabel = (
  entry: HomeAssistantEntityRegistryEntry,
  runtime: HomeAssistantRuntimeSnapshot,
) =>
  entry.name ??
  (typeof runtime.entityStates[entry.entity_id]?.attributes.friendly_name === "string"
    ? (runtime.entityStates[entry.entity_id]?.attributes.friendly_name as string)
    : undefined) ??
  entry.original_name ??
  entry.entity_id;

export const bindingEntityCandidates = ({
  descriptor,
  roomId,
  profile,
  runtime,
  scope = "mapped-area",
}: {
  descriptor: BindingSlotDescriptor;
  roomId: string;
  profile: RuntimeBindingProfile;
  runtime: HomeAssistantRuntimeSnapshot;
  scope?: BindingEntityCandidateScope;
}): readonly BindingEntityCandidate[] => {
  const outsideRooms = descriptor.roomIds.length === 0;
  const roomAreaId = profile.roomAreaIds[roomId];
  if (!outsideRooms && !roomAreaId && scope !== "all-areas") return [];
  const homeWideCamera = isShareableCameraDescriptor(descriptor);
  const claimed =
    homeWideCamera || descriptor.kind === "opening-contact"
      ? new Set<EntityId>()
      : new Set(
          Object.entries(profile.entityIdsBySlotId)
            .filter(([slotId]) => slotId !== descriptor.slotId)
            .map(([, entityId]) => entityId),
        );
  return runtime.entityRegistry
    .map((entry) => ({ entry, areaId: entityAreaId(entry, runtime) }))
    .filter(
      ({ areaId }) =>
        outsideRooms || homeWideCamera || scope === "all-areas" || areaId === roomAreaId,
    )
    .filter(({ entry }) => entityMatchesBindingSlot(descriptor, entry.entity_id, runtime))
    .map(({ entry, areaId }) => {
      const state = runtime.entityStates[entry.entity_id];
      const disabled = Boolean(entry.disabled_by);
      const hidden = Boolean(entry.hidden_by);
      const available = Boolean(state?.available);
      const isClaimed = claimed.has(entry.entity_id);
      const stateLabel = disabled
        ? "Disabled"
        : hidden
          ? "Hidden"
          : !state
            ? "Missing state"
            : !state.available
              ? state.state === "unknown"
                ? "Unknown"
                : "Unavailable"
              : "Available";
      return {
        matchRank: bindingDomainMatchRank(
          descriptor.spec,
          entry.entity_id.split(".")[0],
          descriptor.deviceModel,
        ),
        entityId: entry.entity_id,
        label: registryLabel(entry, runtime),
        areaId,
        areaLabel: areaId
          ? (runtime.areas.find((area) => area.area_id === areaId)?.name ?? "Unknown area")
          : "No area",
        available,
        disabled,
        hidden,
        claimed: isClaimed,
        selectable: true,
        stateLabel,
      };
    })
    .sort(
      (left, right) =>
        left.matchRank - right.matchRank ||
        left.label.localeCompare(right.label) ||
        left.areaLabel.localeCompare(right.areaLabel) ||
        left.entityId.localeCompare(right.entityId),
    );
};
