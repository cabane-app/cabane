import { downloadWorkspaceArchive } from "./download-workspace-archive";
import { NativeWorkspaceWelcome } from "./NativeWorkspaceWelcome";
import { WorkspaceOpenPage } from "./WorkspaceOpenPage";
import { deleteReferenceHome } from "../editor-reference-plan/reference-storage";
import {
  enrollBuildTutorial,
  forgetBuildTutorial,
} from "../editor-onboarding/build-tutorial-storage";
import { lastOpenedWorkspace, forgetWorkspacePresentation } from "./workspace-presentation";
import { useWorkspaceOnboarding } from "./useWorkspaceOnboarding";
import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import {
  serializeCanonicalJson,
  setupStorageKey,
  useHomeAssistantHostSession,
  type WorkspaceEntry,
  type WorkspaceRepository,
} from "@cabane/engine";
import { WorkspaceLibrary } from "./WorkspaceLibrary";
import { WorkspaceDeletion } from "./WorkspaceDeletion";
import { WorkspaceHost } from "./WorkspaceHost";
import { BuildWorkspaceEntry } from "./BuildWorkspaceEntry";
import { WorkspaceHaLibrary, WorkspaceHaSuggestions } from "./WorkspaceHaLibrary";
import { initializeWorkspaces } from "./initialize-workspaces";
import { exportWorkspaceBackup, parseWorkspaceImport } from "./workspace-transfer";
import { downloadConnectData } from "../editor-connect/profile-transfer";
import { readEditorReturn } from "../editor-connect/connect-navigation";
import { agentPilotPath, workspaceHomePath, workspaceIdForPath } from "../editor-routes";
import { ownerProjectRegistries } from "../project-runtime";

