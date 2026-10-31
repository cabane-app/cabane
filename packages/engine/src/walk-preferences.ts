import type { SolarLightingMode } from "./lighting";

const WALK_PREFERENCES_KEY = "cabane.walk.preferences.v1";

function loadPreferences(): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(WALK_PREFERENCES_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function savePreferences(next: Record<string, unknown>): void {
  try {
    window.localStorage.setItem(WALK_PREFERENCES_KEY, JSON.stringify(next));
  } catch {
    /* Keep the current session setting when storage is unavailable. */
  }
}

export function loadInvertYAxis(): boolean {
  return loadPreferences().invertYAxis === true;
}

export function saveInvertYAxis(value: boolean): void {
  savePreferences({ ...loadPreferences(), invertYAxis: value });
}

export function loadLightingMode(): SolarLightingMode {
  const mode = loadPreferences().lightingMode;
  return mode === "day" || mode === "night" ? mode : "live";
}

export function saveLightingMode(mode: SolarLightingMode): void {
  savePreferences({ ...loadPreferences(), lightingMode: mode });
}
