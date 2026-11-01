import { useHomeAssistantHostSession } from "@cabane/engine";
import { HomeAssistantIcon } from "./HomeAssistantIcon";
import { workspaceStorageStatus } from "./workspace-availability";
import { useEffect, useState } from "react";
import { readSyncCursor, fingerprintWorkspace, type SyncCursor } from "./workspace-sync-state";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { readWorkspacePreview } from "./workspace-presentation";
import type { WorkspaceEntry } from "@cabane/engine";
export type WorkspaceLibraryEntry = WorkspaceEntry;
export type WorkspaceCardAction =
  | "settings"
  | "sync"
  | "dashboard"
  | "device"
  | "agent-pilot"
  | "rename"
  | "duplicate"
  | "export"
  | "delete";
export function WorkspaceCard({
  entry,
  busy,
  onOpen,
  onAction,
  onRecover,
  onExportRaw,
}: {
  entry: WorkspaceLibraryEntry;
  busy: boolean;
  onOpen: () => void;
  onAction: (action: WorkspaceCardAction) => void;
  onRecover: () => void;
  onExportRaw: () => void;
}) {
  const { metadata, record, error } = entry;
  const hostSession = useHomeAssistantHostSession();
  const [sync, setSync] = useState<SyncCursor | null>(null);
  const [changed, setChanged] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(!metadata.homeAssistantUrl);
  useEffect(() => {
    let active = true;
    setSync(null);
    setChanged(false);
    setStorageError(false);
    setStorageLoaded(!metadata.homeAssistantUrl);
    const refresh = () => {
      if (metadata.homeAssistantUrl)
        void readSyncCursor(window.indexedDB, metadata.homeAssistantUrl, metadata.id)
          .then(async (cursor) => {
            const changed = Boolean(
              cursor &&
              record &&
              (await fingerprintWorkspace(metadata, record)) !== cursor.acknowledgedFingerprint,
            );
            if (active) {
              setSync(cursor);
              setChanged(changed);
              setStorageLoaded(true);
            }
          })
          .catch(() => {
            if (active) {
              setStorageError(true);
              setStorageLoaded(true);
            }
          });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, [metadata.id, metadata.homeAssistantUrl, record, metadata]);
  const storage = workspaceStorageStatus(sync, changed);
  const actionLabels: Record<WorkspaceCardAction, string> = {
    settings: "Home Assistant settings",
    sync: "Sync with Home Assistant",
    dashboard: "Add to Home Assistant",
    device: "Open on another device",
    "agent-pilot": "Connect LLM agent",
    rename: "Rename",
    duplicate: "Duplicate",
    export: "Export",
    delete: "Delete",
  };
  const preview = readWorkspacePreview(metadata.id);
  const dirty = record && JSON.stringify(record.draft) !== JSON.stringify(record.published);
  return (
    <article className={`workspace-card${error ? " workspace-card--recovery" : ""}`}>
      {!error && (
        <button
          className="workspace-card-target"
          disabled={busy}
          onClick={onOpen}
          aria-label={`Open ${metadata.name}`}
        />
      )}
      <details>
        <summary aria-label={`Actions for ${metadata.name}`}>•••</summary>
        <div className="workspace-menu">
          {(
            [
              "settings",
              "sync",
              "dashboard",
              "device",
              "agent-pilot",
              "rename",
              "duplicate",
              "export",
              "delete",
            ] as const
          )
            .filter(
              (action) =>
                (action !== "sync" || !sync?.enabled) &&
                (action !== "agent-pilot" || Boolean(hostSession)),
            )
            .map((action) => (
              <button
                key={action}
                disabled={busy || Boolean(error && action !== "delete")}
                onClick={(event) => {
                  const menu = event.currentTarget.closest("details");
                  menu?.removeAttribute("open");
                  menu?.querySelector("summary")?.focus();
                  onAction(action);
                }}
              >
                {actionLabels[action]}
              </button>
            ))}
        </div>
      </details>
      {preview && (
        <img
          className="workspace-preview"
          src={preview}
          alt={`Preview of ${metadata.name}`}
          loading="lazy"
        />
      )}
      <h2>{metadata.name}</h2>
      <dl className="workspace-availability">
        <div>
          <dt>Connection</dt>
          <dd>
            <EditorIcon name="devices" />
            {metadata.homeAssistantUrl ? "HA configured" : "HA not connected"}
          </dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>
            <EditorIcon name={storageError ? "warning" : storage.icon} />
            {storageError
              ? "Storage unavailable"
              : !storageLoaded
                ? "Checking storage…"
                : storage.label}
          </dd>
        </div>
      </dl>
      {(error || !metadata.hasPublished || dirty) && (
        <p className="workspace-status">
          {error ? "Needs recovery" : !metadata.hasPublished ? "Draft" : "Unapplied changes"}
        </p>
      )}
      <div className="workspace-card-footer">
        <p className="workspace-server">
          {metadata.homeAssistantUrl && (
            <>
              <HomeAssistantIcon />
              <span>{new URL(metadata.homeAssistantUrl).host}</span>
            </>
          )}
        </p>
        {!error && (
          <span className="workspace-card-arrow" aria-hidden="true">
            →
          </span>
        )}
      </div>
      {error ? (
        <>
          <p className="workspace-error">{error}</p>
          <div className="workspace-card-recovery">
            <button disabled={busy} onClick={onRecover}>
              Recover workspace
            </button>
            <button disabled={busy} onClick={onExportRaw}>
              Export raw data
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}
