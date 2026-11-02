import { useEffect, useRef, type MouseEvent } from "react";
import { useCabaneDom } from "@cabane/engine";
import type { useHomeEditorController } from "../editor-workspace/useHomeEditorController";
import { useAgentRelay } from "./useAgentRelay";

type Props = {
  workspaceId: string;
  controller: ReturnType<typeof useHomeEditorController>;
  open: boolean;
  onClose: () => void;
};
export function AgentPilotPanel({ workspaceId, controller, open, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const dom = useCabaneDom();
  const { connection, start, disconnect, host } = useAgentRelay(workspaceId, controller);
  useEffect(() => {
    if (!open) return;
    const previous = dom.root.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    dom.events.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      dom.events.removeEventListener("keydown", onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, [dom, onClose, open]);
  if (!open) return null;
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  return (
    <div className="agent-pilot-dialog-backdrop" onMouseDown={closeFromBackdrop}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="agent-pilot-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-pilot-title"
        aria-describedby="agent-pilot-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="agent-pilot-dialog__header">
          <div>
            <p className="agent-pilot-dialog__eyebrow">Home Assistant agent connection</p>
            <h2 id="agent-pilot-title">Connect LLM agent</h2>
          </div>
          <button
            type="button"
            className="agent-pilot-dialog__close"
            aria-label="Close Connect LLM agent"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <p id="agent-pilot-description" className="agent-pilot-dialog__description">
          Connect an agent to this workspace through Home Assistant. It can inspect and edit the
          draft using the same actions as the editor.
        </p>
        {!host ? (
          <p className="agent-pilot-dialog__notice">
            Open Cabane from your Home Assistant sidebar to connect an agent.
          </p>
        ) : (
          <>
            <div className="agent-pilot-dialog__status">
              <span>Status</span>
              <strong className={`is-${connection.status}`}>{connection.status}</strong>
            </div>
            <p className="agent-pilot-dialog__message" role="status">
              {connection.message}
            </p>
            {connection.status === "waiting" && connection.code ? (
              <>
                <p>Run this in the agent terminal:</p>
                <pre className="agent-pilot-command">
                  <code>{`npm run agent:pair -- --url ${host.origin} --code ${connection.code}`}</code>
                </pre>
                <p className="agent-pilot-dialog__notice">
                  The code can be used once and expires in five minutes. The agent can run on
                  another device that can reach this Home Assistant.
                </p>
              </>
            ) : null}
            {connection.status === "waiting" || connection.status === "connected" ? (
              <button type="button" onClick={disconnect}>
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                className="agent-pilot-dialog__primary"
                disabled={connection.status === "connecting"}
                onClick={() => void start()}
              >
                {connection.status === "connecting" ? "Creating code…" : "Generate pairing code"}
              </button>
            )}
            {connection.status === "connected" ? (
              <p className="agent-pilot-dialog__notice">
                Keep this editor open. The agent can now use npm run agent:request.
              </p>
            ) : null}
          </>
        )}
        <small>
          The session grants access to Cabane commands for this workspace. Home Assistant
          credentials stay in Home Assistant. Save remains an explicit action.
        </small>
      </section>
    </div>
  );
}
