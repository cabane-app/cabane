import type { ComponentType } from "react";
import type {
  DeviceLiveMedia,
  DeviceSlotSpec,
  DeviceVisualState,
  EntityStateSnapshot,
  ExtensionInteractionTarget,
} from "./types";

export interface HomeDeviceModelProps {
  color?: string;
  variant?: string;
  slot: DeviceSlotSpec;
  state?: EntityStateSnapshot;
  liveMedia?: DeviceLiveMedia;
  visualState: DeviceVisualState;
  /** Optional operating animation override, independent of connection status. */
  operating?: boolean;
  reducedMotion: boolean;
  walkMode: boolean;
  onInteract: (target: ExtensionInteractionTarget) => void;
}

export type HomeDeviceModelComponent = ComponentType<HomeDeviceModelProps>;
