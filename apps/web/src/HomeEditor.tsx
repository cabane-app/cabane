import { type HomeProjectLifecycle, type HomeProjectRecord } from "@cabane/engine";
import type {
  ConnectWorkspaceProps,
  HomeEditorExitReason,
} from "./editor-workspace/editor-workspace-contract";

import { useState } from "react";

import "./home-editor.css";

import "./editor-connect/connect-editor.css";

import { EditorWorkspace } from "./editor-workspace/EditorWorkspace";
import "./editor-workspace/editor-panels.css";
import "./editor-workspace/mobile-editor-panels.css";

const downloadProjectRecovery = (homeId: string, raw: string) => {
  const href = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${homeId}.corrupt-project.json`;
  anchor.click();
  URL.revokeObjectURL(href);
};

export function HomeEditor({
  initialRecord,
  lifecycle,
  recoveryMessage,
  recoveryRaw,
  onClose,
  autosaveDelayMs,
  ...connectProps
}: ConnectWorkspaceProps & {
  initialRecord: HomeProjectRecord;
  lifecycle: HomeProjectLifecycle;
  recoveryMessage?: string | undefined;
  recoveryRaw?: string | undefined;
  autosaveDelayMs?: number;
  onClose: (record: HomeProjectRecord, reason: HomeEditorExitReason) => void;
}) {
  const [session, setSession] = useState(() => ({
    record: initialRecord,
    recoveryMessage,
    recoveryRaw,
    resetError: null as string | null,
  }));

  if (session.recoveryMessage)
    return (
      <main className="direction-project-loading is-error">
        <strong>Your saved project needs recovery.</strong>
        <span>{session.resetError ?? session.recoveryMessage}</span>
        <div className="direction-project-loading__actions">
          <button
            type="button"
            onClick={() =>
              downloadProjectRecovery(session.record.homeId, session.recoveryRaw ?? "")
            }
          >
            Download recovery data
          </button>
          <button
            type="button"
            onClick={() => (connectProps.onRecoveryWorkspaces ?? connectProps.onWorkspaces)?.()}
          >
            Workspaces
          </button>
          <button
            type="button"
            disabled={session.recoveryRaw === undefined}
            onClick={() => {
              if (
                session.recoveryRaw === undefined ||
                !window.confirm(
                  "Reset this workspace to an empty home? Download recovery data first if you want to keep a copy.",
                )
              )
                return;
              void lifecycle.recoverToSeed(session.record, session.recoveryRaw).then((result) => {
                if (result.status === "saved")
                  setSession({
                    record: result.record,
                    recoveryMessage: undefined,
                    recoveryRaw: undefined,
                    resetError: null,
                  });
                else
                  setSession((current) => ({
                    ...current,
                    resetError:
                      result.status === "storage-error"
                        ? result.error.message
                        : "The project could not be reset in browser storage.",
                  }));
              });
            }}
          >
            Reset to empty home
          </button>
          <button
            type="button"
            className="is-primary"
            disabled={session.recoveryRaw === undefined}
            onClick={() => {
              if (session.recoveryRaw === undefined) return;
              void lifecycle
                .recoverWithoutMissingSceneItems(session.record, session.recoveryRaw)
                .then((result) => {
                  if (result.status === "saved")
                    setSession({
                      record: result.record,
                      recoveryMessage: undefined,
                      recoveryRaw: undefined,
                      resetError: null,
                    });
                  else
                    setSession((current) => ({
                      ...current,
                      resetError:
                        result.status === "storage-error"
                          ? result.error.message
                          : "The unavailable items could not be removed from browser storage.",
                    }));
                });
            }}
          >
            Remove unavailable items and continue
          </button>
        </div>
      </main>
    );
  return (
    <EditorWorkspace
      initialRecord={session.record}
      lifecycle={lifecycle}
      onClose={onClose}
      autosaveDelayMs={autosaveDelayMs}
      {...connectProps}
    />
  );
}

export type { HomeEditorExitReason } from "./editor-workspace/editor-workspace-contract";
