import type { RoomStatusMap } from "./model";

export const overlayOptions = [
  ["temperature", "Temperature"],
  ["humidity", "Humidity"],
  ["aqi", "Air quality (AQI)"],
  ["heating", "Heating"],
  ["cooling", "Cooling"],
  ["lighting", "Lights"],
  ["presence", "Presence"],
  ["doorOpen", "Open doors"],
] as const;

export type OverlayPreferences = Record<(typeof overlayOptions)[number][0], boolean>;
const storageKey = "cabane.room-overlays.preferences.v1";

export function loadOverlayPreferences(): OverlayPreferences {
  let stored: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    if (value && typeof value === "object" && !Array.isArray(value))
      stored = value as Record<string, unknown>;
  } catch {
    /* Defaults also work without browser storage. */
  }
  return Object.fromEntries(
    overlayOptions.map(([key]) => [key, stored[key] !== false]),
  ) as OverlayPreferences;
}

export function saveOverlayPreferences(value: OverlayPreferences): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* Keep session preferences when storage is unavailable. */
  }
}

export function filterOverlayStatuses(
  statuses: RoomStatusMap,
  preferences: OverlayPreferences,
): RoomStatusMap {
  return Object.fromEntries(
    Object.entries(statuses).map(([id, summary]) => {
      const visible = { ...summary };
      for (const [key] of overlayOptions) {
        if (preferences[key]) continue;
        if (key === "heating" || key === "cooling" || key === "doorOpen") visible[key] = false;
        else delete visible[key];
      }
      return [id, visible];
    }),
  );
}
