import { useId, type ReactNode } from "react";
import { EditorSwitch } from "../../editor-chrome/EditorSwitch";
import { CommittedTextInput } from "./CommittedTextInput";

/** Shared room identity controls; callers retain ownership of physical geometry. */
export function RoomMembershipFields({
  enabled,
  name,
  description,
  placeholder,
  onEnabledChange,
  onNameCommit,
  children,
}: {
  enabled: boolean;
  name: string;
  description: string;
  placeholder: string;
  onEnabledChange: (enabled: boolean) => void;
  onNameCommit: (name: string) => void;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <fieldset>
      <legend>Room</legend>
      <div className="construction-inspector__room-toggle">
        <label id={`${id}-label`} htmlFor={id}>
          Use as room
        </label>
        <EditorSwitch
          id={id}
          labelledBy={`${id}-label`}
          describedBy={`${id}-description`}
          checked={enabled}
          onChange={onEnabledChange}
        />
        <p id={`${id}-description`} className="construction-inspector__room-action-note">
          {description}
        </p>
      </div>
      {enabled && (
        <>
          <label>
            Name
            <CommittedTextInput
              label="Room name"
              value={name}
              placeholder={placeholder}
              onCommit={onNameCommit}
            />
          </label>
          {children}
        </>
      )}
    </fieldset>
  );
}
