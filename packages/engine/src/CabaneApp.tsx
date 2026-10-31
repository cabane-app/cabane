import { useMemo, useState } from "react";
import { CabaneDashboard } from "./CabaneDashboard";
import { neutralDemoManifest } from "./demo";
export { validateHomeAssistantUrlInput } from "./HomeAssistantConnectionFlow";
import { loadStoredHomeAssistantUrl, saveStoredHomeAssistantUrl } from "./home-assistant-auth";
import { HomeAssistantRuntimeProvider } from "./HomeAssistantRuntime";
import type { ArchitectureModelRegistry, DeviceModelRegistry, HomeManifest } from "./types";
import { validateHomeManifest } from "./validation";
import { exportCabaneBrowserData, importCabaneBrowserData } from "./browser-data-transfer";

const ONBOARDING_STORAGE_PREFIX = "cabane:onboarding:v1";
const MODELING_NUDGE_STORAGE_PREFIX = "cabane:modeling-nudge:v1";
const LEGACY_ONBOARDING_STORAGE_PREFIX = "smart-home-3d:onboarding:v1";
const LEGACY_MODELING_NUDGE_STORAGE_PREFIX = "smart-home-3d:modeling-nudge:v1";
const storageKey = (prefix: string, homeId: string) => `${prefix}:${homeId}`;

const legacyCompletionKey = (key: string) =>
  key
    .replace(ONBOARDING_STORAGE_PREFIX, LEGACY_ONBOARDING_STORAGE_PREFIX)
    .replace(MODELING_NUDGE_STORAGE_PREFIX, LEGACY_MODELING_NUDGE_STORAGE_PREFIX);

export const loadStoredCompletionFlag = (
  storage: Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">>,
  key: string,
) => {
  try {
    const current = storage.getItem(key);
    if (current === "complete") return true;
    if (current !== null) return false;
    const legacy = storage.getItem(legacyCompletionKey(key));
    if (legacy !== "complete") return false;
    storage.setItem?.(key, "complete");
    return true;
  } catch {
    return false;
  }
};

export const onboardingStorageKey = (homeId: string) =>
  storageKey(ONBOARDING_STORAGE_PREFIX, homeId);
export const modelingNudgeStorageKey = (homeId: string) =>
  storageKey(MODELING_NUDGE_STORAGE_PREFIX, homeId);

const initialStoredUrl = () =>
  typeof window === "undefined" ? null : loadStoredHomeAssistantUrl(window.localStorage);

export { CabaneAppExperience } from "./onboarding/OnboardingExperience";
import { CabaneAppExperience } from "./onboarding/OnboardingExperience";
export type { OnboardingOptions } from "./onboarding/OnboardingExperience";

export function CabaneApp({
  manifest,
  architectureModels,
  deviceModels = {},
  onEditHome,
  onWorkspaces,
  constructionApplied = false,
}: {
  manifest: HomeManifest | null;
  architectureModels: ArchitectureModelRegistry;
  deviceModels?: DeviceModelRegistry;
  onEditHome?: (mode?: "construct" | "furnish" | "connect") => void;
  onWorkspaces?: () => void;
  /** A successful editor Apply completed before this Home surface was mounted. */
  constructionApplied?: boolean;
}) {
  const activeManifest = manifest ?? neutralDemoManifest;
  const validation = useMemo(
    () => validateHomeManifest(activeManifest, { deviceModels }),
    [activeManifest, deviceModels],
  );
  const [homeAssistantUrl, setHomeAssistantUrl] = useState(initialStoredUrl);
  const exportBrowserData = () => {
    if (typeof window === "undefined") return;
    const contents = exportCabaneBrowserData(window.localStorage, activeManifest);
    const href = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${activeManifest.home.id}-cabane-browser-data.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };
  if (!validation.canRender || !validation.manifest) {
    return (
      <CabaneDashboard
        manifest={manifest}
        architectureModels={architectureModels}
        deviceModels={deviceModels}
        onWorkspaces={onWorkspaces}
        onExportBrowserData={exportBrowserData}
      />
    );
  }
  const updateHomeAssistantUrl = (url: string | null) => {
    setHomeAssistantUrl(url);
    if (typeof window !== "undefined") saveStoredHomeAssistantUrl(window.localStorage, url);
  };
  return (
    <HomeAssistantRuntimeProvider homeAssistantUrl={homeAssistantUrl}>
      <CabaneAppExperience
        manifest={validation.manifest}
        architectureModels={architectureModels}
        deviceModels={deviceModels}
        homeAssistantUrl={homeAssistantUrl}
        onHomeAssistantUrlChange={updateHomeAssistantUrl}
        onEditHome={onEditHome}
        onWorkspaces={onWorkspaces}
        constructionApplied={constructionApplied}
        onImportBrowserData={(json) => {
          if (typeof window === "undefined") {
            return {
              valid: false,
              issues: [
                { code: "transfer.browser", path: "$", message: "Browser storage is unavailable." },
              ],
            };
          }
          const result = importCabaneBrowserData(json, window.localStorage, activeManifest);
          if (result.valid) {
            setHomeAssistantUrl(loadStoredHomeAssistantUrl(window.localStorage));
          }
          return result;
        }}
        onExportBrowserData={exportBrowserData}
      />
    </HomeAssistantRuntimeProvider>
  );
}
