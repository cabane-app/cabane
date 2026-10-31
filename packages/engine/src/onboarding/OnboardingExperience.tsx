import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CabaneDashboard } from "../CabaneDashboard";
import { DemoHomeAssistantSession, demoLightVisualManifest } from "../DemoHomeAssistantSession";
import { isNightLighting } from "../lighting";
import { loadLightingMode } from "../walk-preferences";
import { HomeAssistantConnectionFlow } from "../HomeAssistantConnectionFlow";
import {
  HomeAssistantRuntimeValueProvider,
  useHomeAssistantRuntime,
} from "../HomeAssistantRuntime";
import {
  useRuntimeBindingProfile,
  type RuntimeBindingProfileManager,
} from "../RuntimeBindingSetup";
import { useSetupRecord } from "../useSetupRecord";
import type { ArchitectureModelRegistry, DeviceModelRegistry, HomeManifest } from "../types";
import type { BrowserDataImportResult } from "../browser-data-transfer";
import { createLaunchOnboardingState } from "./onboarding-state";
import { OnboardingIntroduction, type OnboardingLinks } from "./OnboardingIntroduction";
import { useFirstControlConfirmation } from "./useFirstControlConfirmation";
import "./onboarding.css";

export interface OnboardingOptions {
  isDemo: boolean;
  welcome: boolean;
  nudgeDismissed: boolean;
  busy: boolean;
  links?: OnboardingLinks;
  start: (path: "connect" | "build") => Promise<void>;
  dismiss: (kind: "welcome" | "nudge") => Promise<void>;
  openWelcome?: () => void;
}

