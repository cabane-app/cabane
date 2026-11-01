import { LengthInput } from "../editor-chrome/LengthInput";
import { useCabaneDom } from "@cabane/engine";
import { useEffect, useId, useRef, useState } from "react";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import "./floor-management-dialog.css";

export function FloorManagementDialog({
  action,
  name,
  itemCount,
  stairCount,
  height,
  onSave,
  onCancel,
  onRemove,
  removeDisabledReason,
}: {
  action: "rename" | "remove" | "add-above" | "add-below";
  name: string;
  itemCount: number;
  stairCount: number;
  height: number;
  onSave: (name: string, height: number, duplicate?: boolean) => void;
  onCancel: () => void;
  onRemove?: (() => void) | undefined;
  removeDisabledReason?: string | undefined;
}) {
  const dom = useCabaneDom();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const heightHintId = useId();
  const removeHintId = useId();
  const [value, setValue] = useState(name);
  const [floorHeight, setFloorHeight] = useState(String(height));
  const adding = action === "add-above" || action === "add-below";
  const [duplicate, setDuplicate] = useState(false);
  const invalid =
    action === "rename" &&
    (!value.trim() || !Number.isFinite(Number(floorHeight)) || Number(floorHeight) <= 0);
  useEffect(() => {
    const previous = dom.root.activeElement as HTMLElement | null;
    dialog.current?.showModal?.();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [dom]);
  return (
    <dialog
      ref={dialog}
      className="floor-management-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) onSave(value.trim(), Number(floorHeight), duplicate);
        }}
      >
        <header>
          <h2 id={titleId}>
            {adding
              ? `Add floor ${action === "add-below" ? "below" : "above"}`
              : action === "remove"
                ? `Remove ${name}?`
                : "Floor settings"}
          </h2>
          <EditorButton aria-label="Close floor settings" onClick={onCancel}>
            <EditorIcon name="close" />
          </EditorButton>
        </header>
        {adding ? (
          <div className="floor-management-dialog__fields">
            <p>
              The new floor will be added{" "}
              {action === "add-below" ? "beneath the lowest floor" : "above the top floor"}.
            </p>
            <label className="floor-management-dialog__choice">
              <input
                type="checkbox"
                checked={duplicate}
                onChange={(event) => setDuplicate(event.target.checked)}
              />
              Duplicate this floor ({name})
            </label>
            {duplicate && (
              <p>
                Copies the Construct elements with new IDs. Furniture, devices and stairs are not
                copied.
              </p>
            )}
          </div>
        ) : action === "remove" ? (
          <p>
            This removes this floor, its {itemCount} items and {stairCount} connecting stairs. You
            can undo this change.
          </p>
        ) : (
          <div className="floor-management-dialog__fields">
            <label>
              Floor name
              <input
                autoFocus
                required
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
            <label>
              Floor-to-floor height
              <LengthInput
                label="Floor-to-floor height"
                min={0.1}
                value={Number(floorHeight)}
                onCommit={(value) => setFloorHeight(String(value))}
              />
            </label>
            <p id={heightHintId} className="floor-management-dialog__hint">
              Distance from this floor to the floor above.
            </p>
          </div>
        )}
        <footer>
          {action === "rename" && (
            <EditorButton
              className="floor-management-dialog__delete"
              disabled={!onRemove}
              aria-describedby={removeDisabledReason ? removeHintId : undefined}
              onClick={onRemove}
            >
              Delete floor
            </EditorButton>
          )}
          <EditorButton onClick={onCancel}>Cancel</EditorButton>
          <EditorButton
            type="submit"
            variant="primary"
            disabled={invalid}
            className={action === "remove" ? "floor-management-dialog__remove" : undefined}
          >
            {adding ? "Add floor" : action === "remove" ? "Remove floor" : "Save floor"}
          </EditorButton>
        </footer>
        {action === "rename" && removeDisabledReason && (
          <p id={removeHintId} className="floor-management-dialog__delete-hint">
            {removeDisabledReason}
          </p>
        )}
      </form>
    </dialog>
  );
}
