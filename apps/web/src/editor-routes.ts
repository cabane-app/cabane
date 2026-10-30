import { matchRoutes } from "react-router";
import type { EditorOpenRequest } from "./editor-connect/connect-navigation";

export const editorRoutes = [
  { path: "/build", handle: { mode: "construct" } },
  {
    path: "/workspaces/:workspaceId/shortcuts",
    handle: { mode: "construct", panel: "action-bar" },
  },
  {
    path: "/workspaces/:workspaceId/action-bar",
    handle: { mode: "construct", panel: "action-bar" },
  },
  { path: "/workspaces/:workspaceId/construct", handle: { mode: "construct" } },
  { path: "/workspaces/:workspaceId/arrange", handle: { mode: "furnish" } },
  { path: "/workspaces/:workspaceId/connect", handle: { mode: "connect" } },
  { path: "/workspaces/:workspaceId/connect/rooms", handle: { mode: "connect", view: "rooms" } },
  {
    path: "/workspaces/:workspaceId/connect/devices",
    handle: { mode: "connect", view: "devices" },
  },
] satisfies { path: string; handle: EditorOpenRequest }[];

export function editorRequestForPath(pathname: string): EditorOpenRequest | null {
  return matchRoutes(editorRoutes, pathname)?.[0].route.handle ?? null;
}

export function workspaceHomePath(workspaceId: string): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}`;
}

export function agentPilotPath(workspaceId: string): string {
  return `${workspaceHomePath(workspaceId)}/construct?agent-pilot=1`;
}

export function agentPilotRequested(search: string): boolean {
  return new URLSearchParams(search).get("agent-pilot") === "1";
}

export function workspaceIdForPath(pathname: string): string | null {
  return (
    matchRoutes([{ path: "/workspaces/:workspaceId/*" }], pathname)?.[0].params.workspaceId ?? null
  );
}

export function editorPath(request: EditorOpenRequest, workspaceId: string): string {
  const base = workspaceHomePath(workspaceId);
  if (request.panel === "home-assistant") return `${base}/home-assistant`;
  if (request.panel === "action-bar") return `${base}/shortcuts`;
  if (request.mode === "construct") return `${base}/construct`;
  if (request.mode === "furnish") return `${base}/arrange`;
  return request.relationshipId
    ? `${base}/connect/devices`
    : request.view
      ? `${base}/connect/${request.view}`
      : `${base}/connect`;
}

/** Editor history is shared only within the same home; all other exits save. */
export function shouldFlushEditorExit(workspaceId: string, nextPath: string): boolean {
  return !editorRequestForPath(nextPath) || workspaceIdForPath(nextPath) !== workspaceId;
}
