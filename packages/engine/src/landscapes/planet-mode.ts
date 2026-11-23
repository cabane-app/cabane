import { useSyncExternalStore } from "react";

const key = (home: string) => `cabane.landscape.v1:${home}`;
const DEFAULT_PLANET_MODE = true;
const listeners = new Set<() => void>();
const unsaved = new Map<string, boolean>();

function read(home: string): boolean {
  const fallback = unsaved.get(home);
  if (fallback !== undefined) return fallback;
  try {
    const value = window.localStorage.getItem(key(home));
    // Existing homes used the landscape name before Planet mode became a switch.
    return value === null ? DEFAULT_PLANET_MODE : value === "countryside" || value === "true";
  } catch {
    // Storage can be unavailable inside an embedded dashboard.
  }
  return DEFAULT_PLANET_MODE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

export function usePlanetMode(home: string) {
  return useSyncExternalStore(
    subscribe,
    () => read(home),
    () => DEFAULT_PLANET_MODE,
  );
}

export function setPlanetMode(home: string, value: boolean) {
  try {
    window.localStorage.setItem(key(home), String(value));
    unsaved.delete(home);
  } catch {
    unsaved.set(home, value);
  }
  listeners.forEach((notify) => notify());
}
