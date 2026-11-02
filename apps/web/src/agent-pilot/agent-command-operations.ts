import {
  collectBindingSlots,
  entityMatchesBindingSlot,
  normalizeWorkspaceBindingOrigin,
  type EntityId,
} from "@cabane/engine";
import { catalogEntries } from "../editor-preview/furnish/catalog/catalog";
import { executeConstructAction } from "./agent-construct-actions";
import { executeArrangeAction } from "./agent-arrange-actions";
import type { EditorProjectAction } from "../editor-workspace/editor-project-actions";
import {
  activeFloor,
  currentBindingState,
  ensureEditable,
  expectedRevision,
  finiteNumber,
  inspectionFor,
  objectParams,
  optionalString,
  requiredString,
  settleMutation,
  type AgentControllerRef,
  type EditorController,
  PROTOCOL_VERSION,
} from "./agent-command-support";

export async function executeConstruct(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  params: Record<string, unknown>,
) {
  const controller = controllerRef.current;
  ensureEditable(controller);
  expectedRevision(params, controller);
  activeFloor(controller, optionalString(params, "floorId"));
  const action = objectParams(params.action);
  const beforeRevision = controller.workspace.getEditRevision();
  executeConstructAction(controller.constructEditor, action);
  return settleMutation(workspaceId, controllerRef, beforeRevision, "dispatch_construct");
}

export async function executeFloorOperation(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  params: Record<string, unknown>,
) {
  const controller = controllerRef.current;
  ensureEditable(controller);
  expectedRevision(params, controller);
  const action = objectParams(params.action);
  const type = requiredString(action, "type");
  const floorId = optionalString(action, "floorId") ?? controller.activeFloorId;
  let edit: EditorProjectAction;
  if (type === "add-floor-above" || type === "add-floor-below") {
    const sourceFloorId = optionalString(action, "sourceFloorId");
    edit = { type, id: requiredString(action, "id"), ...(sourceFloorId ? { sourceFloorId } : {}) };
  } else if (type === "rename-floor")
    edit = { type, floorId, name: requiredString(action, "name") };
  else if (type === "set-floor-height")
    edit = { type, floorId, heightMeters: finiteNumber(action.heightMeters, "heightMeters") };
  else if (type === "remove-floor") edit = { type, floorId };
  else if (type === "delete-stair") edit = { type, stairId: requiredString(action, "stairId") };
  else if (type === "add-stair" || type === "update-stair")
    edit = {
      type,
      stair: objectParams(action.stair) as unknown as Extract<
        EditorProjectAction,
        { type: "add-stair" | "update-stair" }
      >["stair"],
    };
  else if (type === "update-home-settings") {
    const changes = objectParams(action.changes);
    if (
      !Object.keys(changes).length ||
      Object.keys(changes).some(
        (key) => !["roof", "northAngleDegrees", "apartmentFloor"].includes(key),
      )
    )
      throw new Error("changes must contain roof, northAngleDegrees or apartmentFloor.");
    edit = { type, changes };
  } else if (type === "set-walk-start")
    edit = {
      type,
      walkStart:
        action.walkStart === null
          ? null
          : (objectParams(action.walkStart) as unknown as Extract<
              EditorProjectAction,
              { type: "set-walk-start" }
            >["walkStart"]),
    };
  else throw new Error(`Unsupported project action: ${type}.`);
  const beforeRevision = controller.workspace.getEditRevision();
  controller.executeProjectAction(edit);
  return settleMutation(workspaceId, controllerRef, beforeRevision, type);
}

export async function executeArrange(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  params: Record<string, unknown>,
) {
  const controller = controllerRef.current;
  ensureEditable(controller);
  expectedRevision(params, controller);
  activeFloor(controller, optionalString(params, "floorId"));
  const beforeRevision = controller.workspace.getEditRevision();
  await executeArrangeAction(controller, objectParams(params.action));
  return settleMutation(workspaceId, controllerRef, beforeRevision, "arrange");
}

export function listCatalog(controller: EditorController) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    entries: catalogEntries(controller.furnishingModels, controller.deviceModels).map((entry) => ({
      key: entry.key,
      kind: entry.kind,
      modelId: entry.modelId,
      custom: entry.modelId.startsWith("custom:"),
      label: entry.definition.label,
      category: entry.definition.category,
      defaultRoomType: entry.definition.defaultRoomType,
      defaultSize: entry.definition.defaultSize,
      preferredPlacement: entry.definition.preferredPlacement,
      variants:
        entry.definition.variants?.map((variant) => ({ id: variant.id, label: variant.label })) ??
        [],
      ...(entry.kind === "device"
        ? {
            supportedDomains: entry.definition.supportedDomains,
            supportedDeviceClasses: entry.definition.supportedDeviceClasses ?? {},
          }
        : {}),
    })),
  };
}

