import type { ControllableDeviceDomain, EntityId, EntityStateSnapshot } from "./types";

export type CoalescedControlChannel =
  "brightness" | "humidity" | "percentage" | "position" | "temperature" | "value" | "volume";

export interface SupportedServiceCall {
  domain: ControllableDeviceDomain | "dreame_vacuum" | "scene" | "script";
  service: string;
  data?: Readonly<Record<string, unknown>> | undefined;
  target: { entity_id: EntityId | EntityId[] };
  delivery?: {
    mode: "coalesced-value" | "continuous-value";
    channel: CoalescedControlChannel;
  };
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const steppedValue = (value: number, minimum: number, maximum: number, step: number) => {
  const bounded = clamp(value, minimum, maximum);
  const stepped = minimum + Math.round((bounded - minimum) / step) * step;
  return Number(clamp(stepped, minimum, maximum).toFixed(6));
};

const domainOf = (entity: EntityStateSnapshot) => {
  const domain = entity.entityId.split(".", 1)[0];
  if (domain === "event") throw new Error("Event entities are read-only.");
  return domain as SupportedServiceCall["domain"];
};

const valueCall = (
  entity: EntityStateSnapshot,
  service: string,
  data?: Readonly<Record<string, unknown>>,
): SupportedServiceCall => ({
  domain: domainOf(entity),
  service,
  data,
  target: { entity_id: entity.entityId },
});

const coalescedValueCall = (
  entity: EntityStateSnapshot,
  service: string,
  channel: CoalescedControlChannel,
  data: Readonly<Record<string, unknown>>,
): SupportedServiceCall => ({
  ...valueCall(entity, service, data),
  delivery: { mode: "coalesced-value", channel },
});

export const toggleEntityCall = (entity: EntityStateSnapshot): SupportedServiceCall =>
  valueCall(entity, entity.state === "off" ? "turn_on" : "turn_off");

export const lightBrightnessCall = (entity: EntityStateSnapshot, percent: number) =>
  coalescedValueCall(entity, "turn_on", "brightness", {
    brightness_pct: Math.round(clamp(percent, 1, 100)),
  });

export const supportsLightBrightness = (entity: EntityStateSnapshot) => {
  const modes = entity.attributes.supported_color_modes;
  return (
    typeof entity.attributes.brightness === "number" ||
    (Array.isArray(modes) && modes.some((mode) => mode !== "onoff"))
  );
};

export const lightBrightnessRatio = (entity: EntityStateSnapshot | undefined): number => {
  if (!entity || entity.stale || !entity.available || entity.state !== "on") return 0;
  const brightness = entity.attributes.brightness;
  if (typeof brightness !== "number" || !Number.isFinite(brightness)) return 1;
  return clamp(brightness / 255, 0, 1);
};

const colorChannel = (value: number) => Math.round(clamp(value, 0, 255));

const rgbForColorTemperature = (kelvin: number) => {
  const temperature = clamp(kelvin, 1_000, 40_000) / 100;
  const red = temperature <= 66 ? 255 : 329.698727446 * (temperature - 60) ** -0.1332047592;
  const green =
    temperature <= 66
      ? 99.4708025861 * Math.log(temperature) - 161.1195681661
      : 288.1221695283 * (temperature - 60) ** -0.0755148492;
  const blue =
    temperature >= 66
      ? 255
      : temperature <= 19
        ? 0
        : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
  return [colorChannel(red), colorChannel(green), colorChannel(blue)] as const;
};

export const lightColorForSnapshot = (
  entity: EntityStateSnapshot | undefined,
  fallback: string,
): string => {
  const rgb = entity?.attributes.rgb_color;
  if (
    Array.isArray(rgb) &&
    rgb.length === 3 &&
    rgb.every((channel) => typeof channel === "number" && Number.isFinite(channel))
  )
    return `rgb(${rgb.map(colorChannel).join(", ")})`;
  const kelvinAttribute = entity?.attributes.color_temp_kelvin;
  const miredAttribute = entity?.attributes.color_temp;
  const kelvin =
    typeof kelvinAttribute === "number" && Number.isFinite(kelvinAttribute)
      ? kelvinAttribute
      : typeof miredAttribute === "number" && Number.isFinite(miredAttribute) && miredAttribute > 0
        ? 1_000_000 / miredAttribute
        : null;
  if (kelvin === null) return fallback;
  const [red, green, blue] = rgbForColorTemperature(kelvin);
  return `rgb(${red}, ${green}, ${blue})`;
};

export const climateTemperatureRange = (entity: EntityStateSnapshot) => {
  const minimum = Number(entity.attributes.min_temp ?? 7);
  const maximum = Number(entity.attributes.max_temp ?? 35);
  const step = Number(entity.attributes.target_temp_step ?? 0.5);
  return {
    min: Number.isFinite(minimum) ? minimum : 7,
    max: Number.isFinite(maximum) ? maximum : 35,
    step: Number.isFinite(step) && step > 0 ? step : 0.5,
  };
};

export const climateTemperatureCall = (
  entity: EntityStateSnapshot,
  requestedTemperature: number,
) => {
  const { min, max, step } = climateTemperatureRange(entity);
  const temperature = Math.round(clamp(requestedTemperature, min, max) / step) * step;
  return coalescedValueCall(entity, "set_temperature", "temperature", { temperature });
};

export const climatePowerCall = (entity: EntityStateSnapshot, turnOn: boolean) =>
  valueCall(entity, turnOn ? "turn_on" : "turn_off");

export const climateModeCall = (entity: EntityStateSnapshot, hvacMode: string) =>
  valueCall(entity, "set_hvac_mode", { hvac_mode: hvacMode });

export const climatePresetCall = (entity: EntityStateSnapshot, presetMode: string) =>
  valueCall(entity, "set_preset_mode", { preset_mode: presetMode });

export const climateFanModeCall = (entity: EntityStateSnapshot, fanMode: string) =>
  valueCall(entity, "set_fan_mode", { fan_mode: fanMode });

export const climateSwingModeCall = (entity: EntityStateSnapshot, swingMode: string) =>
  valueCall(entity, "set_swing_mode", { swing_mode: swingMode });

export const coverActionCall = (
  entity: EntityStateSnapshot,
  action: "open_cover" | "stop_cover" | "close_cover",
) => valueCall(entity, action);

export const coverPositionCall = (entity: EntityStateSnapshot, position: number) =>
  coalescedValueCall(entity, "set_cover_position", "position", {
    position: Math.round(clamp(position, 0, 100)),
  });

export const fanPowerCall = (entity: EntityStateSnapshot, turnOn: boolean) =>
  valueCall(entity, turnOn ? "turn_on" : "turn_off");

export const fanPercentageCall = (entity: EntityStateSnapshot, percentage: number) =>
  coalescedValueCall(entity, "set_percentage", "percentage", {
    percentage: Math.round(clamp(percentage, 0, 100)),
  });

export const fanPresetCall = (entity: EntityStateSnapshot, presetMode: string) =>
  valueCall(entity, "set_preset_mode", { preset_mode: presetMode });

export const HUMIDIFIER_FEATURE_MODES = 1;
export const WATER_HEATER_FEATURE_TARGET_TEMPERATURE = 1;
export const WATER_HEATER_FEATURE_OPERATION_MODE = 2;
export const WATER_HEATER_FEATURE_AWAY_MODE = 4;
export const WATER_HEATER_FEATURE_ON_OFF = 8;
export const VACUUM_FEATURE_PAUSE = 4;
export const VACUUM_FEATURE_STOP = 8;
export const VACUUM_FEATURE_RETURN_HOME = 16;
export const VACUUM_FEATURE_FAN_SPEED = 32;
export const VACUUM_FEATURE_START = 8192;
export const LOCK_FEATURE_OPEN = 1;
export const ALARM_FEATURE_ARM_HOME = 1;
export const ALARM_FEATURE_ARM_AWAY = 2;
export const ALARM_FEATURE_ARM_NIGHT = 4;
export const ALARM_FEATURE_ARM_CUSTOM_BYPASS = 16;
export const ALARM_FEATURE_ARM_VACATION = 32;
export const VALVE_FEATURE_OPEN = 1;
export const VALVE_FEATURE_CLOSE = 2;
export const VALVE_FEATURE_SET_POSITION = 4;
export const VALVE_FEATURE_STOP = 8;
export const SIREN_FEATURE_TURN_ON = 1;
export const SIREN_FEATURE_TURN_OFF = 2;
export const SIREN_FEATURE_TONES = 4;
export const SIREN_FEATURE_VOLUME_SET = 8;
export const SIREN_FEATURE_DURATION = 16;

export const humidifierHumidityRange = (entity: EntityStateSnapshot) => {
  const minimum = Number(entity.attributes.min_humidity ?? 0);
  const maximum = Number(entity.attributes.max_humidity ?? 100);
  const step = Number(entity.attributes.target_humidity_step ?? 1);
  return {
    min: Number.isFinite(minimum) ? minimum : 0,
    max: Number.isFinite(maximum) ? maximum : 100,
    step: Number.isFinite(step) && step > 0 ? step : 1,
  };
};

export const humidifierPowerCall = (entity: EntityStateSnapshot, turnOn: boolean) =>
  valueCall(entity, turnOn ? "turn_on" : "turn_off");

export const humidifierHumidityCall = (entity: EntityStateSnapshot, requestedHumidity: number) => {
  const { min, max, step } = humidifierHumidityRange(entity);
  return coalescedValueCall(entity, "set_humidity", "humidity", {
    humidity: steppedValue(requestedHumidity, min, max, step),
  });
};

export const humidifierModeCall = (entity: EntityStateSnapshot, mode: string) =>
  valueCall(entity, "set_mode", { mode });

export const waterHeaterTemperatureRange = (entity: EntityStateSnapshot) => {
  const minimum = Number(entity.attributes.min_temp ?? 40);
  const maximum = Number(entity.attributes.max_temp ?? 80);
  const step = Number(entity.attributes.target_temp_step ?? 1);
  return {
    min: Number.isFinite(minimum) ? minimum : 40,
    max: Number.isFinite(maximum) ? maximum : 80,
    step: Number.isFinite(step) && step > 0 ? step : 1,
  };
};

export const waterHeaterPowerCall = (entity: EntityStateSnapshot, turnOn: boolean) =>
  valueCall(entity, turnOn ? "turn_on" : "turn_off");

export const waterHeaterTemperatureCall = (
  entity: EntityStateSnapshot,
  requestedTemperature: number,
) => {
  const { min, max, step } = waterHeaterTemperatureRange(entity);
  return coalescedValueCall(entity, "set_temperature", "temperature", {
    temperature: steppedValue(requestedTemperature, min, max, step),
  });
};

export const waterHeaterOperationModeCall = (entity: EntityStateSnapshot, operationMode: string) =>
  valueCall(entity, "set_operation_mode", { operation_mode: operationMode });

export const waterHeaterAwayModeCall = (entity: EntityStateSnapshot, awayMode: boolean) =>
  valueCall(entity, "set_away_mode", { away_mode: awayMode });

export const vacuumActionCall = (
  entity: EntityStateSnapshot,
  action: "start" | "pause" | "stop" | "return_to_base",
) => valueCall(entity, action);

export const vacuumFanSpeedCall = (entity: EntityStateSnapshot, fanSpeed: string) =>
  valueCall(entity, "set_fan_speed", { fan_speed: fanSpeed });

export interface VacuumRoom {
  id: number;
  name: string;
}

const vacuumRoomList = (value: unknown): readonly VacuumRoom[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const room = candidate as Readonly<Record<string, unknown>>;
    const id = Number(room.id);
    if (!Number.isInteger(id) || seen.has(id)) return [];
    seen.add(id);
    const suppliedName = typeof room.name === "string" ? room.name.trim() : "";
    return [{ id, name: suppliedName || `Room ${id}` }];
  });
};

