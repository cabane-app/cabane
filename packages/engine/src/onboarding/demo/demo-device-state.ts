import type { SupportedServiceCall } from "../../home-assistant-controls";
import type { EntityBindingSlotSpec, EntityId, EntityStateSnapshot } from "../../types";

const supportedDomains = [
  "light",
  "fan",
  "vacuum",
  "valve",
  "switch",
  "climate",
  "cover",
  "sensor",
  "binary_sensor",
  "event",
  "media_player",
  "lock",
  "alarm_control_panel",
] as const;
export type DemoDomain = (typeof supportedDomains)[number];
export function demoDomain(slot: EntityBindingSlotSpec): DemoDomain | null {
  return supportedDomains.find((domain) => slot.compatibleDomains.includes(domain)) ?? null;
}
const sensorDefaults: Readonly<Record<string, readonly [string, string]>> = {
  temperature: ["21.5", "°C"],
  humidity: ["45", "%"],
  battery: ["86", "%"],
  illuminance: ["320", "lx"],
  power: ["42", "W"],
  energy: ["3.2", "kWh"],
  carbon_dioxide: ["620", "ppm"],
  pressure: ["1013", "hPa"],
};
export function createDemoDeviceState(
  entityId: EntityId,
  domain: DemoDomain,
  slot: EntityBindingSlotSpec,
  night = false,
): EntityStateSnapshot {
  const deviceClass = slot.compatibleDeviceClasses?.[0];
  const attributes: Record<string, unknown> = {
    friendly_name: slot.presentation.label,
    ...(deviceClass ? { device_class: deviceClass } : {}),
  };
  let state = "off";
  switch (domain) {
    case "vacuum":
      state = "docked";
      Object.assign(attributes, { supported_features: 16384 | 8192 | 4096 | 16 | 8 | 4 });
      break;
    case "fan":
      state = "on";
      Object.assign(attributes, { percentage: 50, supported_features: 49 });
      break;
    case "valve":
      state = "open";
      Object.assign(attributes, { current_position: 100, supported_features: 7 });
      break;
    case "light":
      state = night ? "on" : "off";
      Object.assign(attributes, {
        supported_color_modes: ["rgb"],
        color_mode: "rgb",
        brightness: 180,
        rgb_color: [255, 211, 160],
      });
      break;
    case "cover":
      state = "open";
      Object.assign(attributes, { current_position: 65, supported_features: 7 });
      break;
    case "climate":
      state = "heat";
      Object.assign(attributes, {
        temperature: 21,
        current_temperature: 20.5,
        temperature_unit: "°C",
        min_temp: 7,
        max_temp: 30,
        target_temp_step: 0.5,
        hvac_modes: ["off", "heat", "cool"],
        hvac_action: "heating",
        supported_features: 1,
      });
      break;
    case "sensor": {
      const reading = deviceClass ? sensorDefaults[deviceClass] : undefined;
      state = reading?.[0] ?? (deviceClass ? "unknown" : "idle");
      if (reading) attributes.unit_of_measurement = reading[1];
      break;
    }
    case "event":
      state = "2026-01-01T12:00:00.000+00:00";
      Object.assign(attributes, { event_type: "short_release", event_types: ["short_release"] });
      break;
    case "binary_sensor":
      state = ["occupancy", "presence", "connectivity"].includes(deviceClass ?? "") ? "on" : "off";
      break;
    case "lock":
      state = "locked";
      break;
    case "alarm_control_panel":
      state = "disarmed";
      Object.assign(attributes, { supported_features: 3, code_arm_required: false });
      break;
    case "media_player":
      state = "playing";
      Object.assign(attributes, {
        supported_features: 16773,
        volume_level: 0.45,
        media_title: "Demo playlist",
      });
      break;
  }
  return { entityId, state, attributes, available: state !== "unknown", stale: false };
}
function invalid(): never {
  throw new Error("This demo device does not support that command or value.");
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return invalid();
  return Math.min(max, Math.max(min, value));
}
/** Pure updates: validate before React state changes so failures reject the call. */
export function applyDemoServiceCall(
  state: EntityStateSnapshot,
  call: SupportedServiceCall,
): EntityStateSnapshot {
  const targets = Array.isArray(call.target.entity_id)
    ? call.target.entity_id
    : [call.target.entity_id];
  if (!targets.includes(state.entityId) || !state.entityId.startsWith(`${call.domain}.`))
    return invalid();
  const data = call.data ?? {};
  const attributes = { ...state.attributes };
  let next = state.state;
  let allowed: readonly string[] = [];
  switch (call.domain) {
    case "vacuum":
      if (call.service === "clean_area") {
        allowed = ["cleaning_area_id"];
        if (
          !Array.isArray(data.cleaning_area_id) ||
          data.cleaning_area_id.length === 0 ||
          !data.cleaning_area_id.every((area) => typeof area === "string" && area.length > 0)
        )
          return invalid();
        next = "cleaning";
      } else if (call.service === "start") next = "cleaning";
      else if (call.service === "pause") next = "paused";
      else if (call.service === "stop") next = "idle";
      else if (call.service === "return_to_base") next = "returning";
      else return invalid();
      break;
    case "fan":
      if (call.service === "turn_off") next = "off";
      else if (call.service === "turn_on") {
        next = "on";
        if (attributes.percentage === 0) attributes.percentage = 50;
      } else if (call.service === "set_percentage") {
        allowed = ["percentage"];
        attributes.percentage = Math.round(number(data.percentage, 0, 100));
        next = attributes.percentage === 0 ? "off" : "on";
      } else return invalid();
      break;
    case "valve": {
      let position: number;
      if (call.service === "open_valve") position = 100;
      else if (call.service === "close_valve") position = 0;
      else if (call.service === "set_valve_position") {
        allowed = ["position"];
        position = Math.round(number(data.position, 0, 100));
      } else return invalid();
      attributes.current_position = position;
      next = position === 0 ? "closed" : "open";
      break;
    }
    case "light":
    case "switch":
      if (!["turn_on", "turn_off"].includes(call.service)) return invalid();
      next = call.service === "turn_on" ? "on" : "off";
      if (call.domain === "light" && call.service === "turn_on") {
        allowed = ["brightness_pct", "brightness", "rgb_color"];
        if (data.brightness_pct !== undefined)
          attributes.brightness = Math.round((number(data.brightness_pct, 0, 100) * 255) / 100);
        if (data.brightness !== undefined)
          attributes.brightness = Math.round(number(data.brightness, 0, 255));
        if (
          data.brightness_pct === undefined &&
          data.brightness === undefined &&
          attributes.brightness === 0
        )
          attributes.brightness = 180;
        if (attributes.brightness === 0) next = "off";
        if (data.rgb_color !== undefined) {
          if (!Array.isArray(data.rgb_color) || data.rgb_color.length !== 3) return invalid();
          attributes.rgb_color = data.rgb_color.map((channel) =>
            Math.round(number(channel, 0, 255)),
          );
          attributes.color_mode = "rgb";
        }
      }
      break;
    case "cover": {
      let position: number;
      if (call.service === "open_cover") position = 100;
      else if (call.service === "close_cover") position = 0;
      else if (call.service === "set_cover_position") {
        allowed = ["position"];
        position = Math.round(number(data.position, 0, 100));
      } else return invalid();
      attributes.current_position = position;
      next = position === 0 ? "closed" : "open";
      break;
    }
    case "climate":
      if (call.service === "set_temperature") {
        allowed = ["temperature"];
        attributes.temperature = Math.round(number(data.temperature, 7, 30) * 2) / 2;
      } else if (call.service === "set_hvac_mode") {
        allowed = ["hvac_mode"];
        if (typeof data.hvac_mode !== "string" || !["off", "heat", "cool"].includes(data.hvac_mode))
          return invalid();
        next = data.hvac_mode;
      } else if (call.service === "turn_on") next = "heat";
      else if (call.service === "turn_off") next = "off";
      else return invalid();
      attributes.hvac_action =
        next === "off"
          ? "off"
          : next === "heat" &&
              Number(attributes.temperature) > Number(attributes.current_temperature)
            ? "heating"
            : next === "cool" &&
                Number(attributes.temperature) < Number(attributes.current_temperature)
              ? "cooling"
              : "idle";
      break;
    case "media_player":
      if (call.service === "turn_on") next = "on";
      else if (call.service === "turn_off") next = "off";
      else if (call.service === "media_play") next = "playing";
      else if (call.service === "media_pause") next = "paused";
      else if (call.service === "volume_set") {
        allowed = ["volume_level"];
        attributes.volume_level = number(data.volume_level, 0, 1);
      } else return invalid();
      break;
    case "lock":
      if (!["lock", "unlock"].includes(call.service)) return invalid();
      next = call.service === "lock" ? "locked" : "unlocked";
      break;
    case "alarm_control_panel":
      if (call.service === "alarm_disarm") next = "disarmed";
      else if (call.service === "alarm_arm_home") next = "armed_home";
      else if (call.service === "alarm_arm_away") next = "armed_away";
      else return invalid();
      break;
    default:
      return invalid();
  }
  if (Object.keys(data).some((key) => !allowed.includes(key))) return invalid();
  const previous = Date.parse(state.lastConfirmedAt ?? "");
  const timestamp = new Date(
    Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : 0),
  ).toISOString();
  return { ...state, state: next, attributes, lastConfirmedAt: timestamp, lastUpdated: timestamp };
}
export function applyDemoServiceToStates(
  states: Readonly<Record<EntityId, EntityStateSnapshot>>,
  call: SupportedServiceCall,
): Readonly<Record<EntityId, EntityStateSnapshot>> {
  const targets = Array.isArray(call.target.entity_id)
    ? call.target.entity_id
    : [call.target.entity_id];
  if (targets.length === 0) return invalid();
  const updates = targets.map((id) => {
    const current = states[id];
    if (!current) return invalid();
    return [id, applyDemoServiceCall(current, call)] as const;
  });
  return { ...states, ...Object.fromEntries(updates) };
}
