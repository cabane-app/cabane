import { createContext } from "react";
import type { DeviceItemSpec } from "./home-project";
import type { EntityStateSnapshot } from "./types";

export const SceneNightContext = createContext(false);

/** Resolve only scene state; never mutate the connected entity or send services. */
export function sceneLightState(
  mode: DeviceItemSpec["lightState"],
  connected: EntityStateSnapshot | undefined,
  night = false,
  modelId?: string,
): EntityStateSnapshot | undefined {
  if (!mode || mode === "connected") {
    if (
      modelId === "fireplace" &&
      connected?.entityId.startsWith("climate.") &&
      !["off", "unknown", "unavailable"].includes(connected.state)
    ) {
      return { ...connected, state: connected.attributes.hvac_action === "heating" ? "on" : "off" };
    }
    return connected;
  }
  return {
    entityId: connected?.entityId ?? "light.scene",
    state: mode === "always-on" || (mode === "night-only" && night) ? "on" : "off",
    attributes: {},
    available: true,
    stale: false,
  };
}
