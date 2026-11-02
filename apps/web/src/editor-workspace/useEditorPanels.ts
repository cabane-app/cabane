import { useCallback, useEffect, useReducer } from "react";
import type { useHomeEditorController } from "./useHomeEditorController";

type SelectionContext = Pick<
  ReturnType<typeof useHomeEditorController>,
  "mode" | "activeFloorId" | "constructEditor" | "stairDialog" | "furnishingEditor"
>;

/** Placement options stay reachable between stair gestures, including on touch. */
export function editorPanelsBusy(
  controller: Pick<
    ReturnType<typeof useHomeEditorController>,
    "unsettled" | "stairPlacement" | "dragging" | "marqueeSelecting"
  > & {
    constructEditor: Pick<
      ReturnType<typeof useHomeEditorController>["constructEditor"],
      "drawStart"
    >;
  },
) {
  return (
    (controller.unsettled && !controller.stairPlacement) ||
    controller.dragging ||
    controller.marqueeSelecting ||
    Boolean(controller.constructEditor.drawStart)
  );
}

/** Panel identity follows selection; property edits never reopen a collapsed panel. */
export function editorPanelSelection(
  { mode, activeFloorId, constructEditor, stairDialog, furnishingEditor }: SelectionContext,
  shortcutsMode: boolean,
): string | null {
  if (shortcutsMode) return null;
  let target: string | null = null;
  if (mode === "construct") {
    const selection = constructEditor.selection;
    target = stairDialog
      ? `stair:${stairDialog.id}`
      : selection?.kind === "multiple"
        ? selection.targets
            .map(({ kind, id }) => `${kind}:${id}`)
            .sort()
            .join("|")
        : selection
          ? `${selection.kind}:${selection.id}`
          : null;
  } else if (mode === "furnish" && furnishingEditor.selectedIds.length) {
    target = [...furnishingEditor.selectedIds].sort().join("|");
  }
  return target ? `${mode}:${activeFloorId}:${target}` : null;
}

type Surface = "tools" | "properties" | "issues";
interface PanelState {
  selection: string | null;
  hasIssues: boolean;
  collapsed: boolean;
  issuesExpanded: boolean;
  surface: Surface;
  mobileOpen: boolean;
  context: string;
}
type Action =
  | { type: "selection"; selection: string | null; hasIssues: boolean; context: string }
  | { type: "properties" | "collapse" | "issues" | "tools" | "show-issues" | "close-mobile" };
function reduce(state: PanelState, action: Action): PanelState {
  switch (action.type) {
    case "selection":
      if (action.selection === state.selection && action.context === state.context)
        return action.hasIssues === state.hasIssues
          ? state
          : {
              ...state,
              hasIssues: action.hasIssues,
              mobileOpen:
                state.surface === "issues" && !action.hasIssues ? false : state.mobileOpen,
            };
      return {
        ...state,
        selection: action.selection,
        hasIssues: action.hasIssues,
        context: action.context,
        mobileOpen:
          action.context === state.context &&
          (state.surface !== "properties" || !!action.selection) &&
          state.mobileOpen,
        collapsed: false,
        surface: action.selection
          ? "properties"
          : state.surface === "properties"
            ? "tools"
            : state.surface,
      };
    case "properties":
      return { ...state, collapsed: false, surface: "properties", mobileOpen: true };
    case "collapse":
      return { ...state, collapsed: true, surface: "tools", mobileOpen: false };
    case "tools":
      return { ...state, surface: "tools", mobileOpen: true };
    case "show-issues":
      return { ...state, issuesExpanded: true, surface: "issues", mobileOpen: true };
    case "close-mobile":
      return { ...state, mobileOpen: false };
    case "issues":
      return {
        ...state,
        issuesExpanded: !state.issuesExpanded,
        surface: state.issuesExpanded ? "tools" : "issues",
      };
  }
}

export function useEditorPanels(
  selection: string | null,
  busy: boolean,
  hasIssues = true,
  context = "",
) {
  const [state, dispatch] = useReducer(reduce, {
    selection,
    hasIssues,
    collapsed: false,
    issuesExpanded: false,
    surface: selection ? "properties" : "tools",
    mobileOpen: false,
    context,
  });
  // Selection changes on pointer-down. Reflow only after the gesture settles.
  useEffect(() => {
    if (!busy) dispatch({ type: "selection", selection, hasIssues, context });
  }, [busy, selection, hasIssues, context]);
  const closeMobilePanel = useCallback(() => dispatch({ type: "close-mobile" }), []);
  return {
    propertiesOpen: !!state.selection && !state.collapsed,
    hasSelection: !!selection,
    issuesExpanded: state.issuesExpanded,
    issuesOpen: state.issuesExpanded && state.hasIssues,
    mobileSurface: state.surface,
    mobileOpen: state.mobileOpen,
    closeMobilePanel,
    openProperties: () => dispatch({ type: "properties" }),
    collapseProperties: () => dispatch({ type: "collapse" }),
    showIssues: () => dispatch({ type: "show-issues" }),
    showTools: () => dispatch({ type: "tools" }),
    toggleIssues: () => dispatch({ type: "issues" }),
  };
}
