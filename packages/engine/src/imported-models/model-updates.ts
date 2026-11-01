import { createBrowserUuid } from "../browser-uuid";
import { isAuxiliaryEntitySlot } from "../entity-slot-roles";
import type { EditorWorkspaceSnapshot } from "../home-editor/workspace-history";
import { collectProjectIds } from "../home-project/cross-references";
import type { SceneItemSpec } from "../home-project/types";
import { removeWorkspaceSlotReferences } from "../home-project/workspace-bindings";
import { editModelLighting } from "../model-lighting/edit";
import type { CustomModel } from "./contracts";

/** Add or edit one model, its copies and draft connections as one undoable change. */
export function editCustomModel(
  snapshot: EditorWorkspaceSnapshot,
  model: CustomModel,
  replacement?: { modelId: string; kind: SceneItemSpec["kind"] },
): EditorWorkspaceSnapshot {
  const models = snapshot.project.customModels ?? [];
  const previous = models.find((entry) => entry.id === model.id);
  if (
    previous &&
    (previous.asset.sha256 !== model.asset.sha256 ||
      previous.asset.byteLength !== model.asset.byteLength)
  )
    throw new Error("Editing a model cannot replace its GLB asset.");
  const removedSlots: string[] = [];
  const occupied = new Set(collectProjectIds(snapshot.project));
  const sceneItems = snapshot.project.sceneItems.map((item): SceneItemSpec => {
    const replacing = item.modelId === replacement?.modelId && item.kind === replacement.kind;
    if (item.modelId !== model.id && !replacing) return item;
    const oldModel = replacing ? undefined : previous;
    // Existing copies keep their multiplier; missing definitions have no prior scale to infer.
    const size = oldModel
      ? (model.normalization.size.map((value, axis) =>
          value === oldModel.normalization.size[axis]
            ? item.size[axis]
            : item.size[axis] * (value / oldModel.normalization.size[axis]),
        ) as [number, number, number])
      : item.size;
    const controls = (item.entitySlots ?? []).filter((slot) => !isAuxiliaryEntitySlot(slot));
    const sameProfile = oldModel
      ? oldModel.profile === model.profile
      : model.profile === "furniture"
        ? item.kind === "furnishing" && controls.length === 0
        : item.kind === "device" &&
          controls.filter((slot) => slot.deviceRole === "primary").length === 1 &&
          controls.every(
            (slot) =>
              slot.compatibleDomains.length > 0 &&
              slot.compatibleDomains.every((domain) => domain === model.profile),
          );
    if (sameProfile) return { ...item, modelId: model.id, size };
    const readings = (item.entitySlots ?? []).filter(isAuxiliaryEntitySlot);
    removedSlots.push(...controls.map((slot) => slot.id));
    const { entitySlots: _slots, lightState: _lightState, ...common } = item;
    if (model.profile === "furniture")
      return {
        ...common,
        modelId: model.id,
        size,
        kind: "furnishing",
        ...(readings.length ? { entitySlots: readings } : {}),
      };
    let slotId = createBrowserUuid();
    while (occupied.has(slotId)) slotId = createBrowserUuid();
    occupied.add(slotId);
    return {
      ...common,
      modelId: model.id,
      size,
      kind: "device",
      entitySlots: [
        {
          id: slotId,
          compatibleDomains: [model.profile],
          required: true,
          autoMap: "manual",
          deviceRole: "primary",
          presentation: { label: model.name, dashboardRole: "primary" },
        },
        ...readings,
      ],
    };
  });
  return editModelLighting(
    {
      ...snapshot,
      project: {
        ...snapshot.project,
        customModels: previous
          ? models.map((entry) => (entry.id === model.id ? model : entry))
          : [...models, model],
        sceneItems,
      },
      bindings: removeWorkspaceSlotReferences(snapshot.bindings, removedSlots),
    },
    model.id,
    model.light ?? null,
    { furnishingModels: {}, deviceModels: {} },
  );
}
