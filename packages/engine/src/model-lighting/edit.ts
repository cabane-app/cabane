import { validateModelLighting } from "./schema";
import type { HomeProjectIssue } from "../home-project/validation-types";
import { createBrowserUuid } from "../browser-uuid";
import { collectProjectIds } from "../home-project/cross-references";
import { removeWorkspaceSlotReferences } from "../home-project/workspace-bindings";
import type { EditorWorkspaceSnapshot } from "../home-editor/workspace-history";
import type { CustomModelLight } from "../imported-models/contracts";
import type { ProjectModelRegistries } from "../types";
import { lightingEntitySlotId, primaryLightSlot, projectModelLighting } from "./settings";

/** One history entry contains model settings, new relationships, and draft-only cleanup. */
export function editModelLighting(
  snapshot: EditorWorkspaceSnapshot,
  modelId: string,
  light: CustomModelLight | null | undefined,
  native: ProjectModelRegistries,
): EditorWorkspaceSnapshot {
  if (light) {
    const issues: HomeProjectIssue[] = [];
    validateModelLighting(light, "lighting", issues);
    if (issues.length) throw new Error(issues[0].message);
  }
  const custom = snapshot.project.customModels?.find((model) => model.id === modelId);
  if (!custom && !native.deviceModels[modelId] && !native.furnishingModels[modelId])
    throw new Error("This model is unavailable. Restore it before editing its lighting.");
  let project = snapshot.project;
  if (custom) {
    const { light: _previous, ...base } = custom;
    project = {
      ...project,
      customModels: project.customModels!.map((model) =>
        model.id === modelId ? { ...base, ...(light ? { light } : {}) } : model,
      ),
    };
  } else {
    const entries = Object.entries(project.modelLights ?? {}).filter(([id]) => id !== modelId);
    if (light !== undefined) entries.push([modelId, light]);
    const { modelLights: _previous, ...base } = project;
    project = { ...base, ...(entries.length ? { modelLights: Object.fromEntries(entries) } : {}) };
  }
  const enabled = !!projectModelLighting(project, modelId, native);
  const removed: string[] = [];
  const occupied = new Set(collectProjectIds(project));
  project = {
    ...project,
    sceneItems: project.sceneItems.map((item) => {
      if (item.modelId !== modelId) return item;
      if (enabled && !primaryLightSlot(item)) {
        if (item.lightSlotId) return item;
        let id = createBrowserUuid();
        while (occupied.has(id) || occupied.has(lightingEntitySlotId(id))) id = createBrowserUuid();
        occupied.add(id);
        occupied.add(lightingEntitySlotId(id));
        return { ...item, lightSlotId: id };
      }
      if (!item.lightSlotId) return item;
      removed.push(lightingEntitySlotId(item.lightSlotId));
      const { lightSlotId: _slot, ...rest } = item;
      return rest;
    }),
  };
  return {
    ...snapshot,
    project,
    bindings: removeWorkspaceSlotReferences(snapshot.bindings, removed),
  };
}
