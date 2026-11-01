import { AGENT_MODEL_ACTION_TYPES, executeModelAction } from "./agent-model-actions";
import { parseHomeProjectSchema } from "@cabane/engine";
import { catalogEntries } from "../editor-preview/furnish/catalog/catalog";
import type { SceneItemPatch } from "../editor-preview/furnish/item-edits";
import {
  itemPlacement,
  objectParams,
  optionalString,
  planPoint,
  requiredString,
  type EditorController,
} from "./agent-command-support";

function itemIds(action: Record<string, unknown>) {
  if (
    !Array.isArray(action.itemIds) ||
    !action.itemIds.length ||
    action.itemIds.some((id) => typeof id !== "string" || !id.trim())
  )
    throw new Error("itemIds must be a non-empty array of item IDs.");
  return action.itemIds as string[];
}

export async function executeArrangeAction(
  controller: EditorController,
  action: Record<string, unknown>,
) {
  const editor = controller.furnishingEditor;
  const type = requiredString(action, "type");
  if ((AGENT_MODEL_ACTION_TYPES as readonly string[]).includes(type)) {
    await executeModelAction(controller, action);
    return;
  }
  if (type === "add-item") {
    const modelId = requiredString(action, "modelId");
    const entry = catalogEntries(controller.furnishingModels, controller.deviceModels).find(
      (entry) => entry.modelId === modelId,
    );
    if (!entry) throw new Error(`Catalog model ${modelId} was not found.`);
    const result = controller.addCatalogItem(entry, {
      ...(action.at === undefined ? {} : { at: planPoint(action.at, "at") }),
      ...(action.placement === undefined
        ? {}
        : { placement: itemPlacement(action.placement, "placement") }),
    });
    if (result.error) throw new Error(result.error);
    return;
  }
  if (type === "update-item-placements") {
    const placements = objectParams(action.placements);
    if (!Object.keys(placements).length)
      throw new Error("placements must contain at least one item placement.");
    const decoded = Object.fromEntries(
      Object.entries(placements).map(([id, placement]) => {
        if (!editor.items.some((item) => item.id === id))
          throw new Error(`Item ${id} was not found on the active floor.`);
        return [id, itemPlacement(placement, `placements.${id}`)];
      }),
    );
    editor.updatePlacements(decoded);
    return;
  }
  if (["group-items", "ungroup-items", "duplicate-items", "delete-items"].includes(type)) {
    const ids = itemIds(action);
    for (const id of ids) {
      if (!editor.items.some((item) => item.id === id))
        throw new Error(`Item ${id} was not found on the active floor.`);
    }
    if (type === "group-items") editor.groupItems(ids);
    if (type === "ungroup-items") editor.ungroupItems(ids);
    if (type === "duplicate-items") editor.duplicateItems(ids, controller.placementFloor);
    if (type === "delete-items") editor.deleteItems(ids);
    return;
  }
  if (type === "rename-group" || type === "transform-group") {
    const groupId = requiredString(action, "groupId");
    if (!editor.items.some((item) => item.group?.id === groupId))
      throw new Error(`Group ${groupId} was not found on the active floor.`);
    if (type === "rename-group") editor.renameGroup(groupId, requiredString(action, "name"));
    else {
      const placement = itemPlacement(action.placement, "placement");
      if (placement.kind !== "absolute") throw new Error("Groups require absolute placement.");
      editor.transformGroup(groupId, placement, controller.placementFloor);
    }
    return;
  }
  const itemId = requiredString(action, "itemId");
  const item = editor.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`Item ${itemId} was not found on the active floor.`);
  if (type === "delete-item") {
    controller.deleteSceneItem(itemId);
    return;
  }
  if (type === "duplicate-item") {
    controller.duplicateArrangeItem(itemId);
    return;
  }
  if (type === "repair-item-placement") {
    const result = controller.repairs.repairItem(itemId, "reset-placement");
    if (result?.error) throw new Error(result.error);
    return;
  }
  if (type !== "update-item") throw new Error(`Unsupported Arrange action: ${type}.`);
  const patch = objectParams(action.patch);
  const keys = Object.keys(patch);
  const allowed = ["placement", "variant", "color", "size", "lightState", "entitySlots"];
  if (!keys.length || keys.some((key) => !allowed.includes(key)))
    throw new Error(`patch must contain editable fields: ${allowed.join(", ")}.`);
  if (
    patch.size !== undefined &&
    (!Array.isArray(patch.size) ||
      patch.size.length !== 3 ||
      !patch.size.every(
        (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
      ))
  )
    throw new Error("size must contain three positive finite numbers.");
  if (
    patch.lightState !== undefined &&
    (typeof patch.lightState !== "string" ||
      !["always-off", "always-on", "night-only", "connected"].includes(patch.lightState))
  )
    throw new Error("lightState is unsupported.");
  if (patch.placement !== undefined) itemPlacement(patch.placement, "patch.placement");
  if (patch.variant !== undefined) optionalString(patch, "variant");
  const candidate = { ...item, ...patch };
  if (candidate.color === null) delete candidate.color;
  const schema = parseHomeProjectSchema({
    ...controller.editorProject,
    sceneItems: controller.editorProject.sceneItems.map((other) =>
      other.id === itemId ? candidate : other,
    ),
  });
  if (!schema.valid) throw new Error(schema.issues.map((issue) => issue.message).join(" "));
  const definition = (
    item.kind === "device" ? controller.deviceModels : controller.furnishingModels
  )[item.modelId];
  if (!definition) throw new Error(`Model ${item.modelId} is unavailable.`);
  editor.updateItem(itemId, patch as SceneItemPatch, definition);
}
