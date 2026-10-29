import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useCabaneDom } from "@cabane/engine";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import "./model-editor.css";

/** One modal and one save boundary for a whole model definition. */
export function ModelEditorDialog({
  name,
  scope,
  saveLabel = "Save changes",
  canSave,
  onSave,
  onCancel,
  children,
}: {
  name: string;
  scope: ReactNode;
  saveLabel?: string;
  canSave: boolean;
  onSave: () => Promise<void>;
  onCancel: () => void;
  children: (busy: boolean) => ReactNode;
}) {
  const dom = useCabaneDom();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef(dom.root.activeElement as HTMLElement | null);
  const title = useId();
  const description = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const previous = opener.current;
    dialog.current?.showModal?.();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [dom]);
  return (
    <dialog
      ref={dialog}
      className="model-editor-dialog"
      aria-labelledby={title}
      aria-describedby={description}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave || busy) return;
          setBusy(true);
          setError(null);
          void onSave()
            .catch((caught: unknown) =>
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Could not save the model. Your changes are kept here. Try Save again.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <header className="model-editor-header">
          <div>
            <h2 id={title}>Model Editor</h2>
            <p className="model-editor-name">{name || "New model"}</p>
          </div>
          <EditorButton aria-label="Close model editor" disabled={busy} onClick={onCancel}>
            <EditorIcon name="close" />
          </EditorButton>
        </header>
        <p id={description} className="model-editor-scope">
          {scope}
        </p>
        {children(busy)}
        {error && (
          <p role="alert" className="model-editor-error">
            {error}
          </p>
        )}
        <footer className="model-editor-footer">
          <span>Preview only. Home Assistant devices are not operated.</span>
          <div className="model-editor-save-actions">
            <EditorButton disabled={busy} onClick={onCancel}>
              Cancel
            </EditorButton>
            <EditorButton type="submit" variant="primary" disabled={!canSave || busy}>
              {busy ? "Saving…" : saveLabel}
            </EditorButton>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
