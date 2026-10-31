import { EditorIcon } from "../editor-chrome/EditorIcon";
import type { useEditorPanels } from "./useEditorPanels";
import type { EditorMode } from "../editor-chrome/EditorModeNav";

export function EditorPanelControls({
  panels,
  issueCount,
  disabled,
  mode = "construct",
  presentation = "dock",
}: {
  panels: ReturnType<typeof useEditorPanels>;
  issueCount: number;
  disabled: boolean;
  mode?: EditorMode | "settings";
  presentation?: "dock" | "tabs";
}) {
  const onDemand = mode === "construct" || mode === "furnish";
  const active = !onDemand || panels.mobileOpen;
  return (
    <>
      {presentation === "dock" && panels.hasSelection && !panels.propertiesOpen && (
        <button
          className="editor-properties-toggle"
          type="button"
          disabled={disabled}
          onClick={panels.openProperties}
          aria-expanded={false}
          aria-controls="editor-properties"
        >
          <EditorIcon name="details" />
          Properties
        </button>
      )}
      <div
        className={`editor-panel-switcher${presentation === "tabs" ? " editor-panel-switcher--tabs" : ""}`}
        role="group"
        aria-label="Editor panels"
      >
        <button
          type="button"
          disabled={disabled}
          aria-pressed={active && panels.mobileSurface === "tools"}
          aria-controls="editor-mobile-panel"
          onClick={panels.showTools}
        >
          <EditorIcon name={mode === "furnish" ? "plus" : "construct"} />
          <span className="editor-panel-label">
            {presentation === "tabs"
              ? mode === "furnish"
                ? "Catalog"
                : "Tools"
              : mode === "furnish"
                ? "Add items"
                : onDemand
                  ? "Build tools"
                  : "Tools"}
          </span>
        </button>
        {(panels.hasSelection ||
          presentation === "tabs" ||
          mode === "construct" ||
          mode === "furnish") && (
          <button
            type="button"
            disabled={disabled || !panels.hasSelection}
            title={!panels.hasSelection ? "Select an object to edit its properties" : undefined}
            aria-pressed={active && panels.mobileSurface === "properties"}
            aria-controls="editor-mobile-panel"
            onClick={panels.openProperties}
          >
            <EditorIcon name="details" />
            <span className="editor-panel-label">Properties</span>
          </button>
        )}
        {issueCount > 0 && (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={active && panels.mobileSurface === "issues"}
            aria-controls="editor-mobile-panel"
            onClick={panels.showIssues}
          >
            <EditorIcon name="warning" />
            <span className="editor-panel-label">Issues</span>{" "}
            <span className="editor-panel-count">{issueCount}</span>
          </button>
        )}
      </div>
    </>
  );
}
