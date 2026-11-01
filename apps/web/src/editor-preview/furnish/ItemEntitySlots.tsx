import { useState } from "react";
import {
  SceneStateVisibilitySelect,
  ConnectionIcon,
  DeviceCategoryIcon,
  connectionSlotLabel,
  entityConnectionSummary,
  isAuxiliaryEntitySlot,
  type EntityBindingSlotSpec,
  type HomeAssistantRuntimeSnapshot,
  type RuntimeBindingProfile,
  type SceneItemSpec,
} from "@cabane/engine";
import { EditorButton } from "../../editor-chrome/EditorButton";
import "./item-entity-slots.css";

export interface ItemConnectionContext {
  profile: RuntimeBindingProfile;
  runtime: HomeAssistantRuntimeSnapshot;
  onConnect: (slotId: string) => void;
  onDisconnect: (slotId: string) => void;
  onAddReading: () => void;
}

function ItemConnectionRow({
  slot,
  item,
  connections,
  onChange,
  onRemove,
}: {
  slot: EntityBindingSlotSpec;
  item: SceneItemSpec;
  connections?: ItemConnectionContext | undefined;
  onChange: (slot: EntityBindingSlotSpec) => void;
  onRemove?: (() => void) | undefined;
}) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(slot.presentation.label);
  const current = connections?.profile.entityIdsBySlotId[slot.id];
  const summary = connections && entityConnectionSummary(current, connections.runtime);
  const label = connectionSlotLabel(slot, item.modelId);
  return (
    <div className="item-entity-slots__entry">
      <>
        {current &&
        connections?.runtime.entityStates[current]?.attributes.device_class === "water" ? (
          <ConnectionIcon name="water" />
        ) : (
          <DeviceCategoryIcon domain={slot.compatibleDomains[0] ?? "sensor"} />
        )}
      </>
      <div className="item-connection-content">
        <div className="item-connection-title">
          <strong>{label}</strong>
          <button
            type="button"
            className="item-connection-link"
            onClick={() => connections?.onConnect(slot.id)}
            disabled={!connections}
          >
            {current ? "Change" : "Connect"}
            <ConnectionIcon name="chevron" />
          </button>
          {onRemove && (
            <button
              type="button"
              className="item-connection-more"
              aria-label={`Options for ${label}`}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <ConnectionIcon name="more" />
            </button>
          )}
        </div>
        <p className="item-connection-source">
          {current && summary
            ? [summary.deviceName, summary.label].filter(Boolean).join(" · ")
            : slot.deviceRole === "primary"
              ? "Primary connection"
              : "Choose a Home Assistant sensor"}
        </p>
        <p
          className={`item-connection-status${!current ? " is-pending" : summary && !summary.available ? " is-unavailable" : ""}`}
        >
          <ConnectionIcon name={current ? "check" : "link"} />
          {summary?.status ?? "Not connected"}
        </p>
        <SceneStateVisibilitySelect
          label={isAuxiliaryEntitySlot(slot) ? "Show on model" : "Show state on model"}
          accessibleLabel={`Show ${label} on model`}
          value={slot.presentation.showInScene}
          onChange={(showInScene) =>
            onChange({ ...slot, presentation: { ...slot.presentation, showInScene } })
          }
        />
        {menu && (
          <div className="item-connection-menu" role="group" aria-label={`${label} actions`}>
            <button
              type="button"
              onClick={() => {
                setRenaming(true);
                setMenu(false);
                setName(slot.presentation.label);
              }}
            >
              Rename
            </button>
            {current && (
              <button
                type="button"
                onClick={() => {
                  connections?.onDisconnect(slot.id);
                  setMenu(false);
                }}
              >
                Disconnect
              </button>
            )}
            <button type="button" className="item-connection-remove" onClick={onRemove}>
              Remove reading
            </button>
          </div>
        )}
        {renaming && (
          <form
            className="item-connection-rename"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) {
                onChange({ ...slot, presentation: { ...slot.presentation, label: name.trim() } });
                setRenaming(false);
              }
            }}
          >
            <label>
              Reading name
              <input
                type="text"
                value={name}
                maxLength={80}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button type="submit">Save name</button>
            <button type="button" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ItemEntitySlots({
  item,
  label: _label,
  onChange,
  connections,
}: {
  item: SceneItemSpec;
  label: string;
  onChange: (slots: readonly EntityBindingSlotSpec[]) => void;
  connections?: ItemConnectionContext | undefined;
}) {
  const slots = item.entitySlots ?? [];
  const controls = slots.filter((slot) => !isAuxiliaryEntitySlot(slot));
  const readings = slots.filter(isAuxiliaryEntitySlot);
  const row = (slot: EntityBindingSlotSpec) => (
    <ItemConnectionRow
      key={slot.id}
      slot={slot}
      item={item}
      connections={connections}
      onChange={(next) =>
        onChange(slots.map((candidate) => (candidate.id === next.id ? next : candidate)))
      }
      onRemove={
        isAuxiliaryEntitySlot(slot)
          ? () => onChange(slots.filter((candidate) => candidate.id !== slot.id))
          : undefined
      }
    />
  );
  return (
    <>
      {controls.length > 0 && (
        <fieldset className="item-entity-slots">
          <legend>Connections</legend>
          {controls.map(row)}
        </fieldset>
      )}
      <fieldset className="item-entity-slots">
        <legend>Readings</legend>
        {readings.map(row)}
        <EditorButton onClick={() => connections?.onAddReading()} disabled={!connections}>
          <ConnectionIcon name="plus" />
          Add reading
        </EditorButton>
      </fieldset>
    </>
  );
}