/** Reads the active map's rooms exposed by map-aware vacuum integrations. */
export const vacuumRooms = (entity: EntityStateSnapshot): readonly VacuumRoom[] => {
  const rooms = entity.attributes.rooms;
  if (Array.isArray(rooms)) return vacuumRoomList(rooms);
  if (!rooms || typeof rooms !== "object") return [];
  const maps = rooms as Readonly<Record<string, unknown>>;
  const selectedMap = entity.attributes.selected_map;
  if (typeof selectedMap === "string" && selectedMap in maps) {
    return vacuumRoomList(maps[selectedMap]);
  }
  const mapLists = Object.values(maps).filter(Array.isArray);
  return mapLists.length === 1 ? vacuumRoomList(mapLists[0]) : [];
};

/** Starts one or more room segments without introducing a Cabane-to-vacuum room map. */
export const vacuumRoomCleanCall = (
  entity: EntityStateSnapshot,
  segmentIds: readonly number[],
): SupportedServiceCall => ({
  domain: "dreame_vacuum",
  service: "vacuum_clean_segment",
  data: { segments: [...segmentIds] },
  target: { entity_id: entity.entityId },
});

export const lockActionCall = (
  entity: EntityStateSnapshot,
  action: "lock" | "unlock" | "open",
  code?: string,
) => valueCall(entity, action, code ? { code } : undefined);

