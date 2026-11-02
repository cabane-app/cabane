import {
  editModelLighting,
  WorkspaceConflictError,
  type CustomModelLight,
  type HomeProject,
  type ProjectModelRegistries,
} from "@cabane/engine";
import type { useEditorWorkspace } from "../editor-preview/useEditorWorkspace";

export async function saveModelLighting(
  workspace: Pick<ReturnType<typeof useEditorWorkspace>, "snapshot" | "commit" | "flush">,
  modelId: string,
  light: CustomModelLight | null | undefined,
  native: ProjectModelRegistries,
  replaceEditorsFromProject: (project: HomeProject) => void,
) {
  const next = editModelLighting(workspace.snapshot, modelId, light, native);
  replaceEditorsFromProject(next.project);
  workspace.commit(next);
  const saved = await workspace.flush();
  if (saved.status === "storage-error" && saved.error instanceof WorkspaceConflictError)
    throw new Error(
      "This workspace has a newer saved version. Reopen it before saving these changes.",
      { cause: saved.error },
    );
  if (saved.status !== "saved")
    throw new Error(
      "Could not save lighting. Your draft is kept in memory. Retry Save, or close and use Undo to revert.",
    );
}
