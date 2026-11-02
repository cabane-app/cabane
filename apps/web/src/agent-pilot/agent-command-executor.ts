import { serializeCanonicalJson } from "@cabane/engine";
import { AGENT_ACTIONS, AGENT_CAPABILITIES, AGENT_READ_METHODS } from "./agent-command-contract";
import {
  changedProjectSections,
  inspectionFor,
  objectParams,
  type AgentControllerRef,
  type AgentRequest,
  PROTOCOL_VERSION,
} from "./agent-command-support";
import { executeAction } from "./agent-action-executor";
import { listBindingSlots, listCatalog } from "./agent-command-operations";

export type { AgentRequest } from "./agent-command-support";

export async function executeAgentRequest(
  workspaceId: string,
  controllerRef: AgentControllerRef,
  request: AgentRequest,
) {
  const controller = controllerRef.current;
  if (request.method === "get_capabilities")
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: AGENT_CAPABILITIES,
      methods: AGENT_READ_METHODS,
      actions: AGENT_ACTIONS,
    };
  if (request.method === "inspect_workspace") return inspectionFor(workspaceId, controller);
  if (request.method === "validate_draft") {
    const inspection = inspectionFor(workspaceId, controller);
    const errors = inspection.validation.filter((issue) => issue.severity !== "warning");
    return {
      protocolVersion: PROTOCOL_VERSION,
      workspaceId,
      valid: errors.length === 0,
      errorCount: errors.length,
      warningCount: inspection.validation.length - errors.length,
      issues: inspection.validation,
    };
  }
  if (request.method === "get_draft_diff") {
    const record = controller.workspace.getRecord();
    const sections = changedProjectSections(controller.snapshot.project, record.published);
    return {
      protocolVersion: PROTOCOL_VERSION,
      workspaceId,
      draftChanged: sections.length > 0,
      changedProjectSections: sections,
      bindingsChanged: Object.values(controller.snapshot.bindings).some(
        (state) => serializeCanonicalJson(state.draft) !== serializeCanonicalJson(state.published),
      ),
      draftRevision: controller.workspace.getEditRevision(),
      publishedAt: record.publishedAt,
    };
  }
  if (request.method === "list_catalog") return listCatalog(controller);
  if (request.method === "list_binding_slots") return listBindingSlots(controller);
  if (request.method === "execute_action")
    return executeAction(workspaceId, controllerRef, objectParams(request.params));
  throw new Error(`Unsupported agent method: ${request.method}`);
}
