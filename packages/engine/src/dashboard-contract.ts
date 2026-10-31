import { type RuntimeBindingProfileManager } from "./RuntimeBindingSetup";
import type { HomeAssistantConnectionStatus } from "./types";

import type { ArchitectureModelRegistry, DeviceModelRegistry, HomeManifest } from "./types";

import type { EditorMode } from "./EditorModeIcon";
import type { ReactNode } from "react";

export interface DashboardMappingRequest {
  id: number;
  view: "rooms" | "devices";
  roomId?: string | null;
}

export interface DashboardSetupAction {
  label: string;
  detail: string;
  attention: boolean;
  onOpen: () => void;
}

export interface DashboardSessionPresentation {
  mode: "demo" | "real";
  label: string;
  detail?: string;
  menuDescription?: string;
}

export interface CabaneDashboardProps {
  manifest: HomeManifest | null;
  architectureModels: ArchitectureModelRegistry;
  deviceModels?: DeviceModelRegistry;
  walkTools?: readonly import("./walk-tools").WalkToolDefinition[] | undefined;
  renderActionBarDeviceIcon?: ((modelId: string) => ReactNode) | undefined;
  bindingManager?: RuntimeBindingProfileManager;
  sessionPresentation?: DashboardSessionPresentation | undefined;
  setupAction?: DashboardSetupAction | undefined;
  setupOpen?: boolean;
  focusRoomId?: string | undefined;
  mappingRequest?: DashboardMappingRequest | null;
  onEditHome?: ((mode?: EditorMode) => void) | undefined;
  onCustomizeActionBar?: (() => void) | undefined;
  onExportBrowserData?: (() => void | Promise<void>) | undefined;
  onHomeAssistantSettings?: (() => void) | undefined;
  onWorkspaces?: (() => void) | undefined;
  onOpenConnect?: ((view: "rooms" | "devices", roomId?: string | null) => void) | undefined;
  /** Open an isolated draft walkthrough and return to its editor when walking ends. */
  walkthrough?: { onExit: () => void; pointerLockTarget?: HTMLElement | null | undefined };
}

export const connectionLabel: Record<HomeAssistantConnectionStatus, string> = {
  unconfigured: "Home Assistant not configured",
  disconnected: "Home Assistant disconnected",
  authenticating: "Waiting for authorization",
  connecting: "Connecting to Home Assistant",
  connected: "Home Assistant connected",
  reconnecting: "Reconnecting to Home Assistant",
  "auth-expired": "Authorization expired",
  error: "Home Assistant connection error",
};