export function CabaneAppExperience({
  manifest,
  architectureModels,
  deviceModels,
  homeAssistantUrl,
  onHomeAssistantUrlChange,
  renderActionBarDeviceIcon,
  walkTools,
  onEditHome,
  onOpenSettings,
  onCustomizeActionBar,
  onHomeAssistantSettings,
  onWorkspaces,
  onImportBrowserData,
  onExportBrowserData,
  bindingManager,
  onOpenConnect,
  constructionApplied = false,
  onboarding,
}: {
  manifest: HomeManifest;
  architectureModels: ArchitectureModelRegistry;
  deviceModels: DeviceModelRegistry;
  walkTools?: readonly import("../walk-tools").WalkToolDefinition[];
  renderActionBarDeviceIcon?: (modelId: string) => ReactNode;
  homeAssistantUrl: string | null;
  onHomeAssistantUrlChange: (url: string | null) => void;
  onEditHome?: ((mode?: "construct" | "furnish" | "connect") => void) | undefined;
  onOpenSettings?: (() => void) | undefined;
  onCustomizeActionBar?: () => void;
  onHomeAssistantSettings?: () => void;
  onWorkspaces?: (() => void) | undefined;
  onImportBrowserData?: (json: string) => BrowserDataImportResult;
  onExportBrowserData?: () => void | Promise<void>;
  bindingManager?: RuntimeBindingProfileManager;
  onOpenConnect?: (view: "rooms" | "devices", roomId?: string | null) => void;
  constructionApplied?: boolean;
  onboarding?: OnboardingOptions | undefined;
}) {
  const runtime = useHomeAssistantRuntime();
  const shell = useRef<HTMLDivElement>(null);
  const manager = useRuntimeBindingProfile(manifest, runtime, bindingManager);
  const { setupState, updateSetupRecord } = useSetupRecord(manifest.home.id, constructionApplied);
  const launch = setupState.record.launch ?? createLaunchOnboardingState();
  const isDemo = onboarding?.isDemo ?? false;
  const [demoNight] = useState(() => isNightLighting(loadLightingMode(), undefined, new Date()));
  const dashboardManifest = useMemo(
    () => (isDemo ? demoLightVisualManifest(manifest) : manifest),
    [isDemo, manifest],
  );
  const [surface, setSurface] = useState<"intro" | "connection" | null>(() =>
    onboarding?.welcome ? "intro" : null,
  );
  const [interacted, setInteracted] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  useEffect(() => {
    if (isDemo) setSurface(onboarding?.welcome ? "intro" : null);
  }, [isDemo, onboarding?.welcome]);
  const confirmed = useCallback(() => {
    updateSetupRecord((record) => ({
      ...record,
      activated: true,
      launch: { ...(record.launch ?? createLaunchOnboardingState()), firstControlConfirmed: true },
    }));
    setSuccess(true);
  }, [updateSetupRecord]);
  const mappedLights = manifest.floors.flatMap((floor) =>
    floor.rooms.flatMap((room) =>
      room.devices.flatMap((device) =>
        device.entitySlots
          .filter(
            (slot) =>
              slot.compatibleDomains.includes("light") &&
              manager.profile.entityIdsBySlotId[slot.id],
          )
          .map((slot) => ({ roomId: room.id, deviceId: device.id, slotId: slot.id })),
      ),
    ),
  );
  const target =
    mappedLights.find((candidate) => candidate.slotId === launch.target?.slotId) ??
    mappedLights[0] ??
    launch.target;
  const targetEntityId = target ? manager.profile.entityIdsBySlotId[target.slotId] : undefined;
  const personalSetup = !isDemo && Boolean(launch.entry === "connect" || launch.entry === "build");
  const observedRuntime = useFirstControlConfirmation(
    runtime,
    personalSetup && !setupState.record.activated && !launch.firstControlConfirmed,
    confirmed,
    manifest.home.id,
    targetEntityId,
  );
  const connect = () => {
    if (onOpenConnect) onOpenConnect("devices", target?.roomId);
    else setSurface("connection");
  };
  const dismissWelcome = () => {
    setSurface(null);
    void onboarding?.dismiss("welcome");
    requestAnimationFrame(() =>
      shell.current?.querySelector<HTMLElement>('summary[aria-label="Open scene menu"]')?.focus(),
    );
  };
  const dashboard = (bindingManager: RuntimeBindingProfileManager) => (
    <CabaneDashboard
      manifest={dashboardManifest}
      architectureModels={architectureModels}
      deviceModels={deviceModels}
      bindingManager={bindingManager}
      renderActionBarDeviceIcon={renderActionBarDeviceIcon}
      walkTools={walkTools}
      sessionPresentation={
        isDemo
          ? {
              mode: "demo",
              label: "Demo",
              detail: "Simulated devices",
              menuDescription:
                "Explore freely. These controls only change simulated devices in this browser.",
            }
          : undefined
      }
      setupAction={
        isDemo
          ? {
              label: "Getting started",
              detail: "Explore the demo or build your home",
              attention: false,
              onOpen: () =>
                onboarding?.openWelcome ? onboarding.openWelcome() : setSurface("intro"),
            }
          : personalSetup && !setupState.record.activated
            ? {
                label: "Continue setup",
                detail: "Connect a device in this home",
                attention: false,
                onOpen: connect,
              }
            : undefined
      }
      setupOpen={surface !== null}
      onWorkspaces={onWorkspaces}
      onHomeAssistantSettings={onHomeAssistantSettings}
      focusRoomId={
        personalSetup && targetEntityId && !setupState.record.activated ? target?.roomId : undefined
      }
      onEditHome={onEditHome}
      onOpenSettings={onOpenSettings}
      onCustomizeActionBar={onCustomizeActionBar}
      onOpenConnect={onOpenConnect}
      onExportBrowserData={onExportBrowserData}
    />
  );
  const nudge = isDemo && interacted && !onboarding?.nudgeDismissed;
  const targetState = targetEntityId ? runtime.entityStates[targetEntityId] : undefined;
  const tryDevice =
    personalSetup &&
    runtime.status === "connected" &&
    Boolean(targetState?.available && !targetState.stale) &&
    !setupState.record.activated &&
    !hintDismissed;
  return (
    <div
      ref={shell}
      className={`cabane-app setup-shell ${surface ? "setup-shell--open onboarding-shell--open" : "setup-shell--closed"}`}
      style={
        {
          "--home-accent": manifest.home.palette.accent,
          "--home-secondary": manifest.home.palette.secondary,
        } as CSSProperties
      }
    >
      <div className="setup-shell__scene">
        {isDemo ? (
          <DemoHomeAssistantSession
            manifest={manifest}
            night={demoNight}
            onInteraction={() => setInteracted(true)}
          >
            {({ manager }) => dashboard(manager)}
          </DemoHomeAssistantSession>
        ) : (
          <HomeAssistantRuntimeValueProvider value={observedRuntime}>
            {dashboard(manager)}
          </HomeAssistantRuntimeValueProvider>
        )}
      </div>
      {surface === "intro" && (
        <OnboardingIntroduction
          links={onboarding?.links}
          busy={onboarding?.busy ?? false}
          error={setupState.warning}
          onExplore={dismissWelcome}
          onBuild={() => void onboarding?.start("build")}
          onDismiss={dismissWelcome}
        />
      )}
      {surface === "connection" && (
        <HomeAssistantConnectionFlow
          homeAssistantUrl={homeAssistantUrl}
          runtime={runtime}
          onHomeAssistantUrlChange={onHomeAssistantUrlChange}
          onImportBrowserData={onImportBrowserData}
          onClose={() => setSurface(null)}
          onDefer={() => setSurface(null)}
        />
      )}
      {!surface && (nudge || success || tryDevice) && (
        <aside className="onboarding-nudge" aria-live="polite">
          <button
            type="button"
            className="onboarding-nudge__dismiss"
            aria-label="Dismiss suggestion"
            onClick={() => {
              void onboarding?.dismiss("nudge");
              setSuccess(false);
              setHintDismissed(true);
            }}
          >
            ×
          </button>
          <strong>
            {success
              ? "Your home is connected."
              : tryDevice
                ? "Try your light."
                : "Ready to build your home?"}
          </strong>
          <p>
            {success
              ? "Keep connecting devices or make this home yours."
              : tryDevice
                ? "Use its control in this room to see your real home respond."
                : "Start with an empty home, then connect your own devices."}
          </p>
          {!tryDevice && (
            <div>
              {success && (
                <button type="button" disabled={onboarding?.busy} onClick={connect}>
                  Connect another device
                </button>
              )}
              <button
                type="button"
                disabled={onboarding?.busy}
                onClick={() =>
                  success ? onEditHome?.("furnish") : void onboarding?.start("build")
                }
              >
                {success ? "Make this home yours" : "Build my home"}
              </button>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
