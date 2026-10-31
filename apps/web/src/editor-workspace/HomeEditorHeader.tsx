import { EditorButton } from "../editor-chrome/EditorButton";
import { requestWalkPointerLock } from "@cabane/engine";
import { useMemo, useState } from "react";
import { EditorActionBar } from "../editor-chrome/EditorActionBar";
import { EditorActionButton } from "../editor-chrome/EditorActionButton";

import { EditorIcon } from "../editor-chrome/EditorIcon";

import { EditorModeNav, type EditorMode } from "../editor-chrome/EditorModeNav";

import type { useHomeEditorController } from "./useHomeEditorController";

type Props = Pick<
  ReturnType<typeof useHomeEditorController>,
  | "editingLocked"
  | "publishOpen"
  | "previewOpen"
  | "activeFloorId"
  | "stairPlacement"
  | "setStairPlacement"
  | "startStairs"
  | "snapshot"
  | "mode"
  | "cameraView"
  | "setCameraView"
  | "walkButton"
  | "unsettled"
  | "setPreviewOpen"
  | "selectMode"
  | "closeEditor"
  | "closing"
  | "setPublishMessage"
  | "setPublishOpen"
  | "publishErrors"
  | "publishProject"
  | "constructEditor"
  | "dragging"
  | "floorZoneDrawing"
  | "poolDrawing"
  | "workspace"
  | "undoProject"
  | "redoProject"
  | "replaceEditorsFromProject"
