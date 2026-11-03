import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4 } from "three";

function cameraMoved(current: Matrix4, previous: Matrix4) {
  for (let i = 0; i < 16; i++)
    if (Math.abs(current.elements[i] - previous.elements[i]) > 1e-6) return true;
  return false;
}

/** Receives only the rendered home canvas, never dashboard UI or camera media. */
export const ScenePreviewContext = createContext<((canvas: HTMLCanvasElement) => void) | null>(
  null,
);

export function ScenePreview({ enabled }: { enabled: boolean }) {
  const capture = useContext(ScenePreviewContext);
  const invalidate = useThree((state) => state.invalidate);
  const ready = useRef(false);
  const retry = useRef<number | undefined>(undefined);
  const pose = useMemo(
    () => ({ world: new Matrix4(), projection: new Matrix4(), settledAt: 0 }),
    [],
  );
  useEffect(() => {
    ready.current = false;
    if (!enabled || !capture) return;
    const request = () => {
      ready.current = true;
      invalidate();
    };
    const first = window.setTimeout(request, 2500);
    const refresh = window.setInterval(request, 30000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(refresh);
      window.clearTimeout(retry.current);
      retry.current = undefined;
      ready.current = false;
    };
  }, [enabled, capture, invalidate]);
  // StylizedScene renders at priority 1. Copy before the drawing buffer is cleared.
  useFrame(({ gl, camera }) => {
    if (!enabled || !capture) return;
    const now = performance.now();
    if (
      cameraMoved(camera.matrixWorld, pose.world) ||
      cameraMoved(camera.projectionMatrix, pose.projection)
    ) {
      pose.world.copy(camera.matrixWorld);
      pose.projection.copy(camera.projectionMatrix);
      pose.settledAt = now + 500;
    }
    if (!ready.current) return;
    if (now < pose.settledAt) {
      // Demand rendering can stop before the camera settles. Wake once, without
      // reading pixels or encoding a thumbnail during camera gestures/damping.
      retry.current ??= window.setTimeout(() => {
        retry.current = undefined;
        invalidate();
      }, pose.settledAt - now);
      return;
    }
    ready.current = false;
    window.clearTimeout(retry.current);
    retry.current = undefined;
    capture(gl.domElement);
  }, 2);
  return null;
}
