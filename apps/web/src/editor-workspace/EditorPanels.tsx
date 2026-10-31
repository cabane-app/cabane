import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { EditorPanelControls } from "./EditorPanelControls";
import type { useEditorPanels } from "./useEditorPanels";
import type { EditorMode } from "../editor-chrome/EditorModeNav";

/** A native full-screen dialog gives mobile panels focus containment and Escape dismissal. */
export function EditorPanels({
  mobile,
  mode,
  floorName,
  panels,
  issueCount,
  disabled,
  children,
}: {
  mobile: boolean;
  mode: EditorMode | "settings";
  floorName: string;
  panels: ReturnType<typeof useEditorPanels>;
  issueCount: number;
  disabled: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (panels.mobileOpen) {
      if (!element.open) element.showModal();
    } else element.close();
  }, [mobile, panels.mobileOpen]);
  if (!mobile) return children;
  const title =
    panels.mobileSurface === "properties"
      ? "Properties"
      : panels.mobileSurface === "issues"
        ? "Issues"
        : mode === "furnish"
          ? "Add items"
          : "Build tools";
  return (
    <dialog
      ref={dialog}
      id="editor-mobile-panel"
      className="editor-mobile-panel"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!disabled) panels.closeMobilePanel();
      }}
    >
      <header className="editor-mobile-panel__header">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>
            {mode === "furnish" ? "Arrange" : "Construct"} · {floorName}
          </p>
        </div>
        <button type="button" disabled={disabled} onClick={panels.closeMobilePanel}>
          Done
        </button>
      </header>
      <EditorPanelControls
        panels={panels}
        mode={mode}
        issueCount={issueCount}
        disabled={disabled}
        presentation="tabs"
      />
      <div className="editor-mobile-panel__content" data-surface={panels.mobileSurface}>
        {children}
      </div>
    </dialog>
  );
}
