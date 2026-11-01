import { isAuxiliaryEntitySlot } from "../entity-slot-roles";
import { bindingEntityCandidates, replaceEntitySlotMapping } from "../runtime-binding-profile";
import type {
  BindingSlotDescriptor,
  DeviceSlotSpec,
  EntityId,
  HomeAssistantRuntimeSnapshot,
  RuntimeBindingProfile,
} from "../types";

export interface MappingOption {
  value: string;
  label: string;
  summaryLabel?: string;
  disabled?: boolean;
  searchText?: string;
}

export const entityDeviceNames = (
  runtime: HomeAssistantRuntimeSnapshot,
): ReadonlyMap<string, string> => {
  const devices = new Map(
    runtime.devices.map((device) => [device.id, device.name_by_user ?? device.name ?? ""]),
  );
  return new Map(
    runtime.entityRegistry.map((entry) => [
      entry.entity_id,
      entry.device_id ? (devices.get(entry.device_id) ?? "") : "",
    ]),
  );
};

export interface MappingOptionGroup {
  id?: string;
  collapsed?: boolean;
  groups?: readonly MappingOptionGroup[];
  label: string;
  options: readonly MappingOption[];
}

export interface MappingChoice {
  id: string;
  label: string;
  ariaLabel: string;
  value: string;
  emptyLabel: string;
  required?: boolean;
  options: readonly MappingOption[];
  optionGroups?: readonly MappingOptionGroup[];
  onChange: (value: string) => boolean;
}

export const auxiliaryMappingChoices = (
  descriptors: readonly BindingSlotDescriptor[],
  roomId: string,
  profile: RuntimeBindingProfile,
  runtime: HomeAssistantRuntimeSnapshot,
  onEntityIdsBySlotIdChange: (value: RuntimeBindingProfile["entityIdsBySlotId"]) => void,
): MappingChoice[] =>
  descriptors.map((descriptor): MappingChoice => {
    const current = profile.entityIdsBySlotId[descriptor.slotId];
    const candidates = bindingEntityCandidates({
      descriptor,
      roomId,
      profile,
      runtime,
      scope: "all-areas",
    });
    return {
      id: descriptor.slotId,
      label: descriptor.spec.presentation.label,
      ariaLabel: `Home Assistant entity for ${descriptor.spec.presentation.label}`,
      value: current ?? "",
      required: false,
      emptyLabel: "Not connected",
      options: [
        ...(current && !candidates.some((candidate) => candidate.entityId === current)
          ? [{ value: current, label: "Saved match unavailable" }]
          : []),
        ...candidates.map((candidate) => ({
          value: candidate.entityId,
          label: `${candidate.label} · ${candidate.areaLabel}${candidate.stateLabel === "Available" ? "" : ` · ${candidate.stateLabel}`}${candidate.claimed ? " · already used" : ""}`,
          disabled: !candidate.selectable && candidate.entityId !== current,
        })),
      ],
      onChange: (value) => {
        onEntityIdsBySlotIdChange(
          replaceEntitySlotMapping(profile, descriptor.slotId, (value || null) as EntityId | null)
            .entityIdsBySlotId,
        );
        return true;
      },
    };
  });

export const singleControlDescriptor = (
  device: DeviceSlotSpec,
  descriptors: readonly BindingSlotDescriptor[],
) => {
  const controls = device.entitySlots.filter((slot) => !isAuxiliaryEntitySlot(slot));
  return controls.length === 1
    ? descriptors.find((descriptor) => descriptor.slotId === controls[0].id)
    : undefined;
};

export const entityMappingChange =
  (
    profile: RuntimeBindingProfile,
    slotId: string,
    onChange: (value: RuntimeBindingProfile["entityIdsBySlotId"]) => void,
  ): MappingChoice["onChange"] =>
  (value) => {
    onChange(
      replaceEntitySlotMapping(profile, slotId, (value || null) as EntityId | null)
        .entityIdsBySlotId,
    );
    return true;
  };
