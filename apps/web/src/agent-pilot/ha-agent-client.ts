import type { Connection } from "home-assistant-js-websocket";
import type { AgentRequest } from "./agent-command-executor";

// Leave room for HA's command envelope below its 4 MiB WebSocket message limit.
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export type AgentPilotConnection = {
  status: "disconnected" | "connecting" | "waiting" | "connected" | "error";
  message: string;
  code?: string;
};
// Keep an old accepted action ahead of a newly paired session, even across editor mounts.
let execution = Promise.resolve();
const stopSubscription = (unsubscribe: (() => Promise<void>) | null) => {
  if (unsubscribe) void unsubscribe().catch(() => undefined);
};

export function createHaAgentClient({
  connection,
  workspaceId,
  execute,
  onConnection,
}: {
  connection: Connection;
  workspaceId: string;
  execute: (request: AgentRequest, isActive: () => boolean) => Promise<unknown>;
  onConnection: (state: AgentPilotConnection) => void;
}) {
  let generation = 0;
  let closed = false;
  let opening = false;
  let sessionId: string | null = null;
  let unsubscribe: (() => Promise<void>) | null = null;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const invalidate = () => {
    generation++;
    opening = false;
    sessionId = null;
    clearTimeout(expiry);
    stopSubscription(unsubscribe);
    unsubscribe = null;
  };
  const disconnected = () => {
    invalidate();
    if (!closed)
      onConnection({
        status: "disconnected",
        message: "The Home Assistant connection closed. Generate a new pairing code.",
      });
  };
  connection.addEventListener("disconnected", disconnected);
  const disconnect = () => {
    invalidate();
    if (!closed) onConnection({ status: "disconnected", message: "Agent disconnected." });
  };
  return {
    async start() {
      if (closed || opening) return;
      invalidate();
      const attempt = generation;
      const active = () => !closed && generation === attempt && connection.connected;
      opening = true;
      onConnection({ status: "connecting", message: "Creating a Home Assistant agent session…" });
      try {
        if (!connection.connected) throw new Error("Home Assistant is disconnected.");
        const subscription = await connection.subscribeMessage<Record<string, unknown>>(
          (event) => {
            if (!active()) return;
            if (event.type === "session") {
              if (
                event.protocolVersion !== "3" ||
                event.workspaceId !== workspaceId ||
                typeof event.sessionId !== "string" ||
                typeof event.code !== "string" ||
                typeof event.pairingExpiresIn !== "number" ||
                event.pairingExpiresIn <= 0
              ) {
                disconnect();
                onConnection({
                  status: "error",
                  message:
                    "Update the Cabane integration and reload Home Assistant before pairing.",
                });
                return;
              }
              sessionId = event.sessionId;
              onConnection({
                status: "waiting",
                message: "Enter this one-use code in the agent terminal within five minutes.",
                code: event.code,
              });
              expiry = setTimeout(
                () => {
                  if (active()) disconnect();
                },
                Math.min(event.pairingExpiresIn, 300) * 1000,
              );
            } else if (event.type === "paired") {
              if (!sessionId) return;
              clearTimeout(expiry);
              onConnection({
                status: "connected",
                message: "Agent connected to this workspace. Keep this editor open.",
              });
            } else if (event.type === "closed") {
              disconnect();
              onConnection({
                status: "disconnected",
                message:
                  typeof event.message === "string" ? event.message : "Agent session closed.",
              });
            } else if (event.type === "request") {
              if (
                !sessionId ||
                typeof event.requestId !== "string" ||
                typeof event.method !== "string"
              )
                return;
              const id = sessionId;
              const request: AgentRequest = {
                requestId: event.requestId,
                method: event.method,
                params: event.params,
              };
              const task = execution.then(async () => {
                if (!active() || sessionId !== id) return;
                let response: Record<string, unknown>;
                try {
                  response = {
                    ok: true,
                    result: await execute(request, () => active() && sessionId === id),
                  };
                  if (
                    new TextEncoder().encode(JSON.stringify(response)).byteLength >
                    MAX_RESPONSE_BYTES
                  )
                    throw new Error(
                      "The command response is too large for the HA relay. The command may have completed; review the draft in the editor before retrying.",
                    );
                } catch (error) {
                  response = {
                    ok: false,
                    error: {
                      message:
                        error instanceof Error
                          ? error.message
                          : "The editor rejected this command.",
                    },
                  };
                }
                if (!active() || sessionId !== id) return;
                try {
                  await connection.sendMessagePromise({
                    type: "cabane/agent/respond",
                    session_id: id,
                    request_id: request.requestId,
                    response,
                  });
                } catch (error) {
                  if (
                    error &&
                    typeof error === "object" &&
                    "code" in error &&
                    error.code === "request_expired"
                  )
                    return;
                  if (active()) disconnected();
                }
              });
              execution = task.catch(() => undefined);
            }
          },
          { type: "cabane/agent/open", workspace_id: workspaceId },
          { resubscribe: false },
        );
        if (active()) unsubscribe = subscription;
        else stopSubscription(subscription);
      } catch {
        if (active()) {
          invalidate();
          onConnection({
            status: "error",
            message:
              "Could not open the agent relay. Update the Cabane integration, reload Home Assistant and try again.",
          });
        }
      } finally {
        if (generation === attempt) opening = false;
      }
    },
    disconnect,
    close() {
      closed = true;
      invalidate();
      connection.removeEventListener("disconnected", disconnected);
    },
  };
}
