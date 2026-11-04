import { useEffect, useRef } from "react";
import { executeAgentRequest, type AgentRequest } from "./agent-command-executor";
import { ensureEditable, waitUntil, type EditorController } from "./agent-command-support";

declare global {
  interface Window {
    cabaneDevAgent?: (request: AgentRequest) => Promise<unknown>;
    cabaneDevPrepareCapture?: () => Promise<void>;
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
    const prepareCapture = async () => {
      if (!active) throw new Error("The development editor was closed.");
      ensureEditable(controllerRef.current);
      controllerRef.current.selectMode("furnish");
      controllerRef.current.setCameraView("3d");
      controllerRef.current.clearFurnishingSelection();
      const ready = await waitUntil(
        () =>
          controllerRef.current.mode === "furnish" &&
          controllerRef.current.cameraView === "3d" &&
          !controllerRef.current.unsettled,
      );
      if (!ready) throw new Error("The editor did not settle its capture view.");
    };
    window.cabaneDevAgent = bridge;
    window.cabaneDevPrepareCapture = prepareCapture;
    return () => {
      active = false;
      if (window.cabaneDevAgent === bridge) delete window.cabaneDevAgent;
      if (window.cabaneDevPrepareCapture === prepareCapture) delete window.cabaneDevPrepareCapture;
    };
  }, [workspaceId]);
  return null;
}
