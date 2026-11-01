import { useState, type ReactNode } from "react";
import { DeviceCategoryIcon } from "../DeviceCategoryIcon";
import { isAuxiliaryEntitySlot } from "../entity-slot-roles";
import { replaceEntitySlotMapping } from "../runtime-binding-profile";
import type {
  EntityId,
  HomeAssistantRuntimeSnapshot,
  RoomSpec,
  RuntimeBindingProfile,
} from "../types";
import type { DeviceMappingRelationship } from "./device-mapping-groups";
import { ConnectionSourcePicker } from "./ConnectionSourcePicker";
import { ConnectionIcon } from "./ConnectionIcon";
import {
  connectionSlotLabel,
  entityConnectionSummary,
  type ReadingPresentation,
} from "./connection-presentation";
import { ReadingConnectionForm } from "./ReadingConnectionForm";

export function DeviceConnectionWorkbench({
  room,
  relationship,
  profile,
  runtime,
  disabled,
  slotId,
  onSlotChange,
  onEntityIdsBySlotIdChange,
  onAddReading,
  preview,
  onBack,
}: {
  room: RoomSpec;
  relationship: DeviceMappingRelationship;
  profile: RuntimeBindingProfile;
  runtime: HomeAssistantRuntimeSnapshot;
  disabled: boolean;
  slotId: string | null;
  onSlotChange: (slotId: string | null) => void;
  onEntityIdsBySlotIdChange: (ids: RuntimeBindingProfile["entityIdsBySlotId"]) => void;
  onAddReading?: ((entityId: EntityId, presentation?: ReadingPresentation) => void) | undefined;
  preview?: ReactNode;
  onBack: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const descriptors =
    relationship.kind === "modeled-device" ? relationship.descriptors : [relationship.descriptor];
  const controls = descriptors.filter((descriptor) => !isAuxiliaryEntitySlot(descriptor.spec));
  const readings = descriptors.filter((descriptor) => isAuxiliaryEntitySlot(descriptor.spec));
  const active = descriptors.find((descriptor) => descriptor.slotId === slotId);
  const model = relationship.kind === "modeled-device" ? relationship.device.model : undefined;
  const primary = descriptors.find((descriptor) => descriptor.spec.deviceRole === "primary");
  const primaryEntity = primary ? profile.entityIdsBySlotId[primary.slotId] : undefined;
  const preferredEntity =
    primaryEntity ??
    readings.map((descriptor) => profile.entityIdsBySlotId[descriptor.slotId]).find(Boolean);
  const preferredDeviceId = runtime.entityRegistry.find(
    (entry) => entry.entity_id === preferredEntity,
  )?.device_id;
  const assign = (id: EntityId | null) => {
    if (active)
      onEntityIdsBySlotIdChange(
        replaceEntitySlotMapping(profile, active.slotId, id).entityIdsBySlotId,
      );
  };
  const renderConnection = (descriptor: (typeof descriptors)[number]) => {
    const current = profile.entityIdsBySlotId[descriptor.slotId];
    const summary = entityConnectionSummary(current, runtime);
    return (
      <button
        type="button"
        key={descriptor.slotId}
        className={`connection-slot${active?.slotId === descriptor.slotId && !adding ? " is-active" : ""}`}
        aria-pressed={active?.slotId === descriptor.slotId && !adding}
        onClick={() => {
          onSlotChange(descriptor.slotId);
          setAdding(false);
        }}
      >
        <span className="connection-slot__heading">
          <>
            {current && runtime.entityStates[current]?.attributes.device_class === "water" ? (
              <ConnectionIcon name="water" />
            ) : (
              <DeviceCategoryIcon domain={descriptor.spec.compatibleDomains[0] ?? "sensor"} />
            )}
          </>
          <strong>{connectionSlotLabel(descriptor.spec, model)}</strong>
          <span>
            {current ? "Change" : "Connect"}
            <ConnectionIcon name="chevron" />
          </span>
        </span>
        <span className="connection-slot__source">
          {current
            ? [summary.deviceName, summary.label].filter(Boolean).join(" · ")
            : "Choose a Home Assistant source"}
        </span>
        <span
          className={`connection-slot__status${!current ? " is-pending" : !summary.available ? " is-unavailable" : ""}`}
        >
          <ConnectionIcon name={current ? "check" : "link"} />
          {summary.status}
          {descriptor.spec.presentation.showInScene && (
            <span>
              <ConnectionIcon name="eye" />
              On model
            </span>
          )}
        </span>
      </button>
    );
  };
  return (
    <div className="connection-workbench" data-picking={Boolean(active) || adding}>
      <section className="connection-device" aria-label={`${relationship.label} connections`}>
        <button type="button" className="connection-mobile-back" onClick={onBack}>
          <ConnectionIcon name="back" />
          Devices
        </button>
        <header className="connection-device__identity connection-column-heading">
          {preview}
          <div>
            <h2>{relationship.label}</h2>
            <p>Connections & readings</p>
          </div>
        </header>
        {controls.length > 0 && (
          <section>
            <h3>Device connections</h3>
            {controls.map(renderConnection)}
          </section>
        )}
        {(readings.length > 0 || onAddReading) && (
          <section>
            <h3>Readings</h3>
            {readings.map(renderConnection)}
            {onAddReading && (
              <button
                type="button"
                className="connection-add"
                onClick={() => {
                  onSlotChange(null);
                  setAdding(true);
                }}
                disabled={disabled}
              >
                <ConnectionIcon name="plus" />
                Add reading
              </button>
            )}
          </section>
        )}
      </section>
      {adding && onAddReading ? (
        <ReadingConnectionForm
          profile={profile}
          runtime={runtime}
          roomId={room.id}
          preferredDeviceId={preferredDeviceId}
          attached={readings.flatMap(
            (descriptor) => profile.entityIdsBySlotId[descriptor.slotId] ?? [],
          )}
          disabled={disabled}
          onCancel={() => {
            setAdding(false);
            onSlotChange(null);
          }}
          onAdd={(id, presentation) => {
            onAddReading(id, presentation);
            setAdding(false);
            onSlotChange(null);
          }}
        />
      ) : (
        active && (
          <ConnectionSourcePicker
            key={active.slotId}
            descriptor={active}
            roomId={room.id}
            profile={profile}
            runtime={runtime}
            selected={profile.entityIdsBySlotId[active.slotId]}
            preferredDeviceId={preferredDeviceId}
            disabled={disabled}
            title={connectionSlotLabel(active.spec, model)}
            description={`Choose a Home Assistant source for ${connectionSlotLabel(active.spec, model)}.`}
            onSelect={assign}
            onDisconnect={() => assign(null)}
            onBack={() => onSlotChange(null)}
          />
        )
      )}
    </div>
  );
}
