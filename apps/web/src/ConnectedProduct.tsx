import { useWorkspaceToolStorage } from "./workspaces/useWorkspaceToolStorage";
import { installedWalkTools } from "./walk-tools";
import { HomeAssistantPage } from "./workspaces/HomeAssistantPage";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { stableArchitectureModelRegistry } from "@cabane/catalog/architecture";
import {
  WalkToolStorageProvider,
  useHomeAssistantHostSession,
  FloorNavigationProvider,
  CabaneAppExperience,
  createEmptyRuntimeBindingProfile,
  normalizeWorkspaceBindingOrigin,
  resolveProjectModels,
  type HomeProjectLifecycle,
  type HomeProjectRecord,
  type OnboardingOptions,
} from "@cabane/engine";
import { composeOwnerProjectManifest, ownerProjectRegistries } from "./project-runtime";
import type { EditorOpenRequest } from "./editor-connect/useConnectEditor";
import { downloadConnectData } from "./editor-connect/profile-transfer";
import { CONNECT_RETURN_KEY, readEditorReturn } from "./editor-connect/connect-navigation";
import { editorPath, editorRoutes, workspaceHomePath } from "./editor-routes";
import { exportWorkspaceBackup } from "./workspaces/workspace-transfer";
import { RoutedHomeEditor } from "./RoutedHomeEditor";
import {
  ShortcutDeviceIcon,
  ShortcutThumbnailSurface,
} from "./editor-action-bar/ShortcutDeviceIcon";

