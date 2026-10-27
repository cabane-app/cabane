import { isRoomType } from "../room-types";
import type {
  DeviceDomain,
  DeviceModelDefinition,
  DeviceModelRegistry,
  FurnishingModelDefinition,
  FurnishingModelRegistry,
  ManifestIssue,
  PlanPoint,
} from "../types";

export type RawObject = Record<string, unknown>;

export interface HomeManifestValidationOptions {
  deviceModels?: DeviceModelRegistry;
  furnishingModels?: FurnishingModelRegistry;
}

export interface ValidationContext {
  input: RawObject;
  options: HomeManifestValidationOptions;
  ids: Map<string, string>;
}

export type ValidationRule<T> = (value: T, context: ValidationContext) => readonly ManifestIssue[];

export const combineRules =
  <T>(...rules: readonly ValidationRule<T>[]): ValidationRule<T> =>
  (value, context) =>
    rules.flatMap((rule) => rule(value, context));

export const createValidationContext = (
  input: RawObject,
  options: HomeManifestValidationOptions,
): ValidationContext => ({ input, options, ids: new Map() });

export const issue = (
  code: string,
  path: string,
  message: string,
  severity: ManifestIssue["severity"] = "fatal",
): ManifestIssue => ({ code, path, message, severity });

export const isObject = (value: unknown): value is RawObject =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const isPlanPoint = (value: unknown): value is PlanPoint =>
  Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber);

export const isPolygon = (
  value: unknown,
): value is [PlanPoint, PlanPoint, PlanPoint, ...PlanPoint[]] =>
  Array.isArray(value) && value.length >= 3 && value.every(isPlanPoint);

export const registerId = (
  context: ValidationContext,
  id: unknown,
  path: string,
): readonly ManifestIssue[] => {
  if (!isNonEmptyString(id)) {
    return [issue("id.required", path, "A stable non-empty ID is required.")];
  }
  const prior = context.ids.get(id);
  if (prior) {
    return [issue("id.duplicate", path, `ID "${id}" is already used at ${prior}.`)];
  }
  context.ids.set(id, path);
  return [];
};

export const DOMAINS = new Set<DeviceDomain>([
  "light",
  "switch",
  "input_boolean",
  "climate",
  "cover",
  "fan",
  "media_player",
  "humidifier",
  "water_heater",
  "vacuum",
  "lock",
  "alarm_control_panel",
  "valve",
  "siren",
  "select",
  "number",
  "button",
  "camera",
  "sensor",
  "binary_sensor",
  "event",
]);

export const STABLE_MODELS = new Set([
  "indoor-ac",
  "washing-machine",
  "tumble-dryer",
  "dishwasher",
  "oven",
  "water-heater",
  "speaker",
  "television",
  "under-cabinet-led-strip",
  "compact-wall-television",
  "wall-television",
  "camera-screen",
  "connected-frame-oak",
  "connected-frame-black",
  "floor-lamp",
  "rattan-bell-pendant",
  "round-globe-wall-lamp",
  "wall-reading-spot",
  "oak-wall-uplight",
  "six-globe-ceiling-lamp",
  "astro-parallel-wall-light",
  "tubular-wall-lamp",
  "clip-reading-lamp",
  "terracotta-pendant",
  "white-dome-pendant",
  "low-garden-lantern",
  "pergola-string-lights",
  "garden-lantern-pole",
  "table-lamp",
  "woven-pendant",
  "children-pendant",
  "wall-switch",
  "opening-contact",
  "thermometer",
  "motion-sensor",
  "motorized-blind",
  "leak-sensor",
  "ceiling-fan",
  "table-fan",
  "pedestal-fan",
  "heated-towel-rail",
  "smart-panel-radiator",
  "smart-thermostat",
  "smart-plug",
  "ceiling-light",
  "recessed-downlight",
  "wall-sconce",
  "illuminated-round-mirror",
  "motorized-curtain",
  "video-doorbell",
  "indoor-security-camera",
  "smoke-alarm",
  "carbon-monoxide-alarm",
  "humidity-sensor",
  "air-quality-monitor",
  "energy-monitor",
  "air-purifier",
  "bathroom-extractor-fan",
  "refrigerator",
  "smart-power-strip",
  "humidifier-dehumidifier",
  "robot-vacuum",
  "smart-lock",
  "alarm-keypad",
  "rotating-sprinkler",
  "smart-hose-timer",
  "soil-moisture-sensor",
  "pop-up-sprinkler",
  "motorized-valve",
  "siren",
  "smart-button",
  "built-in-microwave",
  "microwave",
  "coffee-maker",
  "electric-kettle",
  "freezer",
  "pet-feeder",
  "weather-station",
  "compact-car",
  "electric-sedan",
  "pickup-truck",
]);

export const extensionHas = (
  input: RawObject,
  registry: "furnishingModels" | "roomFurnishings" | "deviceModels" | "openingModels",
  key: string,
) =>
  isObject(input.extensions) &&
  isObject(input.extensions[registry]) &&
  Object.hasOwn(input.extensions[registry], key);