export type AlarmAction =
  | "alarm_disarm"
  | "alarm_arm_home"
  | "alarm_arm_away"
  | "alarm_arm_night"
  | "alarm_arm_vacation"
  | "alarm_arm_custom_bypass";

export const alarmActionCall = (entity: EntityStateSnapshot, action: AlarmAction, code?: string) =>
  valueCall(entity, action, code ? { code } : undefined);

export const valveActionCall = (
  entity: EntityStateSnapshot,
  action: "open_valve" | "stop_valve" | "close_valve",
) => valueCall(entity, action);

export const valvePositionCall = (entity: EntityStateSnapshot, position: number) =>
  coalescedValueCall(entity, "set_valve_position", "position", {
    position: Math.round(clamp(position, 0, 100)),
  });

export interface SirenTurnOnParameters {
  tone?: string;
  duration?: number;
  volumeLevel?: number;
}

export const sirenPowerCall = (
  entity: EntityStateSnapshot,
  turnOn: boolean,
  parameters: SirenTurnOnParameters = {},
) => {
  const data = turnOn
    ? {
        ...(parameters.tone ? { tone: parameters.tone } : {}),
        ...(parameters.duration !== undefined ? { duration: parameters.duration } : {}),
        ...(parameters.volumeLevel !== undefined
          ? { volume_level: clamp(parameters.volumeLevel, 0, 1) }
          : {}),
      }
    : undefined;
  return valueCall(entity, turnOn ? "turn_on" : "turn_off", data);
};

