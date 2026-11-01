import { singleControlDescriptor } from "./auxiliary-mapping-choices";
import type { ReactNode } from "react";
import {
  bindingEntityCandidates,
  collectBindingSlots,
  isShareableCameraDescriptor,
} from "../runtime-binding-profile";
import { deviceMappingCandidates, mappedHomeAssistantDeviceId } from "../home-assistant-mapping";
import type {
  DeviceSlotSpec,
  HomeAssistantRuntimeSnapshot,
  HomeBindingManifest,
  RoomSpec,
  RuntimeBindingProfile,
} from "../types";
import {
  DeviceMappingRelationshipCard,
  type DeviceMappingActivationInput,
} from "./DeviceMappingRelationshipCard";

const deviceLabel = (device: DeviceSlotSpec) =>
  device.entitySlots.find((slot) => slot.deviceRole === "primary")?.presentation.label ??
  device.entitySlots[0]?.presentation.label ??
  device.id;

export function ModeledDeviceMappingRow({
  manifest,
  room,
  device,
  profile,
  runtime,
  disabled,
  selected,
  onOpen,
  onTriggerElement,
  preview,
}: {
  manifest: HomeBindingManifest;
  room: RoomSpec;
  device: DeviceSlotSpec;
  profile: RuntimeBindingProfile;
  runtime: HomeAssistantRuntimeSnapshot;
  disabled: boolean;
  selected: boolean;
  onOpen: (input: DeviceMappingActivationInput) => void;
  onTriggerElement?: (element: HTMLButtonElement | null) => void;
  preview?: ReactNode;
}) {
  const descriptors = collectBindingSlots(manifest);
  const cameraDescriptor = descriptors.find(
    (descriptor) =>
      descriptor.deviceSlotId === device.id && isShareableCameraDescriptor(descriptor),
  );
  if (cameraDescriptor) {
    const current = profile.entityIdsBySlotId[cameraDescriptor.slotId];
    const cameraCandidates = bindingEntityCandidates({
      descriptor: cameraDescriptor,
      roomId: room.id,
      profile,
      runtime,
    });
    const currentCamera = cameraCandidates.find((candidate) => candidate.entityId === current);
    return (
      <DeviceMappingRelationshipCard
        preview={preview}
        relationshipId={device.id}
        domain={cameraDescriptor.spec.compatibleDomains[0] ?? "unknown"}
        connected={Boolean(currentCamera)}
        label={deviceLabel(device)}
        targetLabel={
          currentCamera?.label ?? (current ? "Saved match unavailable" : "Not connected")
        }
        disabled={disabled}
        selected={selected}
        onOpen={onOpen}
        onTriggerElement={onTriggerElement}
      />
    );
  }

  const singleSlotDescriptor = singleControlDescriptor(device, descriptors);
  if (singleSlotDescriptor) {
    const current = profile.entityIdsBySlotId[singleSlotDescriptor.slotId];
    const candidates = bindingEntityCandidates({
      descriptor: singleSlotDescriptor,
      roomId: room.id,
      profile,
      runtime,
      scope: "all-areas",
    });
    const currentCandidate = candidates.find((candidate) => candidate.entityId === current);
    return (
      <DeviceMappingRelationshipCard
        preview={preview}
        relationshipId={device.id}
        domain={singleSlotDescriptor.spec.compatibleDomains[0] ?? "unknown"}
        connected={Boolean(currentCandidate)}
        label={deviceLabel(device)}
        targetLabel={
          currentCandidate?.label ?? (current ? "Saved match unavailable" : "Not connected")
        }
        disabled={disabled}
        selected={selected}
        onOpen={onOpen}
        onTriggerElement={onTriggerElement}
      />
    );
  }

  const candidates = deviceMappingCandidates({
    manifest,
    roomId: room.id,
    device,
    profile,
    runtime,
  });
  const mappedDeviceId = mappedHomeAssistantDeviceId(profile, device, runtime);
  const currentCandidate = candidates.find((candidate) => candidate.deviceId === mappedDeviceId);
  const mappedEntries = device.entitySlots.flatMap((slot) => {
    const entityId = profile.entityIdsBySlotId[slot.id];
    return entityId ? [{ slot, entityId }] : [];
  });
  return (
    <DeviceMappingRelationshipCard
      preview={preview}
      relationshipId={device.id}
      domain={
        device.entitySlots.find((slot) => slot.deviceRole === "primary")?.compatibleDomains[0] ??
        device.entitySlots[0]?.compatibleDomains[0] ??
        "unknown"
      }
      connected={Boolean(currentCandidate)}
      label={deviceLabel(device)}
      targetLabel={
        currentCandidate?.label ??
        (mappedEntries.length > 0 ? "Saved match unavailable" : "Not connected")
      }
      disabled={disabled}
      selected={selected}
      onOpen={onOpen}
      onTriggerElement={onTriggerElement}
    />
  );
}
