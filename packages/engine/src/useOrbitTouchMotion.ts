import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { MathUtils, Spherical, Vector3 } from "three";
import type { OrbitControls } from "three-stdlib";

const RELEASE_WINDOW_MS = 70;
const DECAY_PER_SECOND = 14;
const MIN_PAN_PIXELS = 4;
const MIN_ROTATION_RADIANS = 0.015;
const MAX_PAN_PIXELS_PER_SECOND = 1800;
const MAX_RADIANS_PER_SECOND = 5;

type Sample = { time: number; target: Vector3; azimuth: number; polar: number };
type Glide = { pan: Vector3; azimuth: number; polar: number };

/** Keep native MapControls gestures direct, then coast from their recent motion. */
export function useOrbitTouchMotion(
  controls: RefObject<OrbitControls | null>,
  reducedMotion: boolean,
) {
  const element = useThree(
    (state) => (state.events.connected as HTMLElement | undefined) || state.gl.domElement,
  );
  const invalidate = useThree((state) => state.invalidate);
  const glide = useRef<Glide | null>(null);
  const samples = useRef<Sample[]>([]);
  const stopGlide = useCallback(() => {
    glide.current = null;
    samples.current.length = 0;
  }, []);

  useEffect(() => {
    const owner = element.ownerDocument;
    const pointers = new Set<number>();
    let gestureSize = 0;
    let lastMove = 0;
    let restoreControls: (() => void) | undefined;
    const reset = () => {
      pointers.clear();
      restoreControls?.();
      restoreControls = undefined;
    };
    const cancel = () => {
      reset();
      stopGlide();
    };
    const onDown = (event: PointerEvent) => {
      stopGlide();
      const orbit = controls.current;
      if (event.pointerType !== "touch" || !orbit?.enabled) return;
      if (!pointers.size) {
        const { dampingFactor, rotateSpeed } = orbit;
        // Native damping applies only a fraction of each move before drawing.
        orbit.dampingFactor = 1;
        // MapControls scales by height. Boost rotation on narrow portrait canvases.
        const aspect = element.clientHeight / Math.max(1, element.clientWidth);
        orbit.rotateSpeed = rotateSpeed * MathUtils.clamp(aspect, 1, 1.6);
        restoreControls = () => {
          orbit.dampingFactor = dampingFactor;
          orbit.rotateSpeed = rotateSpeed;
        };
      }
      pointers.add(event.pointerId);
      gestureSize = pointers.size;
      lastMove = event.timeStamp;
    };
    const onMove = (event: PointerEvent) => {
      const orbit = controls.current;
      if (
        reducedMotion ||
        !orbit?.enabled ||
        !pointers.has(event.pointerId) ||
        pointers.size !== gestureSize ||
        gestureSize > 2
      )
        return;
      // This listener runs before MapControls. The pose still belongs to the
      // previous move, even if several touch events arrived in one frame.
      const history = samples.current;
      history.push({
        time: lastMove,
        target: orbit.target.clone(),
        azimuth: orbit.getAzimuthalAngle(),
        polar: orbit.getPolarAngle(),
      });
      lastMove = event.timeStamp;
      while (history.length > 1 && history[1].time <= lastMove - RELEASE_WINDOW_MS) history.shift();
    };
    const onUp = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId) || pointers.size) return;
      reset();
      const orbit = controls.current;
      const from = samples.current[0];
      samples.current.length = 0;
      if (!orbit?.enabled || !from || event.timeStamp - lastMove >= RELEASE_WINDOW_MS) return;
      const seconds = Math.max(0.016, (event.timeStamp - from.time) / 1000);
      const limit = (angle: number) =>
        Math.abs(angle) < MIN_ROTATION_RADIANS
          ? 0
          : MathUtils.clamp(angle / seconds, -MAX_RADIANS_PER_SECOND, MAX_RADIANS_PER_SECOND);
      const angle = orbit.getAzimuthalAngle() - from.azimuth;
      const pan = orbit.target.clone().sub(from.target);
      const { zoom } = orbit.object;
      if (pan.length() * zoom < MIN_PAN_PIXELS) pan.set(0, 0, 0);
      glide.current = {
        pan: pan.divideScalar(seconds).clampLength(0, MAX_PAN_PIXELS_PER_SECOND / zoom),
        azimuth: limit(Math.atan2(Math.sin(angle), Math.cos(angle))),
        polar: limit(orbit.getPolarAngle() - from.polar),
      };
      invalidate();
    };
    const onCancel = (event: PointerEvent) => {
      if (pointers.has(event.pointerId)) cancel();
    };

    element.addEventListener("pointerdown", onDown, true);
    element.addEventListener("lostpointercapture", onCancel, true);
    owner.addEventListener("pointermove", onMove, true);
    owner.addEventListener("pointerup", onUp, true);
    owner.addEventListener("pointercancel", onCancel, true);
    owner.addEventListener("visibilitychange", cancel);
    owner.defaultView?.addEventListener("blur", cancel);
    return () => {
      cancel();
      element.removeEventListener("pointerdown", onDown, true);
      element.removeEventListener("lostpointercapture", onCancel, true);
      owner.removeEventListener("pointermove", onMove, true);
      owner.removeEventListener("pointerup", onUp, true);
      owner.removeEventListener("pointercancel", onCancel, true);
      owner.removeEventListener("visibilitychange", cancel);
      owner.defaultView?.removeEventListener("blur", cancel);
    };
  }, [controls, element, invalidate, reducedMotion, stopGlide]);

  const offset = useRef(new Spherical());
  const position = useRef(new Vector3());
  useFrame((_state, delta) => {
    const orbit = controls.current;
    const motion = glide.current;
    if (!motion) return;
    if (
      !orbit?.enabled ||
      !orbit.enableDamping ||
      (motion.pan.length() * orbit.object.zoom < 12 &&
        Math.abs(motion.azimuth) < 0.02 &&
        Math.abs(motion.polar) < 0.02)
    ) {
      stopGlide();
      return;
    }
    const decay = Math.exp(-delta * DECAY_PER_SECOND);
    const step = (1 - decay) / DECAY_PER_SECOND;
    const spherical = offset.current.setFromVector3(
      position.current.copy(orbit.object.position).sub(orbit.target),
    );
    spherical.theta += motion.azimuth * step;
    const polar = spherical.phi + motion.polar * step;
    spherical.phi = MathUtils.clamp(polar, orbit.minPolarAngle, orbit.maxPolarAngle);
    if (spherical.phi !== polar) motion.polar = 0;
    orbit.target.addScaledVector(motion.pan, step);
    orbit.object.position.copy(orbit.target).add(position.current.setFromSpherical(spherical));
    orbit.update();
    motion.pan.multiplyScalar(decay);
    motion.azimuth *= decay;
    motion.polar *= decay;
    invalidate();
  }, -0.5);

  return stopGlide;
}
