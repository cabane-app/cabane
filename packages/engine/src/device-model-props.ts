import type {
  DeviceLiveMedia,
  DeviceSlotSpec,
  DeviceVisualState,
  EntityBindingSlotSpec,
  EntityStateSnapshot,
  ExtensionInteractionTarget,
} from "./types";

/** An attached reading, including its declaration when no live state is available. */
export interface DeviceModelReading {
  slot: EntityBindingSlotSpec;
  state?: EntityStateSnapshot;
}

export interface HomeDeviceModelProps {
  color?: string;
  variant?: string;
  slot: DeviceSlotSpec;
  state?: EntityStateSnapshot;
  /** All attached readings in slot order, independent of dashboard and map visibility. */
  readings?: readonly DeviceModelReading[];
  liveMedia?: DeviceLiveMedia;
  visualState: DeviceVisualState;
  reducedMotion: boolean;
  walkMode: boolean;
  onInteract: (target: ExtensionInteractionTarget) => void;
}
