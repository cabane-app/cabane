import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";

export interface ConnectActionBarProps {
  refreshing: boolean;
  disconnected: boolean;
  onRefresh: () => void;
}

export function ConnectActionBar({ refreshing, disconnected, onRefresh }: ConnectActionBarProps) {
  return (
    <div
      className="connect-refresh"
      role="group"
      aria-label="Connection actions"
      aria-busy={refreshing}
    >
      <EditorButton variant="text" disabled={disconnected || refreshing} onClick={onRefresh}>
        <EditorIcon name="refresh" />
        {refreshing ? "Refreshing…" : "Refresh from Home Assistant"}
      </EditorButton>
    </div>
  );
}