export function WorkspaceApplication() {
  const location = useLocation();
  const hostSession = useHomeAssistantHostSession();
  const navigate = useNavigate();
  // Keep an explicit startup choice authoritative while router transitions and
  // IndexedDB/onboarding state updates commit at different React priorities.
  const [startupDestination, setStartupDestination] = useState<string | null>(null);
  useEffect(() => {
    if (location.pathname !== "/") setStartupDestination(null);
  }, [location.pathname]);
  const [repository, setRepository] = useState<WorkspaceRepository | null>(null);
  const onboarding = useWorkspaceOnboarding(repository);
  const [entries, setEntries] = useState<WorkspaceEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migrationError, setMigrationError] = useState<string | undefined>();
  // Keep the initiating identity while the runtime asynchronously consumes OAuth.
  // ConnectedProduct removes its session return request after restoring navigation.
  const [skipLegacyMigration] = useState(() => Boolean(hostSession));
  const [callbackRequest] = useState(() => (hostSession ? null : readEditorReturn()));
  useEffect(() => {
    let active = true;
    void initializeWorkspaces(window.indexedDB, window.localStorage, {
      skipLegacyMigration,
    })
      .then(async (result) => {
        const all = await result.repository.list();
        if (active) {
          setRepository(result.repository);
          setEntries(all);
          setMigrationError(result.migrationError);
        }
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Browser storage is unavailable.");
      });
    return () => {
      active = false;
    };
  }, [skipLegacyMigration]);
  const refresh = useCallback(async () => {
    if (repository) setEntries(await repository.list());
  }, [repository]);
  useEffect(() => {
    // The host reads and checks its own record. Revalidating every saved home
    // while opening one workspace competes with the first scene frame.
    if (location.pathname !== "/" && location.pathname !== "/workspaces") return;
    const update = () => {
      void refresh().catch((cause) => setError(String(cause)));
    };
    update();
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, [refresh, location.pathname]);
  const openedRemote = useCallback(
    async (id: string) => {
      await refresh();
      await navigate(workspaceHomePath(id), { replace: true });
    },
    [refresh, navigate],
  );
  if (error)
    return (
      <main className="direction-project-loading is-error">
        <strong>Could not load your workspaces.</strong>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  if (!repository || !entries)
    return <main className="direction-project-loading">Loading your workspaces…</main>;
  if (location.pathname.startsWith("/open/"))
    return <WorkspaceOpenPage repository={repository} onOpened={openedRemote} />;
  const isCallback =
    !hostSession &&
    location.pathname !== "/workspaces" &&
    new URLSearchParams(location.search).has("auth_callback");
  const callback = isCallback ? callbackRequest : null;
  if (isCallback) {
    if (!callback || !entries.some((entry) => entry.metadata.id === callback.workspaceId)) {
      return (
        <main className="direction-project-loading is-error">
          <strong>This sign-in no longer has a workspace.</strong>
          <p>Open the intended workspace and sign in again.</p>
          <button onClick={() => void navigate("/workspaces", { replace: true })}>
            Workspaces
          </button>
        </main>
      );
    }
    if (workspaceIdForPath(location.pathname) !== callback.workspaceId) {
      return (
        <Navigate to={`${workspaceHomePath(callback.workspaceId)}${location.search}`} replace />
      );
    }
  }
  if (location.pathname === "/") {
    if (startupDestination) return <Navigate to={startupDestination} replace />;
    if (!onboarding.loaded)
      return <main className="direction-project-loading">Loading your home…</main>;
    if (
      hostSession &&
      onboarding.state &&
      !onboarding.state.welcomeDismissed &&
      entries.length === 1 &&
      entries[0].metadata.id === onboarding.state.demoWorkspaceId
    ) {
      return (
        <NativeWorkspaceWelcome
          session={hostSession}
          repository={repository}
          onRestored={async (id) => {
            setStartupDestination(workspaceHomePath(id));
            await refresh();
            await onboarding.dismiss("welcome");
          }}
          onBuild={async () => {
            setStartupDestination("/build");
          }}
          onExplore={async () => {
            setStartupDestination("/demo");
            await onboarding.dismiss("welcome");
          }}
          onCancel={async () => {
            setStartupDestination("/workspaces");
            await onboarding.dismiss("welcome");
          }}
        />
      );
    }
    const latest = entries.find((entry) => entry.metadata.id === lastOpenedWorkspace());
    const destination = latest ?? (entries.length === 1 ? entries[0] : undefined);
    if (
      destination &&
      onboarding.state &&
      destination.metadata.id === onboarding.state.demoWorkspaceId
    ) {
      return <Navigate to={onboarding.state.welcomeDismissed ? "/demo" : "/welcome"} replace />;
    }
    return (
      <Navigate
        to={destination ? workspaceHomePath(destination.metadata.id) : "/workspaces"}
        replace
      />
    );
  }
  const isDemoRoute = location.pathname === "/welcome" || location.pathname === "/demo";
  const isBuildRoute = location.pathname === "/build";
  if ((isDemoRoute || isBuildRoute) && !onboarding.loaded)
    return <main className="direction-project-loading">Loading your home…</main>;
  if (
    isDemoRoute &&
    !entries.some((entry) => entry.metadata.id === onboarding.state?.demoWorkspaceId)
  ) {
    return (
      <main className="direction-project-loading is-error">
        <strong>The demo home is no longer in this browser.</strong>
        <Link to="/workspaces">Workspaces</Link>
      </main>
    );
  }
  if (isBuildRoute && !onboarding.state?.destinations.build)
    return <BuildWorkspaceEntry onboarding={onboarding} />;
  const id = isDemoRoute
    ? onboarding.state?.demoWorkspaceId
    : isBuildRoute
      ? onboarding.state?.destinations.build
      : workspaceIdForPath(location.pathname);
  if (id)
    return (
      <>
        {onboarding.error && (
          <div className="workspace-connection-error" role="alert">
            {onboarding.error}
            {onboarding.deleted && (
              <button
                disabled={onboarding.busy}
                onClick={() =>
                  void onboarding.start(onboarding.deleted!.path, onboarding.deleted!.id)
                }
              >
                Create a new home
              </button>
            )}
            <button onClick={() => void navigate("/workspaces")}>Workspaces</button>
            <button onClick={onboarding.clearError}>Dismiss</button>
          </div>
        )}
        {onboarding.loaded ? (
          <WorkspaceHost key={id} id={id} repository={repository} onboarding={onboarding} />
        ) : (
          <main className="direction-project-loading">Loading your home…</main>
        )}
      </>
    );
  if (location.pathname !== "/workspaces") return <Navigate to="/" replace />;
  const selected = (id: string) => {
    const entry = entries.find((item) => item.metadata.id === id);
    if (!entry) throw new Error("Workspace no longer exists. Refresh the library.");
    return entry;
  };
  const record = (id: string) => {
    const entry = selected(id);
    if (!entry.record) throw new Error(entry.error ?? "This home needs recovery.");
    return entry.record;
  };
  const open = async (id: string) => {
    await navigate(workspaceHomePath(id));
  };
  const deleteLocal = async (id: string) => {
    const entry = selected(id);
    const raw = await repository.readRaw(id);
    if (entry.record) {
      const fresh = await repository.read(id);
      if (fresh?.record?.revision !== entry.record.revision)
        throw new Error("This workspace changed. Refresh before deleting it.");
    }
    await repository.delete(id, raw);
    await deleteReferenceHome(id);
    forgetWorkspacePresentation(id);
    forgetBuildTutorial(id);
    try {
      window.localStorage.removeItem(setupStorageKey(id));
    } catch {
      /* Non-authoritative onboarding only. */
    }
  };
  return (
    <>
      {migrationError && (
        <p role="alert" className="workspace-error">
          {migrationError} Your saved source data has been retained.
        </p>
      )}
      <WorkspaceLibrary
        demoWorkspaceId={onboarding.state?.demoWorkspaceId}
        onSettings={async (id, intent) => {
          await navigate(
            `${workspaceHomePath(id)}/home-assistant${intent ? `?action=${intent}` : ""}`,
          );
        }}
        onAgentPilot={async (id) => {
          await navigate(agentPilotPath(id));
        }}
        entries={entries}
        onOpen={open}
        onRecover={open}
        onCreate={async (name) => {
          const entry = await repository.createBlank(name);
          enrollBuildTutorial(entry.metadata.id);
          await refresh();
          await open(entry.metadata.id);
        }}
        onRename={async (id, name) => {
          await repository.rename(id, record(id).revision, name);
          await refresh();
        }}
        onDuplicate={async (id, name) => {
          await repository.duplicate(id, record(id).revision, name);
          await refresh();
        }}
        renderDelete={(entry, onCancel, onBusyChange) => (
          <WorkspaceDeletion
            repository={repository}
            target={{ entry }}
            onDeleteLocal={() => deleteLocal(entry.metadata.id)}
            onDeleted={async () => {
              await refresh();
              onCancel();
            }}
            onCancel={onCancel}
            onBusyChange={onBusyChange}
          />
        )}
        onImport={async (json) => {
          const imported = parseWorkspaceImport(json, ownerProjectRegistries);
          const entry = await repository.create(imported.record, imported);
          await refresh();
          await open(entry.metadata.id);
        }}
        onExport={async (id, privateBackup) => {
          const entry = selected(id);
          const saved = record(id);
          const json = privateBackup
            ? exportWorkspaceBackup(entry.metadata, saved)
            : serializeCanonicalJson(saved.draft);
          await downloadWorkspaceArchive(
            json,
            `${id}-${privateBackup ? "backup" : "project"}.cabane`,
          );
        }}
        onExportRaw={async (id) => {
          const raw = await repository.readRaw(id);
          if (raw === null) throw new Error("No saved record exists.");
          downloadConnectData(raw, `${id}-recovery.json`);
        }}
        renderSuggestions={(busy, onBusyChange) => (
          <WorkspaceHaSuggestions
            repository={repository}
            onRestored={openedRemote}
            localWorkspaceIds={entries.map((entry) => entry.metadata.id)}
            busy={busy}
            onBusyChange={onBusyChange}
          />
        )}
        remoteImport={
          <WorkspaceHaLibrary
            repository={repository}
            onRestored={async (id) => {
              await refresh();
              await open(id);
            }}
            initialOrigin={
              entries.find((entry) => entry.metadata.homeAssistantUrl)?.metadata.homeAssistantUrl ??
              null
            }
          />
        }
      />
    </>
  );
}
