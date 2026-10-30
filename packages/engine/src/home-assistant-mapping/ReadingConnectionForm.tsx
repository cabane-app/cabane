import { SceneStateVisibilitySelect } from "./SceneStateVisibilitySelect";
import { useState } from "react";
import type { EntityId, HomeAssistantRuntimeSnapshot, RuntimeBindingProfile } from "../types";
import { newReadingDescriptor } from "./connection-candidates";
import { ConnectionSourcePicker } from "./ConnectionSourcePicker";
import { ConnectionIcon } from "./ConnectionIcon";
import { entityConnectionSummary, type ReadingPresentation } from "./connection-presentation";

export function ReadingConnectionForm({
  profile,
  runtime,
  roomId = "",
  preferredDeviceId,
  attached,
  disabled,
  onAdd,
  onCancel,
}: {
  profile: RuntimeBindingProfile;
  runtime: HomeAssistantRuntimeSnapshot;
  roomId?: string;
  preferredDeviceId?: string | null | undefined;
  attached: readonly EntityId[];
  disabled: boolean;
  onAdd: (entityId: EntityId, presentation: ReadingPresentation) => void;
  onCancel: () => void;
}) {
  const [entityId, setEntityId] = useState<EntityId | null>(null);
  const [label, setLabel] = useState("");
  const [showInScene, setShowInScene] = useState<ReadingPresentation["showInScene"]>(true);
  if (!entityId)
    return (
      <div className="reading-connection-form">
        <button type="button" className="connection-back" onClick={onCancel}>
          <ConnectionIcon name="back" />
          Connections
        </button>
        <ConnectionSourcePicker
          descriptor={newReadingDescriptor}
          roomId={roomId}
          profile={profile}
          runtime={runtime}
          title="Add reading"
          description="Choose a sensor first. Name and display come next."
          preferredDeviceId={preferredDeviceId}
          attached={attached}
          disabled={disabled}
          onSelect={(id) => {
            setEntityId(id);
            setLabel(entityConnectionSummary(id, runtime).label);
          }}
        />
      </div>
    );
  const source = entityConnectionSummary(entityId, runtime);
  return (
    <form
      className="reading-connection-confirm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && label.trim()) onAdd(entityId, { label: label.trim(), showInScene });
      }}
    >
      <button type="button" className="connection-back" onClick={() => setEntityId(null)}>
        <ConnectionIcon name="back" />
        Sensors
      </button>
      <h2>Add reading</h2>
      <p className="reading-connection-confirm__source">
        <strong>{source.label}</strong>
        <span>{source.deviceName}</span>
        <span>{source.value}</span>
      </p>
      <label>
        Reading name
        <input
          type="text"
          maxLength={80}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
        />
      </label>
      <SceneStateVisibilitySelect
        label="Show on model"
        value={showInScene}
        onChange={setShowInScene}
        disabled={disabled}
      />
      <div className="reading-connection-confirm__actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={disabled || !label.trim()}>
          <ConnectionIcon name="plus" />
          Add connected reading
        </button>
      </div>
    </form>
  );
}
