import { useMemo } from "react";

import { validateArchitectureModelRegistry } from "./architecture-models";

import { neutralDemoManifest } from "./demo";

import { useHomeAssistantRuntime } from "./HomeAssistantRuntime";

import { useRuntimeBindingProfile } from "./RuntimeBindingSetup";

import { validateHomeManifest } from "./validation";

import { ConfigurationScreen } from "./ConfigurationScreen";

import { CabaneDashboardProps } from "./dashboard-contract";
import { ValidatedDashboard } from "./DashboardExperience";
import { ValidatedDashboardProps } from "./validated-dashboard-contract";

export function CabaneDashboard({
  manifest,
  architectureModels,
  deviceModels = {},
  renderActionBarDeviceIcon,
  walkTools,
  bindingManager,
  sessionPresentation,
  setupAction,
  setupOpen = false,
  mappingRequest,
  focusRoomId,
  onEditHome,
  onCustomizeActionBar,
  onExportBrowserData,
  onWorkspaces,
  onHomeAssistantSettings,
  onOpenConnect,
  walkthrough,
}: CabaneDashboardProps) {
  const activeManifest = manifest ?? neutralDemoManifest;
  const validation = useMemo(
    () => validateHomeManifest(activeManifest, { deviceModels }),
    [activeManifest, deviceModels],
  );
  const architectureIssues = useMemo(
    () => validateArchitectureModelRegistry(architectureModels),
    [architectureModels],
  );
  const recoveryActions = { onWorkspaces, onDownloadBackup: onExportBrowserData };
  if (architectureIssues.length > 0) {
    return <ConfigurationScreen issues={architectureIssues} {...recoveryActions} />;
  }
  if (!validation.canRender || !validation.manifest) {
    return <ConfigurationScreen issues={validation.issues} {...recoveryActions} />;
  }
  if (bindingManager)
    return (
      <ValidatedDashboard
        manifest={validation.manifest}
        architectureModels={architectureModels}
        deviceModels={deviceModels}
        renderActionBarDeviceIcon={renderActionBarDeviceIcon}
        walkTools={walkTools}
        bindingManager={bindingManager}
        fallbackDemo={manifest === null}
        sessionPresentation={sessionPresentation}
        setupAction={setupAction}
        setupOpen={setupOpen}
        mappingRequest={mappingRequest}
        focusRoomId={focusRoomId}
        onEditHome={onEditHome}
        onCustomizeActionBar={onCustomizeActionBar}
        onExportBrowserData={onExportBrowserData}
        onWorkspaces={onWorkspaces}
        onHomeAssistantSettings={onHomeAssistantSettings}
        onOpenConnect={onOpenConnect}
        walkthrough={walkthrough}
      />
    );
  return (
    <ManagedValidatedDashboard
      manifest={validation.manifest}
      architectureModels={architectureModels}
      deviceModels={deviceModels}
      renderActionBarDeviceIcon={renderActionBarDeviceIcon}
      walkTools={walkTools}
      fallbackDemo={manifest === null}
      sessionPresentation={sessionPresentation}
      setupAction={setupAction}
      setupOpen={setupOpen}
      mappingRequest={mappingRequest}
      focusRoomId={focusRoomId}
      onEditHome={onEditHome}
      onCustomizeActionBar={onCustomizeActionBar}
      onExportBrowserData={onExportBrowserData}
      onWorkspaces={onWorkspaces}
      onHomeAssistantSettings={onHomeAssistantSettings}
      onOpenConnect={onOpenConnect}
      walkthrough={walkthrough}
    />
  );
}

function ManagedValidatedDashboard(props: Omit<ValidatedDashboardProps, "bindingManager">) {
  const runtime = useHomeAssistantRuntime();
  const bindingManager = useRuntimeBindingProfile(props.manifest, runtime);
  return <ValidatedDashboard {...props} bindingManager={bindingManager} />;
}

export type {
  CabaneDashboardProps,
  DashboardMappingRequest,
  DashboardSessionPresentation,
  DashboardSetupAction,
} from "./dashboard-contract";

export { orbitalEditorActionFromKey, SceneActionBar } from "./SceneActionBar";
export {
  SceneActionSlotFace,
  ActionBarBuiltInIcon,
  RoomShortcutIcon,
  actionBarBuiltInLabels,
} from "./SceneActionSlotFace";
export { SceneRoomContext } from "./SceneRoomContext";
