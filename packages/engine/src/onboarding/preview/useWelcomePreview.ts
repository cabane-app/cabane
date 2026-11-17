import { useCallback, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "../../scene-input-preferences";
import type { HomeManifest } from "../../types";
import { createWelcomeWalkLoop } from "./welcome-walk-loop";

export type WelcomePreviewMode = "orbit" | "walk";
type OrbitStage = "Ground floor" | "Upstairs" | "Roof";

const ORBIT_SECONDS = 12;
const FLOOR_SECONDS = ORBIT_SECONDS / 3;
const LAMP_DAYLIGHT = 0.35;

function timeLapseProgress(progress: number, from: number, until: number) {
  const t = Math.max(0, Math.min(1, (progress - from) / (until - from)));
  return t * t * (3 - 2 * t);
}

export function useWelcomePreview(manifest: HomeManifest) {
  const reducedMotion = useReducedMotion();
  const [selectedMode, selectMode] = useState<WelcomePreviewMode>("orbit");
  const [playingOverride, setPlayingOverride] = useState<boolean | null>(null);
  const [walkBlocked, setWalkBlocked] = useState(false);
  const [orbitStage, setOrbitStage] = useState<OrbitStage>("Ground floor");
  const [night, setNight] = useState(false);
  const elapsed = useRef(0);
  const daylightRef = useRef(1);
  const startingDaylight = useRef(1);
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
    startingDaylight.current = daylightRef.current;
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
    const progress = next / duration;
    if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
    const dusk = mode === "walk";
    const time = timeLapseProgress(progress, dusk ? 0.22 : 0.15, 0.75);
    const start = startingDaylight.current;
    daylightRef.current = start + ((dusk ? 0 : 1) - start) * time;
    const lampsOn = daylightRef.current <= LAMP_DAYLIGHT;
    if (lampsOn !== night) setNight(lampsOn);
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
    daylightRef,
    night,
    reducedMotion,
  };
}