> & {
  referenceAdjusting?: boolean;
  settingsMode: boolean;
  onModeTabChange: (mode: EditorMode | "settings") => void;
};
export function HomeEditorHeader({
  referenceAdjusting,
  activeFloorId,
  stairPlacement,
  setStairPlacement,
  startStairs,
  snapshot,
  editingLocked,
  publishOpen,
  previewOpen,
  mode,
  cameraView,
  setCameraView,
  walkButton,
  unsettled,
  setPreviewOpen,
  closeEditor,
  closing,
  setPublishMessage,
  setPublishOpen,
  publishErrors,
  publishProject,
  constructEditor,
  dragging,
  floorZoneDrawing,
  poolDrawing,
  workspace,
  undoProject,
  redoProject,
  settingsMode,
  onModeTabChange,
  replaceEditorsFromProject,
}: Props) {
  const [walkError, setWalkError] = useState<string | null>(null);
  const hasSaved = workspace.record.publishedAt !== 0;
  const hasChanges = useMemo(
    () =>
      JSON.stringify(snapshot.project) !== JSON.stringify(workspace.record.published) ||
      Object.values(snapshot.bindings).some(
        (binding) => JSON.stringify(binding.draft) !== JSON.stringify(binding.published),
      ),
    [snapshot.project, snapshot.bindings, workspace.record.published],
  );
  const historyEnabled = !editingLocked && !dragging && !referenceAdjusting;
  const canUndo =
    historyEnabled &&
    (floorZoneDrawing.active
      ? floorZoneDrawing.points.length > 0
      : poolDrawing.active
        ? poolDrawing.points.length > 0
        : workspace.canUndo && !unsettled);
  const canRedo =
    historyEnabled &&
    (floorZoneDrawing.active
      ? floorZoneDrawing.future.length > 0
      : poolDrawing.active
        ? poolDrawing.future.length > 0
        : workspace.canRedo && !unsettled);
  return (
    <header className="editor-header" inert={editingLocked || publishOpen || previewOpen}>
      <div className="editor-navigation">
        <button
          type="button"
          className="editor-close"
          disabled={editingLocked || unsettled || !hasSaved}
          title={hasSaved ? "Back to Home" : "Save your home before returning to Home"}
          aria-label={closing ? "Returning to Home" : "Back"}
          onClick={() => void closeEditor()}
        >
          <EditorIcon name="back" />
          {closing ? "Returning…" : "Back"}
        </button>
        {!settingsMode && mode !== "connect" && (
          <div className="direction-camera" role="group" aria-label="Camera controls">
            <button
              type="button"
              title={
                mode === "construct"
                  ? "3D is available in Arrange"
                  : "View the home in 3D (Shift+1)"
              }
              aria-label="3D"
              aria-keyshortcuts="Shift+1"
              aria-pressed={mode !== "construct" && cameraView === "3d"}
              disabled={mode === "construct" || editingLocked || unsettled}
              onClick={() => setCameraView("3d")}
            >
              <EditorIcon name="cube" />
              3D
              <kbd aria-hidden="true">⇧1</kbd>
            </button>
            <button
              type="button"
              title="View the floor plan (Shift+2)"
              aria-label="2D"
              aria-keyshortcuts="Shift+2"
              aria-pressed={mode === "construct" || cameraView === "top"}
              disabled={editingLocked || unsettled}
              onClick={() => {
                if (mode === "furnish") setCameraView("top");
              }}
            >
              <EditorIcon name="plan" />
              2D
              <kbd aria-hidden="true">⇧2</kbd>
            </button>
            <button
              ref={walkButton}
              type="button"
              title="Walk through the draft at eye level (Shift+3)"
              aria-label="Explore"
              aria-keyshortcuts="Shift+3"
              aria-haspopup="dialog"
              disabled={editingLocked || unsettled}
              onClick={(event) => {
                void (async () => {
                  setWalkError(null);
                  if (window.matchMedia("(pointer: coarse)").matches) {
                    setPreviewOpen(true);
                    return;
                  }
                  const target = event.currentTarget.closest("main");
                  try {
                    if (!target) throw new Error("Pointer lock unavailable");
                    await requestWalkPointerLock(target);
                    setPreviewOpen(true);
                  } catch {
                    setWalkError("Allow pointer lock in your browser to explore this home.");
                  }
                })();
              }}
            >
              <EditorIcon name="walk" />
              Explore
              <kbd aria-hidden="true">⇧3</kbd>
            </button>
          </div>
        )}
      </div>
      <div className="editor-mobile-home">
        <strong>{snapshot.project.home.name}</strong>
        <span>{snapshot.project.floors.find((floor) => floor.id === activeFloorId)?.name}</span>
      </div>
      {walkError && <p role="alert">{walkError}</p>}
      <EditorModeNav mode={settingsMode ? "settings" : mode} onModeChange={onModeTabChange} />
      <div className="direction-project-actions" role="group" aria-label="Project actions">
        <EditorActionButton
          icon="undo"
          label="Undo"
          disabled={!canUndo}
          onClick={undoProject}
          shortcut="⌘/Ctrl Z"
          keyShortcuts="Control+Z Meta+Z"
        />
        <EditorActionButton
          icon="redo"
          label="Redo"
          disabled={!canRedo}
          onClick={redoProject}
          shortcut="⌘/Ctrl Shift Z · Ctrl Y"
          keyShortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        />
        <span className="editor-action-bar__separator" aria-hidden="true" />
        <button
          type="button"
          className="editor-reset-changes"
          aria-label="Reset changes"
          disabled={editingLocked || unsettled || !hasChanges}
          title="Discard draft changes and restore the saved version"
          onClick={() => {
            void (async () => {
              if (
                !window.confirm(
                  "Reset changes? This discards all draft home and connection changes and restores the last saved version.",
                )
              )
                return;
              const result = await workspace.resetDraftToPublished();
              if (result.status === "saved") replaceEditorsFromProject(result.record.draft);
            })();
          }}
        >
          <EditorIcon name="reset" />
          Reset
        </button>
        <EditorButton
          variant="primary"
          disabled={editingLocked || unsettled}
          onClick={() => {
            setPublishMessage(null);
            if (publishErrors.length > 0) setPublishOpen(true);
            else void publishProject();
          }}
        >
          <EditorIcon name="save" />
          Save
        </EditorButton>
      </div>
      {settingsMode || mode === "connect" ? null : mode === "construct" ? (
        <EditorActionBar
          inert={referenceAdjusting}
          tool={constructEditor.tool}
          onToolChange={(tool) => {
            setStairPlacement(null);
            constructEditor.setTool(tool);
          }}
          onStairs={() => startStairs()}
          stairsActive={Boolean(stairPlacement)}
          stairsDisabledReason={
            editingLocked || unsettled ? "Finish the current edit first." : undefined
          }
        />
      ) : null}
    </header>
  );
}
