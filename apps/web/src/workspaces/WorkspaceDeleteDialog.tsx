import { WorkspaceDialog } from "./WorkspaceDialog";
export type WorkspaceDeleteScope = "local" | "permanent";
export function WorkspaceDeleteDialog({
  name,
  busy,
  error,
  onDelete,
  onCancel,
  onBackup,
  local = true,
  remote = "absent",
  server,
  onRetry,
}: {
  name: string;
  busy: boolean;
  error: string | null;
  onDelete: (scope: WorkspaceDeleteScope) => void;
  onCancel: () => void;
  onBackup: () => void;
  local?: boolean;
  remote?: "checking" | "present" | "absent" | "error";
  server?: string | null;
  onRetry?: () => void;
}) {
  const hasRemote = remote !== "absent";
  return (
    <WorkspaceDialog title={`Delete ${name}?`} busy={busy} error={error} onCancel={onCancel}>
      <p>
        {local && hasRemote
          ? "Remove it from this browser, or delete the saved Home Assistant copy too. Permanent deletion cannot be undone."
          : local
            ? "Permanently removes this workspace, its design, and mappings from this browser. There is no undo."
            : "Permanently removes the saved Home Assistant copy. There is no undo."}
      </p>
      {server && <p className="workspace-delete-server">Home Assistant: {server}</p>}
      {remote === "checking" && <p role="status">Checking the Home Assistant copy…</p>}
      {remote === "error" && (
        <button type="button" disabled={busy} onClick={onRetry}>
          Retry Home Assistant
        </button>
      )}
      {remote === "present" && <p>Other devices may still have browser copies.</p>}
      <div className="workspace-delete-actions">
        {local && hasRemote && (
          <button type="button" disabled={busy} onClick={() => onDelete("local")}>
            Remove locally
          </button>
        )}
        <button
          type="button"
          className="workspace-danger"
          disabled={busy || (hasRemote ? remote !== "present" : !local)}
          onClick={() => onDelete("permanent")}
        >
          Delete permanently
        </button>
      </div>
      <button type="button" disabled={busy} onClick={onBackup}>
        Download backup
      </button>
      {busy && <p role="status">Working…</p>}
    </WorkspaceDialog>
  );
}
