import { useSyncExternalStore } from "react";

export const landscapes = {
  none: "None",
  countryside: "Countryside",
  "new-york": "New York",
} as const;
export type Landscape = keyof typeof landscapes;
const key = (home: string) => `cabane.landscape.v1:${home}`;
const listeners = new Set<() => void>();
const unsaved = new Map<string, Landscape>();

function read(home: string): Landscape {
  const fallback = unsaved.get(home);
  if (fallback) return fallback;
  try {
    const value = window.localStorage.getItem(key(home));
    if (value === "countryside" || value === "new-york") return value;
  } catch {
    // Storage can be unavailable inside an embedded dashboard.
  }
  return "none";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

export function useLandscape(home: string) {
  return useSyncExternalStore(
    subscribe,
    () => read(home),
    () => "none" as const,
  );
}

export function chooseLandscape(home: string, value: Landscape) {
  try {
    window.localStorage.setItem(key(home), value);
    unsaved.delete(home);
  } catch {
    unsaved.set(home, value);
  }
  listeners.forEach((notify) => notify());
}
