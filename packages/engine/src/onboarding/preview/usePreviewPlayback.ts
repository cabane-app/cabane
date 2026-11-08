import { useThree } from "@react-three/fiber";
import { useEffect, useEffectEvent } from "react";

const PREVIEW_FRAME_MS = 1000 / 30;

/** Schedule camera frames only while the welcome scene is visible and playing. */
export function usePreviewPlayback(playing: boolean, advance: (seconds: number) => void) {
  const invalidate = useThree((state) => state.invalidate);
  const tick = useEffectEvent((seconds: number) => {
    advance(seconds);
    invalidate();
  });
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      tick(Math.min((now - previous) / 1000, 0.1));
      previous = now;
    }, PREVIEW_FRAME_MS);
    return () => clearInterval(timer);
  }, [playing]);
}
