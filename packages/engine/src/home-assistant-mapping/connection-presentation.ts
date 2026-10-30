import type { EntityBindingSlotSpec, EntityId, HomeAssistantRuntimeSnapshot } from "../types";

export function connectionSlotLabel(slot: EntityBindingSlotSpec, model?: string) {
  if (slot.deviceRole !== "primary") return slot.presentation.label;
  if (model?.includes("sprinkler")) return "Watering";
  const deviceClass = slot.compatibleDeviceClasses?.[0];
  if (deviceClass)
    return deviceClass.charAt(0).toUpperCase() + deviceClass.slice(1).replaceAll("_", " ");
  const domain = slot.compatibleDomains[0];
  return (
    (
      {
        light: "Lighting",
        switch: "Power",
        valve: "Watering",
        camera: "Camera",
        climate: "Climate",
        media_player: "Media",
        cover: "Opening",
      } as Record<string, string>
    )[domain ?? ""] ?? slot.presentation.label
  );
}

export function entityConnectionSummary(
  entityId: EntityId | undefined,
  runtime: HomeAssistantRuntimeSnapshot,
) {
  const entry = runtime.entityRegistry.find((candidate) => candidate.entity_id === entityId);
  const state = entityId ? runtime.entityStates[entityId] : undefined;
  const device = entry?.device_id
    ? runtime.devices.find((candidate) => candidate.id === entry.device_id)
    : undefined;
  const friendlyName = state?.attributes.friendly_name;
  const label =
    entry?.name ??
    (typeof friendlyName === "string" ? friendlyName : undefined) ??
    entry?.original_name ??
    entityId ??
    "Not connected";
  const deviceName = device?.name_by_user ?? device?.name;
  const status = !entityId
    ? "Not connected"
    : entry?.disabled_by
      ? "Connected · Disabled"
      : entry?.hidden_by
        ? "Connected · Hidden"
        : !state
          ? "Connected · Missing source"
          : !state.available
            ? "Connected · Unavailable"
            : state.stale
              ? "Connected · Stale"
              : "Connected";
  const unit = state?.attributes.unit_of_measurement;
  return {
    label,
    deviceName,
    status,
    available: Boolean(state?.available && !state.stale),
    value:
      state?.available && !state.stale
        ? `${state.state}${typeof unit === "string" ? ` ${unit}` : ""}`
        : null,
  };
}

export interface ReadingPresentation {
  label: string;
  showInScene: boolean | "if-present";
}
