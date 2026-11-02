import { useCabaneDom } from "@cabane/engine";
import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { EditorMode } from "../editor-chrome/EditorModeNav";
import type {
  useConstructEditor,
  useConstructMeasure,
  useFloorZoneDrawing,
} from "../editor-preview/construct";
import type { useFurnishingEditor } from "../editor-preview/furnish";

interface ShortcutContext {
  clearConstructionSelection: () => void;
  clearFurnishingSelection: () => void;
  closeWalk: () => void;
  constructEditor: ReturnType<typeof useConstructEditor>;
  constructMeasure: ReturnType<typeof useConstructMeasure>;
  dragging: boolean;
  duplicateArrangeItem: (id: string) => boolean;
  duplicateConstructionOpening: (id: string) => boolean;
  editingLocked: boolean;
  floorZoneDrawing: ReturnType<typeof useFloorZoneDrawing>;
  furnishingEditor: ReturnType<typeof useFurnishingEditor>;
  marqueeSelecting: boolean;
  mode: EditorMode;
  pendingRoomPaintId: string | null;
  previewOpen: boolean;
  publishOpen: boolean;
  redoProject: () => void;
  selectedOpening: import("@cabane/engine").EditorWallAttachment | undefined;
  undoProject: () => void;
  unsettled: boolean;
  setCameraView: (view: "3d" | "top") => void;
  walkButton: RefObject<HTMLButtonElement | null>;
  setPendingRoomPaintId: Dispatch<SetStateAction<string | null>>;
  setDragging: Dispatch<SetStateAction<boolean>>;
}

