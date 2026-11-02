import { useCallback, useEffect, useState } from "react";
import {
  HomeAssistantRuntimeProvider,
  useHomeAssistantHostSession,
  normalizeHomeAssistantUrl,
  type WorkspaceRepository,
} from "@cabane/engine";
import { useWorkspaceSyncCoordinator } from "./useWorkspaceSyncCoordinator";
import type { HaWorkspaceSummary } from "./ha-workspace-client";
import { HomeAssistantIcon } from "./HomeAssistantIcon";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { WorkspaceDeletion } from "./WorkspaceDeletion";
import { downloadConnectData } from "../editor-connect/profile-transfer";

function WorkspaceHaLibraryContent({
  repository,
  onRestored,
  onBusyChange,
  localWorkspaceIds,
  disabled = false,
}: {
  repository: WorkspaceRepository;
  onRestored: (id: string) => Promise<void>;
  onBusyChange?: ((busy: boolean) => void) | undefined;
  localWorkspaceIds?: string[] | undefined;
  disabled?: boolean | undefined;
}) {
  const hostSession = useHomeAssistantHostSession();
  const { runtime, client, coordinator } = useWorkspaceSyncCoordinator(repository);
  const [remote, setRemote] = useState<HaWorkspaceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<HaWorkspaceSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const busy = pendingId !== null || deleteBusy;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const load = useCallback(async () => {
    try {
      setRemote(await client.list());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not list HA workspaces.");
    }
  }, [client]);
  const localIds = localWorkspaceIds?.join("\0");
  useEffect(() => {
    if (runtime.status !== "connected") return;
    void load();
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [runtime.status, load, localIds]);
  const restore = async (summary: HaWorkspaceSummary) => {
    setPendingId(summary.home_id);
    setError(null);
    try {
      const status = await coordinator.openRemote(summary.home_id, runtime.origin!);
      if (status.kind === "conflict")
        throw new Error(
          "This browser has different changes. Open the local workspace to review its saved copies.",
        );
      await onRestored(summary.home_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restore this workspace.");
    } finally {
      setPendingId(null);
    }
  };
  const downloadDamaged = async (summary: HaWorkspaceSummary) => {
    try {
      const copy = await client.get(summary.home_id);
      if (!copy?.document) throw new Error("No HA copy exists.");
      downloadConnectData(copy.document, `${summary.home_id}-ha-recovery.json`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download HA data.");
    }
  };
  const deleteDialog = deleting && (
    <WorkspaceDeletion
      repository={repository}
      target={{ saved: deleting, origin: runtime.origin! }}
      onCancel={() => setDeleting(null)}
      onBusyChange={setDeleteBusy}
      onDeleted={async () => {
        setRemote((items) => items.filter((item) => item.home_id !== deleting.home_id));
        setDeleting(null);
        setError(null);
      }}
    />
  );
  if (localWorkspaceIds) {
    const suggestions = remote.filter(
      (item) => !item.corrupt && !localWorkspaceIds.includes(item.home_id),
    );
    return (
      <>
        {runtime.status === "connected" &&
          suggestions.map((item) => (
            <article className="workspace-card workspace-card--suggested" key={item.home_id}>
              <button
                type="button"
                className="workspace-card-target"
                disabled={busy || disabled}
                aria-label={`Add ${item.name} from Home Assistant`}
                aria-busy={pendingId === item.home_id}
                onClick={() => void restore(item)}
              />
              <details>
                <summary aria-label={`Actions for ${item.name}`}>•••</summary>
                <div className="workspace-menu">
                  <button
                    type="button"
                    disabled={busy || disabled}
                    onClick={() => setDeleting(item)}
                  >
                    Delete
                  </button>
                </div>
              </details>
              <h2>{item.name}</h2>
              <p className="workspace-suggestion-description">Saved in Home Assistant</p>
              <p className="workspace-server workspace-suggestion-server">
                <HomeAssistantIcon />
                <span>{new URL(runtime.origin!).host}</span>
              </p>
              <div className="workspace-card-footer">
                <span className="workspace-suggestion-action">
                  <EditorIcon name="plus" />
                  {pendingId === item.home_id ? "Adding workspace…" : "Add workspace"}
                </span>
              </div>
            </article>
          ))}
        {deleteDialog}
        {(error || runtime.error) && (
          <div className="workspace-suggestion-error">
            <p role="alert" className="workspace-error">
              {error ?? runtime.error}
            </p>
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => {
                if (runtime.status === "connected") void load();
                else runtime.retry();
              }}
            >
              Retry suggested workspaces
            </button>
          </div>
        )}
      </>
    );
  }
  return (
    <div className="workspace-ha-library-content">
      {runtime.status !== "connected" ? (
        hostSession ? (
          <div>
            <p role="status">{runtime.error ?? "Waiting for Home Assistant…"}</p>
            {["error", "disconnected"].includes(runtime.status) && (
              <button type="button" onClick={runtime.retry}>
                Retry connection
              </button>
            )}
          </div>
        ) : (
          <button type="button" onClick={runtime.connect}>
            Sign in to Home Assistant
          </button>
        )
      ) : (
        <>
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
          {remote.length === 0 && !error && <p>No Cabane workspaces saved on this HA instance.</p>}
          {remote.map((item) => (
            <div key={item.home_id}>
              <span>{item.name}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void (item.corrupt ? downloadDamaged(item) : restore(item))}
              >
                {item.corrupt ? "Download raw data" : "Open"}
              </button>
              <button type="button" disabled={busy} onClick={() => setDeleting(item)}>
                Delete
              </button>
            </div>
          ))}
        </>
      )}
      {deleteDialog}
      {runtime.error && <p role="alert">{runtime.error}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function WorkspaceHaLibrary({
  repository,
  onRestored,
  initialOrigin,
  onBusyChange,
}: {
  repository: WorkspaceRepository;
  onRestored: (id: string) => Promise<void>;
  initialOrigin: string | null;
  onBusyChange?: (busy: boolean) => void;
}) {
  const hostSession = useHomeAssistantHostSession();
  const [originInput, setOriginInput] = useState(
    () => window.sessionStorage.getItem("cabane:ha-library-origin") ?? initialOrigin ?? "",
  );
  const origin = hostSession?.origin ?? normalizeHomeAssistantUrl(originInput);
  useEffect(() => {
    if (origin && !hostSession) window.sessionStorage.setItem("cabane:ha-library-origin", origin);
  }, [origin, hostSession]);
  return (
    <section className="workspace-ha-library">
      {hostSession ? (
        <p>
          Choose a workspace saved on {hostSession.origin}. Sign-in is managed by Home Assistant.
        </p>
      ) : (
        <p>Sign in to choose a saved workspace.</p>
      )}
      {!hostSession && (
        <label>
          Home Assistant address
          <input
            value={originInput}
            onChange={(event) => setOriginInput(event.target.value)}
            placeholder="Enter HTTPS address"
          />
        </label>
      )}
      {origin && (
        <HomeAssistantRuntimeProvider key={origin} homeAssistantUrl={origin}>
          <WorkspaceHaLibraryContent
            repository={repository}
            onRestored={onRestored}
            onBusyChange={onBusyChange}
          />
        </HomeAssistantRuntimeProvider>
      )}
    </section>
  );
}

export function WorkspaceHaSuggestions({
  repository,
  onRestored,
  localWorkspaceIds,
  busy,
  onBusyChange,
}: {
  repository: WorkspaceRepository;
  onRestored: (id: string) => Promise<void>;
  localWorkspaceIds: string[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const hostSession = useHomeAssistantHostSession();
  if (!hostSession) return null;
  return (
    <HomeAssistantRuntimeProvider key={hostSession.origin} homeAssistantUrl={hostSession.origin}>
      <WorkspaceHaLibraryContent
        repository={repository}
        onRestored={onRestored}
        localWorkspaceIds={localWorkspaceIds}
        disabled={busy}
        onBusyChange={onBusyChange}
      />
    </HomeAssistantRuntimeProvider>
  );
}