const PLACEMENT_KINDS = new Set(["absolute", "wall", "ceiling"]);
const RESIZE_AXES = new Set(["width", "height", "depth"]);

const isPositiveSize = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((dimension) => isFiniteNumber(dimension) && dimension > 0);

const isResizePolicy = (value: unknown): boolean => {
  if (!isObject(value)) return false;
  if (["fixed", "uniform", "planar"].includes(String(value.kind))) return true;
  if (value.kind === "axes") {
    return (
      Array.isArray(value.axes) &&
      value.axes.length > 0 &&
      value.axes.every((axis) => RESIZE_AXES.has(String(axis))) &&
      new Set(value.axes).size === value.axes.length
    );
  }
  return value.kind === "custom" && typeof value.normalize === "function";
};

const isSceneModelDefinition = (value: unknown): value is RawObject => {
  if (
    !isObject(value) ||
    typeof value.component !== "function" ||
    !isNonEmptyString(value.label) ||
    !isNonEmptyString(value.category) ||
    !isRoomType(value.defaultRoomType) ||
    !isPositiveSize(value.defaultSize) ||
    !PLACEMENT_KINDS.has(String(value.preferredPlacement)) ||
    (value.placementEnvironment !== undefined &&
      value.placementEnvironment !== "outdoor" &&
      value.placementEnvironment !== "indoor-outdoor") ||
    !isResizePolicy(value.resizePolicy) ||
    !isObject(value.bounds) ||
    !isObject(value.complexity) ||
    typeof value.outlineContact !== "boolean"
  )
    return false;
  const min = value.bounds.min;
  const max = value.bounds.max;
  if (value.windowFit !== undefined) {
    const fit = value.windowFit;
    if (
      !isObject(fit) ||
      ![fit.openingWidthRatio, fit.openingHeightRatio].every(
        (ratio) => isFiniteNumber(ratio) && ratio > 0 && ratio <= 1,
      ) ||
      !isFiniteNumber(fit.depthOffsetMeters) ||
      fit.depthOffsetMeters < 0
    )
      return false;
  }
  return (
    Array.isArray(min) &&
    min.length === 3 &&
    min.every(isFiniteNumber) &&
    Array.isArray(max) &&
    max.length === 3 &&
    max.every(isFiniteNumber) &&
    min.every((coordinate, index) => coordinate <= max[index]) &&
    Number.isInteger(value.complexity.visibleMeshes) &&
    (value.complexity.visibleMeshes as number) >= 0 &&
    Number.isInteger(value.complexity.triangles) &&
    (value.complexity.triangles as number) >= 0
  );
};

export const isFurnishingModelDefinition = (value: unknown): value is FurnishingModelDefinition =>
  isSceneModelDefinition(value);

export const isDeviceModelDefinition = (value: unknown): value is DeviceModelDefinition => {
  if (
    !isSceneModelDefinition(value) ||
    !Array.isArray(value.supportedDomains) ||
    value.supportedDomains.length === 0 ||
    !value.supportedDomains.every((domain) => DOMAINS.has(domain as DeviceDomain)) ||
    !["surface", "wall"].includes(String(value.mountKind)) ||
    !isObject(value.interaction)
  )
    return false;
  return (
    (value.interaction.target === undefined ||
      ["device-dashboard", "camera-viewer"].includes(
        typeof value.interaction.target === "string" ? value.interaction.target : "",
      )) &&
    (value.liveMedia === undefined ||
      (isObject(value.liveMedia) &&
        value.liveMedia.kind === "camera-stream" &&
        value.liveMedia.slotRole === "primary" &&
        (value.supportedDomains as unknown[]).includes("camera"))) &&
    (value.sceneLight === undefined ||
      (isObject(value.sceneLight) &&
        Array.isArray(value.sceneLight.position) &&
        value.sceneLight.position.length === 3 &&
        value.sceneLight.position.every(isFiniteNumber) &&
        isNonEmptyString(value.sceneLight.color) &&
        isFiniteNumber(value.sceneLight.maxIntensity) &&
        value.sceneLight.maxIntensity > 0 &&
        isFiniteNumber(value.sceneLight.distance) &&
        value.sceneLight.distance > 0 &&
        (value.supportedDomains as unknown[]).includes("light"))) &&
    isFiniteNumber(value.interaction.tapTolerancePixels) &&
    value.interaction.tapTolerancePixels > 0
  );
};

export const extensionDefinition = (
  input: RawObject,
  key: string,
): DeviceModelDefinition | undefined => {
  if (!isObject(input.extensions) || !isObject(input.extensions.deviceModels)) return undefined;
  if (!Object.hasOwn(input.extensions.deviceModels, key)) return undefined;
  const candidate = input.extensions.deviceModels[key];
  return isDeviceModelDefinition(candidate) ? candidate : undefined;
};
