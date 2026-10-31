import { type RuntimeBindingProfileManager } from "./RuntimeBindingSetup";

import type { ArchitectureModelRegistry, DeviceModelRegistry, HomeManifest } from "./types";

import type { EditorMode } from "./EditorModeIcon";
import type { ReactNode } from "react";

import {
  CabaneDashboardProps,
  DashboardMappingRequest,
  DashboardSessionPresentation,
  DashboardSetupAction,
} from "./dashboard-contract";

export interface ValidatedDashboardProps {
  manifest: HomeManifest;
  architectureModels: ArchitectureModelRegistry;
  deviceModels: DeviceModelRegistry;
  walkTools?: readonly import("./walk-tools").WalkToolDefinition[] | undefined;
  renderActionBarDeviceIcon?: ((modelId: string) => ReactNode) | undefined;
  bindingManager: RuntimeBindingProfileManager;
  fallbackDemo: boolean;
  sessionPresentation?: DashboardSessionPresentation | undefined;
  setupAction?: DashboardSetupAction | undefined;
  setupOpen: boolean;
  focusRoomId?: string | undefined;
  mappingRequest?: (DashboardMappingRequest | null) | undefined;
  onEditHome?: ((mode?: EditorMode) => void) | undefined;
  onCustomizeActionBar?: (() => void) | undefined;
  onExportBrowserData?: (() => void | Promise<void>) | undefined;
  onHomeAssistantSettings?: (() => void) | undefined;
  onWorkspaces?: (() => void) | undefined;
  onOpenConnect?: ((view: "rooms" | "devices", roomId?: string | null) => void) | undefined;
  walkthrough?: CabaneDashboardProps["walkthrough"];
}
