import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserUuid, useCabaneDom } from "@cabane/engine";
import type { useEditorWorkspace } from "../editor-preview/useEditorWorkspace";
import { decodeReferenceImage } from "./decode-reference-image";
import {
  calibrateReference,
  defaultReferencePreference,
  type ReferencePlan,
  type ReferencePoint,
  type ReferencePreference,
} from "./reference-plan";
export interface ReferenceViewport {
  center: ReferencePoint;
  width: number;
  height: number;
}
export function useReferencePlan(
  workspace: ReturnType<typeof useEditorWorkspace>,
  floorId: string,
  enabled: boolean,
  busy: boolean,
) {
  const { events } = useCabaneDom();
  const storage = workspace.referenceStorage;
  const {
    preferences: storagePreferences,
    setPreference: storageSetPreference,
    ready: storageReady,
    addAsset: storageAddAsset,
  } = storage;
  const input = useRef<HTMLInputElement>(null);
  const saved = workspace.snapshot.references?.[floorId];
  const preference = storagePreferences[floorId] ?? defaultReferencePreference;
  const [session, setSession] = useState<{ floorId: string; plan: ReferencePlan } | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [points, setPoints] = useState<readonly ReferencePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const viewport = useRef<ReferenceViewport>({ center: [0, 0], width: 15, height: 10 });
  const generation = useRef(0);
  const initialPreference = useRef<{ floorId: string; value: ReferencePreference } | null>(null);
  const gestureCancel = useRef<(() => void) | null>(null);
  const plan = session?.floorId === floorId ? session.plan : saved;
  const adjusting = Boolean(enabled && session?.floorId === floorId);
  const cancel = useCallback(() => {
    gestureCancel.current?.();
    gestureCancel.current = null;
    if (initialPreference.current)
      storageSetPreference(initialPreference.current.floorId, initialPreference.current.value);
    initialPreference.current = null;
    setSession(null);
    setCalibrating(false);
    setPoints([]);
    setError(null);
  }, [storageSetPreference]);
  useEffect(() => {
    generation.current = generation.current + 1;
    cancel();
    setLoading(false);
    return () => {
      generation.current = generation.current + 1;
    };
  }, [enabled, floorId, cancel]);
  const begin = (scale = false) => {
    if (!plan || busy || !storageReady) return;
    initialPreference.current ??= { floorId, value: preference };
    setSession({ floorId, plan });
    setExpanded(true);
    setCalibrating(scale);
    setPoints([]);
    setError(null);
    storageSetPreference(floorId, { ...preference, visible: true });
  };
  const update = (next: ReferencePlan) => {
    if (
      !Number.isFinite(next.width) ||
      next.width < 0.01 ||
      !Number.isFinite(next.angle) ||
      !next.center.every(Number.isFinite)
    ) {
      setError("Enter a positive width of at least 0.01 m and finite coordinates.");
      return;
    }
    setSession({ floorId, plan: next });
    setError(null);
  };
  const upload = async (files: FileList | readonly File[]) => {
    if (!enabled || busy || adjusting || !storageReady) return;
    if (files.length !== 1) {
      setError("Choose one reference image for this floor.");
      return;
    }
    const file = files[0];
    const ticket = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const decoded = await decodeReferenceImage(file);
      if (ticket !== generation.current) return;
      const assetId = createBrowserUuid();
      storageAddAsset(assetId, decoded.blob);
      const view = viewport.current;
      const width = 0.8 * Math.min(view.width, (view.height * decoded.width) / decoded.height);
      initialPreference.current = { floorId, value: preference };
      setSession({
        floorId,
        plan: {
          assetId,
          name: file.name,
          pixelWidth: decoded.width,
          pixelHeight: decoded.height,
          center: view.center,
          width,
          angle: 0,
        },
      });
      setExpanded(true);
      setCalibrating(false);
      setPoints([]);
      storageSetPreference(floorId, defaultReferencePreference);
    } catch (cause) {
      if (ticket === generation.current)
        setError(cause instanceof Error ? cause.message : "Could not open this image.");
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  };
  const done = () => {
    if (!session || gestureCancel.current) return;
    workspace.commitReferences({ ...workspace.snapshot.references, [floorId]: session.plan });
    initialPreference.current = null;
    cancel();
  };
  const calibrate = (distance: number) => {
    if (!plan || points.length !== 2) return;
    try {
      const next = calibrateReference(plan, points[0], points[1], distance);
      if (!Number.isFinite(next.width) || next.width < 0.01 || !next.center.every(Number.isFinite))
        throw new Error(
          "This scale is outside the supported range. The image width must be at least 0.01 m.",
        );
      update(next);
      setCalibrating(false);
      setPoints([]);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const pickPoint = (point: ReferencePoint) => {
    if (point.some((value) => value < 0 || value > 1)) return;
    if (
      points.length === 1 &&
      Math.hypot(
        (point[0] - points[0][0]) * (plan?.pixelWidth ?? 1),
        (point[1] - points[0][1]) * (plan?.pixelHeight ?? 1),
      ) < 1
    ) {
      setError("Choose two different points on the image.");
      return;
    }
    setError(null);
    setPoints((previous) => (previous.length < 2 ? [...previous, point] : [point]));
  };
  useEffect(() => {
    if (!adjusting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Numeric fields own Escape to cancel their pending text first.
      if (event.target instanceof HTMLElement && event.target.closest("input")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (gestureCancel.current) {
        gestureCancel.current();
        gestureCancel.current = null;
      } else cancel();
    };
    events.addEventListener("keydown", onKey, true);
    return () => events.removeEventListener("keydown", onKey, true);
  }, [adjusting, cancel, events]);
  return {
    input,
    openPicker: () => {
      if (!busy && storageReady) {
        setExpanded(true);
        input.current?.click();
      }
    },
    plan,
    preference,
    adjusting,
    expanded,
    setExpanded,
    loading,
    error,
    storage,
    viewport,
    gestureCancel,
    points,
    calibrating,
    disabled: busy || loading || !storageReady,
    begin,
    update,
    cancel,
    done,
    upload,
    calibrate,
    pickPoint,
    remove: () => {
      workspace.commitReferences(
        Object.fromEntries(
          Object.entries(workspace.snapshot.references ?? {}).filter(([id]) => id !== floorId),
        ),
      );
      cancel();
    },
    setPreference: (change: Partial<typeof preference>) =>
      storageSetPreference(floorId, { ...preference, ...change }),
  };
}
export type ReferencePlanController = ReturnType<typeof useReferencePlan>;
