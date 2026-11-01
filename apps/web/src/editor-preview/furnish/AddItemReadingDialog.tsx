import { useEffect, useId, useRef } from "react";
import {
  ConnectionIcon,
  ReadingConnectionForm,
  useCabaneDom,
  type EntityId,
  type ReadingPresentation,
  type SceneItemSpec,
} from "@cabane/engine";
import type { ItemConnectionContext } from "./ItemEntitySlots";

export function AddItemReadingDialog({
  item,
  label,
  connections,
  disabled,
  onAdd,
  onClose,
}: {
  item: SceneItemSpec;
  label: string;
  connections: ItemConnectionContext;
  disabled: boolean;
  onAdd: (entityId: EntityId, presentation: ReadingPresentation) => void;
  onClose: () => void;
}) {
  const dom = useCabaneDom();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
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
      className="connection-reading-dialog"
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="connection-reading-dialog__heading">
        <h2 id={title}>{label} · Add reading</h2>
        <button type="button" aria-label="Close reading picker" onClick={onClose}>
          <ConnectionIcon name="close" />
        </button>
      </header>
      <div className="connection-reading-dialog__body">
        <ReadingConnectionForm
          profile={connections.profile}
          runtime={connections.runtime}
          attached={(item.entitySlots ?? []).flatMap(
            (slot) => connections.profile.entityIdsBySlotId[slot.id] ?? [],
          )}
          disabled={disabled}
          onCancel={onClose}
          onAdd={onAdd}
        />
      </div>
    </dialog>
  );
}
