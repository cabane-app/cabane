import type { HomeDeviceModelProps } from "@cabane/engine";

/** With no power attachment, appliances retain their primary-state behavior. */
export const hasOperatingPower = (readings: HomeDeviceModelProps["readings"]) =>
  (readings ?? [])
    .filter(
      ({ slot, state }) =>
        slot.compatibleDeviceClasses?.includes("power") ||
        state?.attributes.device_class === "power",
    )
    .every(({ state }) => {
      if (!state?.available || state.stale || !state.entityId.startsWith("sensor.")) return false;
      const unit = state.attributes.unit_of_measurement;
      const value = Number(state.state);
      return (
        state.attributes.device_class === "power" &&
        (unit === "W" || unit === "kW") &&
        Number.isFinite(value) &&
        value > 0
      );
    });
