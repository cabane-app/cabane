import {
  editCustomModel,
  parseHomeProjectSchema,
  type CustomModel,
  type CustomModelLight,
  type EditorWorkspaceSnapshot,
} from "@cabane/engine";
import type { useEditorWorkspace } from "../editor-preview/useEditorWorkspace";

function existingModel(snapshot: EditorWorkspaceSnapshot, modelId: string) {
  const model = snapshot.project.customModels?.find((model) => model.id === modelId);
  if (!model) throw new Error(`Custom model ${modelId} was not found in this workspace.`);
  return model;
}

export function renameCustomModel(
  snapshot: EditorWorkspaceSnapshot,
  modelId: string,
  name: string,
) {
  existingModel(snapshot, modelId);
  if (!name.trim()) throw new Error("Model name must not be empty.");
  return {
    ...snapshot,
    project: {
      ...snapshot.project,
      customModels: snapshot.project.customModels!.map((model) =>
        model.id === modelId ? { ...model, name: name.trim() } : model,
      ),
    },
  };
}

export function removeCustomModel(snapshot: EditorWorkspaceSnapshot, modelId: string) {
  existingModel(snapshot, modelId);
  if (snapshot.project.sceneItems.some((item) => item.modelId === modelId))
    throw new Error("Remove this model's instances first.");
  return {
    ...snapshot,
    project: {
      ...snapshot.project,
      customModels: snapshot.project.customModels!.filter((model) => model.id !== modelId),
    },
  };
}

/** Edit metadata on an existing immutable asset, with the library's ordinary save behavior. */
export async function saveCustomModel(
  workspace: Pick<ReturnType<typeof useEditorWorkspace>, "snapshot" | "flush">,
  model: CustomModel,
  onEditSnapshot: (snapshot: EditorWorkspaceSnapshot) => void,
) {
  existingModel(workspace.snapshot, model.id);
  const schema = parseHomeProjectSchema({
    ...workspace.snapshot.project,
    customModels: workspace.snapshot.project.customModels!.map((previous) =>
      previous.id === model.id ? model : previous,
    ),
  });
  if (!schema.valid) throw new Error(schema.issues.map((issue) => issue.message).join(" "));
  const next = editCustomModel(workspace.snapshot, model);
  onEditSnapshot(next);
  const saved = await workspace.flush();
  if (saved.status !== "saved")
    throw new Error(
      "Could not save the model. Your draft is kept in memory. Retry Save changes, or close and use Undo to revert.",
    );
}

export type CustomModelChanges = Partial<
  Pick<CustomModel, "name" | "placement" | "profile" | "normalization">
> & { light?: CustomModelLight | null };

export async function saveCustomModelChanges(
  workspace: Pick<ReturnType<typeof useEditorWorkspace>, "snapshot" | "flush">,
  modelId: string,
  changes: CustomModelChanges,
  onEditSnapshot: (snapshot: EditorWorkspaceSnapshot) => void,
) {
  const previous = existingModel(workspace.snapshot, modelId);
  const model = { ...previous, ...changes };
  if (model.light === null) delete model.light;
  await saveCustomModel(workspace, model as CustomModel, onEditSnapshot);
}
