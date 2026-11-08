import { useCallback, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "../../scene-input-preferences";
import type { HomeManifest } from "../../types";
import { createWelcomeWalkLoop } from "./welcome-walk-loop";

export type WelcomePreviewMode = "orbit" | "walk";
type OrbitStage = "Ground floor" | "Upstairs" | "Roof";

const ORBIT_SECONDS = 12;
const FLOOR_SECONDS = ORBIT_SECONDS / 3;

export function useWelcomePreview(manifest: HomeManifest) {
  const reducedMotion = useReducedMotion();
  const [selectedMode, selectMode] = useState<WelcomePreviewMode>("walk");
  const [playingOverride, setPlayingOverride] = useState<boolean | null>(null);
  const [walkBlocked, setWalkBlocked] = useState(false);
  const [orbitStage, setOrbitStage] = useState<OrbitStage>("Ground floor");
  const elapsed = useRef(0);
  const progressRef = useRef<HTMLSpanElement>(null);
  const ground = manifest.floors.find((floor) => !floor.belowGround) ?? manifest.floors[0];
  const upper = manifest.floors.filter((floor) => !floor.belowGround).at(-1) ?? ground;
  const loop = useMemo(
    () => (ground ? createWelcomeWalkLoop(manifest, ground) : null),
    [ground, manifest],
  );
  const walkAvailable = Boolean(loop) && !walkBlocked;
  const mode = walkAvailable ? selectedMode : "orbit";
  const playing = playingOverride ?? !reducedMotion;
  const pause = useCallback(() => setPlayingOverride(false), []);
  const resetProgress = useCallback(() => {
    elapsed.current = 0;
    if (progressRef.current) progressRef.current.style.transform = "scaleX(0)";
    setOrbitStage("Ground floor");
  }, []);
  const rejectWalk = useCallback(() => {
    setWalkBlocked(true);
    selectMode("orbit");
    resetProgress();
  }, [resetProgress]);
  const setMode = (next: WelcomePreviewMode) => {
    if (next === mode || (next === "walk" && !walkAvailable)) return;
    resetProgress();
    selectMode(next);
  };
  const advance = (seconds: number) => {
    const duration = mode === "walk" && loop ? loop.durationSeconds : ORBIT_SECONDS;
    const next = Math.min(elapsed.current + seconds, duration);
    elapsed.current = next;
    if (progressRef.current) progressRef.current.style.transform = `scaleX(${next / duration})`;
    if (next >= duration) {
      if (walkAvailable) setMode(mode === "walk" ? "orbit" : "walk");
      else resetProgress();
    } else if (mode === "orbit") {
      const stage =
        next >= 2 * FLOOR_SECONDS
          ? "Roof"
          : next >= FLOOR_SECONDS && upper !== ground
            ? "Upstairs"
            : "Ground floor";
      if (stage !== orbitStage) setOrbitStage(stage);
    }
    return next;
  };
  return {
    mode,
    orbitStage,
    playing,
    setMode,
    togglePlaying: () => setPlayingOverride(!playing),
    pause,
    rejectWalk,
    walkAvailable,
    loop,
    ground,
    upper,
    advance,
    progressRef,
    reducedMotion,
  };
}
