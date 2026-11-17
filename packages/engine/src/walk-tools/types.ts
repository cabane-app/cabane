import type { ComponentType } from "react";
import type { ExtensionInteractionTarget } from "../types";

export interface WalkToolResult {
  status: "activated" | "unavailable";
  message: string;
}

export interface WalkToolLanding {
  x: number;
  z: number;
  elevation: number;
  floorId: string;
}

/** World-space feet positions; the controller owns support, collision and camera state. */
export interface WalkToolNavigation {
  resolveLanding: (position: { x: number; y: number; z: number }) => WalkToolLanding | null;
  /** Revalidates the landing. False leaves the player unchanged. */
  teleport: (landing: WalkToolLanding, facing: { yaw: number; pitch: number }) => boolean;
}

/** Mounted inside the scene only while equipped in walk mode. No runtime credentials. */
export interface WalkToolProps {
  enabled: boolean;
  pointerLocked: boolean;
  coarsePointer: boolean;
  reducedMotion: boolean;
  navigation: WalkToolNavigation;
  canActivateTarget: (target: ExtensionInteractionTarget) => boolean;
  activateTarget: (target: ExtensionInteractionTarget) => Promise<WalkToolResult>;
}

/** Installed by the host; persisted shortcuts store only the stable tool ID. */
export interface WalkToolDefinition {
  id: string;
  label: string;
  /** Include this installed tool in uncustomized and restored default action bars. */
  defaultShortcut?: boolean;
  /** Optional non-movement key, active only when this shortcut is on the bar. */
  shortcutKey?: string;
  Icon: ComponentType;
  /** Persistent world lighting keeps shader variants stable across equip changes. */
  WorldLighting?: ComponentType<{ active: boolean }>;
  Scene: ComponentType<WalkToolProps>;
}
