import { lazy, Suspense, useMemo, useRef, type ComponentProps } from "react";
import { useBlocker, useLocation, useNavigate } from "react-router";
import {
  editorPath,
  agentPilotRequested,
  editorRequestForPath,
  workspaceHomePath,
  shouldFlushEditorExit,
} from "./editor-routes";
import type { EditorOpenRequest } from "./editor-connect/connect-navigation";

const HomeEditor = lazy(() =>
  import("./HomeEditor").then((module) => ({ default: module.HomeEditor })),
);

export function RoutedHomeEditor({ onClose, ...props }: ComponentProps<typeof HomeEditor>) {
  const location = useLocation();
  const navigate = useNavigate();
  const request = useMemo(
    () =>
      ({
        ...(location.state as { editorRequest?: EditorOpenRequest } | null)?.editorRequest,
        ...editorRequestForPath(location.pathname),
      }) as EditorOpenRequest,
    [location.pathname, location.state],
  );
  const agentPilotOpen = agentPilotRequested(location.search);
  const closeAgentPilot = () => {
    const search = new URLSearchParams(location.search);
    search.delete("agent-pilot");
    void navigate(`${location.pathname}${search.size ? `?${search}` : ""}`, {
      replace: true,
    });
  };
  // Browser Back must save the draft just like the editor's Home button.
  const allowExit = useRef(false);
  const blocker = useBlocker(
    ({ nextLocation }) =>
      !allowExit.current &&
      shouldFlushEditorExit(props.initialRecord.homeId, nextLocation.pathname),
  );
  const go = (next: EditorOpenRequest, replace = false) => {
    void navigate(editorPath(next, props.initialRecord.homeId), {
      replace,
      state: { editorRequest: next },
    });
  };
  return (
    <Suspense fallback={<main className="direction-project-loading">Opening the editor…</main>}>
      <HomeEditor
        {...props}
        agentPilotOpen={agentPilotOpen}
        onAgentPilotClose={closeAgentPilot}
        initialRequest={request}
        onWorkspaces={() => void navigate("/workspaces")}
        onHomeAssistantSettings={() =>
          go({ mode: "construct", panel: "settings", settingsSection: "home-assistant" })
        }
        onRecoveryWorkspaces={() => {
          allowExit.current = true;
          void navigate("/workspaces");
        }}
        navigation={{
          request,
          go,
          exitRequested: blocker.state === "blocked",
          cancelExit: () => {
            if (blocker.state === "blocked") blocker.reset();
          },
        }}
        onClose={(record, reason) => {
          allowExit.current = true;
          onClose(record, reason);
          if (blocker.state === "blocked") blocker.proceed();
          else void navigate(workspaceHomePath(props.initialRecord.homeId));
        }}
      />
    </Suspense>
  );
}
