import {
  editModelLighting,
  WorkspaceConflictError,
  type CustomModel,
  type CustomModelLight,
  type EditorWorkspaceSnapshot,
  type ProjectModelRegistries,
} from "@cabane/engine";
import { editCustomModel } from "../custom-models/edit-custom-model";
import type { useEditorWorkspace } from "../editor-preview/useEditorWorkspace";

export type ModelEditorChange =
  | { kind: "personal"; model: CustomModel }
  | { kind: "catalog"; modelId: string; light: CustomModelLight | null | undefined };

/** The shell coordinates one history commit; model transformations retain their owners. */
export async function saveModelEditor(
  workspace: Pick<ReturnType<typeof useEditorWorkspace>, "snapshot" | "commit" | "flush">,
  change: ModelEditorChange,
  native: ProjectModelRegistries,
  commit: (snapshot: EditorWorkspaceSnapshot) => void = workspace.commit,
) {
  const next =
    change.kind === "personal"
      ? editModelLighting(
          editCustomModel(workspace.snapshot, change.model),
          change.model.id,
          change.model.light ?? null,
          native,
        )
      : editModelLighting(workspace.snapshot, change.modelId, change.light, native);
  commit(next);
  const saved = await workspace.flush();
  if (saved.status === "storage-error" && saved.error instanceof WorkspaceConflictError)
    throw new Error(
      "This workspace has a newer saved version. Reopen it before saving these changes.",
      { cause: saved.error },
    );
  if (saved.status !== "saved")
    throw new Error(
      "Could not save the model. Your draft is kept in memory. Retry Save, or close and use Undo to revert.",
    );
}
