import type { CustomModelLight } from "@cabane/engine";
import {
  renameCustomModel,
  removeCustomModel,
  saveCustomModelChanges,
  type CustomModelChanges,
} from "../custom-models/custom-model-edits";
import { saveModelLighting } from "../model-lighting/save-model-lighting";
import { ownerProjectRegistries } from "../project-runtime";
import { objectParams, requiredString, type EditorController } from "./agent-command-support";

export const AGENT_MODEL_ACTION_TYPES = [
  "update-model-lighting",
  "update-custom-model",
  "rename-custom-model",
  "remove-custom-model",
] as const;

/** Metadata edits use the same validated model/history operations as Arrange's dialogs. */
export async function executeModelAction(
  controller: EditorController,
  action: Record<string, unknown>,
): Promise<void> {
  const modelId = requiredString(action, "modelId");
  if (action.type === "update-model-lighting") {
    if (action.reset !== undefined && typeof action.reset !== "boolean")
      throw new Error("reset must be a boolean.");
    if (action.reset === true && action.light !== undefined)
      throw new Error("Choose light settings or reset, not both.");
    if (action.reset !== true && action.light === undefined)
      throw new Error(
        "light is required; use null to disable lighting or reset: true to restore defaults.",
      );
    const light =
      action.reset === true || action.light === null ? action.light : objectParams(action.light);
    await saveModelLighting(
      controller.workspace,
      modelId,
      light as CustomModelLight | null | undefined,
      ownerProjectRegistries,
      controller.replaceEditorsFromProject,
    );
    return;
  }
  if (action.type === "rename-custom-model") {
    controller.workspace.commit(
      renameCustomModel(controller.workspace.snapshot, modelId, requiredString(action, "name")),
    );
    return;
  }
  if (action.type === "remove-custom-model") {
    controller.workspace.commit(removeCustomModel(controller.workspace.snapshot, modelId));
    return;
  }
  if (action.type !== "update-custom-model")
    throw new Error(`Unsupported model action: ${String(action.type)}.`);
  const changes = objectParams(action.changes);
  const editable = ["name", "placement", "profile", "normalization", "light"];
  if (!Object.keys(changes).length || Object.keys(changes).some((key) => !editable.includes(key)))
    throw new Error(`changes must contain editable metadata: ${editable.join(", ")}.`);
  await saveCustomModelChanges(
    controller.workspace,
    modelId,
    changes as CustomModelChanges,
    (snapshot) => {
      controller.replaceEditorsFromProject(snapshot.project);
      controller.workspace.commit(snapshot);
    },
  );
}
