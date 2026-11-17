export interface SunEntityState {
  state: string;
  attributes: Readonly<Record<string, unknown>>;
}

export interface SolarLightingState {
  daylight: number;
  valid: boolean;
  sunPosition: readonly [x: number, y: number, z: number];
  sunIntensity: number;
  sunColor: string;
  backgroundColor: string;
  hemisphereSkyColor: string;
  hemisphereGroundColor: string;
  hemisphereIntensity: number;
}

export type SolarLightingMode = "live" | "day" | "night";

export const isNightLighting = (
  mode: SolarLightingMode,
  sunState: SunEntityState | undefined,
  localTime: Date,
): boolean => {
  if (mode !== "live") return mode === "night";
  if (sunState?.state === "below_horizon") return true;
  if (sunState?.state === "above_horizon") return false;
  const hour = localTime.getHours();
  return hour >= 18 || hour < 6;
};
type RgbColor = readonly [red: number, green: number, blue: number];

const SUN_DISTANCE = 18;
const FULL_DAY_ELEVATION = 7.7;
const FULL_NIGHT_ELEVATION = -2.5;
const MAX_SUN_INTENSITY = 2.8;
const NIGHT_BACKGROUND: RgbColor = [32, 45, 67];
const DAY_BACKGROUND: RgbColor = [232, 224, 207];
const NIGHT_SKY: RgbColor = [194, 204, 212];
const DAY_SKY: RgbColor = [236, 244, 255];
const NIGHT_GROUND: RgbColor = [89, 99, 107];
const DAY_GROUND: RgbColor = [161, 145, 122];
const HORIZON_SUN: RgbColor = [255, 174, 112];
const DAY_SUN: RgbColor = [255, 231, 197];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));
const smoothstep = (value: number) => {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};
const mix = (start: number, end: number, progress: number) => start + (end - start) * progress;
const mixColor = (start: RgbColor, end: RgbColor, progress: number) => {
  const channels = start.map((channel, index) => Math.round(mix(channel, end[index], progress)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};
const finiteNumber = (value: unknown) => {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const FALLBACK_LIGHTING: SolarLightingState = {
  daylight: 0.63,
  valid: false,
  sunPosition: [-8, 14, 10],
  sunIntensity: 2.25,
  sunColor: "#fff0d7",
  backgroundColor: "#dce8ea",
  hemisphereSkyColor: "#ecf4ff",
  hemisphereGroundColor: "#768b93",
  hemisphereIntensity: 0.95,
};

export const deriveSolarLighting = (
  sunState: SunEntityState | undefined,
  mode: SolarLightingMode = "live",
  northAngleDegrees = 0,
  studioDaylight = true,
): SolarLightingState => {
  const effective =
    mode === "live"
      ? sunState
      : {
          state: mode === "day" ? "above_horizon" : "below_horizon",
          attributes: {
            azimuth: studioDaylight ? 228 : 180,
            elevation: mode === "day" ? (studioDaylight ? 42 : 35) : -8,
          },
        };
  const azimuth = finiteNumber(effective?.attributes.azimuth);
  const elevation = finiteNumber(effective?.attributes.elevation);
  if (azimuth === null || elevation === null) return FALLBACK_LIGHTING;
  const normalizedAzimuth = ((azimuth % 360) + 360) % 360;
  const clampedElevation = clamp(elevation, -90, 90);
  const azimuthRadians = ((normalizedAzimuth + northAngleDegrees) * Math.PI) / 180;
  const elevationRadians = (clampedElevation * Math.PI) / 180;
  const horizontalDistance = SUN_DISTANCE * Math.cos(elevationRadians);
  const dayProgress = smoothstep(
    (clampedElevation - FULL_NIGHT_ELEVATION) / (FULL_DAY_ELEVATION - FULL_NIGHT_ELEVATION),
  );
  const sunlightProgress =
    clampedElevation <= 0 ? 0 : smoothstep(clampedElevation / FULL_DAY_ELEVATION);
  return {
    daylight: dayProgress,
    valid: true,
    sunPosition: [
      horizontalDistance * Math.sin(azimuthRadians),
      SUN_DISTANCE * Math.sin(elevationRadians),
      -horizontalDistance * Math.cos(azimuthRadians),
    ],
    sunIntensity: MAX_SUN_INTENSITY * sunlightProgress,
    sunColor: mixColor(HORIZON_SUN, studioDaylight ? DAY_SUN : [255, 241, 218], sunlightProgress),
    backgroundColor: mixColor(
      NIGHT_BACKGROUND,
      studioDaylight ? DAY_BACKGROUND : [220, 232, 234],
      dayProgress,
    ),
    hemisphereSkyColor: mixColor(NIGHT_SKY, DAY_SKY, dayProgress),
    hemisphereGroundColor: mixColor(
      NIGHT_GROUND,
      studioDaylight ? DAY_GROUND : [118, 139, 147],
      dayProgress,
    ),
    hemisphereIntensity: mix(0.78, 1.05, dayProgress),
  };
};

/** One decision for rendering, night-only devices, and the preferences source label. */
export const resolveSolarLighting = (
  mode: SolarLightingMode,
  sunState: (SunEntityState & { available?: boolean; stale?: boolean }) | undefined,
  localTime: Date,
) => {
  const usable =
    sunState?.available !== false &&
    !sunState?.stale &&
    (sunState?.state === "above_horizon" || sunState?.state === "below_horizon") &&
    finiteNumber(sunState.attributes.azimuth) !== null &&
    finiteNumber(sunState.attributes.elevation) !== null;
  const effectiveMode =
    mode === "live" && !usable
      ? isNightLighting("live", undefined, localTime)
        ? "night"
        : "day"
      : mode;
  return {
    mode: effectiveMode,
    night: isNightLighting(effectiveMode, sunState, localTime),
    source: mode === "live" ? (usable ? "Home Assistant" : "Local time") : "Preview",
  };
};
