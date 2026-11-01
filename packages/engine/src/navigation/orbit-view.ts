import { MAX_ORTHOGRAPHIC_ZOOM, MIN_ORBIT_ZOOM } from "./camera-zoom";
import type { OrbitControls } from "three-stdlib";
import { useRef, useState, useSyncExternalStore } from "react";

export interface SavedOrbitView {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  zoom: number;
  viewport: readonly [number, number];
}
interface Preference {
  version: 1;
  locked: boolean;
  pose: SavedOrbitView | null;
}
const memory = new Map<string, Preference>();
const listeners = new Set<() => void>();
export const orbitViewKey = (home: string, floor: string) =>
  `cabane.orbit-view.v1:${JSON.stringify([home, floor])}`;
const vector = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 100000);
export function readOrbitView(key: string): Preference {
  const cached = memory.get(key);
  if (cached) return cached;
  let preference: Preference = { version: 1, locked: false, pose: null };
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as Preference | null;
    if (value?.version === 1 && typeof value.locked === "boolean") {
      const p = value.pose;
      const valid =
        p &&
        vector(p.position) &&
        vector(p.target) &&
        Math.hypot(...p.position.map((n, i) => n - p.target[i])) > 0.01 &&
        Number.isFinite(p.zoom) &&
        p.zoom >= MIN_ORBIT_ZOOM &&
        p.zoom <= MAX_ORTHOGRAPHIC_ZOOM &&
        Array.isArray(p.viewport) &&
        p.viewport.length === 2 &&
        p.viewport.every((n) => Number.isFinite(n) && n > 0);
      preference = { version: 1, locked: value.locked, pose: valid ? p : null };
    }
  } catch {
    /* Private/blocked storage leaves navigation usable. */
  }
  memory.set(key, preference);
  return preference;
}
export function writeOrbitView(
  key: string,
  update: Partial<Pick<Preference, "pose" | "locked">>,
  persist = true,
) {
  const next = { ...readOrbitView(key), ...update };
  memory.set(key, next);
  try {
    if (persist) localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* Retry on the next change. */
  }
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function useOrbitViewLock(key: string) {
  const locked = useSyncExternalStore(
    subscribe,
    () => readOrbitView(key).locked,
    () => false,
  );
  return [locked, (value: boolean) => writeOrbitView(key, { locked: value })] as const;
}
export function fitSavedOrbitView(
  pose: SavedOrbitView,
  width: number,
  height: number,
): SavedOrbitView {
  width = Math.max(1, width);
  height = Math.max(1, height);
  return {
    ...pose,
    zoom: Math.max(
      MIN_ORBIT_ZOOM,
      Math.min(
        MAX_ORTHOGRAPHIC_ZOOM,
        pose.zoom * Math.min(width / pose.viewport[0], height / pose.viewport[1]),
      ),
    ),
    viewport: [width, height],
  };
}
export interface OrbitViewActions {
  topDown: () => void;
  reset: () => void;
}

export function useDashboardOrbitView(home: string, floor: string) {
  const [controls, setControls] = useState<OrbitControls | null>(null);
  const viewKey = orbitViewKey(home, floor);
  const [locked, setLocked] = useOrbitViewLock(viewKey);
  const viewActions = useRef<OrbitViewActions | null>(null);
  return {
    locked,
    controls,
    cameraProps: { viewKey, locked, viewActions, controlsRef: setControls },
    menuProps: {
      viewLocked: locked,
      onToggleViewLock: () => setLocked(!locked),
      onTopDown: () => viewActions.current?.topDown(),
      onResetView: () => viewActions.current?.reset(),
    },
  };
}