export function useHomeEditorShortcuts({
  clearConstructionSelection,
  clearFurnishingSelection,
  closeWalk,
  constructEditor,
  constructMeasure,
  dragging,
  duplicateArrangeItem,
  duplicateConstructionOpening,
  editingLocked,
  floorZoneDrawing,
  furnishingEditor,
  marqueeSelecting,
  mode,
  pendingRoomPaintId,
  previewOpen,
  publishOpen,
  redoProject,
  selectedOpening,
  undoProject,
  unsettled,
  setCameraView,
  walkButton,
  setPendingRoomPaintId,
  setDragging,
}: ShortcutContext) {
  const dom = useCabaneDom();
  const copiedEditorElement = useRef<{ mode: "construct" | "furnish"; id: string } | null>(null);
  useEffect(() => {
    if (editingLocked || publishOpen) return;
    const handleConstructShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      // A furnishing drag is committed on release; don't delete its target or
      // restore project history while that transaction is still in progress.
      if (mode === "furnish" && furnishingEditor.transaction) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, dialog[open]") || target.isContentEditable)
      )
        return;
      // Labels and tutorial actions own typing/activation keys, while completed
      // naming still permits workspace undo once focus returns to the label.
      if (
        target instanceof HTMLElement &&
        target.closest(".construction-room-name, .build-tutorial") &&
        !event.metaKey &&
        !event.ctrlKey
      )
        return;
      if (
        event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.repeat &&
        ["Digit1", "Digit2", "Digit3"].includes(event.code)
      ) {
        if (
          mode === "connect" ||
          unsettled ||
          dom.root.querySelector(
            '.editor-settings, .shortcuts-workspace, dialog[open], [aria-modal="true"]:not(.direction-preview-dialog)',
          )
        )
          return;
        if (event.code === "Digit1" && mode === "construct") return;
        event.preventDefault();
        if (event.code === "Digit3") {
          // Keep pointer lock and its error handling on the same user-activation path.
          if (!previewOpen) walkButton.current?.click();
        } else {
          if (previewOpen) closeWalk();
          if (mode === "furnish") setCameraView(event.code === "Digit1" ? "3d" : "top");
        }
        return;
      }
      if (previewOpen) return;
      const key = event.key.toLowerCase();
      const historyModifier = (event.metaKey || event.ctrlKey) && !event.altKey;
      if (historyModifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redoProject();
        else undoProject();
        return;
      }
      if (event.ctrlKey && !event.metaKey && !event.altKey && key === "y") {
        event.preventDefault();
        redoProject();
        return;
      }
      if (dom.root.querySelector(".editor-settings, .shortcuts-workspace")) return;
      if (mode === "connect") return;
      if (historyModifier && !event.shiftKey && (key === "c" || key === "v")) {
        if (dragging) return;
        if (key === "c") {
          if (mode === "construct" && selectedOpening) {
            copiedEditorElement.current = { mode, id: selectedOpening.id };
            event.preventDefault();
          } else if (
            mode === "furnish" &&
            (furnishingEditor.selectedItem || furnishingEditor.selectedGroup)
          ) {
            copiedEditorElement.current = {
              mode,
              id: furnishingEditor.selectedItem?.id ?? furnishingEditor.selectedIds[0],
            };
            event.preventDefault();
          }
          return;
        }
        const copied = copiedEditorElement.current;
        if (!copied || copied.mode !== mode) return;
        event.preventDefault();
        if (mode === "construct") duplicateConstructionOpening(copied.id);
        else duplicateArrangeItem(copied.id);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (mode === "furnish") {
        if (key === "escape") {
          event.preventDefault();
          clearFurnishingSelection();
        } else if (
          (key === "delete" || key === "backspace") &&
          furnishingEditor.selectedIds.length > 0
        ) {
          event.preventDefault();
          furnishingEditor.deleteItems(furnishingEditor.selectedIds);
          clearFurnishingSelection();
        }
        return;
      }
      if (key === "escape") {
        event.preventDefault();
        if (marqueeSelecting) return;
        if (pendingRoomPaintId) setPendingRoomPaintId(null);
        else if (floorZoneDrawing.active) floorZoneDrawing.cancel();
        else if (constructEditor.tool === "platform" && constructEditor.poolDrawing.active)
          constructEditor.poolDrawing.cancel();
        else if (constructEditor.tool === "platform") constructEditor.setTool("select");
        else if (constructEditor.tool === "floor") constructEditor.setTool("select");
        else if (constructEditor.tool === "measure" && constructMeasure.phase !== "idle") {
          constructMeasure.cancel();
        } else if (constructEditor.tool === "measure") constructEditor.setTool("select");
        else if (constructEditor.poolDrawing.active) constructEditor.poolDrawing.cancel();
        else if (constructEditor.drawStart) constructEditor.cancelWall();
        else if (
          ["door", "window", "passage", "niche", "hedge", "pool"].includes(constructEditor.tool)
        )
          constructEditor.setTool("select");
        else clearConstructionSelection();
        setDragging(false);
        return;
      }
      if (key === "enter" && constructEditor.drawStart) {
        event.preventDefault();
        constructEditor.cancelWall();
        setDragging(false);
        return;
      }
      if (key === "v") constructEditor.setTool("select");
      else if (key === "w") constructEditor.setTool("wall");
      else if (key === "d") constructEditor.setTool("door");
      else if (key === "n") constructEditor.setTool("window");
      else if (key === "a") constructEditor.setTool("passage");
      else if (key === "f") constructEditor.setTool("floor");
      else if (key === "h") constructEditor.setTool("hedge");
      else if (key === "p") constructEditor.setTool("pool");
      else if (key === "m") constructEditor.setTool("measure");
      else if ((key === "delete" || key === "backspace") && constructEditor.selection) {
        event.preventDefault();
        constructEditor.deleteSelected();
      }
    };
    dom.events.addEventListener("keydown", handleConstructShortcut, true);
    return () => dom.events.removeEventListener("keydown", handleConstructShortcut, true);
  }, [
    clearConstructionSelection,
    clearFurnishingSelection,
    closeWalk,
    constructEditor,
    constructMeasure,
    dragging,
    duplicateArrangeItem,
    duplicateConstructionOpening,
    editingLocked,
    floorZoneDrawing,
    furnishingEditor,
    marqueeSelecting,
    mode,
    pendingRoomPaintId,
    previewOpen,
    publishOpen,
    redoProject,
    selectedOpening,
    undoProject,
    unsettled,
    setCameraView,
    walkButton,
    dom,
    setPendingRoomPaintId,
    setDragging,
  ]);
}
