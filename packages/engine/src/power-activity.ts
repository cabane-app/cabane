import { deviceVisualStateForSnapshot } from "./devices";
import { isAuxiliaryEntitySlot } from "./entity-slot-roles";
import type { DeviceItemSpec, PowerActivitySettings, SceneItemSpec } from "./home-project/types";
import type { EntityBindingSlotSpec, EntityStateSnapshot, ResolvedDeviceBinding } from "./types";

export const isPowerActivitySlot = (slot: EntityBindingSlotSpec) =>
  isAuxiliaryEntitySlot(slot) &&
  slot.compatibleDomains.includes("sensor") &&
  (!slot.compatibleDeviceClasses?.length || slot.compatibleDeviceClasses.includes("power"));

/** W and kW are instantaneous power. Energy and unitless values never qualify. */
export const isPowerReading = (state: EntityStateSnapshot | undefined) =>
  state?.entityId.startsWith("sensor.") === true &&
  state.attributes.device_class === "power" &&
  (state.attributes.unit_of_measurement === "W" || state.attributes.unit_of_measurement === "kW");

export const powerReadingWatts = (state: EntityStateSnapshot | undefined): number | null => {
  if (!state || !isPowerReading(state) || !state.available || state.stale || !state.state.trim())
    return null;
  const value = Number(state.state);
  const watts = value * (state.attributes.unit_of_measurement === "kW" ? 1000 : 1);
  return Number.isFinite(watts) && watts >= 0 ? watts : null;
};

export const validPowerActivitySettings = (item: DeviceItemSpec, settings: PowerActivitySettings) =>
  Number.isFinite(settings.thresholdWatts) &&
  settings.thresholdWatts >= 0 &&
  item.entitySlots.some((slot) => slot.id === settings.slotId && isPowerActivitySlot(slot));

/** Removing a referenced reading clears the optional setting in the same history step. */
export function withItemEntitySlots(
  item: SceneItemSpec,
  entitySlots: readonly EntityBindingSlotSpec[],
): SceneItemSpec {
  if (item.kind !== "device") return { ...item, entitySlots };
  const next = { ...item, entitySlots };
  if (next.powerActivity && !validPowerActivitySettings(next, next.powerActivity))
    delete next.powerActivity;
  return next;
}

/** Undefined preserves native state and the exact unconfigured model behavior. */
export function powerActivityForDevice(
  item: DeviceItemSpec,
  device: ResolvedDeviceBinding,
): boolean | undefined {
  const settings = item.powerActivity;
  if (!settings) return undefined;
  const primarySlot = item.entitySlots.find((slot) => slot.deviceRole === "primary");
  const primary = device.entities.find((entity) => entity.slotId === primarySlot?.id);
  if (primary && primary.domain !== "switch") return undefined;
  if (
    !validPowerActivitySettings(item, settings) ||
    deviceVisualStateForSnapshot(primary?.state) !== "connected-active" ||
    primary?.issues.some((issue) => issue.severity === "error")
  )
    return false;
  const reading = device.entities.find((entity) => entity.slotId === settings.slotId);
  const watts =
    reading?.domain === "sensor" && !reading.issues.some((issue) => issue.severity === "error")
      ? powerReadingWatts(reading.state)
      : null;
  return watts !== null && watts > settings.thresholdWatts;
}
