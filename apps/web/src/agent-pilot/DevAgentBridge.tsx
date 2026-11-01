import { useEffect, useRef } from "react";
import { executeAgentRequest, type AgentRequest } from "./agent-command-executor";
import { waitUntil, type EditorController } from "./agent-command-support";

declare global {
  interface Window {
    cabaneDevAgent?: (request: AgentRequest) => Promise<unknown>;
  }
}

/** Mounted only by the opt-in local development runner. */
export function DevAgentBridge({ controller }: { controller: EditorController }) {
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const workspaceId = controller.snapshot.project.home.id;
  useEffect(() => {
    let active = true;
    const bridge = async (request: AgentRequest) => {
      await waitUntil(
        () => !controllerRef.current.unsettled && !controllerRef.current.editingLocked,
      );
      return executeAgentRequest(
        workspaceId,
        {
          get current() {
            if (!active) throw new Error("The development editor was closed.");
            return controllerRef.current;
          },
        },
        request,
      );
    };
    window.cabaneDevAgent = bridge;
    return () => {
      active = false;
      if (window.cabaneDevAgent === bridge) delete window.cabaneDevAgent;
    };
  }, [workspaceId]);
  return null;
}
