import { useState } from "react";
import type { ConstructContextualIssue } from "../editor-preview/construct";
import { workspaceSnapshotFromEditorState } from "../editor-preview/project-sync";
import { missingModelEditorDescriptor } from "../editor-preview/furnish/missing-model";
import { resetSceneItemPlacement } from "../editor-preview/furnish/placement/repair-placement";
import type { EditorWorkspaceSnapshot, HomeProject, ProjectModelRegistries } from "@cabane/engine";

export function useEditorIssueRepairs(
  controller: ProjectModelRegistries & {
    editorProject: HomeProject;
    snapshot: EditorWorkspaceSnapshot;
    commit: (snapshot: EditorWorkspaceSnapshot) => unknown;
    replaceEditorsFromProject: (project: HomeProject) => void;
  },
) {
  const [repairMessage, setRepairMessage] = useState<string | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const itemLabel = (issue: ConstructContextualIssue) => {
    const target = issue.target;
    if (target?.kind === "wall" || target?.kind === "opening") {
      for (const floor of controller.editorProject.floors) {
        if (issue.floorId && floor.id !== issue.floorId) continue;
        const elements = target.kind === "wall" ? floor.walls : floor.openings;
        const element = elements.find((element) => element.id === target.id);
        if (element) return element.name || undefined;
      }
      return undefined;
    }
    const item =
      issue.target?.kind === "scene-item" &&
      controller.editorProject.sceneItems.find((item) => item.id === issue.target?.id);
    return item
      ? (item.kind === "device" ? controller.deviceModels : controller.furnishingModels)[
          item.modelId
        ]?.label
      : undefined;
  };
  const repairItem = (itemId: string, action: "reset-placement" | "remove") => {
    const project = controller.editorProject;
    const item = project.sceneItems.find((item) => item.id === itemId);
    const floor = project.floors.find((floor) => floor.id === item?.floorId);
    if (!item || !floor) return { error: "Item or floor was not found." };
    const definition =
      (item.kind === "device" ? controller.deviceModels : controller.furnishingModels)[
        item.modelId
      ] ?? missingModelEditorDescriptor(item);
    const candidate =
      action === "reset-placement" ? resetSceneItemPlacement(item, project, definition) : null;
    if (candidate && !candidate.placement) {
      setRepairError(candidate.error);
      setRepairMessage(null);
      return { error: candidate.error };
    }
    const items = project.sceneItems
      .filter((other) => other.floorId === floor.id)
      .flatMap((other) =>
        other.id !== item.id
          ? [other]
          : candidate?.placement
            ? [{ ...other, placement: candidate.placement }]
            : [],
      );
    const next = workspaceSnapshotFromEditorState(
      { ...controller.snapshot, project },
      floor,
      items,
      controller,
    );
    controller.commit(next);
    controller.replaceEditorsFromProject(next.project);
    setRepairError(null);
    setRepairMessage(
      action === "remove"
        ? "Item removed. Undo restores it."
        : "Placement reset to the floor. Undo restores the previous placement.",
    );
    return { error: null };
  };
  const repairIssue = (issue: ConstructContextualIssue, action: "reset-placement" | "remove") => {
    if (issue.target?.kind === "scene-item") repairItem(issue.target.id, action);
  };
  return { repairItem, repairIssue, repairMessage, repairError, itemLabel };
}