export function listBindingSlots(controller: EditorController) {
  const descriptors = collectBindingSlots(controller.connectManifest);
  const configuredOrigin = controller.homeAssistantUrl
    ? normalizeWorkspaceBindingOrigin(controller.homeAssistantUrl)
    : null;
  const connected =
    configuredOrigin !== null &&
    controller.runtime.status === "connected" &&
    controller.runtime.origin === configuredOrigin;
  const state = configuredOrigin ? currentBindingState(controller, configuredOrigin) : undefined;
  return {
    protocolVersion: PROTOCOL_VERSION,
    connected,
    slots: descriptors.map((descriptor) => ({
      slotId: descriptor.slotId,
      kind: descriptor.kind,
      roomIds: descriptor.roomIds,
      deviceSlotId: descriptor.deviceSlotId,
      deviceModel: descriptor.deviceModel,
      label: descriptor.spec.presentation.label,
      required: descriptor.spec.required,
      compatibleDomains: descriptor.spec.compatibleDomains,
      compatibleDeviceClasses: descriptor.spec.compatibleDeviceClasses ?? [],
      mapped: Boolean(state?.draft.entityIdsBySlotId[descriptor.slotId]),
      candidates: connected
        ? controller.runtime.entityRegistry
            .filter((entry) => !entry.disabled_by && !entry.hidden_by)
            .filter((entry) =>
              entityMatchesBindingSlot(descriptor, entry.entity_id, controller.runtime),
            )
            .map((entry) => ({
              entityId: entry.entity_id,
              label:
                (typeof controller.runtime.entityStates[entry.entity_id]?.attributes
                  .friendly_name === "string"
                  ? controller.runtime.entityStates[entry.entity_id]?.attributes.friendly_name
                  : null) ??
                entry.name ??
                entry.original_name ??
                entry.entity_id,
              domain: entry.entity_id.split(".")[0],
              areaId: entry.area_id,
              areaName:
                controller.runtime.areas.find((area) => area.area_id === entry.area_id)?.name ??
                null,
            }))
        : [],
    })),
  };
}

export async function applyBinding(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  params: Record<string, unknown>,
) {
  const controller = controllerRef.current;
  ensureEditable(controller);
  expectedRevision(params, controller);
  const slotId = requiredString(params, "slotId");
  if (!Object.prototype.hasOwnProperty.call(params, "entityId"))
    throw new Error("entityId is required; use null to clear a mapping.");
  const rawEntityId = params.entityId;
  let entityId: EntityId | null = null;
  if (rawEntityId !== null) {
    if (typeof rawEntityId !== "string" || !/^[a-z0-9_]+\.[a-z0-9_]+$/i.test(rawEntityId))
      throw new Error("entityId must use exact domain.object syntax or null.");
    entityId = rawEntityId as EntityId;
  }
  const beforeRevision = controller.workspace.getEditRevision();
  const result = controller.connect.assignEntity(slotId, entityId);
  if (result.status === "rejected") throw new Error(result.message);
  if (result.status === "unchanged")
    return {
      operation: "apply_binding",
      workspaceId,
      changed: false,
      persisted: false,
      inspection: inspectionFor(workspaceId, controller),
    };
  return settleMutation(workspaceId, controllerRef, beforeRevision, "apply_binding");
}

export async function applyRoomMapping(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  params: Record<string, unknown>,
) {
  const controller = controllerRef.current;
  ensureEditable(controller);
  expectedRevision(params, controller);
  const roomId = requiredString(params, "roomId");
  if (!Object.prototype.hasOwnProperty.call(params, "areaId"))
    throw new Error("areaId is required; use null to clear a mapping.");
  const rawAreaId = params.areaId;
  let areaId: string | null = null;
  if (rawAreaId !== null) {
    if (typeof rawAreaId !== "string" || !rawAreaId.trim())
      throw new Error("areaId must be a non-empty string or null.");
    areaId = rawAreaId;
  }
  if (params.confirmClearedSlots !== undefined && typeof params.confirmClearedSlots !== "boolean")
    throw new Error("confirmClearedSlots must be a boolean.");
  const beforeRevision = controller.workspace.getEditRevision();
  const result = controller.connect.assignRoomArea(
    roomId,
    areaId,
    params.confirmClearedSlots === true,
  );
  if (result.status === "rejected") throw new Error(result.message);
  if (result.status !== "applied")
    return {
      operation: "apply_room_mapping",
      workspaceId,
      ...result,
      changed: false,
      persisted: false,
      inspection: inspectionFor(workspaceId, controller),
    };
  return settleMutation(workspaceId, controllerRef, beforeRevision, "apply_room_mapping");
}

export async function discardDraft(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  params: Record<string, unknown>,
) {
  const controller = controllerRef.current;
  ensureEditable(controller);
  expectedRevision(params, controller);
  const result = await controller.workspace.resetDraftToPublished();
  if (result.status !== "saved") {
    const detail =
      result.status === "storage-error" ? result.error.message : "The published home is invalid.";
    throw new Error(`The draft could not be discarded: ${detail}`);
  }
  controllerRef.current.replaceEditorsFromProject(result.record.draft);
  return {
    operation: "discard_draft",
    workspaceId,
    changed: true,
    persisted: true,
    inspection: inspectionFor(workspaceId, controllerRef.current, result.record.draft),
  };
}

export async function publishDraft(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  params: Record<string, unknown>,
) {
  const controller = controllerRef.current;
  ensureEditable(controller);
  expectedRevision(params, controller);
  const result = await controller.publishProject(false, () => {
    try {
      return Boolean(controllerRef.current);
    } catch {
      return false;
    }
  });
  if (!result) throw new Error("The draft has blocking issues or the editor is busy.");
  if (result.status !== "published") {
    const detail =
      result.status === "blocked"
        ? result.errors.map((issue) => issue.message).join(" ")
        : result.status === "confirmation-required"
          ? result.warnings.map((issue) => issue.message).join(" ")
          : result.error.message;
    throw new Error(`The draft could not be published: ${detail}`);
  }
  return {
    operation: "publish_draft",
    workspaceId,
    published: true,
    inspection: inspectionFor(workspaceId, controllerRef.current, result.record.published),
  };
}
