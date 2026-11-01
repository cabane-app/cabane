import {
  sceneItemPlacementIssues,
  type FloorSpec,
  type ProjectModelRegistries,
} from "@cabane/engine";
import {
  furnishingEditorReducer,
  type FurnishingEditorAction,
  type FurnishingEditorState,
} from "../editor-state";

const placementActions = new Set<FurnishingEditorAction["type"]>([
  "add-item",
  "update-item",
  "add-preset",
  "duplicate",
  "duplicate-items",
  "transform-group",
  "rotate",
  "update-placement",
  "update-placements",
  "update-size",
  "update-placement-and-size",
]);
const clearErrorActions = new Set<FurnishingEditorAction["type"]>([
  "select",
  "select-many",
  "replace-items",
  "undo",
  "redo",
  "cancel-transaction",
]);

/** Reject the whole proposed edit before it enters draft state or undo history. */
export function guardedFurnishingEditorReducer(
  state: FurnishingEditorState,
  action: FurnishingEditorAction,
  context?: { project: { floors: readonly FloorSpec[] }; registries: ProjectModelRegistries },
): FurnishingEditorState {
  const next = furnishingEditorReducer(state, action);
  if (context && placementActions.has(action.type)) {
    const previous = new Map(state.items.map((item) => [item.id, item]));
    for (const item of next.items) {
      if (item === previous.get(item.id)) continue;
      const registry =
        item.kind === "device"
          ? context.registries.deviceModels
          : context.registries.furnishingModels;
      const definition = registry[item.modelId];
      const issue = sceneItemPlacementIssues(item, context.project, definition)[0];
      if (issue)
        return {
          ...state,
          placementError: `${definition?.label ?? "Item"}: ${issue.message} Change refused.`,
        };
    }
  }
  return next.placementError &&
    (placementActions.has(action.type) || clearErrorActions.has(action.type))
    ? { ...next, placementError: null }
    : next;
}
