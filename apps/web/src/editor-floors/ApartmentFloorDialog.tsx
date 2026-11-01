import { useCabaneDom } from "@cabane/engine";
import { useEffect, useId, useRef, useState } from "react";
import { EditorButton } from "../editor-chrome/EditorButton";
import "./floor-management-dialog.css";

export function ApartmentFloorDialog({
  value,
  onSave,
  onCancel,
}: {
  value: number;
  onSave: (value: number) => void;
  onCancel: () => void;
}) {
  const dom = useCabaneDom();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const hint = useId();
  const [input, setInput] = useState(String(value));
  const floor = Number(input);
  const valid = input.trim() !== "" && Number.isInteger(floor) && floor >= 0 && floor <= 100;
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
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onSave(floor);
        }}
      >
        <header>
          <h2 id={title}>Apartment floor</h2>
        </header>
        <div className="floor-management-dialog__fields">
          <label>
            Which floor does your home start on?
            <input
              autoFocus
              required
              type="number"
              min="0"
              max="100"
              step="1"
              value={input}
              aria-describedby={hint}
              onChange={(event) => setInput(event.target.value)}
            />
          </label>
          <p id={hint}>
            0 is ground level. Higher numbers add decorative floors beneath your home. They have no
            rooms or devices and cannot be entered. For a home with several floors, this applies to
            its lowest floor.
          </p>
        </div>
        <footer>
          <EditorButton onClick={onCancel}>Cancel</EditorButton>
          <EditorButton type="submit" variant="primary" disabled={!valid}>
            Save
          </EditorButton>
        </footer>
      </form>
    </dialog>
  );
}
