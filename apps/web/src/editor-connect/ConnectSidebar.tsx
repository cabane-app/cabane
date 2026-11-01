import { useRef } from "react";
import type { HomeAssistantRuntimeValue } from "@cabane/engine";
import { ConnectActionBar } from "./ConnectActionBar";
import type { ConnectEditor } from "./useConnectEditor";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import "./connect-panel.css";
import "./connect-workspace.css";

export function ConnectSidebar({
  editor,
  runtime,
  homeAssistantUrl,
  onSettings,
}: {
  editor: ConnectEditor;
  runtime: HomeAssistantRuntimeValue;
  homeAssistantUrl: string | null;
  onSettings?: (() => void) | undefined;
}) {
  const connectedOrigin = useRef<string | null>(null);
  if (!editor.disconnected) connectedOrigin.current = homeAssistantUrl;
  const hasProfile =
    Object.keys(editor.profile.roomAreaIds).length > 0 ||
    Object.keys(editor.profile.entityIdsBySlotId).length > 0;
  const setup = !(homeAssistantUrl && (hasProfile || connectedOrigin.current === homeAssistantUrl));
  const busy = ["authenticating", "connecting", "reconnecting"].includes(runtime.status);
  return (
    <div className="connect-inspector connect-sidebar">
      {setup ? (
        <section className="connect-setup">
          <h3>Connect your home</h3>
          <p className="connect-copy">Set up Home Assistant to link your devices.</p>
          <EditorButton onClick={onSettings}>
            Set up Home Assistant
            <EditorIcon name="chevron" />
          </EditorButton>
        </section>
      ) : (
        <>
          <EditorButton
            className="connect-show-plan"
            aria-pressed={!editor.room}
            onClick={editor.showPlan}
          >
            <EditorIcon name="plan" />
            House plan
          </EditorButton>
          <ConnectActionBar
            refreshing={runtime.refreshing}
            disconnected={editor.disconnected}
            onRefresh={() => void editor.refresh()}
          />
          <nav className="connect-room-nav" aria-label="Rooms">
            <h3>Rooms</h3>
            {editor.deviceRooms.map((room) => {
              const summary = editor.roomDeviceSummaries[room.id];
              const count = summary?.total
                ? `${summary.mapped}/${summary.total} connected`
                : "No devices";
              return (
                <button
                  type="button"
                  key={room.id}
                  className="connect-room-nav__room"
                  aria-pressed={editor.roomId === room.id}
                  onClick={() => editor.selectRoom(room.id)}
                >
                  <strong>{room.name}</strong>
                  <small>{count}</small>
                </button>
              );
            })}
          </nav>
        </>
      )}
      {(runtime.error || runtime.refreshError) && (
        <p className="connect-error" role="alert">
          {runtime.refreshError ?? runtime.error}
        </p>
      )}
      {editor.message && editor.message !== "Draft changes" && (
        <p className="connect-feedback" role="status">
          {editor.message}
        </p>
      )}
      <footer className="connect-footer">
        <i className={editor.disconnected ? "" : "is-connected"} aria-hidden="true" />
        <div className="connect-footer__status" role="status">
          <span>
            {busy
              ? "Connecting to Home Assistant…"
              : editor.disconnected
                ? "Home Assistant not connected"
                : "Home Assistant connected"}
          </span>
        </div>
        <button
          type="button"
          className="connect-settings-button"
          aria-label="Connection settings"
          onClick={onSettings}
        >
          <EditorIcon name="settings" />
        </button>
      </footer>
      <span className="connect-announcement" role="status">
        {editor.message === "Draft changes" ? editor.message : ""}
      </span>
    </div>
  );
}