export function ConnectedProduct({
  record: initialRecord,
  lifecycle,
  homeAssistantUrl,
  onHomeAssistantUrlChange,
  recoveryMessage,
  recoveryRaw,
  initialRequest,
  onboarding,
}: {
  record: HomeProjectRecord;
  lifecycle: HomeProjectLifecycle;
  homeAssistantUrl: string | null;
  onHomeAssistantUrlChange: (
    url: string | null,
    current?: HomeProjectRecord,
  ) => void | Promise<HomeProjectRecord | void>;
  recoveryMessage?: string | undefined;
  recoveryRaw?: string | undefined;
  initialRequest?: EditorOpenRequest;
  onboarding?: OnboardingOptions;
}) {
  const [record, setRecord] = useState(initialRecord);
  const publishedManifest = useMemo(
    () => (record.publishedAt === 0 ? null : composeOwnerProjectManifest(record.published)),
    [record.published, record.publishedAt],
  );
  const publishedDeviceModels = useMemo(
    () => resolveProjectModels(record.published, ownerProjectRegistries).deviceModels,
    [record.published],
  );
  const [recovery, setRecovery] = useState({ message: recoveryMessage, raw: recoveryRaw });
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const toolStorage = useWorkspaceToolStorage(record, setRecord, setConnectionError);
  const [constructionApplied, setConstructionApplied] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const hostSession = useHomeAssistantHostSession();
  const [entryRequest] = useState<EditorOpenRequest | null>(
    () => initialRequest ?? (hostSession ? null : readEditorReturn(initialRecord.homeId)),
  );
  // Consume the entry redirect on mount; later route changes belong to the user.
  const restoreEntry = useEffectEvent(() => {
    if (entryRequest) {
      // Preserve OAuth query parameters until the runtime has consumed them.
      const search = new URLSearchParams(location.search);
      if (entryRequest.destination) search.set("action", entryRequest.destination);
      void navigate(
        `${editorPath(entryRequest, record.homeId)}${search.size ? `?${search}` : ""}`,
        { replace: true, state: { editorRequest: entryRequest } },
      );
      window.sessionStorage.removeItem(CONNECT_RETURN_KEY);
    }
  });
  useEffect(() => {
    restoreEntry();
  }, []);
  const openEditor = async (request: EditorOpenRequest) => {
    await toolStorage.flush();
    const path = editorPath(request, record.homeId);
    void navigate(path, { state: { editorRequest: request } });
  };
  const origin = homeAssistantUrl ? normalizeWorkspaceBindingOrigin(homeAssistantUrl) : null;
  const manager = useMemo(
    () => ({
      profile:
        (origin ? record.bindings[origin]?.published : undefined) ??
        createEmptyRuntimeBindingProfile(record.homeId),
      saveWeatherSource: origin
        ? (source: import("@cabane/engine").WeatherSource) =>
            toolStorage.saveWeatherSource(origin, source)
        : undefined,
      loaded: true,
      hasStoredProfile: Boolean(origin && record.bindings[origin]),
      // The controlled real dashboard can never activate independent mappings.
      save: () => undefined,
    }),
    [origin, record, toolStorage],
  );
  const editor = (
    <RoutedHomeEditor
      initialRecord={record}
      lifecycle={lifecycle}
      recoveryMessage={recovery.message}
      recoveryRaw={recovery.raw}
      homeAssistantUrl={homeAssistantUrl}
      onPrepareOrigin={async (current, url) => {
        const next = await onHomeAssistantUrlChange(url, current);
        const updated = next ?? current;
        setRecord(updated);
        return updated;
      }}
      onClose={(next, reason) => {
        setRecovery({ message: undefined, raw: undefined });
        setRecord(next);
        setConstructionApplied(reason === "applied");
        window.sessionStorage.removeItem(CONNECT_RETURN_KEY);
      }}
    />
  );
  const home =
    record.publishedAt === 0 ? (
      <Navigate to={editorPath({ mode: "construct" }, record.homeId)} replace />
    ) : (
      <WalkToolStorageProvider storage={toolStorage.storage}>
        <ShortcutThumbnailSurface>
          <CabaneAppExperience
            manifest={publishedManifest!}
            architectureModels={stableArchitectureModelRegistry}
            onboarding={onboarding}
            walkTools={installedWalkTools}
            deviceModels={publishedDeviceModels}
            homeAssistantUrl={homeAssistantUrl}
            onHomeAssistantUrlChange={(url) => {
              setConnectionError(null);
              void Promise.resolve()
                .then(() => onHomeAssistantUrlChange(url, record))
                .then((next) => {
                  if (next) setRecord(next);
                })
                .catch((error) =>
                  setConnectionError(
                    error instanceof Error
                      ? error.message
                      : "Connection settings could not be saved.",
                  ),
                );
            }}
            onHomeAssistantSettings={() =>
              void navigate(`${workspaceHomePath(record.homeId)}/home-assistant`)
            }
            onWorkspaces={() => void navigate("/workspaces")}
            renderActionBarDeviceIcon={(modelId) => (
              <ShortcutDeviceIcon modelId={modelId} models={publishedDeviceModels} />
            )}
            bindingManager={manager}
            constructionApplied={constructionApplied}
            onEditHome={(mode = "construct") => {
              void openEditor({ mode });
            }}
            onCustomizeActionBar={() => {
              void openEditor({ mode: "construct", panel: "action-bar" });
            }}
            onOpenConnect={(view, roomId) => {
              void openEditor({
                mode: "connect",
                view,
                ...(roomId === undefined ? {} : { roomId: roomId }),
              });
            }}
            onExportBrowserData={() =>
              downloadConnectData(
                exportWorkspaceBackup(
                  {
                    name: record.draft.home.name,
                    homeAssistantUrl,
                    hasPublished: record.publishedAt !== 0,
                  },
                  record,
                ),
                `${record.homeId}-private-workspace.json`,
              )
            }
          />
        </ShortcutThumbnailSurface>
      </WalkToolStorageProvider>
    );
  return (
    <FloorNavigationProvider key={record.homeId}>
      {connectionError && (
        <div className="workspace-connection-error" role="alert">
          {connectionError}
          <button type="button" onClick={() => setConnectionError(null)}>
            Dismiss
          </button>
        </div>
      )}
      <Routes>
        <Route path="/welcome" element={home} />
        <Route path="/demo" element={home} />
        <Route path="/workspaces/:workspaceId" element={home} />
        <Route
          path="/workspaces/:workspaceId/home-assistant"
          element={
            <HomeAssistantPage
              record={record}
              lifecycle={lifecycle}
              origin={homeAssistantUrl}
              onChangeOrigin={async (url) => {
                const next = await onHomeAssistantUrlChange(url, record);
                if (next) setRecord(next);
              }}
              onRecordChange={setRecord}
              isDemo={onboarding?.isDemo ?? false}
              onCreatePersonal={() => {
                void onboarding?.start("connect");
              }}
            />
          }
        />
        <Route
          path="/workspaces/:workspaceId/mobile-editor"
          element={
            <Navigate
              to={editorPath(
                {
                  mode:
                    new URLSearchParams(location.search).get("mode") === "arrange"
                      ? "furnish"
                      : "construct",
                },
                record.homeId,
              )}
              replace
            />
          }
        />
        {editorRoutes.map(({ path }) => (
          <Route key={path} path={path} element={editor} />
        ))}
        <Route path="*" element={<Navigate to={workspaceHomePath(record.homeId)} replace />} />
      </Routes>
    </FloorNavigationProvider>
  );
}
