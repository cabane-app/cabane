import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Group } from "three";

const DESKTOP_OVERLAY_LIMIT = 10;
const COMPACT_OVERLAY_LIMIT = 6;
const COMPACT_VIEWPORT_WIDTH = 760;
const OVERLAY_COLLISION_GAP = 4;
const OVERLAY_COLLISION_HEIGHT = 48;
const RETAINED_DISTANCE_BONUS = 0.12;

interface SceneOverlayCandidate {
  readonly id: string;
  readonly screenX: number;
  readonly screenY: number;
  readonly distanceFromCenter: number;
  readonly labelWidth: number;
  readonly labelHeight?: number;
  readonly priority: number;
  readonly inViewport: boolean;
}

export const sceneOverlayLimitForWidth = (width: number) =>
  width < COMPACT_VIEWPORT_WIDTH ? COMPACT_OVERLAY_LIMIT : DESKTOP_OVERLAY_LIMIT;

const candidatesOverlap = (left: SceneOverlayCandidate, right: SceneOverlayCandidate) =>
  Math.abs(left.screenX - right.screenX) <
    (left.labelWidth + right.labelWidth) / 2 + OVERLAY_COLLISION_GAP &&
  Math.abs(left.screenY - right.screenY) <
    ((left.labelHeight ?? OVERLAY_COLLISION_HEIGHT) +
      (right.labelHeight ?? OVERLAY_COLLISION_HEIGHT)) /
      2 +
      OVERLAY_COLLISION_GAP;

export const selectSceneOverlayIds = (
  candidates: readonly SceneOverlayCandidate[],
  limit: number,
  retainedIds: ReadonlySet<string> = new Set(),
) => {
  const selected: SceneOverlayCandidate[] = [];
  const ranked = candidates
    .filter((candidate) => candidate.inViewport)
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        left.distanceFromCenter -
          (retainedIds.has(left.id) ? RETAINED_DISTANCE_BONUS : 0) -
          (right.distanceFromCenter - (retainedIds.has(right.id) ? RETAINED_DISTANCE_BONUS : 0)) ||
        left.id.localeCompare(right.id),
    );

  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    if (selected.some((visible) => candidatesOverlap(candidate, visible))) continue;
    selected.push(candidate);
  }
  return new Set(selected.map((candidate) => candidate.id));
};

interface OverlayEntry {
  id: string;
  anchor: RefObject<Group | null>;
  labelWidth: number;
  labelHeight: number;
  priority: number;
  visible: boolean | undefined;
  onVisible: (visible: boolean) => void;
}

const OverlayLayoutContext = createContext<{
  register: (entry: OverlayEntry) => () => void;
  invalidate: () => void;
} | null>(null);

/** One screen-space budget for room labels, device states and attached readings. */
export function SceneOverlayLayout({ children }: { children: ReactNode }) {
  const { invalidate } = useThree();
  const entries = useMemo(() => new Map<string, OverlayEntry>(), []);
  const retained = useRef<ReadonlySet<string>>(new Set());
  const projected = useMemo(() => new Vector3(), []);
  const register = useMemo(
    () => (entry: OverlayEntry) => {
      entries.set(entry.id, entry);
      invalidate();
      return () => {
        entries.delete(entry.id);
        invalidate();
      };
    },
    [entries, invalidate],
  );

  useFrame(({ camera, size }) => {
    const candidates: SceneOverlayCandidate[] = [];
    for (const entry of entries.values()) {
      const anchor = entry.anchor.current;
      if (!anchor) continue;
      anchor.getWorldPosition(projected).project(camera);
      candidates.push({
        id: entry.id,
        screenX: ((projected.x + 1) * size.width) / 2,
        screenY: ((1 - projected.y) * size.height) / 2,
        distanceFromCenter: Math.hypot(projected.x, projected.y),
        labelWidth: entry.labelWidth,
        labelHeight: entry.labelHeight,
        priority: entry.priority,
        inViewport:
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 1.04 &&
          Math.abs(projected.y) <= 1.08,
      });
    }
    const selected = selectSceneOverlayIds(
      candidates,
      sceneOverlayLimitForWidth(size.width),
      retained.current,
    );
    retained.current = selected;
    for (const entry of entries.values()) {
      const visible = selected.has(entry.id);
      if (entry.visible === visible) continue;
      entry.visible = visible;
      entry.onVisible(visible);
    }
  });

  const layout = useMemo(() => ({ register, invalidate }), [register, invalidate]);
  return <OverlayLayoutContext.Provider value={layout}>{children}</OverlayLayoutContext.Provider>;
}

export function useSceneOverlay<T extends HTMLElement = HTMLDivElement>({
  id,
  labelWidth,
  labelHeight,
  priority,
  enabled = true,
}: {
  id: string;
  labelWidth: number;
  labelHeight: number;
  priority: number;
  enabled?: boolean;
}) {
  const layout = useContext(OverlayLayoutContext);
  const anchorRef = useRef<Group>(null);
  const [label, setLabel] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    if (!layout || !enabled) return;
    const entry: OverlayEntry = {
      id,
      anchor: anchorRef,
      labelWidth,
      labelHeight,
      priority,
      visible: undefined,
      onVisible: setVisible,
    };
    const unregister = layout.register(entry);
    // Keep wrapped labels and multi-reading cards in the same collision geometry.
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(([measurement]) => {
            const bounds = {
              width: measurement.target.clientWidth,
              height: measurement.target.clientHeight,
            };
            if (
              !bounds.width ||
              !bounds.height ||
              (entry.labelWidth === bounds.width && entry.labelHeight === bounds.height)
            )
              return;
            if (bounds.width > 0) entry.labelWidth = bounds.width;
            if (bounds.height > 0) entry.labelHeight = bounds.height;
            layout.invalidate();
          });
    if (label) observer?.observe(label);
    return () => {
      observer?.disconnect();
      unregister();
    };
  }, [layout, id, labelWidth, labelHeight, priority, enabled, label]);
  return { anchorRef, labelRef: setLabel, visible: !layout || visible };
}
