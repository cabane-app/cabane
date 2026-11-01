import { EditorIcon } from "../editor-chrome/EditorIcon";
import { useCabaneAssetUrl, useHomeAssistantHostSession } from "@cabane/engine";
import { useLocation, useNavigate } from "react-router";

import type { WorkspaceDestination } from "./workspace-open-link";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { useState, type ReactNode } from "react";
import {
  WorkspaceCard,
  type WorkspaceCardAction,
  type WorkspaceLibraryEntry,
} from "./WorkspaceCard";
import { WorkspaceNameDialog } from "./WorkspaceNameDialog";
import { WorkspaceTransferDialog } from "./WorkspaceTransferDialog";
import "./workspaces.css";
export type { WorkspaceLibraryEntry } from "./WorkspaceCard";
type Dialog = {
  action: WorkspaceCardAction | "create" | "import" | "setup-ha";
  entry?: WorkspaceLibraryEntry;
};
export interface WorkspaceLibraryProps {
  entries: WorkspaceLibraryEntry[];
  demoWorkspaceId?: (string | null) | undefined;
  onOpen: (id: string) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDuplicate: (id: string, name: string) => Promise<void>;
  renderDelete: (
    entry: WorkspaceLibraryEntry,
    onCancel: () => void,
    onBusyChange: (busy: boolean) => void,
  ) => ReactNode;
  onImport: (json: string) => Promise<void>;
  onExport: (id: string, privateBackup: boolean) => Promise<void>;
  onRecover: (id: string) => Promise<void>;
  onExportRaw: (id: string) => Promise<void>;
  onAgentPilot: (id: string) => Promise<void>;
  remoteImport?: ReactNode;
  renderSuggestions?: (busy: boolean, onBusyChange: (busy: boolean) => void) => ReactNode;
  onSettings?: (id: string, intent?: WorkspaceDestination) => Promise<void>;
}
export function WorkspaceLibrary(props: WorkspaceLibraryProps) {
  const hostSession = useHomeAssistantHostSession();
  const iconUrl = useCabaneAssetUrl("cabane-icon.png");
  const location = useLocation();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog | null>(() =>
    new URLSearchParams(location.search).get("import") === "home-assistant"
      ? { action: "import" }
      : null,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openDialog = (next: Dialog) => {
    setError(null);
    setDialog(next);
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setDialog(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not complete this action. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const setupEntries = props.entries.filter(
    (entry) => !entry.error && entry.metadata.id !== props.demoWorkspaceId,
  );
  const startSetup = () => {
    if (setupEntries.length === 1)
      void run(() => props.onSettings!(setupEntries[0].metadata.id, "dashboard"));
    else openDialog({ action: "setup-ha" });
  };
  const cancel = () => {
    setDialog(null);
    setError(null);
    void navigate("/workspaces", { replace: true });
  };
  return (
    <main className="workspace-library">
      <header className="workspace-library-header">
        <div>
          <p className="workspace-brand">
            <img src={iconUrl} alt="" width="28" height="33" />
            Cabane
          </p>
          <h1>Your workspaces</h1>
        </div>
        <div className="workspace-library-actions">
          <button
            className="workspace-primary"
            disabled={busy}
            onClick={() => openDialog({ action: "create" })}
          >
            <EditorIcon name="plus" />
            New workspace
          </button>
          <button disabled={busy} onClick={() => openDialog({ action: "import" })}>
            <EditorIcon name="import" />
            Import workspace
          </button>
        </div>
      </header>
      {props.onSettings && !hostSession && (
        <div className="workspace-ha-entry">
          <button disabled={busy} onClick={startSetup}>
            Add Cabane to Home Assistant
            <EditorIcon name="chevron" />
          </button>
        </div>
      )}

      {!dialog && error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {!props.entries.length && (
        <section className="workspace-empty">
          <h2>A place for your next home</h2>
          <p>Create a workspace from scratch, or import a saved Cabane project.</p>
        </section>
      )}
      <section className="workspace-grid" aria-label="Homes">
        {props.entries.map((entry) => (
          <WorkspaceCard
            key={entry.metadata.id}
            entry={entry}
            busy={busy}
            onOpen={() => void run(() => props.onOpen(entry.metadata.id))}
            onAction={(action) =>
              ["settings", "sync", "dashboard", "device"].includes(action)
                ? void run(
                    () =>
                      props.onSettings?.(
                        entry.metadata.id,
                        action === "settings" ? undefined : (action as WorkspaceDestination),
                      ) ?? Promise.resolve(),
                  )
                : action === "agent-pilot"
                  ? void run(() => props.onAgentPilot(entry.metadata.id))
                  : openDialog({ action, entry })
            }
            onRecover={() => void run(() => props.onRecover(entry.metadata.id))}
            onExportRaw={() => void run(() => props.onExportRaw(entry.metadata.id))}
          />
        ))}
        {props.renderSuggestions?.(busy, setBusy)}
      </section>
      {dialog?.action === "setup-ha" && (
        <WorkspaceDialog
          title="Add Cabane to Home Assistant"
          busy={busy}
          error={error}
          onCancel={cancel}
        >
          <p>
            {setupEntries.length
              ? "Choose the home to sync with Home Assistant."
              : "Create or import a home first. You can keep using Cabane in this browser."}
          </p>
          <div className="workspace-setup-homes">
            {setupEntries.map((entry) => (
              <button
                key={entry.metadata.id}
                disabled={busy}
                onClick={() => void run(() => props.onSettings!(entry.metadata.id, "dashboard"))}
              >
                {entry.metadata.name}
              </button>
            ))}
          </div>
          {!setupEntries.length && (
            <button onClick={() => openDialog({ action: "create" })}>Create a home</button>
          )}
        </WorkspaceDialog>
      )}
      {dialog &&
        (dialog.action === "create" ||
          dialog.action === "rename" ||
          dialog.action === "duplicate") && (
          <WorkspaceNameDialog
            action={dialog.action}
            initialName={
              dialog.action === "create"
                ? ""
                : `${dialog.entry!.metadata.name}${dialog.action === "duplicate" ? " copy" : ""}`
            }
            busy={busy}
            error={error}
            onCancel={cancel}
            onSave={(name) =>
              void run(() =>
                dialog.action === "create"
                  ? props.onCreate(name)
                  : dialog.action === "rename"
                    ? props.onRename(dialog.entry!.metadata.id, name)
                    : props.onDuplicate(dialog.entry!.metadata.id, name),
              )
            }
          />
        )}
      {dialog?.action === "delete" && props.renderDelete(dialog.entry!, cancel, setBusy)}
      {(dialog?.action === "import" || dialog?.action === "export") && (
        <WorkspaceTransferDialog
          mode={dialog.action}
          busy={busy}
          error={error}
          onCancel={cancel}
          remoteImport={props.remoteImport}
          onImport={(json) => void run(() => props.onImport(json))}
          onExport={(privateBackup) =>
            void run(() => props.onExport(dialog.entry!.metadata.id, privateBackup))
          }
        />
      )}
    </main>
  );
}
