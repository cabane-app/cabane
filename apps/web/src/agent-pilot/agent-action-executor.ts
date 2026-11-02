import {
  AGENT_ARRANGE_ACTIONS,
  AGENT_CONSTRUCT_ACTIONS,
  AGENT_FLOOR_ACTIONS,
} from "./agent-command-contract";
import {
  applyBinding,
  applyRoomMapping,
  discardDraft,
  executeArrange,
  executeConstruct,
  executeFloorOperation,
  publishDraft,
} from "./agent-command-operations";
import {
  activeFloor,
  ensureEditable,
  expectedRevision,
  inspectionFor,
  objectParams,
  optionalString,
  requiredString,
  settleMutation,
  waitUntil,
  type AgentControllerRef,
} from "./agent-command-support";

async function selectFloor(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  params: Record<string, unknown>,
) {
  const controller = controllerRef.current;
  ensureEditable(controller);
  expectedRevision(params, controller);
  const floorId = requiredString(params, "floorId");
  if (!controller.snapshot.project.floors.some((floor) => floor.id === floorId))
    throw new Error(`Floor ${floorId} was not found in this workspace.`);
  controller.floorNavigation.selectFloor(floorId, "target");
  const selected = await waitUntil(() => controllerRef.current.activeFloorId === floorId);
  if (!selected) throw new Error(`The editor did not select floor ${floorId}.`);
  return {
    operation: "select-floor",
    workspaceId,
    inspection: inspectionFor(workspaceId, controllerRef.current),
  };
}

async function renameRoom(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  params: Record<string, unknown>,
) {
  const controller = controllerRef.current;
  ensureEditable(controller);
  const roomId = requiredString(params, "roomId");
  const name = requiredString(params, "name");
  const floor = activeFloor(controller, optionalString(params, "floorId"));
  const room = floor.rooms.find((room) => room.id === roomId);
  if (!room) throw new Error(`Room ${roomId} was not found on the active floor.`);
  expectedRevision(params, controller);
  const beforeRevision = controller.workspace.getEditRevision();
  controller.constructEditor.updateRoom(roomId, { name });
  const updated = await waitUntil(
    () =>
      controllerRef.current.snapshot.project.floors
        .find((candidate) => candidate.id === floor.id)
        ?.rooms.some(
          (candidateRoom) => candidateRoom.id === roomId && candidateRoom.name === name,
        ) ?? false,
  );
  if (!updated) throw new Error("The editor did not settle the room edit.");
  const settled = await settleMutation(workspaceId, controllerRef, beforeRevision, "rename-room");
  return {
    ...settled,
    operation: "rename-room",
    workspaceId,
    roomId,
    previousName: room.name,
    name,
  };
}

async function historyAction(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  action: "undo" | "redo",
  params: Record<string, unknown>,
) {
  const controller = controllerRef.current;
  ensureEditable(controller);
  expectedRevision(params, controller);
  const canChange = action === "undo" ? controller.workspace.canUndo : controller.workspace.canRedo;
  const beforeRevision = controller.workspace.getEditRevision();
  const next = action === "undo" ? controller.undoProject() : controller.redoProject();
  if (canChange && next) {
    const settled = await settleMutation(workspaceId, controllerRef, beforeRevision, action);
    return { ...settled, operation: action, workspaceId };
  }
  return {
    operation: action,
    workspaceId,
    changed: false,
    persisted: false,
    inspection: inspectionFor(workspaceId, controllerRef.current, next?.project),
  };
}

export async function executeAction(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  params: Record<string, unknown>,
) {
  const action = objectParams(params.action);
  const type = requiredString(action, "type");

  if (AGENT_CONSTRUCT_ACTIONS.has(type)) {
    const floorId = optionalString(action, "floorId");
    const constructAction = Object.fromEntries(
      Object.entries(action).filter(([key]) => key !== "floorId"),
    );
    return executeConstruct(workspaceId, controllerRef, {
      ...params,
      ...(floorId === undefined ? {} : { floorId }),
      action: constructAction,
    });
  }

  if (AGENT_FLOOR_ACTIONS.has(type)) {
    return executeFloorOperation(workspaceId, controllerRef, { ...params, action });
  }

  if (AGENT_ARRANGE_ACTIONS.has(type)) {
    const floorId = optionalString(action, "floorId");
    return executeArrange(workspaceId, controllerRef, {
      ...params,
      ...(floorId === undefined ? {} : { floorId }),
      action,
    });
  }

  if (type === "select-floor")
    return selectFloor(workspaceId, controllerRef, {
      ...action,
      expectedRevision: params.expectedRevision,
    });
  if (type === "apply-binding")
    return applyBinding(workspaceId, controllerRef, { ...params, ...action });
  if (type === "apply-room-mapping")
    return applyRoomMapping(workspaceId, controllerRef, { ...params, ...action });
  if (type === "discard-draft") return discardDraft(workspaceId, controllerRef, params);
  if (type === "publish-draft") return publishDraft(workspaceId, controllerRef, params);
  if (type === "rename-room")
    return renameRoom(workspaceId, controllerRef, { ...params, ...action });
  if (type === "undo" || type === "redo")
    return historyAction(workspaceId, controllerRef, type, params);
  throw new Error(`Unsupported agent action: ${type}.`);
}
