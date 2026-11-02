import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import {
  borrowedHomeAssistantTransportError,
  type HomeAssistantHostSession,
  type WorkspaceRepository,
} from "@cabane/engine";
import { createHaWorkspaceClient } from "./ha-workspace-client";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { WorkspaceHaLibrary } from "./WorkspaceHaLibrary";
import "./workspaces.css";

type Check = { kind: "checking" | "empty" | "saved" } | { kind: "error"; message: string };

/** Discover saved homes before showing the demo, without subscribing to devices. */
export function NativeWorkspaceWelcome({
  session,
  repository,
  onRestored,
  onBuild,
  onExplore,
  onCancel,
}: {
  session: HomeAssistantHostSession;
  repository: WorkspaceRepository;
  onRestored: (id: string) => Promise<void>;
  onBuild: () => Promise<void>;
  onExplore: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [check, setCheck] = useState<Check>({ kind: "checking" });
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setCheck({ kind: "checking" });
    const timer = window.setTimeout(() => {
      active = false;
      setCheck({
        kind: "error",
        message: "Home Assistant took too long to check saved homes. Try again.",
      });
    }, 10000);
    const load = async () => {
      const transportError = borrowedHomeAssistantTransportError(
        window.location.href,
        session.origin,
      );
      if (transportError) throw new Error(transportError);
      if (session.connection.connected === false)
        throw new Error("Home Assistant is disconnected. Reconnect and try again.");
      const client = createHaWorkspaceClient((message) =>
        session.connection.sendMessagePromise(message),
      );
      return client.list();
    };
    void load()
      .then((homes) => {
        if (active) setCheck({ kind: homes.length ? "saved" : "empty" });
      })
      .catch((cause) => {
        if (active)
          setCheck({
            kind: "error",
            message:
              cause instanceof Error
                ? cause.message
                : "Could not check saved homes on Home Assistant.",
          });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [session.connection, session.origin, attempt]);

  if (check.kind === "checking")
    return (
      <main className="direction-project-loading" role="status">
        Checking for homes saved on Home Assistant…
      </main>
    );
  if (check.kind === "empty") return <Navigate to="/welcome" replace />;
  return (
    <main className="workspace-library">
      <WorkspaceDialog
        title="Import a workspace"
        busy={busy}
        error={check.kind === "error" ? check.message : null}
        onCancel={() => void onCancel()}
      >
        {check.kind === "saved" ? (
          <WorkspaceHaLibrary
            repository={repository}
            onRestored={onRestored}
            initialOrigin={session.origin}
            onBusyChange={setBusy}
          />
        ) : (
          <>
            <p>Could not check your saved homes.</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
          </>
        )}
        <div className="workspace-library-actions">
          <button type="button" disabled={busy} onClick={() => void onBuild()}>
            Create a new home
          </button>
          <button type="button" disabled={busy} onClick={() => void onExplore()}>
            Explore the demo
          </button>
        </div>
      </WorkspaceDialog>
    </main>
  );
}
