import { rememberWorkspace, saveWorkspacePreview } from "./workspace-presentation";
import type { useWorkspaceOnboarding } from "./useWorkspaceOnboarding";
import { onboardingLinks } from "../onboarding-config";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ScenePreviewContext,
  HomeAssistantRuntimeProvider,
  type HomeProjectRecord,
  type WorkspaceRepository,
  type WorkspaceMetadata,
} from "@cabane/engine";
import { ConnectedProduct } from "../ConnectedProduct";
import { createBrowserHomeProjectLifecycle } from "../project-runtime";
import { WorkspaceHaStorageProvider } from "./WorkspaceHaStorage";
import { WorkspaceModelAssetNotice } from "./WorkspaceModelAssetNotice";

export function WorkspaceHost({
  id,
  repository,
  onboarding,
}: {
  id: string;
  repository: WorkspaceRepository;
  onboarding: ReturnType<typeof useWorkspaceOnboarding>;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const capturePreview = useCallback(
    (canvas: HTMLCanvasElement) => saveWorkspacePreview(id, canvas),
    [id],
  );
  const isDemo = onboarding.state?.demoWorkspaceId === id;
  const [lifecycle] = useState(() => createBrowserHomeProjectLifecycle(window.indexedDB, id));
  const [loaded, setLoaded] = useState<{
    record: HomeProjectRecord;
    metadata: WorkspaceMetadata;
    recoveryMessage?: string;
    recoveryRaw?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void repository
      .read(id)
      .then(async (entry) => {
        const result = entry?.record
          ? { status: "ready" as const, record: entry.record }
          : await lifecycle.load();
        if (!active) return;
        if (!entry) {
          setError("This workspace is not saved in this browser.");
          return;
        }
        rememberWorkspace(id);
        setLoaded({
          record: result.record,
          metadata: entry.metadata,
          ...(result.status === "recovery"
            ? { recoveryMessage: result.reason, recoveryRaw: result.raw }
            : {}),
        });
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load this home.");
      });
    return () => {
      active = false;
    };
  }, [id, lifecycle, repository]);
  useEffect(() => {
    let active = true;
    const check = () => {
      void repository
        .read(id)
        .then((entry) => {
          if (!active) return;
          if (!entry) setError("This workspace was deleted in another tab.");
          else if (loaded && entry.metadata.homeAssistantUrl !== loaded.metadata.homeAssistantUrl)
            setError(
              "This workspace's connection changed in another tab. Reopen it from Workspaces.",
            );
        })
        .catch(() => {
          if (active) setError("Could not verify this workspace. Reopen it from Workspaces.");
        });
    };
    window.addEventListener("focus", check);
    return () => {
      active = false;
      window.removeEventListener("focus", check);
    };
  }, [id, repository, loaded]);
  if (error)
    return (
      <main className="direction-project-loading is-error">
        <strong>Could not open this workspace.</strong>
        <p>{error}</p>
        <Link to="/workspaces?import=home-assistant">Open from Home Assistant</Link>
        <Link to="/workspaces">Workspaces</Link>
      </main>
    );
  if (!loaded) return <main className="direction-project-loading">Loading your home…</main>;
  return (
    <ScenePreviewContext.Provider value={capturePreview}>
      <HomeAssistantRuntimeProvider
        hostSession={isDemo ? null : undefined}
        homeAssistantUrl={isDemo ? null : loaded.metadata.homeAssistantUrl}
      >
        <WorkspaceHaStorageProvider
          id={id}
          origin={loaded.metadata.homeAssistantUrl}
          repository={repository}
          hidden={isDemo}
        >
          <WorkspaceModelAssetNotice record={loaded.record} id={id} />
          <ConnectedProduct
            onboarding={{
              isDemo,
              welcome: isDemo && location.pathname === "/welcome",
              nudgeDismissed: onboarding.state?.nudgeDismissed ?? true,
              busy: onboarding.busy,
              start: onboarding.start,
              dismiss: async (kind) => {
                if (kind === "welcome") void navigate("/demo");
                await onboarding.dismiss(kind);
              },
              openWelcome: () => void navigate("/welcome"),
              links: onboardingLinks,
            }}
            record={loaded.record}
            lifecycle={lifecycle}
            recoveryMessage={loaded.recoveryMessage}
            recoveryRaw={loaded.recoveryRaw}
            homeAssistantUrl={loaded.metadata.homeAssistantUrl}
            onHomeAssistantUrlChange={async (url, current) => {
              const entry = await repository.setConnection(
                id,
                (current ?? loaded.record).revision,
                url,
              );
              if (!entry.record) throw new Error("Could not save the connection.");
              setLoaded((previous) =>
                previous
                  ? { ...previous, metadata: entry.metadata, record: entry.record! }
                  : previous,
              );
              return entry.record;
            }}
          />
        </WorkspaceHaStorageProvider>
      </HomeAssistantRuntimeProvider>
    </ScenePreviewContext.Provider>
  );
}
