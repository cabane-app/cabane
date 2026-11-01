import { useCallback, useEffect, useRef, useState } from "react";
import { useHomeAssistantHostSession } from "@cabane/engine";
import type { useHomeEditorController } from "../editor-workspace/useHomeEditorController";
import { executeAgentRequest } from "./agent-command-executor";
import { createHaAgentClient, type AgentPilotConnection } from "./ha-agent-client";

type EditorController = ReturnType<typeof useHomeEditorController>;
export function useAgentRelay(workspaceId: string, controller: EditorController) {
  const host = useHomeAssistantHostSession();
  const editorRef = useRef({ workspaceId, controller });
  editorRef.current = { workspaceId, controller };
  const clientRef = useRef<ReturnType<typeof createHaAgentClient> | null>(null);
  const [connection, setConnection] = useState<AgentPilotConnection>({
    status: "disconnected",
    message: "Generate a pairing code to connect an agent.",
  });
  const hostConnection = host?.connection;
  useEffect(() => {
    if (!hostConnection) return;
    const client = createHaAgentClient({
      connection: hostConnection,
      workspaceId,
      onConnection: setConnection,
      execute: (request, isActive) =>
        executeAgentRequest(
          workspaceId,
          {
            get current() {
              if (!isActive() || editorRef.current.workspaceId !== workspaceId)
                throw new Error("The agent session is no longer paired with this workspace.");
              return editorRef.current.controller;
            },
          },
          request,
        ),
    });
    clientRef.current = client;
    setConnection({
      status: "disconnected",
      message: "Generate a pairing code to connect an agent.",
    });
    const onPageHide = () => client.disconnect();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      client.close();
      clientRef.current = null;
    };
  }, [hostConnection, workspaceId]);
  const start = useCallback(async () => clientRef.current?.start(), []);
  const disconnect = useCallback(() => clientRef.current?.disconnect(), []);
  return { connection, start, disconnect, host };
}
