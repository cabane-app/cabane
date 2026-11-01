import {
  auxiliaryMappingChoices,
  entityMappingChange,
  singleControlDescriptor,
  type MappingChoice,
  type MappingOption,
  type MappingOptionGroup,
} from "./auxiliary-mapping-choices";
import { isAuxiliaryEntitySlot } from "../entity-slot-roles";
import { useState, type ReactNode } from "react";
import { DeviceMappingChoices } from "./DeviceMappingChoices";
import {
  bindingEntityCandidates,
  isShareableCameraDescriptor,
  replaceEntitySlotMapping,
} from "../runtime-binding-profile";
import {
  applyDeviceMapping,
  deviceMappingCandidates,
  mappedHomeAssistantDeviceId,
} from "../home-assistant-mapping";
import type {
  EntityId,
  HomeAssistantRuntimeSnapshot,
  HomeBindingManifest,
  RoomSpec,
  RuntimeBindingProfile,
} from "../types";
import type { DeviceMappingRelationship } from "./device-mapping-groups";

export type DeviceMappingInspectorState = "open" | "summary";

export function DeviceMappingInspector({
  manifest,
  room,
  relationship,
  profile,
  runtime,
  disabled,
  state,
  onEntityIdsBySlotIdChange,
  onSelectionMade,
  onCollapse,
  onReopen,
  onChoiceElement,
  onAddReading,
  inline = false,
  preview,
}: {
  manifest: HomeBindingManifest;
  room: RoomSpec;
  relationship: DeviceMappingRelationship | null;
  profile: RuntimeBindingProfile;
  runtime: HomeAssistantRuntimeSnapshot;
  disabled: boolean;
  state: DeviceMappingInspectorState | "closed";
  onEntityIdsBySlotIdChange: (
    entityIdsBySlotId: RuntimeBindingProfile["entityIdsBySlotId"],
  ) => void;
  onSelectionMade: (targetLabel: string) => void;
  onCollapse: () => void;
  onReopen: () => void;
  onChoiceElement?: (element: HTMLElement | null) => void;
  onAddReading?: ((entityId: EntityId) => void) | undefined;
  inline?: boolean;
  preview?: ReactNode;
}) {
  const [optimisticTarget, setOptimisticTarget] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [pendingDevice, setPendingDevice] = useState<{
    relationshipId: string;
    deviceId: string;
  } | null>(null);

  if (!relationship) {
    return <aside className="device-mapping-inspector" data-state="closed" aria-hidden="true" />;
  }

  let primaryChoice: MappingChoice;
  let functionChoices: MappingChoice[] = [];
  let relationshipLabel = "Not connected";
  let connectionDetails: ReactNode;

  if (relationship.kind === "entity-slot") {
    const { descriptor } = relationship;
    const current = profile.entityIdsBySlotId[descriptor.slotId];
    const candidates = bindingEntityCandidates({
      descriptor,
      roomId: room.id,
      profile,
      runtime,
      scope:
        descriptor.kind === "opening-contact" ||
        descriptor.kind === "opening-cover" ||
        isAuxiliaryEntitySlot(descriptor.spec)
          ? "all-areas"
          : "mapped-area",
    });
    const currentCandidate = candidates.find((candidate) => candidate.entityId === current);
    const currentState = current ? runtime.entityStates[current] : undefined;
    relationshipLabel =
      currentCandidate?.label ?? (current ? "Saved match unavailable" : "Not connected");
    primaryChoice = {
      id: descriptor.slotId,
      label: descriptor.kind === "opening-contact" ? "Opening sensor" : "Home Assistant entity",
      ariaLabel: `Home Assistant match for ${relationship.label}`,
      value: current ?? "",
      emptyLabel:
        candidates.length === 0 && !current
          ? "No compatible Home Assistant matches"
          : "Not connected",
      options: [
        ...(current && !currentCandidate
          ? [{ value: current, label: "Saved match unavailable" }]
          : []),
        ...candidates.map((candidate) => ({
          value: candidate.entityId,
          label: `${candidate.label}${descriptor.kind === "opening-contact" ? ` · ${candidate.areaLabel}` : ""}${candidate.stateLabel === "Available" ? "" : ` · ${candidate.stateLabel}`}${candidate.claimed ? " · already used" : ""}`,
          disabled: !candidate.selectable && candidate.entityId !== current,
        })),
      ],
      onChange: entityMappingChange(profile, descriptor.slotId, onEntityIdsBySlotIdChange),
    };
    connectionDetails = (
      <>
        {current && (
          <p>
            Entity: <code>{current}</code>
          </p>
        )}
        <p>
          Compatible: {descriptor.spec.compatibleDomains.join(", ")}
          {candidates.some((candidate) => candidate.matchRank > 0)
            ? "; plugs and switches (on/off only)"
            : ""}
        </p>
        {descriptor.kind !== "opening-contact" &&
        descriptor.spec.compatibleDeviceClasses?.length ? (
          <p>Device class: {descriptor.spec.compatibleDeviceClasses.join(", ")}</p>
        ) : null}
        {current && (
          <p>
            State:{" "}
            {currentState ? (currentState.available ? "Available" : currentState.state) : "Missing"}
          </p>
        )}
      </>
    );
  } else {
    const { device } = relationship;
    const cameraDescriptor = relationship.descriptors.find(isShareableCameraDescriptor);
    const singleSlotDescriptor = singleControlDescriptor(device, relationship.descriptors);
    if (cameraDescriptor) {
      const current = profile.entityIdsBySlotId[cameraDescriptor.slotId];
      const candidates = bindingEntityCandidates({
        descriptor: cameraDescriptor,
        roomId: room.id,
        profile,
        runtime,
      });
      const currentCamera = candidates.find((candidate) => candidate.entityId === current);
      relationshipLabel =
        currentCamera?.label ?? (current ? "Saved match unavailable" : "Not connected");
      primaryChoice = {
        id: cameraDescriptor.slotId,
        label: "Home Assistant camera",
        ariaLabel: `Home Assistant camera for ${relationship.label}`,
        value: current ?? "",
        emptyLabel:
          candidates.length === 0 && !current
            ? "No compatible Home Assistant cameras"
            : "Not connected",
        options: [
          ...(current && !currentCamera
            ? [{ value: current, label: "Saved match unavailable" }]
            : []),
          ...candidates.map((candidate) => ({
            value: candidate.entityId,
            label: `${candidate.label} · ${candidate.areaLabel}${candidate.stateLabel === "Available" ? "" : ` · ${candidate.stateLabel}`}`,
            disabled: !candidate.selectable && candidate.entityId !== current,
          })),
        ],
        onChange: (value) => {
          onEntityIdsBySlotIdChange(
            replaceEntitySlotMapping(
              profile,
              cameraDescriptor.slotId,
              (value || null) as EntityId | null,
            ).entityIdsBySlotId,
          );
          return true;
        },
      };
      connectionDetails = current ? (
        <>
          <p>
            Camera: <code>{current}</code>
          </p>
          {currentCamera && <p>Home Assistant area: {currentCamera.areaLabel}</p>}
        </>
      ) : null;
    } else if (singleSlotDescriptor) {
      const descriptor = singleSlotDescriptor;
      const current = profile.entityIdsBySlotId[descriptor.slotId];
      const candidates = bindingEntityCandidates({
        descriptor,
        roomId: room.id,
        profile,
        runtime,
        scope: "all-areas",
      });
      const currentCandidate = candidates.find((candidate) => candidate.entityId === current);
      const currentState = current ? runtime.entityStates[current] : undefined;
      const roomAreaId = profile.roomAreaIds[room.id];
      const inRoomCandidates = candidates.filter(
        (candidate) => candidate.matchRank === 0 && candidate.areaId === roomAreaId,
      );
      const otherCandidates = candidates.filter(
        (candidate) => candidate.matchRank === 0 && candidate.areaId !== roomAreaId,
      );
      const optionForCandidate = (
        candidate: (typeof candidates)[number],
        showArea: boolean,
      ): MappingOption => ({
        value: candidate.entityId,
        label: [
          candidate.label,
          ...(showArea
            ? [candidate.areaLabel, candidate.stateLabel]
            : candidate.stateLabel === "Available"
              ? []
              : [candidate.stateLabel]),
          ...(candidate.claimed ? ["already used"] : []),
        ].join(" · "),
        summaryLabel: candidate.label,
        disabled: !candidate.selectable && candidate.entityId !== current,
      });
      const savedOptions: MappingOption[] =
        current && !currentCandidate ? [{ value: current, label: "Saved match unavailable" }] : [];
      const inRoomOptions = inRoomCandidates.map((candidate) =>
        optionForCandidate(candidate, false),
      );
      const otherOptions = otherCandidates.map((candidate) => optionForCandidate(candidate, true));
      const alternativeOptions = candidates
        .filter((candidate) => candidate.matchRank > 0)
        .map((candidate) => optionForCandidate(candidate, true));
      const options = [...savedOptions, ...inRoomOptions, ...otherOptions, ...alternativeOptions];
      const isLighting = descriptor.spec.compatibleDomains.includes("light");
      const byArea = (entries: typeof candidates): MappingOptionGroup[] => {
        const areas = new Map<string, MappingOptionGroup>();
        for (const candidate of entries) {
          const id = candidate.areaId ?? "no-area";
          const group = areas.get(id) ?? {
            id,
            label: candidate.areaLabel,
            collapsed: true,
            options: [],
          };
          group.options = [...group.options, optionForCandidate(candidate, false)];
          areas.set(id, group);
        }
        return [...areas.values()].sort((a, b) => a.label.localeCompare(b.label));
      };
      relationshipLabel =
        currentCandidate?.label ?? (current ? "Saved match unavailable" : "Not connected");
      primaryChoice = {
        id: descriptor.slotId,
        label: "Home Assistant entity",
        ariaLabel: `Home Assistant entity for ${relationship.label}`,
        value: current ?? "",
        emptyLabel:
          candidates.length === 0 && !current
            ? "No compatible Home Assistant entities"
            : "Not connected",
        options,
        optionGroups: [
          ...(savedOptions.length > 0 ? [{ label: "Saved selection", options: savedOptions }] : []),
          ...(inRoomOptions.length > 0
            ? [
                {
                  label: isLighting ? `Lights in ${room.name}` : `In ${room.name}`,
                  options: inRoomOptions,
                },
              ]
            : []),
          ...(otherOptions.length > 0
            ? [
                isLighting
                  ? {
                      label: "Other lights",
                      options: [],
                      collapsed: true,
                      groups: byArea(otherCandidates),
                    }
                  : { label: "Other compatible entities", options: otherOptions },
              ]
            : []),
          ...(alternativeOptions.length > 0
            ? [
                {
                  label: "Other switches · on/off only",
                  options: [],
                  collapsed: true,
                  groups: byArea(candidates.filter((candidate) => candidate.matchRank > 0)),
                },
              ]
            : []),
        ],
        onChange: (value) => {
          onEntityIdsBySlotIdChange(
            replaceEntitySlotMapping(profile, descriptor.slotId, (value || null) as EntityId | null)
              .entityIdsBySlotId,
          );
          return true;
        },
      };
      connectionDetails = (
        <>
          {current && (
            <p>
              Entity: <code>{current}</code>
            </p>
          )}
          {currentCandidate && <p>Home Assistant area: {currentCandidate.areaLabel}</p>}
          <p>
            Compatible: {descriptor.spec.compatibleDomains.join(", ")}
            {candidates.some((candidate) => candidate.matchRank > 0)
              ? "; plugs and switches (on/off only)"
              : ""}
          </p>
          {descriptor.kind !== "opening-contact" &&
          descriptor.spec.compatibleDeviceClasses?.length ? (
            <p>Device class: {descriptor.spec.compatibleDeviceClasses.join(", ")}</p>
          ) : null}
          {current && (
            <p>
              State:{" "}
              {currentState
                ? currentState.available
                  ? "Available"
                  : currentState.state
                : "Missing"}
            </p>
          )}
        </>
      );
    } else {
      const candidates = deviceMappingCandidates({
        manifest,
        roomId: room.id,
        device,
        profile,
        runtime,
      });
      const mappedDeviceId = mappedHomeAssistantDeviceId(profile, device, runtime);
      const pendingDeviceId =
        pendingDevice?.relationshipId === relationship.id ? pendingDevice.deviceId : null;
      const selectedDeviceId = mappedDeviceId ?? pendingDeviceId;
      const currentCandidate = candidates.find(
        (candidate) => candidate.deviceId === selectedDeviceId,
      );
      const currentDeviceId = currentCandidate?.deviceId;
      const mappedEntries = device.entitySlots.flatMap((slot) => {
        const entityId = profile.entityIdsBySlotId[slot.id];
        return entityId ? [{ slot, entityId }] : [];
      });
      relationshipLabel =
        currentCandidate?.label ??
        (mappedEntries.length > 0 ? "Saved match unavailable" : "Not connected");
      primaryChoice = {
        id: device.id,
        label: "Home Assistant device",
        ariaLabel: `Home Assistant device for ${relationship.label}`,
        value: selectedDeviceId ?? "",
        emptyLabel:
          candidates.length === 0 && !selectedDeviceId
            ? "No compatible Home Assistant devices"
            : "Not connected",
        options: [
          ...(selectedDeviceId && !currentCandidate
            ? [{ value: selectedDeviceId, label: "Saved device unavailable" }]
            : []),
          ...candidates.map((candidate) => ({ value: candidate.deviceId, label: candidate.label })),
        ],
        onChange: (value) => {
          const candidate = candidates.find((item) => item.deviceId === value) ?? null;
          const next = applyDeviceMapping(profile, device, candidate);
          const unresolvedRequired =
            candidate?.unresolvedSlotIds.some((slotId) =>
              device.entitySlots.some((slot) => slot.id === slotId && slot.required),
            ) ?? false;
          setPendingDevice(
            candidate && unresolvedRequired
              ? { relationshipId: relationship.id, deviceId: candidate.deviceId }
              : null,
          );
          onEntityIdsBySlotIdChange(next.entityIdsBySlotId);
          return !unresolvedRequired;
        },
      };
      functionChoices = (currentCandidate?.unresolvedSlotIds ?? []).flatMap((slotId) => {
        const slot = device.entitySlots.find((candidate) => candidate.id === slotId);
        const descriptor = relationship.descriptors.find(
          (candidate) => candidate.slotId === slotId,
        );
        if (!slot || !descriptor || !currentDeviceId) return [];
        const current = profile.entityIdsBySlotId[slotId];
        const candidatesForFunction = bindingEntityCandidates({
          descriptor,
          roomId: room.id,
          profile,
          runtime,
        }).filter(
          (candidate) =>
            runtime.entityRegistry.find((entry) => entry.entity_id === candidate.entityId)
              ?.device_id === currentDeviceId,
        );
        const currentFunction = candidatesForFunction.find(
          (candidate) => candidate.entityId === current,
        );
        return [
          {
            id: slotId,
            label: `${slot.presentation.label} function`,
            ariaLabel: `Home Assistant function for ${slot.presentation.label}`,
            value: current ?? "",
            required: slot.required,
            emptyLabel:
              candidatesForFunction.length === 0 && !current
                ? "No matching function found"
                : "Not connected",
            options: [
              ...(current && !currentFunction
                ? [{ value: current, label: "Saved function unavailable" }]
                : []),
              ...candidatesForFunction.map((candidate) => ({
                value: candidate.entityId,
                label: `${candidate.label}${candidate.stateLabel === "Available" ? "" : ` · ${candidate.stateLabel}`}`,
                disabled: !candidate.selectable && candidate.entityId !== current,
              })),
            ],
            onChange: (value: string) => {
              onEntityIdsBySlotIdChange(
                replaceEntitySlotMapping(profile, slotId, (value || null) as EntityId | null)
                  .entityIdsBySlotId,
              );
              setPendingDevice(null);
              return true;
            },
          },
        ];
      });
      connectionDetails =
        mappedEntries.length > 0
          ? mappedEntries.map(({ slot, entityId }) => (
              <p key={slot.id}>
                {slot.presentation.label}: <code>{entityId}</code>
              </p>
            ))
          : null;
    }
  }

  const auxiliaryDescriptors =
    relationship.kind === "modeled-device"
      ? relationship.descriptors.filter((descriptor) => isAuxiliaryEntitySlot(descriptor.spec))
      : [];
  functionChoices = [
    ...functionChoices,
    ...auxiliaryMappingChoices(
      auxiliaryDescriptors,
      room.id,
      profile,
      runtime,
      onEntityIdsBySlotIdChange,
    ),
  ];
  const canAddReading = Boolean(onAddReading && relationship.kind === "modeled-device");
  const selectedTargetLabel =
    optimisticTarget?.id === relationship.id ? optimisticTarget.label : relationshipLabel;
  const choose = (choice: MappingChoice, value: string, primary: boolean) => {
    if (disabled && value) return;
    const chosenOption = value
      ? choice.options.find((option) => option.value === value)
      : undefined;
    const chosenLabel = value
      ? (chosenOption?.summaryLabel ?? chosenOption?.label ?? "Saved match")
      : "Not connected";
    const targetLabel = primary ? chosenLabel : relationshipLabel;
    const selectionComplete = choice.onChange(value);
    setOptimisticTarget({ id: relationship.id, label: targetLabel });
    if (selectionComplete && auxiliaryDescriptors.length === 0 && !canAddReading)
      onSelectionMade(targetLabel);
  };

  return (
    <aside
      className={`device-mapping-inspector${inline ? " is-inline" : ""}`}
      data-state={state}
      aria-label={`Map ${relationship.label}`}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || state !== "open") return;
        event.preventDefault();
        onCollapse();
      }}
    >
      <section
        className="device-mapping-inspector__panel"
        role={inline ? undefined : "dialog"}
        aria-modal={!inline && state === "open" ? "true" : undefined}
        aria-hidden={state !== "open"}
      >
        <button
          type="button"
          className="device-mapping-inspector__collapse"
          aria-label={`Back to devices from ${relationship.label}`}
          tabIndex={state === "open" ? 0 : -1}
          onClick={onCollapse}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
          <span>{inline ? "Back to devices" : "Devices"}</span>
        </button>
        {preview}
        <div className="device-mapping-inspector__content">
          <h2>{relationship.label}</h2>
          <p className="device-mapping-inspector__room">{room.name}</p>
          <DeviceMappingChoices
            primaryChoice={primaryChoice}
            functionChoices={functionChoices}
            readingSlotIds={auxiliaryDescriptors.map((descriptor) => descriptor.slotId)}
            profile={profile}
            runtime={runtime}
            disabled={disabled}
            open={state === "open"}
            onChoose={choose}
            onChoiceElement={onChoiceElement}
            onAddReading={canAddReading ? onAddReading : undefined}
          />
          {connectionDetails && (
            <details className="device-mapping-inspector__details">
              <summary>Connection details</summary>
              <div>{connectionDetails}</div>
            </details>
          )}
        </div>
      </section>
      <button
        type="button"
        className="device-mapping-inspector__summary"
        aria-label={`Edit mapping for ${relationship.label}`}
        tabIndex={state === "summary" ? 0 : -1}
        aria-hidden={state !== "summary"}
        onClick={onReopen}
      >
        <strong>{relationship.label}</strong>
        <span aria-hidden="true">→</span>
        <span>{selectedTargetLabel}</span>
      </button>
    </aside>
  );
}
