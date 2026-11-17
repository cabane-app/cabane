import { useSyncExternalStore } from "react";

const updated = {
  lighting: true,
  contact: true,
  finishes: true,
  joinery: true,
  grounds: true,
  framing: true,
};

export type GraphicsFeature = keyof typeof updated;
type GraphicsFeatures = Readonly<Record<GraphicsFeature, boolean>>;
const features = Object.keys(updated) as GraphicsFeature[];
const key = "cabane.dev.graphics.v1";
const listeners = new Set<() => void>();
let current: GraphicsFeatures | undefined;

function read(): GraphicsFeatures {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(key) ?? "null",
    ) as Partial<GraphicsFeatures> | null;
    const next = { ...updated };
    for (const id of features) next[id] = stored?.[id] !== false;
    return next;
  } catch {
    return current ?? updated;
  }
}

const snapshot = () => (current ??= read());
function onStorage(event: StorageEvent) {
  if (event.key !== key && event.key !== null) return;
  current = read();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  if (!listeners.size && typeof window !== "undefined") {
    current = read();
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && typeof window !== "undefined")
      window.removeEventListener("storage", onStorage);
  };
}

export function setGraphicsFeatures(change: Partial<GraphicsFeatures>) {
  if (!import.meta.env.DEV) return;
  current = { ...snapshot(), ...change };
  try {
    window.localStorage.setItem(key, JSON.stringify(current));
  } catch {
    // In-memory controls remain available in browsers with storage disabled.
  }
  listeners.forEach((listener) => listener());
}

export function setAllGraphicsFeatures(enabled: boolean) {
  const change = { ...updated };
  for (const id of features) change[id] = enabled;
  setGraphicsFeatures(change);
}

const useDevelopmentFeatures = () => useSyncExternalStore(subscribe, snapshot, () => updated);
export const useGraphicsFeatures = import.meta.env.DEV ? useDevelopmentFeatures : () => updated;

function useDevelopmentFeature(id: GraphicsFeature) {
  return useSyncExternalStore(
    subscribe,
    () => snapshot()[id],
    () => true,
  );
}
export const useGraphicsFeature: (id: GraphicsFeature) => boolean = import.meta.env.DEV
  ? useDevelopmentFeature
  : () => true;
