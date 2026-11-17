import { useCallback, useEffect, useReducer } from "react";
import type { useHomeEditorController } from "./useHomeEditorController";

type PropertiesContext = Pick<
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

/** Panel identity follows the selection or the current Construct floor. */
export function editorPropertiesTarget(
  { mode, activeFloorId, constructEditor, stairDialog, furnishingEditor }: PropertiesContext,
  settingsMode: boolean,
): string | null {
  if (settingsMode) return null;
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
          : "settings";
  } else if (mode === "furnish" && furnishingEditor.selectedIds.length) {
    target = [...furnishingEditor.selectedIds].sort().join("|");
  }
  return target ? `${mode}:${activeFloorId}:${target}` : null;
}

type Surface = "tools" | "properties" | "issues";
interface PanelState {
  target: string | null;
  hasIssues: boolean;
  collapsed: boolean;
  issuesExpanded: boolean;
  surface: Surface;
  mobileOpen: boolean;
  context: string;
}
type Action =
  | { type: "target"; target: string | null; hasIssues: boolean; context: string }
  | {
      type: "restore-properties";
      target: string | null;
      hasIssues: boolean;
      context: string;
      open: boolean;
      mobileOpen: boolean;
    }
  | { type: "properties" | "collapse" | "issues" | "tools" | "show-issues" | "close-mobile" };
function reduce(state: PanelState, action: Action): PanelState {
  switch (action.type) {
    case "target":
      if (action.target === state.target && action.context === state.context)
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
        target: action.target,
        hasIssues: action.hasIssues,
        context: action.context,
        mobileOpen:
          action.context === state.context &&
          (state.surface !== "properties" || !!action.target) &&
          state.mobileOpen,
        collapsed: false,
        surface: action.target
          ? "properties"
          : state.surface === "properties"
            ? "tools"
            : state.surface,
      };
    case "restore-properties":
      return {
        ...state,
        target: action.target,
        hasIssues: action.hasIssues,
        context: action.context,
        collapsed: !action.open,
        surface: action.open ? "properties" : "tools",
        mobileOpen: action.open && action.mobileOpen,
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
  target: string | null,
  busy: boolean,
  hasIssues = true,
  context = "",
) {
  const [state, dispatch] = useReducer(reduce, {
    target,
    hasIssues,
    collapsed: false,
    issuesExpanded: false,
    surface: target ? "properties" : "tools",
    mobileOpen: false,
    context,
  });
  // The target can change on pointer-down. Reflow only after the gesture settles.
  useEffect(() => {
    if (!busy) dispatch({ type: "target", target, hasIssues, context });
  }, [busy, target, hasIssues, context]);
  const closeMobilePanel = useCallback(() => dispatch({ type: "close-mobile" }), []);
  const restoreProperties = useCallback(
    (open: boolean, mobileOpen: boolean) =>
      dispatch({ type: "restore-properties", target, hasIssues, context, open, mobileOpen }),
    [target, hasIssues, context],
  );
  return {
    propertiesOpen: !!state.target && !state.collapsed,
    hasProperties: !!target,
    issuesExpanded: state.issuesExpanded,
    issuesOpen: state.issuesExpanded && state.hasIssues,
    mobileSurface: state.surface,
    mobileOpen: state.mobileOpen,
    closeMobilePanel,
    restoreProperties,
    openProperties: () => dispatch({ type: "properties" }),
    collapseProperties: () => dispatch({ type: "collapse" }),
    showIssues: () => dispatch({ type: "show-issues" }),
    showTools: () => dispatch({ type: "tools" }),
    toggleIssues: () => dispatch({ type: "issues" }),
  };
}