export const selectOptionCall = (entity: EntityStateSnapshot, option: string) =>
  valueCall(entity, "select_option", { option });

export const numberValueRange = (entity: EntityStateSnapshot) => {
  const minimum = Number(entity.attributes.min ?? 0);
  const maximum = Number(entity.attributes.max ?? 100);
  const step = Number(entity.attributes.step ?? 1);
  return {
    min: Number.isFinite(minimum) ? minimum : 0,
    max: Number.isFinite(maximum) ? maximum : 100,
    step: Number.isFinite(step) && step > 0 ? step : 1,
  };
};

export const numberValueCall = (entity: EntityStateSnapshot, requestedValue: number) => {
  const { min, max, step } = numberValueRange(entity);
  return coalescedValueCall(entity, "set_value", "value", {
    value: steppedValue(requestedValue, min, max, step),
  });
};

export const buttonPressCall = (entity: EntityStateSnapshot) => valueCall(entity, "press");

export const mediaPlaybackCall = (entity: EntityStateSnapshot): SupportedServiceCall =>
  valueCall(entity, entity.state === "playing" ? "media_pause" : "media_play");

export const mediaVolumeCall = (entity: EntityStateSnapshot, volume: number) =>
  coalescedValueCall(entity, "volume_set", "volume", {
    volume_level: clamp(volume, 0, 1),
  });

export const availableLightEntityIds = (states: Readonly<Record<EntityId, EntityStateSnapshot>>) =>
  Object.values(states)
    .filter((entity) => entity.entityId.startsWith("light."))
    .filter((entity) => entity.available && !entity.stale)
    .map((entity) => entity.entityId)
    .sort((left, right) => left.localeCompare(right));

export const allLightsOffCall = (
  states: Readonly<Record<EntityId, EntityStateSnapshot>>,
): SupportedServiceCall | null => {
  const entityIds = availableLightEntityIds(states);
  return entityIds.length === 0
    ? null
    : {
        domain: "light",
        service: "turn_off",
        target: { entity_id: entityIds },
      };
};

export const entityDisplayValue = (entity: EntityStateSnapshot) => {
  if (entity.entityId.startsWith("event.")) {
    if (entity.stale) return "Disconnected";
    if (entity.state === "unknown") return "No event received";
    if (!entity.available) return "Unavailable";
    const timestamp = Date.parse(entity.state);
    if (!Number.isFinite(timestamp)) return "Event time unavailable";
    const eventType = entity.attributes.event_type;
    const label = typeof eventType === "string" && eventType.trim() ? eventType : "Unknown event";
    return `${label} · ${new Date(timestamp).toLocaleString()}`;
  }
  const unit = entity.attributes.unit_of_measurement;
  const value = typeof unit === "string" ? `${entity.state} ${unit}` : entity.state;
  return entity.stale ? `${value} · stale` : value;
};

export const featureEnabled = (entity: EntityStateSnapshot, flag: number) =>
  (Number(entity.attributes.supported_features) & flag) !== 0;

export const stringOptions = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
