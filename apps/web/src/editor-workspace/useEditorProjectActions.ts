import type { HomeProject, ProjectModelRegistries } from "@cabane/engine";
import type { useEditorWorkspace } from "../editor-preview/useEditorWorkspace";
import { editProject, type EditorProjectAction } from "./editor-project-actions";
import { useEditorIssueRepairs } from "./useEditorIssueRepairs";

export function useEditorProjectActions({
  workspace,
  editorProject,
  registries,
  selectFloor,
  replaceEditorsFromProject,
}: {
  workspace: ReturnType<typeof useEditorWorkspace>;
  editorProject: HomeProject;
  registries: ProjectModelRegistries;
  selectFloor: (id: string) => void;
  replaceEditorsFromProject: (project: HomeProject) => void;
}) {
  const executeProjectAction = (action: EditorProjectAction) => {
    const next = editProject(workspace.snapshot, action);
    const changed = workspace.commit(next);
    if (changed) {
      if (action.type === "add-floor-above" || action.type === "add-floor-below")
        selectFloor(action.id);
      if (
        [
          "add-floor-above",
          "add-floor-below",
          "rename-floor",
          "set-floor-height",
          "remove-floor",
        ].includes(action.type)
      )
        replaceEditorsFromProject(next.project);
    }
    return changed;
  };
  const repairs = useEditorIssueRepairs({
    editorProject,
    snapshot: workspace.snapshot,
    commit: workspace.commit,
    replaceEditorsFromProject,
    ...registries,
  });
  return { executeProjectAction, repairs };
}
