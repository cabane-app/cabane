import { composeHomeBindingManifest } from "@cabane/engine";
import { useEffect } from "react";
import type { ConnectWorkspaceProps } from "./editor-workspace-contract";

import {
  useHomeAssistantHostSession,
  useHomeAssistantRuntime,
  validateWorkspaceBindings,
} from "@cabane/engine";

import { ownerProjectExtensions } from "../project-runtime";

import { useMemo } from "react";

import { type EditorMode } from "../editor-chrome/EditorModeNav";

import { useEditorWorkspace } from "../editor-preview/useEditorWorkspace";

import { useConnectEditor, type EditorOpenRequest } from "../editor-connect/useConnectEditor";

import { CONNECT_RETURN_KEY, type EditorCameraState } from "../editor-connect/connect-navigation";

import { useConnectSignIn } from "../editor-connect/useConnectSignIn";
import { addReadingToSnapshot } from "../editor-connect/add-reading";

type Options = {
  workspace: ReturnType<typeof useEditorWorkspace>;
  activeFloorId: string;
  runtime: ReturnType<typeof useHomeAssistantRuntime>;
  mode: EditorMode;
  editingLocked: boolean;
  unsettled: boolean;
  publishOpen: boolean;
  initialRequest: ConnectWorkspaceProps["initialRequest"];
  navigation: ConnectWorkspaceProps["navigation"];
  homeAssistantUrl: string | null;
  onPrepareOrigin: ConnectWorkspaceProps["onPrepareOrigin"];
  savedCamera: React.RefObject<EditorCameraState | null>;
  furnishingEditorSelectedId: string | null;
  setConnectionBusy: React.Dispatch<React.SetStateAction<boolean>>;
  homeId: string;
  replaceEditorsFromProject: (project: import("@cabane/engine").HomeProject) => void;
};
export function useEditorConnection({
  workspace,
  activeFloorId,
  runtime,
  mode,
  editingLocked,
  unsettled,
  publishOpen,
  initialRequest,
  navigation,
  homeAssistantUrl,
  onPrepareOrigin,
  savedCamera,
  furnishingEditorSelectedId,
  setConnectionBusy,
  homeId,
  replaceEditorsFromProject,
}: Options) {
  const {
    snapshot,
    commit,
    flush,
    getRecord: workspaceGetRecord,
    adoptRecord: workspaceAdoptRecord,
  } = workspace;
  const connectManifest = useMemo(
    () => composeHomeBindingManifest(snapshot.project, ownerProjectExtensions),
    [snapshot.project],
  );
  const connectFloor =
    connectManifest.floors.find((f) => f.id === activeFloorId) ?? connectManifest.floors[0];
  const connect = useConnectEditor({
    manifest: connectManifest,
    floorId: activeFloorId,
    bindings: snapshot.bindings,
    runtime,
    origin: homeAssistantUrl,
    active: mode === "connect" && !editingLocked && !unsettled && !publishOpen,
    onChange: (bindings) => commit({ ...snapshot, bindings }),
    onAddReading: (itemId, entityId, presentation) => {
      if (editingLocked || unsettled || publishOpen) return;
      const next = addReadingToSnapshot(snapshot, itemId, entityId, runtime, presentation);
      if (next) {
        replaceEditorsFromProject(next.project);
        commit(next);
      }
    },
    ...(initialRequest === undefined ? {} : { initialRequest: initialRequest }),
    ...(navigation?.request.view === undefined ? {} : { routeView: navigation?.request.view }),
    onViewChange: navigation ? (view) => navigation.go({ mode: "connect", view }) : undefined,
  });
  const {
    issues: connectIssues,
    view: connectView,
    roomId: connectRoomId,
    relationshipId: connectRelationshipId,
  } = connect;
  const { selectRelationship: connectSelectRelationship, defaultView: connectDefaultView } =
    connect;
  useEffect(() => {
    if (
      navigation?.request.mode === "connect" &&
      !navigation.request.panel &&
      !navigation.request.view
    ) {
      connectSelectRelationship(null);
      navigation.go({ ...navigation.request, view: connectDefaultView }, true);
    }
  }, [navigation, connectDefaultView, connectSelectRelationship]);

  const hostSession = useHomeAssistantHostSession();
  const signIn = useConnectSignIn(runtime, async (origin) => {
    setConnectionBusy(true);
    try {
      const saved = await flush();
      if (saved.status !== "saved")
        throw new Error("The draft could not be saved. Sign-in has not started.");
      if (origin !== homeAssistantUrl) {
        if (!onPrepareOrigin)
          throw new Error("Connection settings are unavailable in this preview.");
        const next = await onPrepareOrigin(workspaceGetRecord(), origin);
        if (!workspaceAdoptRecord(next))
          throw new Error("The workspace changed while connecting. Reopen Connect to retry.");
      }
      if (hostSession) return;
      const request: EditorOpenRequest = {
        floorId: activeFloorId,
        mode: "connect",
        view: connectView,
        roomId: connectRoomId,
        relationshipId: connectRelationshipId,
        arrange: {
          selectedItemId: furnishingEditorSelectedId,
          ...(savedCamera.current ? { camera: savedCamera.current } : {}),
        },
      };
      try {
        window.sessionStorage.setItem(
          CONNECT_RETURN_KEY,
          JSON.stringify({ ...request, workspaceId: homeId }),
        );
      } catch {
        throw new Error(
          "The sign-in return could not be saved in this browser. Allow session storage and try again.",
        );
      }
    } finally {
      setConnectionBusy(false);
    }
  });
  const bindingIssues = useMemo(
    () => [
      ...validateWorkspaceBindings(
        snapshot.bindings,
        connectManifest,
        composeHomeBindingManifest(workspaceGetRecord().published, ownerProjectExtensions),
      ),
      ...connectIssues,
    ],
    [snapshot.bindings, connectManifest, workspaceGetRecord, connectIssues],
  );
  return { connect, connectManifest, connectFloor, signIn, bindingIssues };
}
