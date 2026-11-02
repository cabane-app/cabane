import { useCabaneDom } from "@cabane/engine";
import { useEffect, useId, useRef, type ReactNode } from "react";
export function WorkspaceDialog({
  title,
  titleIcon,
  busy,
  error,
  onCancel,
  children,
}: {
  title: string;
  titleIcon?: ReactNode;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  children: ReactNode;
}) {
  const dom = useCabaneDom();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = dom.root.activeElement as HTMLElement | null;
    ref.current?.showModal?.();
    return () => previous?.focus();
  }, [dom]);
  return (
    <dialog
      ref={ref}
      className="workspace-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId}>
        {titleIcon}
        {title}
      </h2>
      {children}
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      <button type="button" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </dialog>
  );
}
