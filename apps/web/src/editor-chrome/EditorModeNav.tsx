import { EditorIcon } from "./EditorIcon";

export type EditorMode = "construct" | "furnish" | "connect";

export function EditorModeNav({
  mode,
  onModeChange,
}: {
  mode: EditorMode | "settings";
  onModeChange: (mode: EditorMode | "settings") => void;
}) {
  return (
    <nav className="direction-modes" aria-label="Editor mode">
      <button
        type="button"
        data-mode="construct"
        aria-pressed={mode === "construct"}
        onClick={() => onModeChange("construct")}
      >
        <EditorIcon name="construct" />
        Construct
      </button>
      <button
        type="button"
        data-mode="furnish"
        aria-pressed={mode === "furnish"}
        onClick={() => onModeChange("furnish")}
      >
        <EditorIcon name="furnish" />
        Arrange
      </button>
      <button
        type="button"
        data-mode="connect"
        aria-pressed={mode === "connect"}
        onClick={() => onModeChange("connect")}
      >
        <EditorIcon name="connect" />
        Connect
      </button>
      <button
        type="button"
        data-mode="settings"
        aria-pressed={mode === "settings"}
        onClick={() => onModeChange("settings")}
      >
        <EditorIcon name="settings" />
        Settings
      </button>
    </nav>
  );
}
